import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, ACTIVE_MS } from './app.ts';
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
