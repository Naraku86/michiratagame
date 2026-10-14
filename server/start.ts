import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from './app.ts';
const directory = resolve(process.env.MICHI_DATA_DIR ?? 'data');
mkdirSync(directory, { recursive: true, mode: 0o700 });
const port = Number(process.env.PORT ?? 4174);
const server = createApp(resolve(directory, 'community.sqlite'), resolve('dist'));
server.listen(port, '127.0.0.1', () => console.log(`Michiratagame: http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close());
