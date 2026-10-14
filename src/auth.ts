import { isPublishableKey } from './auth-key.ts';

// Optional Supabase Auth helper without SDK or UI. It only talks to the documented REST API
// (/auth/v1/*) with the publishable key, uses PKCE for OAuth, email confirmation and password
// recovery, and never touches the game save. Without configuration it stays disabled.

export type OAuthProvider = 'google' | 'facebook';
export type FlowKind = 'oauth' | 'signup' | 'recovery';
export type AuthSession = { accessToken: string; refreshToken: string; expiresAt: number; user: { id: string; email: string | null } };
export interface AuthStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void; }
export type AuthEnv = { VITE_SUPABASE_URL?: string; VITE_SUPABASE_PUBLISHABLE_KEY?: string; VITE_AUTH_REDIRECT_URL?: string };
export type AuthSetup =
  | { status: 'disabled' }
  | { status: 'misconfigured'; message: string }
  | { status: 'ready'; client: AuthClient };
export type RedirectResult =
  | { handled: false }
  | { handled: true; kind: FlowKind; session: AuthSession; cleanUrl: string }
  | { handled: true; error: AuthError; cleanUrl: string };

export class AuthError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(message: string, code: string, status = 0) { super(message); this.code = code; this.status = status; }
}

const SESSION_KEY = 'michiratagame.auth.session';
const VERIFIER_KEY = 'michiratagame.auth.pkce';
const VERIFIER_MAX_AGE = 24 * 60 * 60 * 1000;
const TIMEOUT = 8000;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'Confirma tu correo antes de entrar.',
  user_already_exists: 'Ya existe una cuenta con ese correo.',
  email_exists: 'Ya existe una cuenta con ese correo.',
  weak_password: 'La contraseña es demasiado débil.',
  same_password: 'La nueva contraseña debe ser distinta.',
  over_email_send_rate_limit: 'Se enviaron demasiados correos. Espera un poco.',
  over_request_rate_limit: 'Demasiados intentos. Espera un poco.',
  flow_state_expired: 'El enlace caducó. Vuelve a intentarlo.',
  flow_state_not_found: 'El enlace ya se usó o caducó. Vuelve a intentarlo.',
  bad_code_verifier: 'Abre el enlace en el mismo navegador donde lo pediste.',
  missing_verifier: 'Abre el enlace en el mismo navegador donde lo pediste.',
  signup_disabled: 'El registro está desactivado.',
  email_provider_disabled: 'El acceso por correo está desactivado.',
  provider_disabled: 'Ese proveedor no está activado.',
  session_not_found: 'Tu sesión terminó. Entra de nuevo.',
  session_expired: 'Tu sesión terminó. Entra de nuevo.',
  refresh_token_not_found: 'Tu sesión terminó. Entra de nuevo.',
  refresh_token_already_used: 'Tu sesión terminó. Entra de nuevo.',
  timeout: 'El servicio de cuentas no respondió. Tu partida sigue guardada en este dispositivo.',
  network: 'Sin conexión con el servicio de cuentas. Tu partida sigue guardada en este dispositivo.',
};

/** Reads Vite env vars. Missing config disables accounts; wrong config never offers login. */
export function setupAuth(env: AuthEnv, deps: { storage: AuthStorage; fetch?: typeof fetch; now?: () => number; origin: string }): AuthSetup {
  const rawUrl = env.VITE_SUPABASE_URL?.trim() ?? '';
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
  if (!rawUrl && !key) return { status: 'disabled' };
  try {
    const url = new URL(rawUrl);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('VITE_SUPABASE_URL debe usar https.');
    if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('VITE_SUPABASE_URL debe ser sólo el origen.');
    if (/^sb_secret_/.test(key)) throw new Error('Nunca pongas la clave secreta en el cliente.');
    if (!isPublishableKey(key)) throw new Error('Falta una clave publicable válida.');
    const redirect = new URL(env.VITE_AUTH_REDIRECT_URL?.trim() || '/', deps.origin);
    if (redirect.origin !== new URL(deps.origin).origin) throw new Error('VITE_AUTH_REDIRECT_URL debe estar en el mismo dominio del juego.');
    return { status: 'ready', client: new AuthClient(url.origin, key, redirect.href, deps.storage, deps.fetch ?? fetch.bind(globalThis), deps.now ?? Date.now) };
  } catch (error) {
    return { status: 'misconfigured', message: error instanceof Error ? error.message : 'Configuración inválida.' };
  }
}

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export class AuthClient {
  private refreshing?: Promise<AuthSession | null>;
  readonly url: string;
  readonly redirectTo: string;
  private readonly key: string;
  private readonly storage: AuthStorage;
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  constructor(url: string, key: string, redirectTo: string, storage: AuthStorage, fetcher: typeof fetch, now: () => number) {
    this.url = url; this.key = key; this.redirectTo = redirectTo; this.storage = storage; this.fetcher = fetcher; this.now = now;
  }

  private async request(method: string, path: string, body?: unknown, token?: string): Promise<any> {
    const headers: Record<string, string> = { apikey: this.key, Accept: 'application/json', 'X-Supabase-Api-Version': '2024-01-01' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    let response: Response;
    try {
      response = await this.fetcher(`${this.url}/auth/v1${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT),
      });
    } catch (error) {
      const timeout = error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');
      throw new AuthError(MESSAGES[timeout ? 'timeout' : 'network'], timeout ? 'timeout' : 'network');
    }
    const text = await response.text().catch(() => '');
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }
    if (!response.ok) {
      const code = typeof data?.code === 'string' ? data.code : typeof data?.error_code === 'string' ? data.error_code : `http_${response.status}`;
      throw new AuthError(MESSAGES[code] ?? 'No se pudo completar el acceso.', code, response.status);
    }
    return data;
  }

  private async challenge(kind: FlowKind) {
    const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)));
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    // One pending flow per browser; a newer request replaces the previous link.
    this.storage.setItem(VERIFIER_KEY, JSON.stringify({ verifier, kind, createdAt: this.now() }));
    return { code_challenge: base64url(digest), code_challenge_method: 's256' };
  }

  private storeSession(data: any): AuthSession {
    if (typeof data?.access_token !== 'string' || typeof data?.refresh_token !== 'string' || typeof data?.user?.id !== 'string')
      throw new AuthError('Respuesta de sesión inválida.', 'invalid_session');
    const expiresAt = Number.isFinite(data.expires_at) ? data.expires_at * 1000 : this.now() + Number(data.expires_in ?? 0) * 1000;
    const session: AuthSession = { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt, user: { id: data.user.id, email: data.user.email ?? null } };
    this.storage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  private redirect(path = '') { return `?redirect_to=${encodeURIComponent(this.redirectTo)}${path}`; }

  /** Stored session without network checks; the server must still validate it. */
  session(): AuthSession | null {
    try {
      const value = JSON.parse(this.storage.getItem(SESSION_KEY) ?? 'null');
      return typeof value?.accessToken === 'string' && typeof value?.refreshToken === 'string' && typeof value?.user?.id === 'string' ? value : null;
    } catch { return null; }
  }

  /** Access token for API calls, refreshed one minute before expiry. */
  async accessToken(): Promise<string | null> {
    const current = this.session();
    if (!current) return null;
    if (current.expiresAt - this.now() > 60_000) return current.accessToken;
    this.refreshing ??= this.request('POST', '/token?grant_type=refresh_token', { refresh_token: current.refreshToken })
      .then(data => this.storeSession(data))
      .catch(error => {
        // Rejected refresh tokens end the session; network failures keep it for a later retry.
        if (error instanceof AuthError && error.status >= 400 && error.status < 500) this.storage.removeItem(SESSION_KEY);
        throw error;
      })
      .finally(() => { this.refreshing = undefined; });
    return (await this.refreshing)?.accessToken ?? null;
  }

  /** URL to send the browser to; Supabase redirects back to redirectTo with ?code=. */
  async oauthUrl(provider: OAuthProvider): Promise<string> {
    if (provider !== 'google' && provider !== 'facebook') throw new AuthError('Proveedor no soportado.', 'provider_disabled');
    const pkce = await this.challenge('oauth');
    const params = new URLSearchParams({ provider, redirect_to: this.redirectTo, ...pkce });
    return `${this.url}/auth/v1/authorize?${params}`;
  }

  /** Returns a session when email confirmation is off, otherwise null until the link is opened. */
  async signUp(email: string, password: string): Promise<AuthSession | null> {
    checkCredentials(email, password);
    const data = await this.request('POST', `/signup${this.redirect()}`, { email: email.trim(), password, ...(await this.challenge('signup')) });
    return data?.access_token ? this.storeSession(data) : null;
  }

  async signIn(email: string, password: string): Promise<AuthSession> {
    checkCredentials(email, password);
    return this.storeSession(await this.request('POST', '/token?grant_type=password', { email: email.trim(), password }));
  }

  async resendConfirmation(email: string): Promise<void> {
    if (!EMAIL.test(email.trim())) throw new AuthError('Escribe un correo válido.', 'validation_failed');
    await this.request('POST', `/resend${this.redirect()}`, { type: 'signup', email: email.trim() });
  }

  /** Always resolves the same way for known and unknown emails, like Supabase does. */
  async requestPasswordReset(email: string): Promise<void> {
    if (!EMAIL.test(email.trim())) throw new AuthError('Escribe un correo válido.', 'validation_failed');
    await this.request('POST', `/recover${this.redirect()}`, { email: email.trim(), ...(await this.challenge('recovery')) });
  }

  /** Requires the session returned by completeRedirect for a recovery link (or a fresh login). */
  async updatePassword(password: string): Promise<void> {
    checkCredentials('a@b.co', password);
    const token = await this.accessToken();
    if (!token) throw new AuthError(MESSAGES.session_not_found, 'session_not_found');
    await this.request('PUT', '/user', { password }, token);
  }

  /** Handles ?code= or ?error= after OAuth, email confirmation or recovery. Call once on startup. */
  async completeRedirect(href: string): Promise<RedirectResult> {
    const url = new URL(href);
    const hash = new URLSearchParams(url.hash.slice(1));
    const code = url.searchParams.get('code');
    const failure = url.searchParams.get('error_code') ?? url.searchParams.get('error') ?? hash.get('error_code') ?? hash.get('error');
    if (!code && !failure) return { handled: false };
    for (const name of ['code', 'error', 'error_code', 'error_description', 'state']) url.searchParams.delete(name);
    if (failure) url.hash = '';
    const cleanUrl = url.href;
    if (failure) return { handled: true, error: new AuthError(MESSAGES[failure] ?? 'No se pudo completar el acceso.', failure), cleanUrl };
    let pending: { verifier?: unknown; kind?: unknown; createdAt?: unknown } | null = null;
    try { pending = JSON.parse(this.storage.getItem(VERIFIER_KEY) ?? 'null'); } catch { /* corrupt entry */ }
    this.storage.removeItem(VERIFIER_KEY);
    const fresh = typeof pending?.createdAt === 'number' && this.now() - pending.createdAt < VERIFIER_MAX_AGE;
    if (typeof pending?.verifier !== 'string' || !fresh || !['oauth', 'signup', 'recovery'].includes(pending.kind as string))
      return { handled: true, error: new AuthError(MESSAGES.missing_verifier, 'missing_verifier'), cleanUrl };
    try {
      const session = this.storeSession(await this.request('POST', '/token?grant_type=pkce', { auth_code: code, code_verifier: pending.verifier }));
      return { handled: true, kind: pending.kind as FlowKind, session, cleanUrl };
    } catch (error) {
      return { handled: true, error: error instanceof AuthError ? error : new AuthError('No se pudo completar el acceso.', 'unknown'), cleanUrl };
    }
  }

  /** Local logout always succeeds offline; 'global' also closes other devices. */
  async signOut(scope: 'local' | 'global' = 'local'): Promise<void> {
    const current = this.session();
    this.storage.removeItem(SESSION_KEY);
    this.storage.removeItem(VERIFIER_KEY);
    if (!current) return;
    try { await this.request('POST', `/logout?scope=${scope}`, undefined, current.accessToken); } catch { /* token expires on its own */ }
  }
}

function checkCredentials(email: string, password: string) {
  if (!EMAIL.test(email.trim())) throw new AuthError('Escribe un correo válido.', 'validation_failed');
  // Supabase hashes with bcrypt, which only uses the first 72 bytes.
  if (password.length < 8 || new TextEncoder().encode(password).length > 72) throw new AuthError('Usa una contraseña de 8 a 72 caracteres.', 'weak_password');
}
