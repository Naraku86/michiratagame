import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.ts';
import { loadAuthConfig } from './auth.ts';
const userId = '11111111-2222-4333-8444-555555555555';
const otherId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const config = loadAuthConfig({ MICHI_AUTH_PROVIDER: 'supabase', SUPABASE_URL: 'https://auth.example.test', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key' });

test('verified accounts keep one board identity across devices and logout cannot write the account through its guest cookie', async () => {
  const verify = (async (_url: unknown, init?: RequestInit) => {
    const token = new Headers(init?.headers).get('Authorization');
    if (token !== 'Bearer a.b.c' && token !== 'Bearer x.y.z') return new Response('{}', { status: 401 });
    return new Response(JSON.stringify({ id: token === 'Bearer a.b.c' ? userId : otherId, email: 'test@example.test', email_confirmed_at: '2026-10-13', app_metadata: { provider: 'email' } }), { status: 200 });
  }) as typeof fetch;
  const server = createApp(':memory:', '/tmp/no-assets', Date.now, {}, config, verify);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/presence`;
  async function post(points: number, cookie = '', token = '', name?: string) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ points, ...(name ? { name } : {}) }) });
  }
  try {
    const anonymous = await post(100, '', '', 'Mi cuenta');
    const cookie = anonymous.headers.get('set-cookie')!.split(';')[0];
    const guest = await anonymous.json();
    const signed = await (await post(200, cookie, 'a.b.c')).json();
    assert.equal(signed.me.id, guest.me.id); assert.equal(signed.me.account.id, userId);
    const secondDevice = await (await post(150, '', 'a.b.c')).json();
    assert.equal(secondDevice.me.id, guest.me.id); assert.equal(secondDevice.active, 1); assert.equal(secondDevice.me.best, 200);
    const loggedOut = await (await post(300, cookie)).json();
    assert.notEqual(loggedOut.me.id, guest.me.id); assert.equal(loggedOut.me.account, null);
    const otherAccount = await (await post(500, cookie, 'x.y.z')).json();
    assert.notEqual(otherAccount.me.id, guest.me.id); assert.equal(otherAccount.me.account.id, otherId);
    assert.equal((await (await post(0, '', 'a.b.c')).json()).me.best, 200);
    assert.equal((await post(1000, cookie, 'invalid.token.signature')).status, 401);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('legacy service_role configuration keys are rejected in both server and client', async () => {
  const { setupAuth } = await import('../src/auth.ts');
  const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const legacy = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
  for (const role of ['service_role', 'authenticated', 'unknown']) {
    assert.throws(() => loadAuthConfig({ MICHI_AUTH_PROVIDER: 'supabase', SUPABASE_URL: 'https://auth.example.test', SUPABASE_PUBLISHABLE_KEY: legacy(role) }));
    assert.equal(setupAuth({ VITE_SUPABASE_URL: 'https://auth.example.test', VITE_SUPABASE_PUBLISHABLE_KEY: legacy(role) }, { storage, origin: 'https://game.example.test' }).status, 'misconfigured');
  }
  assert.equal(setupAuth({ VITE_SUPABASE_URL: 'https://auth.example.test', VITE_SUPABASE_PUBLISHABLE_KEY: legacy('anon') }, { storage, origin: 'https://game.example.test' }).status, 'ready');
});
