import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.ts';
import type { Server } from 'node:http';

// Deterministic local load probe: bounded, self-contained, no external network.
// It starts an ephemeral 127.0.0.1 server (or targets LOAD_URL / argv[2]) and
// sends at most 1000 requests with at most 10 concurrent workers, reporting
// accepted vs 429 counts, latency percentiles, and observed memory deltas.
const TOTAL = Math.min(1000, Math.max(1, Number(process.env.LOAD_TOTAL ?? 1000)));
const CONCURRENCY = Math.min(10, Math.max(1, Number(process.env.LOAD_CONCURRENCY ?? 10)));

async function startEphemeral(): Promise<{ base: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), 'michi-load-'));
  const dist = join(dir, 'dist');
  await mkdir(dist);
  await writeFile(join(dist, 'index.html'), 'demo');
  const server: Server = createApp(join(dir, 'test.sqlite'), dist);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = address && typeof address !== 'string' ? address.port : 0;
  return {
    base: `http://127.0.0.1:${port}`,
    cleanup: async () => {
      server.closeIdleConnections?.();
      await new Promise<void>(resolve => server.close(() => resolve()));
      await rm(dir, { recursive: true, force: true });
    },
  };
}

const target = process.env.LOAD_URL ?? process.argv[2];
const ephemeral = target ? null : await startEphemeral();
const base = target ?? ephemeral!.base;

const before = process.memoryUsage();
const durations: number[] = [];
const errors: string[] = [];
let accepted = 0;
let limited = 0;
let other = 0;
let cookie = '';
let next = 0;

async function worker(): Promise<void> {
  for (;;) {
    const i = next++;
    if (i >= TOTAL) return;
    const started = performance.now();
    try {
      const response = await fetch(base + '/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify({ points: 1 }),
      });
      durations.push(performance.now() - started);
      if (response.status === 200) {
        accepted++;
        if (!cookie) cookie = response.headers.get('set-cookie')?.split(';')[0] ?? '';
      } else if (response.status === 429) {
        limited++;
      } else {
        other++;
      }
      await response.arrayBuffer();
    } catch (error) {
      errors.push(String(error));
    }
  }
}

const startedAt = performance.now();
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
const elapsedMs = Math.round(performance.now() - startedAt);
const after = process.memoryUsage();

durations.sort((a, b) => a - b);
const percentile = (p: number) =>
  durations.length ? durations[Math.min(durations.length - 1, Math.floor((p / 100) * durations.length))] : 0;

const formatMs = (value: number) => `${value.toFixed(1)} ms`;
const formatMb = (value: number) => `${(value / 1024 / 1024).toFixed(1)} MB`;

console.log(`Objetivo: ${base}`);
console.log(`Solicitudes: ${TOTAL} · concurrencia: ${CONCURRENCY} · duración total: ${elapsedMs} ms`);
console.log(`Aceptadas (200): ${accepted}`);
console.log(`Limitadas (429): ${limited}`);
console.log(`Otras: ${other}`);
console.log(`Errores de conexión: ${errors.length}`);
console.log(`Latencia p50: ${formatMs(percentile(50))} · p95: ${formatMs(percentile(95))} · p99: ${formatMs(percentile(99))}`);
console.log(`Memoria (observada) RSS: ${formatMb(before.rss)} → ${formatMb(after.rss)} (Δ ${formatMb(after.rss - before.rss)})`);
console.log(`Memoria (observada) heap: ${formatMb(before.heapUsed)} → ${formatMb(after.heapUsed)} (Δ ${formatMb(after.heapUsed - before.heapUsed)})`);
if (errors.length) {
  console.error('Algunas solicitudes fallaron (ver detalles):');
  for (const error of errors.slice(0, 10)) console.error(`- ${error}`);
}

if (ephemeral) await ephemeral.cleanup();
process.exitCode = errors.length ? 1 : 0;
