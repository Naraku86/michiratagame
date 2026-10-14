import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, ACTIVE_MS, SCORE_BURST, SCORE_RATE, isValidIp, isLoopbackAddress, resolveClientIp } from './app.ts';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import http from 'node:http';
import type { Server } from 'node:http';

async function listen(server: Server) {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}
async function close(server: Server) {
  server.closeIdleConnections?.();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
async function rawRequest(base: string, options: { path?: string; method?: string; headers?: Record<string, string>; body?: string }) {
  const url = new URL(base);
  return new Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: Number(url.port),
      path: options.path ?? '/api/presence',
      method: options.method ?? 'POST',
      headers: options.headers ?? {},
    }, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data, headers: res.headers }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}
test('community shares presence, retains identity and records, validates input and persists after restart', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'michi-community-'));
  const dist = join(dir, 'dist'); await mkdir(dist); await writeFile(join(dist, 'index.html'), 'demo');
  let time = 1_000_000;
  let server = createApp(join(dir, 'test.sqlite'), dist, () => time);
  let base = await listen(server);
  async function post(body: unknown, cookie = '') {
    return fetch(base + '/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: base }, body: JSON.stringify(body) });
  }
  try {
    const first = await post({ points: 50, name: 'Michi Uno' });
    assert.equal(first.status, 200);
    const cookie = first.headers.get('set-cookie')!.split(';')[0];
    assert.match(first.headers.get('set-cookie')!, /HttpOnly; SameSite=Lax/);
    const one = await first.json(); assert.equal(one.active, 1); assert.equal(one.me.name, 'Michi Uno');
    assert.equal(JSON.stringify(one).includes('token'), false);
    const second = await post({ points: 100, name: 'Michi Dos' });
    const two = await second.json(); assert.equal(two.active, 2); assert.equal(two.players[0].name, 'Michi Dos');
    const spent = await (await post({ points: 5 }, cookie)).json();
    assert.equal(spent.me.id, one.me.id); assert.equal(spent.me.best, 50); assert.equal(spent.me.rank, 2); assert.equal(spent.active, 2);
    const renamed = await (await post({ points: 150, name: 'Michí' }, cookie)).json();
    assert.equal(renamed.me.name, 'Michí'); assert.equal(renamed.me.rank, 1);
    for (const body of [{ points: -1 }, { points: 1e13 }, { points: '100' }, { points: 1, name: '<script>' }, { points: 1, name: ' ' }, { points: 1, name: 'x'.repeat(25) }]) assert.equal((await post(body, cookie)).status, 400);
    assert.equal((await fetch(base + '/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://other.example' }, body: '{"points":1}' })).status, 403);
    assert.equal((await fetch(base + '/api/presence', { method: 'POST', body: '{}' })).status, 415);
    assert.equal((await fetch(base + '/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(5000) })).status, 413);
    assert.equal((await fetch(base + '/%2e%2e%2fsecret')).status, 403);
    assert.equal(await (await fetch(base)).text(), 'demo');
    time += ACTIVE_MS + 1;
    const expired = await (await post({ points: 2 }, cookie)).json();
    assert.equal(expired.active, 1); assert.equal(expired.players.find((p: any) => p.id === two.me.id).active, false);
    await close(server);
    server = createApp(join(dir, 'test.sqlite'), dist, () => time);
    base = await listen(server);
    const restored = await (await post({ points: 0 }, cookie)).json();
    assert.equal(restored.me.id, one.me.id); assert.equal(restored.me.name, 'Michí'); assert.equal(restored.me.best, 150);
    for (let i = 0; i < 120; i++) await post({ points: 0 }, cookie);
    assert.equal((await post({ points: 0 }, cookie)).status, 429);
  } finally { await close(server); await rm(dir, { recursive: true, force: true }); }
});

test('suspicious jumps are tagged and sorted after every regular player, surviving rename and restart', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'michi-suspects-'));
  let time = 1_000_000;
  const path = join(dir, 'test.sqlite');
  let server = createApp(path, dir, () => time, { newPlayerPerClient: 1000, newPlayerGlobal: 1000 });
  let base = await listen(server);
  async function post(points: number, name?: string, cookie = '', extra = {}) {
    const response = await fetch(base + '/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: base }, body: JSON.stringify({ points, ...(name ? { name } : {}), ...extra }) });
    assert.equal(response.status, 200);
    return { body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] ?? cookie };
  }
  try {
    const honest = await post(100, 'Normal');
    const bot = await post(0, 'Prueba');
    const imported = await post(500_000_000_000, 'Guardado antiguo');
    assert.equal(imported.body.me.suspected, false, 'a large imported save alone is not evidence');
    time += 20_000;
    const normal = await post(100 + SCORE_RATE * 20, undefined, honest.cookie);
    assert.equal(normal.body.me.suspected, false, 'elapsed time allows normal production between heartbeats');
    const suspicious = await post(1e12, undefined, bot.cookie);
    assert.equal(suspicious.body.me.suspected, true);
    assert.equal(suspicious.body.players.at(-1).id, bot.body.me.id);
    assert.equal(suspicious.body.me.rank, 3);
    assert.match(suspicious.body.me.reason, /no confirmación/);
    const renamed = await post(0, 'Otro nombre', bot.cookie, { suspected: false });
    assert.equal(renamed.body.me.suspected, true);
    const spamming = await post(0, 'Saltos');
    for (let i = 1; i <= 5; i++) await post(SCORE_BURST / 4 * i, undefined, spamming.cookie);
    const depleted = await post(SCORE_BURST * 1.5, undefined, spamming.cookie);
    assert.equal(depleted.body.me.suspected, true, 'rapid reports cannot repeatedly reuse the burst allowance');
    for (let i = 0; i < 51; i++) await post(i, `Jugador ${i}`);
    const board = await post(0, undefined, bot.cookie);
    assert.equal(board.body.players.filter((p: any) => !p.suspected).length, 50);
    assert.equal(board.body.players.at(-2).id, bot.body.me.id);
    assert.ok(board.body.me.rank > 50);
    await close(server);
    server = createApp(path, dir, () => time);
    base = await listen(server);
    assert.equal((await post(0, undefined, bot.cookie)).body.me.suspected, true);
  } finally { await close(server); await rm(dir, { recursive: true, force: true }); }
});

test('legacy database migration preserves identities and does not accuse historical high scores', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'michi-migration-'));
  const path = join(dir, 'test.sqlite');
  const db = new DatabaseSync(path);
  db.exec('CREATE TABLE players (id TEXT PRIMARY KEY, token TEXT UNIQUE NOT NULL, name TEXT NOT NULL, best INTEGER NOT NULL DEFAULT 0, seen INTEGER NOT NULL DEFAULT 0)');
  const token = 'a'.repeat(64);
  db.prepare('INSERT INTO players VALUES (?, ?, ?, ?, ?)').run('legacy', createHash('sha256').update(token).digest('hex'), 'Antiguo', 72_000_000_000, 1000);
  db.close();
  const server = createApp(path, dir, () => 1_000_000);
  const base = await listen(server);
  try {
    const response = await fetch(base + '/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `michi_player=${token}` }, body: JSON.stringify({ points: 72_000_000_000 }) });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.me.id, 'legacy'); assert.equal(result.me.name, 'Antiguo');
    assert.equal(result.me.best, 72_000_000_000); assert.equal(result.me.suspected, false);
  } finally { await close(server); await rm(dir, { recursive: true, force: true }); }
});

test('proxy headers are validated and trusted only from loopback', () => {
  assert.equal(isValidIp('127.0.0.1'), true);
  assert.equal(isValidIp('2001:db8::1'), true);
  assert.equal(isValidIp('999.999.999.999'), false);
  assert.equal(isValidIp('not-an-ip'), false);
  assert.equal(isValidIp('http://evil'), false);
  assert.equal(isLoopbackAddress('127.0.0.1'), true);
  assert.equal(isLoopbackAddress('::1'), true);
  assert.equal(isLoopbackAddress('::ffff:127.0.0.1'), true);
  assert.equal(isLoopbackAddress('8.8.8.8'), false);
  assert.equal(resolveClientIp({ socket: { remoteAddress: '127.0.0.1' }, headers: { 'cf-connecting-ip': '203.0.113.9' } }), '203.0.113.9');
  assert.equal(resolveClientIp({ socket: { remoteAddress: '127.0.0.1' }, headers: { 'cf-connecting-ip': 'javascript:alert(1)' } }), '127.0.0.1');
  assert.equal(resolveClientIp({ socket: { remoteAddress: '8.8.8.8' }, headers: { 'cf-connecting-ip': '203.0.113.9' } }), '8.8.8.8');
  assert.equal(resolveClientIp({ socket: { remoteAddress: '127.0.0.1' }, headers: { 'x-forwarded-for': '198.51.100.7, 10.0.0.1' } }), '198.51.100.7');
  assert.equal(resolveClientIp({ socket: { remoteAddress: '127.0.0.1' }, headers: {} }), '127.0.0.1');
});

test('malformed origin, preflight and declared oversized body are handled safely', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'michi-controls-'));
  const dist = join(dir, 'dist'); await mkdir(dist); await writeFile(join(dist, 'index.html'), 'demo');
  const server = createApp(join(dir, 'test.sqlite'), dist, () => 1_000_000);
  const base = await listen(server);
  try {
    assert.equal((await fetch(base + '/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: '%%%' }, body: '{"points":1}' })).status, 403);
    const preflight = await fetch(base + '/api/presence', { method: 'OPTIONS', headers: { Origin: base } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
    assert.equal((await fetch(base + '/api/presence', { method: 'OPTIONS', headers: { Origin: 'https://other.example' } })).status, 403);
    const oversized = await rawRequest(base, { headers: { 'Content-Type': 'application/json', 'Content-Length': '5000' }, body: 'x'.repeat(5000) });
    assert.equal(oversized.status, 413);
    const chunked = await rawRequest(base, { headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(5000) });
    assert.equal(chunked.status, 413, 'chunked bodies are also capped while streaming');
    const named = await fetch(base + '/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ points: 1, name: 'Ratón ñandú 鼠' }) });
    assert.equal(named.status, 200);
    assert.equal((await named.json()).me.name, 'Ratón ñandú 鼠');
  } finally { await close(server); await rm(dir, { recursive: true, force: true }); }
});

test('per-client rate limit is keyed by validated client address and recovers after the window', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'michi-perclient-'));
  const dist = join(dir, 'dist'); await mkdir(dist); await writeFile(join(dist, 'index.html'), 'demo');
  let time = 1_000_000;
  const server = createApp(join(dir, 'test.sqlite'), dist, () => time, { rateLimitPerClient: 2, rateLimitGlobal: 1_000 });
  const base = await listen(server);
  async function postFrom(ip: string) {
    return fetch(base + '/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip }, body: '{"points":1}' });
  }
  try {
    assert.equal((await postFrom('10.0.0.1')).status, 200);
    assert.equal((await postFrom('10.0.0.1')).status, 200);
    assert.equal((await postFrom('10.0.0.1')).status, 429);
    assert.equal((await postFrom('10.0.0.2')).status, 200, 'a different client is not limited');
    time += 60_000;
    assert.equal((await postFrom('10.0.0.1')).status, 200, 'client recovers after the window');
  } finally { await close(server); await rm(dir, { recursive: true, force: true }); }
});

test('global rate limit caps total requests across all clients', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'michi-global-'));
  const dist = join(dir, 'dist'); await mkdir(dist); await writeFile(join(dist, 'index.html'), 'demo');
  const server = createApp(join(dir, 'test.sqlite'), dist, () => 1_000_000, { rateLimitGlobal: 3, rateLimitPerClient: 1_000 });
  const base = await listen(server);
  try {
    for (let i = 0; i < 3; i++) {
      assert.equal((await fetch(base + '/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': `10.0.0.${i + 1}` }, body: '{"points":1}' })).status, 200);
    }
    assert.equal((await fetch(base + '/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '10.0.0.99' }, body: '{"points":1}' })).status, 429);
  } finally { await close(server); await rm(dir, { recursive: true, force: true }); }
});

test('client map is bounded and prunes expired entries when full (size === max)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'michi-prune-'));
  const dist = join(dir, 'dist'); await mkdir(dist); await writeFile(join(dist, 'index.html'), 'demo');
  let time = 1_000_000;
  const server = createApp(join(dir, 'test.sqlite'), dist, () => time, { rateLimitPerClient: 1_000, rateLimitGlobal: 100_000, rateMaxClients: 2, rateWindowMs: 1_000 });
  const base = await listen(server);
  async function postFrom(ip: string) {
    return fetch(base + '/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip }, body: '{"points":1}' });
  }
  try {
    assert.equal((await postFrom('10.0.0.1')).status, 200);
    assert.equal((await postFrom('10.0.0.2')).status, 200);
    assert.equal((await postFrom('10.0.0.3')).status, 503, 'map is full and nothing has expired yet');
    time += 2_000;
    assert.equal((await postFrom('10.0.0.3')).status, 200, 'expired entries are pruned and the new client is admitted');
  } finally { await close(server); await rm(dir, { recursive: true, force: true }); }
});

test('ranking preserves global positions and tied ids beyond both board limits using its compound index', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'michi-ranking-'));
  const path = join(dir, 'test.sqlite');
  const time = 1_000_000;
  const server = createApp(path, dir, () => time);
  const db = new DatabaseSync(path);
  const tokenFor = (index: number) => index.toString(16).padStart(64, '0');
  const insert = db.prepare('INSERT INTO players(id, token, name, best, seen, suspected, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (let i = 0; i < 72; i++) {
    const id = `player-${String(i).padStart(3, '0')}`;
    insert.run(id, createHash('sha256').update(tokenFor(i)).digest('hex'), id, i < 60 ? 100 : 200, time, i < 60 ? 0 : 1, time);
  }
  for (const suspected of [0, 1]) {
    const plan = db.prepare(`EXPLAIN QUERY PLAN SELECT id, name, best, seen, suspected FROM players WHERE suspected = ? ORDER BY best DESC, id ASC LIMIT ${suspected ? 10 : 50}`).all(suspected);
    assert.ok(plan.some(row => String(row.detail).includes('players_ranking')), JSON.stringify(plan));
    assert.ok(plan.every(row => !String(row.detail).includes('TEMP B-TREE')), JSON.stringify(plan));
  }
  db.close();
  const base = await listen(server);
  async function board(index: number) {
    const response = await fetch(base + '/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `michi_player=${tokenFor(index)}`, Origin: base }, body: JSON.stringify({ points: 0 }) });
    assert.equal(response.status, 200);
    return response.json();
  }
  try {
    const normal = await board(55);
    assert.equal(normal.me.rank, 56);
    assert.equal(normal.me.suspected, false);
    assert.equal(normal.players.length, 60);
    assert.deepEqual(normal.players.slice(0, 50).map((p: any) => [p.id, p.rank]), Array.from({ length: 50 }, (_, i) => [`player-${String(i).padStart(3, '0')}`, i + 1]));
    assert.deepEqual(normal.players.slice(50).map((p: any) => [p.id, p.rank]), Array.from({ length: 10 }, (_, i) => [`player-${String(i + 60).padStart(3, '0')}`, i + 61]));
    const suspect = await board(71);
    assert.equal(suspect.me.rank, 72);
    assert.equal(suspect.me.suspected, true);
    assert.equal(suspect.players.some((p: any) => p.id === suspect.me.id), false);
  } finally { await close(server); await rm(dir, { recursive: true, force: true }); }
});

test('ranking starts at one with no regular players and also with no suspects', async () => {
  for (const suspected of [0, 1]) {
    const dir = await mkdtemp(join(tmpdir(), 'michi-ranking-empty-'));
    const path = join(dir, 'test.sqlite');
    const server = createApp(path, dir, () => 1_000_000);
    const db = new DatabaseSync(path);
    const token = 'b'.repeat(64);
    db.prepare('INSERT INTO players(id, token, name, best, suspected) VALUES (?, ?, ?, ?, ?)').run('only', createHash('sha256').update(token).digest('hex'), 'Único', 0, suspected);
    db.close();
    const base = await listen(server);
    try {
      const response = await fetch(base + '/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `michi_player=${token}` }, body: JSON.stringify({ points: 0 }) });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.me.rank, 1);
      assert.equal(result.players.length, 1);
      assert.equal(result.players[0].rank, 1);
      assert.equal(result.players[0].suspected, Boolean(suspected));
    } finally { await close(server); await rm(dir, { recursive: true, force: true }); }
  }
});

test('new identities have a separate quota while established players keep reporting', async () => {
  let time = 1_000_000;
  const server = createApp(':memory:', '/tmp/no-assets', () => time, { newPlayerPerClient: 2, newPlayerGlobal: 5 });
  const base = await listen(server);
  const post = (cookie = '') => fetch(base + '/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: '{"points":1}' });
  try {
    const first = await post(); const cookie = first.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await post()).status, 200);
    assert.equal((await post()).status, 429);
    assert.equal((await post(cookie)).status, 200);
    time += 60_001; assert.equal((await post()).status, 200);
  } finally { await close(server); }
});

test('static file requests are rate-limited without consuming the API allowance', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'michi-static-'));
  await writeFile(join(dir, 'index.html'), 'demo');
  const server = createApp(':memory:', dir, () => 1_000_000, { staticPerClient: 2 });
  const base = await listen(server);
  try {
    assert.equal((await fetch(base)).status, 200); assert.equal((await fetch(base)).status, 200);
    assert.equal((await fetch(base)).status, 429);
    assert.equal((await fetch(base + '/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"points":1}' })).status, 200);
  } finally { await close(server); await rm(dir, { recursive: true, force: true }); }
});

test('static assets stream unchanged bytes, support HEAD and advertise bounded cache', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'michi-stream-'));
  await mkdir(join(dir, 'assets'));
  const data = Buffer.alloc(1_000_000, 123);
  await writeFile(join(dir, 'assets', 'sample.webp'), data);
  const server = createApp(':memory:', dir);
  const base = await listen(server);
  try {
    const full = await fetch(base + '/assets/sample.webp');
    assert.equal(full.status, 200); assert.equal(full.headers.get('content-length'), String(data.length));
    assert.equal(full.headers.get('cache-control'), 'public, max-age=3600');
    assert.deepEqual(Buffer.from(await full.arrayBuffer()), data);
    const head = await fetch(base + '/assets/sample.webp', { method: 'HEAD' });
    assert.equal(head.headers.get('content-length'), String(data.length)); assert.equal(await head.text(), '');
    assert.equal((await fetch(base + '/assets')).status, 404);
  } finally { await close(server); await rm(dir, { recursive: true, force: true }); }
});
