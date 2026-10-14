import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

export const ACTIVE_MS = 60_000;
// Generous envelope above current maximum production and fatigue-limited tapping.
export const SCORE_RATE = 10_000_000;
export const SCORE_BURST = 40_000_000;
export function createApp(databasePath: string, distPath: string, now = Date.now) {
  const db = new DatabaseSync(databasePath);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY, token TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      best INTEGER NOT NULL DEFAULT 0, seen INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS players_best ON players(best DESC);
    CREATE INDEX IF NOT EXISTS players_seen ON players(seen);`);
  // Additive migration preserves names, cookies and historical records.
  const columns = new Set(db.prepare('PRAGMA table_info(players)').all().map(row => row.name));
  for (const [column, definition] of [
    ['suspected', 'INTEGER NOT NULL DEFAULT 0'],
    ['checked_at', 'INTEGER NOT NULL DEFAULT 0'],
    ['score_credit', `REAL NOT NULL DEFAULT ${SCORE_BURST}`],
  ]) if (!columns.has(column)) db.exec(`ALTER TABLE players ADD COLUMN ${column} ${definition}`);
  const find = db.prepare('SELECT * FROM players WHERE token = ?');
  const insert = db.prepare('INSERT INTO players(id, token, name) VALUES (?, ?, ?)');
  const update = db.prepare('UPDATE players SET name = ?, best = MAX(best, ?), seen = ?, suspected = ?, checked_at = ?, score_credit = ? WHERE id = ?');
  const count = db.prepare('SELECT COUNT(*) AS count FROM players WHERE seen > ?');
  const top = db.prepare('SELECT id, name, best, seen, suspected FROM players WHERE suspected = 0 ORDER BY best DESC, id ASC LIMIT 50');
  const suspects = db.prepare('SELECT id, name, best, seen, suspected FROM players WHERE suspected = 1 ORDER BY best DESC, id ASC LIMIT 10');
  const rank = db.prepare('SELECT COUNT(*) + 1 AS rank FROM players WHERE suspected < ? OR (suspected = ? AND (best > ? OR (best = ? AND id < ?)))');
  const limits = new Map<string, { time: number; hits: number }>();
  const dist = resolve(distPath);
  function json(res: ServerResponse, status: number, data: unknown) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(data));
  }
  function publicPlayer(player: any) {
    return { id: player.id, name: player.name, best: player.best,
      rank: Number(rank.get(player.suspected, player.suspected, player.best, player.best, player.id)!.rank),
      suspected: player.suspected === 1,
      reason: player.suspected === 1 ? 'Aumento de puntos fuera del margen del juego; señal automática, no confirmación.' : '',
    };
  }
  function snapshot(player: any) {
    const cutoff = now() - ACTIVE_MS;
    return {
      active: Number(count.get(cutoff)!.count),
      me: publicPlayer(player),
      players: [...top.all(), ...suspects.all()].map(row => ({ ...publicPlayer(row), active: Number(row.seen) > cutoff })),
    };
  }
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        const ip = String(req.headers['cf-connecting-ip'] ?? req.socket.remoteAddress ?? 'local');
        const time = now();
        if (limits.size > 10_000) for (const [key, limit] of limits) if (time - limit.time >= 60_000) limits.delete(key);
        const limit = limits.get(ip);
        if (limit && time - limit.time < 60_000) {
          if (++limit.hits > 120) { json(res, 429, { error: 'Demasiadas solicitudes. Intenta en un minuto.' }); return; }
        } else {
          if (limits.size >= 10_000) { json(res, 503, { error: 'Servidor ocupado.' }); return; }
          limits.set(ip, { time, hits: 1 });
        }
        if (url.pathname !== '/api/presence' || req.method !== 'POST') { json(res, 404, { error: 'No encontrado.' }); return; }
        const origin = req.headers.origin;
        if ((origin && new URL(origin).host !== req.headers.host) || req.headers['sec-fetch-site'] === 'cross-site') {
          json(res, 403, { error: 'Origen no permitido.' }); return;
        }
        if (!req.headers['content-type']?.startsWith('application/json')) { json(res, 415, { error: 'Se requiere JSON.' }); return; }
        let raw = '';
        for await (const chunk of req) {
          raw += chunk.toString();
          if (Buffer.byteLength(raw) > 4096) { json(res, 413, { error: 'Solicitud demasiado grande.' }); return; }
        }
        let body: any;
        try { body = JSON.parse(raw); } catch { json(res, 400, { error: 'JSON inválido.' }); return; }
        if (!body || typeof body !== 'object' || Array.isArray(body) || !Number.isFinite(body.points) || body.points < 0 || body.points > 1e12) {
          json(res, 400, { error: 'Puntuación inválida.' }); return;
        }
        if (body.name !== undefined && (typeof body.name !== 'string' || !/^[\p{L}\p{N} _.'-]{1,24}$/u.test(body.name.trim()) || !body.name.trim())) {
          json(res, 400, { error: 'Usa un nombre de 1 a 24 letras, números o espacios.' }); return;
        }
        const cookie = /(?:^|;\s*)michi_player=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie ?? '')?.[1];
        const hash = (token: string) => createHash('sha256').update(token).digest('hex');
        let player = cookie ? find.get(hash(cookie)) : undefined;
        if (!player) {
          const token = randomBytes(32).toString('hex');
          const id = randomUUID();
          insert.run(id, hash(token), `Invitado ${id.slice(0, 4)}`);
          const secure = req.headers['x-forwarded-proto'] === 'https' || origin?.startsWith('https:');
          res.setHeader('Set-Cookie', `michi_player=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${secure ? '; Secure' : ''}`);
          player = find.get(hash(token))!;
        }
        // shortcut: scores are client-reported, move game simulation to server for competitive play.
        const candidate = Math.floor(body.points);
        const delta = Math.max(0, candidate - Number(player.best));
        const allowance = Number(player.score_credit) + Math.max(0, time - Number(player.checked_at)) / 1000 * SCORE_RATE;
        // First contact/import establishes a baseline; high historical scores alone are not evidence.
        const suspiciousJump = Number(player.checked_at) > 0 && delta > allowance;
        const suspected = Number(player.suspected) === 1 || suspiciousJump;
        const credit = Number(player.checked_at) > 0 ? Math.min(SCORE_BURST, Math.max(0, allowance - delta)) : SCORE_BURST;
        update.run(body.name === undefined ? player.name : body.name.trim(), candidate, time, suspected ? 1 : 0, time, credit, player.id);
        player = find.get(String(player.token))!;
        json(res, 200, snapshot(player)); return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
      const path = resolve(dist, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!path.startsWith(dist + sep)) { res.writeHead(403); res.end(); return; }
      const data = await readFile(path);
      const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
      res.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error: any) {
      if (res.headersSent) { res.end(); return; }
      json(res, error?.code === 'ENOENT' || error?.code === 'EISDIR' ? 404 : 500, { error: 'No se pudo completar la solicitud.' });
    }
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  server.on('close', () => db.close());
  return server;
}
