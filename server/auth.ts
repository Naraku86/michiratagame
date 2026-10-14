import type { DatabaseSync } from 'node:sqlite';

// Optional account layer. Disabled unless explicitly configured; the game, saves and the
// anonymous community board keep working without it. Sessions are never trusted locally:
// every access token is checked by Supabase Auth at GET /auth/v1/user.

export type AuthConfig =
  | { enabled: false }
  | { enabled: true; provider: 'supabase'; url: string; publishableKey: string; timeoutMs: number };

export type AuthUser = { id: string; email: string | null; emailVerified: boolean; provider: string; providers: string[] };
export type SessionResult =
  | { ok: true; user: AuthUser }
  | { ok: false; reason: 'disabled' | 'missing' | 'invalid' | 'unverified' | 'anonymous' | 'unavailable' };

export class AuthConfigError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const MAX_TOKEN = 8192;
const MAX_BODY = 64 * 1024;

/** Reads MICHI_AUTH_PROVIDER, SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY. Throws when enabled but wrong. */
export function loadAuthConfig(env: Record<string, string | undefined>): AuthConfig {
  const provider = (env.MICHI_AUTH_PROVIDER ?? '').trim();
  if (provider === '' || provider === 'none') return { enabled: false };
  if (provider !== 'supabase') throw new AuthConfigError(`MICHI_AUTH_PROVIDER desconocido: ${provider}`);
  const rawUrl = (env.SUPABASE_URL ?? '').trim();
  const key = (env.SUPABASE_PUBLISHABLE_KEY ?? '').trim();
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new AuthConfigError('SUPABASE_URL no es una URL válida.'); }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new AuthConfigError('SUPABASE_URL debe usar https.');
  if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== ''))
    throw new AuthConfigError('SUPABASE_URL debe ser sólo el origen del proyecto, sin ruta ni credenciales.');
  if (!key) throw new AuthConfigError('Falta SUPABASE_PUBLISHABLE_KEY.');
  // Elevated keys bypass Row Level Security and are never needed to validate a user session.
  if (/^sb_secret_/.test(key))
    throw new AuthConfigError('Usa la clave publicable (o anon heredada), nunca la clave secreta/service_role.');
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key) && !TOKEN.test(key))
    throw new AuthConfigError('SUPABASE_PUBLISHABLE_KEY no tiene el formato de una clave publicable o anon.');
  const timeoutMs = env.MICHI_AUTH_TIMEOUT_MS === undefined ? 5000 : Number(env.MICHI_AUTH_TIMEOUT_MS);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 15_000) throw new AuthConfigError('MICHI_AUTH_TIMEOUT_MS debe estar entre 500 y 15000.');
  return { enabled: true, provider: 'supabase', url: url.origin, publishableKey: key, timeoutMs };
}

/** Extracts a bearer token from an Authorization header; returns undefined for anything malformed. */
export function bearerToken(header: string | string[] | undefined): string | undefined {
  if (typeof header !== 'string') return undefined;
  const match = /^Bearer ([^\s]+)$/.exec(header.trim());
  return match && match[1].length <= MAX_TOKEN && TOKEN.test(match[1]) ? match[1] : undefined;
}

/** Asks Supabase Auth who owns the token. Any doubt (timeout, 5xx, odd payload) means "not authenticated". */
export async function validateSession(config: AuthConfig, token: string | undefined, fetcher: typeof fetch = fetch): Promise<SessionResult> {
  if (!config.enabled) return { ok: false, reason: 'disabled' };
  if (!token || token.length > MAX_TOKEN || !TOKEN.test(token)) return { ok: false, reason: 'missing' };
  let response: Response;
  try {
    response = await fetcher(`${config.url}/auth/v1/user`, {
      method: 'GET',
      headers: { apikey: config.publishableKey, Authorization: `Bearer ${token}`, Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch { return { ok: false, reason: 'unavailable' }; }
  if (response.status === 401 || response.status === 403) { await response.body?.cancel(); return { ok: false, reason: 'invalid' }; }
  if (response.status !== 200) { await response.body?.cancel(); return { ok: false, reason: 'unavailable' }; }
  let data: any;
  try {
    if (Number(response.headers.get('content-length') ?? 0) > MAX_BODY) throw new Error('too large');
    const text = await response.text();
    if (text.length > MAX_BODY) throw new Error('too large');
    data = JSON.parse(text);
  } catch { return { ok: false, reason: 'unavailable' }; }
  if (!data || typeof data !== 'object' || typeof data.id !== 'string' || !UUID.test(data.id)) return { ok: false, reason: 'unavailable' };
  if (data.is_anonymous === true) return { ok: false, reason: 'anonymous' };
  const meta = data.app_metadata && typeof data.app_metadata === 'object' ? data.app_metadata : {};
  const provider = typeof meta.provider === 'string' ? meta.provider : 'unknown';
  const providers = Array.isArray(meta.providers) ? meta.providers.filter((p: unknown): p is string => typeof p === 'string') : [provider];
  const emailVerified = typeof data.email_confirmed_at === 'string' && data.email_confirmed_at !== '';
  // Password accounts must prove the mailbox; OAuth providers vouch for their own users.
  if (provider === 'email' && !emailVerified) return { ok: false, reason: 'unverified' };
  return { ok: true, user: { id: data.id.toLowerCase(), email: typeof data.email === 'string' ? data.email : null, emailVerified, provider, providers } };
}

export type LinkResult =
  | { status: 'linked'; playerId: string }      // first link: this anonymous player now belongs to the account
  | { status: 'existing'; playerId: string }    // account already owns a player (maybe the same one)
  | { status: 'conflict'; playerId: string };   // this anonymous player already belongs to another account

/**
 * Links anonymous community players to auth users in a separate table. It never edits the
 * players table nor any Supabase table; callers must pass a playerId resolved from the
 * HttpOnly player cookie, never from the request body.
 */
export function createAuthLinks(db: DatabaseSync, now = Date.now) {
  db.exec(`CREATE TABLE IF NOT EXISTS auth_links (
    auth_user_id TEXT PRIMARY KEY, player_id TEXT UNIQUE NOT NULL,
    provider TEXT NOT NULL, linked_at INTEGER NOT NULL
  );`);
  const byUser = db.prepare('SELECT player_id FROM auth_links WHERE auth_user_id = ?');
  const byPlayer = db.prepare('SELECT auth_user_id FROM auth_links WHERE player_id = ?');
  const insert = db.prepare('INSERT INTO auth_links(auth_user_id, player_id, provider, linked_at) VALUES (?, ?, ?, ?)');
  return {
    playerFor(userId: string): string | undefined {
      return byUser.get(userId.toLowerCase())?.player_id as string | undefined;
    },
    link(user: AuthUser, playerId: string): LinkResult {
      if (!UUID.test(user.id) || !playerId) throw new Error('Identidad inválida.');
      const userId = user.id.toLowerCase();
      // IMMEDIATE takes the write lock first, so two concurrent links cannot both pass the checks.
      db.exec('BEGIN IMMEDIATE');
      try {
        let result: LinkResult;
        const owned = byUser.get(userId)?.player_id as string | undefined;
        const owner = byPlayer.get(playerId)?.auth_user_id as string | undefined;
        if (owned) result = { status: 'existing', playerId: owned };
        else if (owner) result = { status: 'conflict', playerId };
        else { insert.run(userId, playerId, user.provider, now()); result = { status: 'linked', playerId }; }
        db.exec('COMMIT');
        return result;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
}

/** HTTP status a future /api/auth/* route should answer for each failure reason. */
export function sessionStatus(reason: Exclude<SessionResult, { ok: true }>['reason']): number {
  return { disabled: 404, missing: 401, invalid: 401, unverified: 403, anonymous: 403, unavailable: 503 }[reason];
}
