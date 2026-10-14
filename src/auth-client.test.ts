import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setupAuth, AuthError, type AuthStorage } from './auth.ts';

function fixture() {
  const values = new Map<string, string>();
  const storage: AuthStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
  const calls: { url: string; options: RequestInit }[] = [];
  let response: unknown = { access_token: 'access', refresh_token: 'refresh', expires_in: 3600, user: { id: 'user', email: 'a@b.co' } };
  let status = 200;
  let now = 1_000_000;
  const fetcher = (async (url: string | URL | Request, options: RequestInit = {}) => {
    calls.push({ url: String(url), options });
    return new Response(JSON.stringify(response), { status });
  }) as typeof fetch;
  const env = { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
  const deps = { storage, fetch: fetcher, now: () => now, origin: 'https://game.example' };
  const setup = setupAuth(env, deps); assert.equal(setup.status, 'ready');
  if (setup.status !== 'ready') throw new Error('not ready');
  return { client: setup.client, values, calls, env, deps, reply: (body: unknown, code = 200) => { response = body; status = code; }, advance: (ms: number) => { now += ms; } };
}

test('missing settings disable auth; malformed settings and secret keys fail closed', () => {
  const { env, deps } = fixture();
  assert.equal(setupAuth({}, deps).status, 'disabled');
  for (const changes of [{ VITE_SUPABASE_URL: 'http://external.example' }, { VITE_SUPABASE_URL: 'https://example.supabase.co/path' }, { VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_bad' }, { VITE_AUTH_REDIRECT_URL: 'https://other.example/' }, { VITE_SUPABASE_PUBLISHABLE_KEY: '' }]) {
    assert.equal(setupAuth({ ...env, ...changes }, deps).status, 'misconfigured');
  }
});

test('OAuth PKCE verifies SHA256, exchanges one-time code and cleans callback query', async () => {
  const { client, values, calls } = fixture();
  const url = new URL(await client.oauthUrl('google'));
  const pending = JSON.parse(values.get('michiratagame.auth.pkce')!);
  assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(pending.verifier).digest('base64url'));
  assert.equal(url.searchParams.get('code_challenge_method'), 's256');
  assert.equal(url.searchParams.get('redirect_to'), 'https://game.example/');
  const back = await client.completeRedirect('https://game.example/?code=abc&other=keep');
  assert.equal(back.handled, true);
  assert.ok(back.handled && 'session' in back && back.kind === 'oauth');
  assert.equal(back.handled && back.cleanUrl, 'https://game.example/?other=keep');
  assert.deepEqual(JSON.parse(calls[0].options.body as string), { auth_code: 'abc', code_verifier: pending.verifier });
  assert.equal(values.has('michiratagame.auth.pkce'), false);
  const repeated = await client.completeRedirect('https://game.example/?code=abc');
  assert.ok(repeated.handled && 'error' in repeated && repeated.error.code === 'missing_verifier');
});

test('sign in validates input, stores session without password, and translates errors', async () => {
  const { client, values, calls, reply } = fixture();
  await assert.rejects(client.signIn('bad', '12345678'), AuthError);
  await assert.rejects(client.signIn('a@b.co', 'short'), AuthError);
  assert.equal(calls.length, 0);
  await client.signIn(' a@b.co ', '12345678');
  assert.equal(await client.accessToken(), 'access');
  assert.ok(![...values.values()].some(value => value.includes('12345678')));
  assert.equal(calls[0].url.endsWith('grant_type=password'), true);
  reply({ code: 'invalid_credentials' }, 400);
  await assert.rejects(client.signIn('a@b.co', '12345678'), { message: 'Correo o contraseña incorrectos.' });
});

test('signup confirmation and recovery use PKCE and password update uses authenticated request', async () => {
  const { client, calls, values, reply } = fixture();
  reply({ user: { id: 'user' } });
  assert.equal(await client.signUp('a@b.co', '12345678'), null);
  assert.ok(JSON.parse(calls[0].options.body as string).code_challenge);
  assert.equal(JSON.parse(values.get('michiratagame.auth.pkce')!).kind, 'signup');
  await client.resendConfirmation('a@b.co');
  await client.requestPasswordReset('a@b.co');
  assert.equal(JSON.parse(values.get('michiratagame.auth.pkce')!).kind, 'recovery');
  reply({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, user: { id: 'user' } });
  const back = await client.completeRedirect('https://game.example/?code=reset');
  assert.ok(back.handled && 'kind' in back && back.kind === 'recovery');
  await client.updatePassword('new-password');
  assert.equal(calls.at(-1)?.options.method, 'PUT');
  assert.equal((calls.at(-1)?.options.headers as Record<string, string>).Authorization, 'Bearer access');
});

test('refresh shares one request; rejected refresh clears session; logout clears locally', async () => {
  const { client, calls, advance, reply, values } = fixture();
  await client.signIn('a@b.co', '12345678');
  advance(3_550_000);
  reply({ access_token: 'new', refresh_token: 'new-refresh', expires_in: 3600, user: { id: 'user' } });
  assert.deepEqual(await Promise.all([client.accessToken(), client.accessToken()]), ['new', 'new']);
  assert.equal(calls.filter(call => call.url.endsWith('grant_type=refresh_token')).length, 1);
  advance(3_550_000); reply({ code: 'refresh_token_not_found' }, 401);
  await assert.rejects(client.accessToken(), AuthError); assert.equal(client.session(), null);
  reply({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, user: { id: 'user' } });
  await client.signIn('a@b.co', '12345678');
  reply({ code: 'session_not_found' }, 401); await client.signOut();
  assert.equal(values.has('michiratagame.auth.session'), false);
});

test('expired PKCE and provider failure clean callback without leaking server error description', async () => {
  const { client, advance } = fixture();
  await client.oauthUrl('facebook'); advance(24 * 60 * 60 * 1000);
  const back = await client.completeRedirect('https://game.example/?code=old');
  assert.ok(back.handled && 'error' in back && back.error.code === 'missing_verifier');
  const failure = await client.completeRedirect('https://game.example/?error=access_denied&error_description=private');
  assert.ok(failure.handled && 'error' in failure);
  assert.equal(failure.handled && failure.cleanUrl, 'https://game.example/');
});
