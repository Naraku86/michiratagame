import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { loadAuthConfig, validateSession, bearerToken, createAuthLinks, sessionStatus, AuthConfigError, type AuthUser } from './auth.ts';
import { setupAuth, AuthClient, AuthError, type AuthStorage } from '../src/auth.ts';

// All Supabase traffic is mocked; nothing here reaches a real project or the public domain.
const URL_OK = 'https://abcdefghijklmnop.supabase.co';
const KEY = 'sb_publishable_test_key';
const TOKEN = 'aaa.bbb.ccc';
const USER_ID = '11111111-2222-4333-8444-555555555555';
type Call = { url: string; init: RequestInit };
function mockFetch(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetcher = (async (url: string | URL, init: RequestInit = {}) => {
    const call = { url: String(url), init }; calls.push(call); return handler(call);
  }) as typeof fetch;
  return { fetcher, calls };
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const enabled = loadAuthConfig({ MICHI_AUTH_PROVIDER: 'supabase', SUPABASE_URL: URL_OK, SUPABASE_PUBLISHABLE_KEY: KEY });

test('auth stays disabled without configuration and fails closed when enabled config is wrong', () => {
  assert.deepEqual(loadAuthConfig({}), { enabled: false });
  assert.deepEqual(loadAuthConfig({ MICHI_AUTH_PROVIDER: 'none' }), { enabled: false });
  assert.deepEqual(enabled, { enabled: true, provider: 'supabase', url: URL_OK, publishableKey: KEY, timeoutMs: 5000 });
  const bad: Record<string, string | undefined>[] = [
    { MICHI_AUTH_PROVIDER: 'firebase' },
    { MICHI_AUTH_PROVIDER: 'supabase', SUPABASE_URL: URL_OK },
    { MICHI_AUTH_PROVIDER: 'supabase', SUPABASE_PUBLISHABLE_KEY: KEY },
    { MICHI_AUTH_PROVIDER: 'supabase', SUPABASE_URL: 'http://abc.supabase.co', SUPABASE_PUBLISHABLE_KEY: KEY },
    { MICHI_AUTH_PROVIDER: 'supabase', SUPABASE_URL: URL_OK + '/auth/v1', SUPABASE_PUBLISHABLE_KEY: KEY },
    { MICHI_AUTH_PROVIDER: 'supabase', SUPABASE_URL: 'https://user:pw@abc.supabase.co', SUPABASE_PUBLISHABLE_KEY: KEY },
    { MICHI_AUTH_PROVIDER: 'supabase', SUPABASE_URL: URL_OK, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_nope' },
    { MICHI_AUTH_PROVIDER: 'supabase', SUPABASE_URL: URL_OK, SUPABASE_PUBLISHABLE_KEY: 'not a key' },
    { MICHI_AUTH_PROVIDER: 'supabase', SUPABASE_URL: URL_OK, SUPABASE_PUBLISHABLE_KEY: KEY, MICHI_AUTH_TIMEOUT_MS: '0' },
  ];
  for (const env of bad) assert.throws(() => loadAuthConfig(env), AuthConfigError, JSON.stringify(env));
  assert.equal(loadAuthConfig({ MICHI_AUTH_PROVIDER: 'supabase', SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_PUBLISHABLE_KEY: KEY }).enabled, true);
});

test('bearer tokens are parsed strictly', () => {
  assert.equal(bearerToken(`Bearer ${TOKEN}`), TOKEN);
  for (const header of [undefined, '', TOKEN, `Basic ${TOKEN}`, 'Bearer a.b', `Bearer ${TOKEN} x`, ['Bearer a.b.c'], `Bearer ${'a'.repeat(9000)}.b.c`])
    assert.equal(bearerToken(header as any), undefined);
});

test('sessions are validated only by Supabase /auth/v1/user with the publishable key', async () => {
  const { fetcher, calls } = mockFetch(() => json(200, { id: USER_ID.toUpperCase(), email: 'm@example.com', email_confirmed_at: '2026-10-01T00:00:00Z', app_metadata: { provider: 'google', providers: ['google'] } }));
  const result = await validateSession(enabled, TOKEN, fetcher);
  assert.deepEqual(result, { ok: true, user: { id: USER_ID, email: 'm@example.com', emailVerified: true, provider: 'google', providers: ['google'] } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${URL_OK}/auth/v1/user`);
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers.apikey, KEY); assert.equal(headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(calls[0].init.redirect, 'error'); assert.ok(calls[0].init.signal);
});

test('session validation fails closed on every doubtful answer', async () => {
  const cases: [() => Response | Promise<Response>, string][] = [
    [() => json(401, { code: 'bad_jwt' }), 'invalid'],
    [() => json(403, { code: 'session_not_found' }), 'invalid'],
    [() => json(500, {}), 'unavailable'],
    [() => json(429, {}), 'unavailable'],
    [() => new Response('<html>', { status: 200 }), 'unavailable'],
    [() => json(200, { id: 'not-a-uuid' }), 'unavailable'],
    [() => json(200, [USER_ID]), 'unavailable'],
    [() => new Response('x'.repeat(70_000), { status: 200 }), 'unavailable'],
    [() => json(200, { id: USER_ID, is_anonymous: true }), 'anonymous'],
    [() => json(200, { id: USER_ID, email: 'm@example.com', email_confirmed_at: null, app_metadata: { provider: 'email' } }), 'unverified'],
    [() => { throw new TypeError('fetch failed'); }, 'unavailable'],
    [() => { throw new DOMException('timed out', 'TimeoutError'); }, 'unavailable'],
  ];
  for (const [handler, reason] of cases) {
    const result = await validateSession(enabled, TOKEN, mockFetch(handler).fetcher);
    assert.deepEqual(result, { ok: false, reason }, reason);
  }
  const { fetcher, calls } = mockFetch(() => json(200, { id: USER_ID }));
  assert.deepEqual(await validateSession({ enabled: false }, TOKEN, fetcher), { ok: false, reason: 'disabled' });
  assert.deepEqual(await validateSession(enabled, undefined, fetcher), { ok: false, reason: 'missing' });
  assert.deepEqual(await validateSession(enabled, 'no-jwt', fetcher), { ok: false, reason: 'missing' });
  assert.equal(calls.length, 0, 'no request without a well-formed token');
  assert.equal(sessionStatus('unavailable'), 503); assert.equal(sessionStatus('invalid'), 401);
});

test('a request that never answers is aborted by the timeout', async () => {
  const fast = { ...enabled, timeoutMs: 50 } as typeof enabled;
  const hang = (_: string | URL, init: RequestInit = {}) => new Promise<Response>((_, reject) => init.signal!.addEventListener('abort', () => reject(init.signal!.reason)));
  assert.deepEqual(await validateSession(fast, TOKEN, hang as typeof fetch), { ok: false, reason: 'unavailable' });
});

test('anonymous players link to one account each, atomically and without stealing identities', () => {
  const db = new DatabaseSync(':memory:');
  const links = createAuthLinks(db, () => 42);
  const user = (id: string): AuthUser => ({ id, email: null, emailVerified: true, provider: 'google', providers: ['google'] });
  const alice = user(USER_ID); const bob = user('99999999-2222-4333-8444-555555555555');
  assert.deepEqual(links.link(alice, 'player-a'), { status: 'linked', playerId: 'player-a' });
  assert.deepEqual(links.link(alice, 'player-a'), { status: 'existing', playerId: 'player-a' });
  // Same account on a second device keeps its original player; the new anonymous one stays untouched.
  assert.deepEqual(links.link(alice, 'player-b'), { status: 'existing', playerId: 'player-a' });
  // Another account cannot claim a player that already belongs to someone.
  assert.deepEqual(links.link(bob, 'player-a'), { status: 'conflict', playerId: 'player-a' });
  assert.deepEqual(links.link(bob, 'player-b'), { status: 'linked', playerId: 'player-b' });
  assert.equal(links.playerFor(USER_ID.toUpperCase()), 'player-a');
  assert.throws(() => links.link(user('bad'), 'player-c'));
  // Constraint violations roll back and leave the connection usable.
  db.exec("CREATE TRIGGER boom BEFORE INSERT ON auth_links WHEN NEW.player_id = 'player-x' BEGIN SELECT RAISE(ABORT, 'boom'); END;");
  assert.throws(() => links.link(user('77777777-2222-4333-8444-555555555555'), 'player-x'), /boom/);
  assert.equal(db.isTransaction, false);
  assert.deepEqual(db.prepare('SELECT auth_user_id, player_id, provider, linked_at FROM auth_links ORDER BY player_id').all().map(row => ({ ...row })), [
    { auth_user_id: USER_ID, player_id: 'player-a', provider: 'google', linked_at: 42 },
    { auth_user_id: bob.id, player_id: 'player-b', provider: 'google', linked_at: 42 },
  ]);
  createAuthLinks(db); // idempotent migration
  db.close();
});

// Browser helper (src/auth.ts) tested with in-memory storage and mocked HTTP.
function memoryStorage(): AuthStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); }, removeItem: key => { data.delete(key); } };
}
function client(handler: (call: Call) => Response | Promise<Response>, now = () => 1_000_000) {
  const storage = memoryStorage();
  const mock = mockFetch(handler);
  const setup = setupAuth({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_PUBLISHABLE_KEY: KEY }, { storage, fetch: mock.fetcher, now, origin: 'https://game.example' });
  assert.equal(setup.status, 'ready');
  return { auth: (setup as { client: AuthClient }).client, storage, calls: mock.calls };
}
const tokenResponse = (extra = {}) => json(200, { access_token: TOKEN, refresh_token: 'refresh-1', expires_in: 3600, user: { id: USER_ID, email: 'm@example.com' }, ...extra });

test('browser helper is optional and never accepts secret keys or foreign redirects', () => {
  const deps = { storage: memoryStorage(), origin: 'https://game.example' };
  assert.equal(setupAuth({}, deps).status, 'disabled');
  for (const env of [
    { VITE_SUPABASE_URL: URL_OK },
    { VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_x' },
    { VITE_SUPABASE_URL: 'http://abc.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: KEY },
    { VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_PUBLISHABLE_KEY: KEY, VITE_AUTH_REDIRECT_URL: 'https://evil.example/' },
  ]) assert.equal(setupAuth(env, deps).status, 'misconfigured', JSON.stringify(env));
});

test('OAuth uses PKCE S256 and the code is exchanged once in the same browser', async () => {
  const { auth, storage, calls } = client(() => tokenResponse());
  const target = new URL(await auth.oauthUrl('google'));
  assert.equal(target.origin + target.pathname, `${URL_OK}/auth/v1/authorize`);
  assert.equal(target.searchParams.get('provider'), 'google');
  assert.equal(target.searchParams.get('redirect_to'), 'https://game.example/');
  assert.equal(target.searchParams.get('code_challenge_method'), 's256');
  const { verifier } = JSON.parse(storage.data.get('michiratagame.auth.pkce')!);
  const expected = createHash('sha256').update(verifier).digest('base64url');
  assert.equal(target.searchParams.get('code_challenge'), expected);
  assert.equal(calls.length, 0, 'building the URL does not contact Supabase');

  const result = await auth.completeRedirect('https://game.example/?code=abc-123&keep=1#x');
  assert.ok(result.handled && 'session' in result);
  assert.equal(result.kind, 'oauth'); assert.equal(result.cleanUrl, 'https://game.example/?keep=1#x');
  assert.equal(calls[0].url, `${URL_OK}/auth/v1/token?grant_type=pkce`);
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { auth_code: 'abc-123', code_verifier: verifier });
  assert.equal((calls[0].init.headers as Record<string, string>).apikey, KEY);
  assert.equal(storage.data.has('michiratagame.auth.pkce'), false);
  assert.equal(auth.session()!.user.id, USER_ID);
  assert.equal(auth.session()!.expiresAt, 1_000_000 + 3_600_000);
  // A replayed link has no verifier left and is refused locally.
  const replay = await auth.completeRedirect('https://game.example/?code=abc-123');
  assert.ok(replay.handled && 'error' in replay); assert.equal(replay.error.code, 'missing_verifier');
  assert.deepEqual(await auth.completeRedirect('https://game.example/?level=3'), { handled: false });
});

test('redirect errors and rejected exchanges surface without creating a session', async () => {
  const { auth } = client(() => json(400, { code: 'flow_state_expired', msg: 'expired' }));
  const denied = await auth.completeRedirect('https://game.example/?error=access_denied&error_description=nope');
  assert.ok(denied.handled && 'error' in denied); assert.equal(denied.cleanUrl, 'https://game.example/');
  await auth.oauthUrl('facebook');
  const expired = await auth.completeRedirect('https://game.example/?code=x');
  assert.ok(expired.handled && 'error' in expired); assert.equal(expired.error.code, 'flow_state_expired');
  assert.equal(auth.session(), null);
});

test('email sign-up, confirmation, login, recovery and password update use the documented endpoints', async () => {
  const replies: Response[] = [
    json(200, { id: USER_ID, email: 'm@example.com' }), // signup pending confirmation
    tokenResponse(),                                     // pkce exchange of confirmation link
    json(200, {}),                                       // recover
    tokenResponse({ refresh_token: 'refresh-2' }),       // pkce exchange of recovery link
    json(200, { id: USER_ID }),                          // PUT /user
    tokenResponse(),                                     // password login
    json(200, {}),                                       // resend
  ];
  const { auth, calls } = client(() => replies.shift()!);
  assert.equal(await auth.signUp(' m@example.com ', 'michirata-123'), null);
  assert.equal(calls[0].url, `${URL_OK}/auth/v1/signup?redirect_to=${encodeURIComponent('https://game.example/')}`);
  const signup = JSON.parse(String(calls[0].init.body));
  assert.equal(signup.email, 'm@example.com'); assert.equal(signup.code_challenge_method, 's256'); assert.ok(signup.code_challenge);
  const confirmed = await auth.completeRedirect('https://game.example/?code=c1');
  assert.ok(confirmed.handled && 'kind' in confirmed); assert.equal(confirmed.kind, 'signup');

  await auth.requestPasswordReset('m@example.com');
  assert.match(calls[2].url, /\/auth\/v1\/recover\?redirect_to=/);
  assert.ok(JSON.parse(String(calls[2].init.body)).code_challenge);
  const recovery = await auth.completeRedirect('https://game.example/?code=r1');
  assert.ok(recovery.handled && 'kind' in recovery); assert.equal(recovery.kind, 'recovery');
  await auth.updatePassword('nueva-clave-segura');
  assert.equal(calls[4].init.method, 'PUT'); assert.equal((calls[4].init.headers as Record<string, string>).Authorization, `Bearer ${TOKEN}`);

  await auth.signIn('m@example.com', 'nueva-clave-segura');
  assert.equal(calls[5].url, `${URL_OK}/auth/v1/token?grant_type=password`);
  await auth.resendConfirmation('m@example.com');
  assert.deepEqual(JSON.parse(String(calls[6].init.body)), { type: 'signup', email: 'm@example.com' });

  await assert.rejects(auth.signIn('no-email', 'michirata-123'), { code: 'validation_failed' });
  await assert.rejects(auth.signUp('m@example.com', 'corta'), { code: 'weak_password' });
  await assert.rejects(auth.signUp('m@example.com', 'ñ'.repeat(40)), { code: 'weak_password' });
  assert.equal(calls.length, 7, 'invalid input never reaches the network');
});

test('Supabase error codes, timeouts and network failures become readable AuthErrors', async () => {
  for (const [response, code, status] of [
    [json(400, { code: 'invalid_credentials', msg: 'Invalid login credentials' }), 'invalid_credentials', 400],
    [json(400, { error_code: 'email_not_confirmed' }), 'email_not_confirmed', 400],
    [new Response('<html>bad gateway', { status: 502 }), 'http_502', 502],
  ] as const) {
    const { auth } = client(() => response);
    await assert.rejects(auth.signIn('m@example.com', 'michirata-123'), (error: AuthError) => error.code === code && error.status === status && error.message.length > 0);
  }
  for (const [thrown, code] of [[new DOMException('t', 'TimeoutError'), 'timeout'], [new TypeError('offline'), 'network']] as const) {
    const { auth } = client(() => { throw thrown; });
    await assert.rejects(auth.signIn('m@example.com', 'michirata-123'), { code });
  }
});

test('tokens refresh before expiry, once per tab, and rejected refreshes end the session', async () => {
  let time = 1_000_000;
  let answer = () => tokenResponse();
  const { auth, calls } = client(() => answer(), () => time);
  await auth.signIn('m@example.com', 'michirata-123');
  assert.equal(await auth.accessToken(), TOKEN);
  answer = () => tokenResponse({ access_token: 'new.access.token', refresh_token: 'refresh-2', expires_in: 3600 });
  time += 3_600_000 - 30_000;
  const [a, b] = await Promise.all([auth.accessToken(), auth.accessToken()]);
  assert.equal(a, 'new.access.token'); assert.equal(b, 'new.access.token');
  assert.equal(calls.filter(call => call.url.includes('grant_type=refresh_token')).length, 1);
  assert.deepEqual(JSON.parse(String(calls[1].init.body)), { refresh_token: 'refresh-1' });

  time += 3_600_000;
  answer = () => { throw new TypeError('offline'); };
  await assert.rejects(auth.accessToken(), { code: 'network' });
  assert.ok(auth.session(), 'offline keeps the session for later');
  answer = () => json(400, { code: 'refresh_token_already_used' });
  await assert.rejects(auth.accessToken(), { code: 'refresh_token_already_used' });
  assert.equal(auth.session(), null);
});

test('logout clears local state even offline and never touches the game save', async () => {
  const { auth, storage, calls } = client(() => tokenResponse());
  storage.setItem('michiratagame.demo', '{"version":2}');
  await auth.signIn('m@example.com', 'michirata-123');
  await auth.oauthUrl('google');
  calls.length = 0;
  await auth.signOut('global');
  assert.equal(calls[0].url, `${URL_OK}/auth/v1/logout?scope=global`);
  assert.equal(auth.session(), null);
  assert.equal(storage.data.has('michiratagame.auth.pkce'), false);
  assert.equal(storage.getItem('michiratagame.demo'), '{"version":2}');

  let fail = false;
  const second = client(() => { if (fail) throw new TypeError('offline'); return tokenResponse(); });
  await second.auth.signIn('m@example.com', 'michirata-123');
  fail = true;
  await second.auth.signOut();
  assert.equal(second.auth.session(), null);
  await second.auth.signOut(); // no session: no request
  assert.equal(second.calls.length, 2);
});
