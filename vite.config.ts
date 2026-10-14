import { defineConfig, loadEnv } from 'vite';
import { isPublishableKey } from './src/auth-key.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  // Reject secret keys before Vite can embed them in the public bundle.
  if (key && !isPublishableKey(key)) throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY debe ser una clave publicable o anon; se cancela el build.');
  if (env.VITE_SUPABASE_URL) {
    const url = new URL(env.VITE_SUPABASE_URL);
    if (url.username || url.password) throw new Error('La URL pública de Supabase no debe contener credenciales.');
  }
  return { server: { proxy: { '/api': process.env.MICHI_DEV_API_URL ?? 'http://127.0.0.1:4174' } } };
});
