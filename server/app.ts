import { bearerToken, createAuthLinks, loadAuthConfig, validateSession, sessionStatus, type AuthConfig, type AuthUser } from './auth.ts';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { resolve, extname, sep } from 'node:path';
import { isIP } from 'node:net';

export const ACTIVE_MS = 60_000;
// Generous envelope above current maximum production and fatigue-limited tapping.
export const SCORE_RATE = 10_000_000;
export const SCORE_BURST = 40_000_000;

// Request-protection defaults. All are overridable for tests through AppLimits.
export const DEFAULT_RATE_LIMIT = 120; // per-client requests per window (token bucket)
export const DEFAULT_RATE_LIMIT_GLOBAL = 2_000; // total requests per window across all clients
export const DEFAULT_RATE_WINDOW_MS = 60_000;
export const DEFAULT_RATE_MAX_CLIENTS = 10_000;
export const MAX_BODY_BYTES = 4096;
export const DEFAULT_MAX_CONNECTIONS = 1_000;
export const DEFAULT_MAX_REQUESTS_PER_SOCKET = 100;

export interface AppLimits {
  rateLimitPerClient?: number;
  rateLimitGlobal?: number;
  rateWindowMs?: number;
  rateMaxClients?: number;
  maxBodyBytes?: number;
  newPlayerPerClient?: number;
  newPlayerGlobal?: number;
  staticPerClient?: number;
  staticGlobal?: number;
}

const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** A loopback source means a trusted reverse proxy/tunnel on this machine may be the sender. */
export function isLoopbackAddress(ip: string | undefined): boolean {
  return typeof ip === 'string' && LOOPBACK_IPS.has(ip.toLowerCase());
}

/** Accepts only valid IPv4 or IPv6 literals; everything else is ignored. */
export function isValidIp(ip: string): boolean {
  return isIP(ip) !== 0;
}

function headerText(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

/**
 * Proxy headers (CF-Connecting-IP, X-Forwarded-For) are trusted only when the
 * direct socket is loopback (the local reverse proxy/Cloudflare tunnel). Direct
 * remote clients cannot spoof them, and malformed values fall back safely.
 */
export function resolveClientIp(req: {
  socket: { remoteAddress?: string };
  headers: Record<string, string | string[] | undefined>;
}): string {
  const remote = req.socket.remoteAddress ?? 'local';
  if (!isLoopbackAddress(remote)) return remote;
  const cf = headerText(req.headers['cf-connecting-ip']);
  if (cf && isValidIp(cf)) return cf;
  const forwarded = headerText(req.headers['x-forwarded-for']);
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first && isValidIp(first)) return first;
  }
  return remote;
}

/** Origin is allowed when absent, or when its host matches the request Host. Malformed origins are denied, never fatal. */
function sameOrigin(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return true;
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Token bucket: bursty traffic is allowed up to `capacity`, then refills steadily. */
class TokenBucket {
  private readonly capacity: number;
  private readonly refillPerSec: number;
  private tokens: number;
  private last = 0;
  private started = false;

  constructor(capacity: number, refillPerSec: number) {
    this.capacity = capacity;
    this.refillPerSec = refillPerSec;
    this.tokens = capacity;
  }

  take(now: number): boolean {
    if (!this.started) {
      this.started = true;
      this.last = now;
      this.tokens = this.capacity;
    } else {
      const elapsed = Math.max(0, (now - this.last) / 1000);
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
      this.last = now;
    }
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}

interface ClientEntry {
  bucket: TokenBucket;
  last: number;
}

/**
 * Global + per-client token buckets. The client map is bounded: expired entries
 * are pruned only when the map is full, so memory never grows past maxClients
 * and the old "size === 10000 never cleaned" bug is gone.
 */
class RateLimiter {
  private readonly global: TokenBucket;
  private readonly clients = new Map<string, ClientEntry>();
  private readonly perClient: number;
  private readonly windowMs: number;
  private readonly maxClients: number;

  constructor(
    perClient: number,
    globalLimit: number,
    windowMs: number,
    maxClients: number,
  ) {
    this.perClient = perClient;
    this.windowMs = windowMs;
    this.maxClients = maxClients;
    this.global = new TokenBucket(globalLimit, (globalLimit * 1000) / windowMs);
  }

  allow(key: string, now: number): { ok: true } | { ok: false; status: number; message: string } {
    if (!this.global.take(now)) {
      return { ok: false, status: 429, message: 'Demasiadas solicitudes. Intenta en un minuto.' };
    }
    const entry = this.clients.get(key);
    if (entry) {
      entry.last = now;
      if (entry.bucket.take(now)) return { ok: true };
      return { ok: false, status: 429, message: 'Demasiadas solicitudes. Intenta en un minuto.' };
    }
    if (this.clients.size >= this.maxClients) {
      this.prune(now);
      if (this.clients.size >= this.maxClients) {
        return { ok: false, status: 503, message: 'Servidor ocupado.' };
      }
    }
    const bucket = new TokenBucket(this.perClient, (this.perClient * 1000) / this.windowMs);
    bucket.take(now);
    this.clients.set(key, { bucket, last: now });
    return { ok: true };
  }

  private prune(now: number): void {
    for (const [key, entry] of this.clients) {
      if (now - entry.last >= this.windowMs) this.clients.delete(key);
    }
  }
}

export function createApp(
  databasePath: string,
  distPath: string,
  now = Date.now,
  limits: AppLimits = {},
  authConfig: AuthConfig = loadAuthConfig(process.env),
  authFetcher: typeof fetch = fetch,
) {
  const rateLimitPerClient = limits.rateLimitPerClient ?? DEFAULT_RATE_LIMIT;
  const rateLimitGlobal = limits.rateLimitGlobal ?? DEFAULT_RATE_LIMIT_GLOBAL;
  const rateWindowMs = limits.rateWindowMs ?? DEFAULT_RATE_WINDOW_MS;
  const rateMaxClients = limits.rateMaxClients ?? DEFAULT_RATE_MAX_CLIENTS;
  const maxBodyBytes = limits.maxBodyBytes ?? MAX_BODY_BYTES;

  const db = new DatabaseSync(databasePath);
  db.exec(`PRAGMA journal_mode=WAL;
    PRAGMA synchronous=NORMAL;
    PRAGMA busy_timeout=5000;
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
  db.exec('CREATE INDEX IF NOT EXISTS players_ranking ON players(suspected, best DESC, id ASC)');
  const find = db.prepare('SELECT * FROM players WHERE token = ?');
  const findById = db.prepare('SELECT * FROM players WHERE id = ?');
  const authLinks = createAuthLinks(db, now);
  const insert = db.prepare('INSERT INTO players(id, token, name) VALUES (?, ?, ?)');
  const update = db.prepare('UPDATE players SET name = ?, best = MAX(best, ?), seen = ?, suspected = ?, checked_at = ?, score_credit = ? WHERE id = ?');
  const count = db.prepare('SELECT COUNT(*) AS count FROM players WHERE seen > ?');
  const top = db.prepare('SELECT id, name, best, seen, suspected FROM players WHERE suspected = 0 ORDER BY best DESC, id ASC LIMIT 50');
  const suspects = db.prepare('SELECT id, name, best, seen, suspected FROM players WHERE suspected = 1 ORDER BY best DESC, id ASC LIMIT 10');
  const normalCount = db.prepare('SELECT COUNT(*) AS count FROM players WHERE suspected = 0');
  const rank = db.prepare('SELECT COUNT(*) + 1 AS rank FROM players WHERE suspected < ? OR (suspected = ? AND (best > ? OR (best = ? AND id < ?)))');
  const rateLimiter = new RateLimiter(rateLimitPerClient, rateLimitGlobal, rateWindowMs, rateMaxClients);
  const registrationLimiter = new RateLimiter(limits.newPlayerPerClient ?? 10, limits.newPlayerGlobal ?? 100, rateWindowMs, rateMaxClients);
  const staticLimiter = new RateLimiter(limits.staticPerClient ?? 600, limits.staticGlobal ?? 6000, rateWindowMs, rateMaxClients);
  const dist = resolve(distPath);

  function json(res: ServerResponse, status: number, data: unknown) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(data));
  }
  function publicPlayer(player: any, position: number) {
    return { id: player.id, name: player.name, best: player.best,
      rank: position,
      suspected: player.suspected === 1,
      reason: player.suspected === 1 ? 'Aumento de puntos fuera del margen del juego; señal automática, no confirmación.' : '',
    };
  }

  function snapshot(player: any, user?: AuthUser) {
    const cutoff = now() - ACTIVE_MS;
    const regularRows = top.all();
    const suspectedRows = suspects.all();
    const regularTotal = suspectedRows.length ? Number(normalCount.get()!.count) : 0;
    const personalRank = Number(rank.get(player.suspected, player.suspected, player.best, player.best, player.id)!.rank);
    return {
      active: Number(count.get(cutoff)!.count),
      me: { ...publicPlayer(player, personalRank), account: user ? { id: user.id, email: user.email } : null },
      players: [
        ...regularRows.map((row, index) => ({ ...publicPlayer(row, index + 1), active: Number(row.seen) > cutoff })),
        ...suspectedRows.map((row, index) => ({ ...publicPlayer(row, regularTotal + index + 1), active: Number(row.seen) > cutoff })),
      ],
    };
  }

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      let url: URL;
      try {
        url = new URL(req.url ?? '/', 'http://localhost');
      } catch {
        json(res, 400, { error: 'Solicitud inválida.' });
        return;
      }

      if (url.pathname.startsWith('/api/')) {
        const ip = resolveClientIp(req);
        const time = now();
        const decision = rateLimiter.allow(ip, time);
        if (!decision.ok) {
          res.setHeader('Retry-After', String(Math.ceil(rateWindowMs / 1000)));
          json(res, decision.status, { error: decision.message, retryAfter: Math.ceil(rateWindowMs / 1000) });
          return;
        }

        if (req.method === 'OPTIONS') {
          if (!sameOrigin(req.headers.origin, req.headers.host) || headerText(req.headers['sec-fetch-site']) === 'cross-site') {
            json(res, 403, { error: 'Origen no permitido.' });
            return;
          }
          res.writeHead(204, {
            'Access-Control-Allow-Origin': req.headers.origin ?? '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '600',
            'Vary': 'Origin',
            'Cache-Control': 'no-store',
          });
          res.end();
          return;
        }

        if (url.pathname !== '/api/presence' || req.method !== 'POST') {
          json(res, 404, { error: 'No encontrado.' });
          return;
        }
        if (!sameOrigin(req.headers.origin, req.headers.host) || headerText(req.headers['sec-fetch-site']) === 'cross-site') {
          json(res, 403, { error: 'Origen no permitido.' });
          return;
        }
        if (!req.headers['content-type']?.startsWith('application/json')) {
          json(res, 415, { error: 'Se requiere JSON.' });
          return;
        }
        const declared = Number(headerText(req.headers['content-length']));
        if (Number.isFinite(declared) && declared > maxBodyBytes) {
          json(res, 413, { error: 'Solicitud demasiado grande.' });
          return;
        }
        let raw = '';
        for await (const chunk of req) {
          raw += chunk.toString();
          if (Buffer.byteLength(raw) > maxBodyBytes) {
            json(res, 413, { error: 'Solicitud demasiado grande.' });
            return;
          }
        }
        let body: any;
        try {
          body = JSON.parse(raw);
        } catch {
          json(res, 400, { error: 'JSON inválido.' });
          return;
        }
        if (!body || typeof body !== 'object' || Array.isArray(body) || !Number.isFinite(body.points) || body.points < 0 || body.points > 1e12) {
          json(res, 400, { error: 'Puntuación inválida.' });
          return;
        }
        if (body.name !== undefined && (typeof body.name !== 'string' || !/^[\p{L}\p{N} _.'-]{1,24}$/u.test(body.name.trim()) || !body.name.trim())) {
          json(res, 400, { error: 'Usa un nombre de 1 a 24 letras, números o espacios.' });
          return;
        }
        let user: AuthUser | undefined;
        if (req.headers.authorization !== undefined) {
          const result = await validateSession(authConfig, bearerToken(req.headers.authorization), authFetcher);
          if (!result.ok) { json(res, sessionStatus(result.reason), { error: result.reason === 'unavailable' ? 'El servicio de cuentas no responde. Tu partida sigue guardada.' : 'Entra de nuevo con una cuenta válida y confirmada.' }); return; }
          user = result.user;
        }
        const cookie = /(?:^|;\s*)michi_player=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie ?? '')?.[1];
        const hash = (token: string) => createHash('sha256').update(token).digest('hex');
        const accountPlayer = user ? authLinks.playerFor(user.id) : undefined;
        let player = accountPlayer ? findById.get(accountPlayer) : cookie ? find.get(hash(cookie)) : undefined;
        const owner = player ? authLinks.ownerFor(String(player.id)) : undefined;
        if (owner && owner !== user?.id) player = undefined;
        if (!player) {
          const registration = registrationLimiter.allow(ip, time);
          if (!registration.ok) { json(res, registration.status, { error: 'Demasiados jugadores nuevos desde esta conexión. Espera un minuto; puedes seguir jugando.' }); return; }
          const token = randomBytes(32).toString('hex');
          const id = randomUUID();
          insert.run(id, hash(token), `Invitado ${id.slice(0, 4)}`);
          const proxiedHttps = isLoopbackAddress(req.socket.remoteAddress) && headerText(req.headers['x-forwarded-proto']) === 'https';
          const secure = proxiedHttps || req.headers.origin?.startsWith('https:');
          res.setHeader('Set-Cookie', `michi_player=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${secure ? '; Secure' : ''}`);
          player = find.get(hash(token))!;
        }
        if (user && !accountPlayer) {
          const link = authLinks.link(user, String(player.id));
          if (link.status === 'conflict') { json(res, 409, { error: 'Este jugador ya pertenece a otra cuenta.' }); return; }
          player = findById.get(link.playerId)!;
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
        json(res, 200, snapshot(player, user));
        return;
      }

      const staticDecision = staticLimiter.allow(resolveClientIp(req), now());
      if (!staticDecision.ok) { res.setHeader('Retry-After', '60'); json(res, staticDecision.status, { error: 'Demasiadas solicitudes de archivos.' }); return; }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405);
        res.end();
        return;
      }
      let decoded: string;
      try {
        decoded = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      } catch {
        res.writeHead(400);
        res.end();
        return;
      }
      const path = resolve(dist, '.' + decoded);
      if (!path.startsWith(dist + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const file = await stat(path);
      if (!file.isFile()) { res.writeHead(404); res.end(); return; }
      const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
      res.writeHead(200, { 'Content-Length': file.size, 'Content-Type': types[extname(path)] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': url.pathname.startsWith('/assets/') ? 'public, max-age=3600' : 'no-cache' });
      if (req.method === 'HEAD') res.end();
      else await pipeline(createReadStream(path), res);
    } catch (error: any) {
      if (res.headersSent) {
        res.end();
        return;
      }
      json(res, error?.code === 'ENOENT' || error?.code === 'EISDIR' ? 404 : 500, { error: 'No se pudo completar la solicitud.' });
    }
  });

  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.timeout = 10_000;
  server.maxHeadersCount = 100;
  server.maxConnections = DEFAULT_MAX_CONNECTIONS;
  server.maxRequestsPerSocket = DEFAULT_MAX_REQUESTS_PER_SOCKET;
  server.on('close', () => db.close());
  return server;
}
