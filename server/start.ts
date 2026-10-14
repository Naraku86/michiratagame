import { loadEnvFile } from 'node:process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from './app.ts';

try { loadEnvFile(); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }

const directory = resolve(process.env.MICHI_DATA_DIR ?? 'data');
mkdirSync(directory, { recursive: true, mode: 0o700 });
const port = Number(process.env.PORT ?? 4174);
const host = process.env.MICHI_HOST ?? '127.0.0.1';
const server = createApp(resolve(directory, 'community.sqlite'), resolve('dist'));
if (process.env.MICHI_MAX_CONNECTIONS) server.maxConnections = Number(process.env.MICHI_MAX_CONNECTIONS);
server.listen(port, host, () => console.log(`Michiratagame: http://${host}:${port}`));

let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Michiratagame: ${signal} recibido, cerrando conexiones.`);
  server.closeIdleConnections?.();
  const force = setTimeout(() => {
    console.log('Michiratagame: forzando cierre de conexiones abiertas.');
    server.closeAllConnections?.();
    process.exit(0);
  }, 5_000);
  force.unref();
  server.close(() => {
    clearTimeout(force);
    process.exit(0);
  });
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => shutdown(signal));
