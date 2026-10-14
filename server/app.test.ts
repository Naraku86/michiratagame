import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, ACTIVE_MS, SCORE_BURST, SCORE_RATE } from './app.ts';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import type { Server } from 'node:http';

async function listen(server: Server) {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}
async function close(server: Server) {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
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
  let server = createApp(path, dir, () => time);
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
