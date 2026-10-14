// PoC local de la auditoría de trampas (docs/AUDITORIA_TRAMPAS.md).
// Ejecuta: node --experimental-strip-types tools/audit-cheats.ts [--json docs/audit-evidence.json]
// Sólo usa createApp con SQLite temporal, 127.0.0.1, puerto efímero y reloj simulado.
// Cada caso afirma que el fallo EXISTE: si un caso falla, el hallazgo ya no se reproduce (¿se arregló?).
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Server } from 'node:http';
import { createApp, SCORE_BURST, SCORE_RATE } from '../server/app.ts';
import { efficiency, freshFatigue, loadFatigue, recordTap, saveFatigue, FATIGUE_KEY } from '../src/fatigue.ts';

type Result = { id: string; title: string; reproduced: boolean; evidence: unknown; error?: string };
const results: Result[] = [];
const jsonPath = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : undefined;

let time = 1_000_000;
const dir = await mkdtemp(join(tmpdir(), 'michi-audit-'));
const dbPath = join(dir, 'audit.sqlite');
const server: Server =createApp(dbPath, dir, () => time);
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.ok(address && typeof address !== 'string');
const base = `http://127.0.0.1:${address.port}`;

// Cada caso usa su propia IP falsa para que el límite de 120/min no mezcle casos (eso es en sí el hallazgo H5).
async function post(body: unknown, { cookie = '', ip = '10.0.0.1', origin = base as string | undefined } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'cf-connecting-ip': ip };
  if (cookie) headers.Cookie = cookie;
  if (origin) headers.Origin = origin;
  const response = await fetch(base + '/api/presence', { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await response.text();
  let data: any; try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] ?? cookie };
}
function rows() {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try { return Number((db.prepare('SELECT COUNT(*) AS n FROM players').get() as any).n); } finally { db.close(); }
}
async function check(id: string, title: string, run: () => Promise<unknown> | unknown) {
  try {
    const evidence = await run();
    results.push({ id, title, reproduced: true, evidence });
    console.log(`REPRODUCIDO ${id}: ${title}\n  ${JSON.stringify(evidence)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ id, title, reproduced: false, evidence: null, error: message });
    console.log(`NO REPRODUCIDO ${id}: ${title}\n  ${message}`);
  }
}

try {
  await check('H1', 'El primer reporte de una identidad nueva acepta el máximo (1e12) sin marca', async () => {
    const r = await post({ points: 1e12, name: 'Primer Reporte' }, { ip: '10.1.0.1' });
    assert.equal(r.status, 200);
    assert.equal(r.data.me.suspected, false, 'H1 ya no se reproduce: el primer reporte de 1e12 quedó marcado');
    assert.equal(r.data.me.rank, 1, 'H1 ya no se reproduce: 1e12 no quedó en el puesto 1');
    return { status: r.status, best: r.data.me.best, rank: r.data.me.rank, suspected: r.data.me.suspected };
  });

  await check('H2', 'Identidades desechables (sin cookie) desplazan a un jugador honesto fuera del top 50', async () => {
    const honest = await post({ points: 0, name: 'Honesta' }, { ip: '10.2.0.1' });
    time += 100_000; // 100 s de juego permitidos a 1e7/s
    const grown = await post({ points: 1e9 }, { ip: '10.2.0.1', cookie: honest.cookie });
    assert.equal(grown.data.me.suspected, false);
    for (let i = 0; i < 50; i++) await post({ points: 1e12, name: `Michi ${i}` }, { ip: '10.2.0.2' });
    const after = await post({ points: 1e9 }, { ip: '10.2.0.1', cookie: honest.cookie });
    const regular = after.data.players.filter((p: any) => !p.suspected);
    assert.equal(regular.some((p: any) => p.id === honest.data.me.id), false, 'H2 ya no se reproduce: la jugadora honesta sigue en el top 50');
    assert.equal(regular.every((p: any) => p.best === 1e12), true, 'H2 ya no se reproduce: el top 50 no son todas identidades falsas');
    return { honestRank: after.data.me.rank, topRegular: regular.length, fakesInTop: regular.filter((p: any) => p.best === 1e12).length, suspectedFakes: after.data.players.filter((p: any) => p.suspected).length };
  });

  await check('H3', 'Una marca "Tramposo · sospecha" se evade borrando la cookie, conservando el nombre', async () => {
    const start = await post({ points: 0, name: 'Evasora' }, { ip: '10.3.0.1' });
    const flagged = await post({ points: 1e12 }, { ip: '10.3.0.1', cookie: start.cookie });
    assert.equal(flagged.data.me.suspected, true, 'precondición: el salto debe marcarse');
    const fresh = await post({ points: 1e12, name: 'Evasora' }, { ip: '10.3.0.1' });
    assert.notEqual(fresh.data.me.id, flagged.data.me.id);
    assert.equal(fresh.data.me.suspected, false, 'H3 ya no se reproduce: la identidad nueva hereda o recibe la marca');
    return { flaggedSuspected: flagged.data.me.suspected, newIdentity: fresh.data.me.id !== flagged.data.me.id, freshName: fresh.data.me.name, freshSuspected: fresh.data.me.suspected, freshBest: fresh.data.me.best };
  });

  await check('H4', 'El margen crece sin tope con el tiempo inactivo: esperar ~28 h permite saltar de 0 a 1e12', async () => {
    const start = await post({ points: 0, name: 'Paciente' }, { ip: '10.4.0.1' });
    time += Math.ceil((1e12 - SCORE_BURST) / SCORE_RATE) * 1000; // 99 996 s sin reportar
    const jump = await post({ points: 1e12 }, { ip: '10.4.0.1', cookie: start.cookie });
    assert.equal(jump.data.me.suspected, false, 'H4 ya no se reproduce: el salto tras inactividad quedó marcado');
    return { idleSeconds: Math.ceil((1e12 - SCORE_BURST) / SCORE_RATE), jumpedTo: jump.data.me.best, suspected: jump.data.me.suspected };
  });

  await check('H5', 'El límite por IP confía en cf-connecting-ip del cliente: rotar la cabecera evita el 429', async () => {
    time += 61_000;
    const statuses: number[] = [];
    for (let i = 0; i < 130; i++) statuses.push((await fetch(base + '/api/nada', { headers: { 'cf-connecting-ip': `10.5.${i >> 8}.${i & 255}` } })).status);
    const same: number[] = [];
    for (let i = 0; i < 121; i++) same.push((await fetch(base + '/api/nada', { headers: { 'cf-connecting-ip': '10.5.9.9' } })).status);
    assert.equal(statuses.includes(429), false, 'H5 ya no se reproduce: rotar cf-connecting-ip produjo 429');
    assert.equal(same.at(-1), 429, 'control: una misma IP sí debe llegar a 429');
    return { rotated: { requests: 130, got429: statuses.filter(s => s === 429).length }, sameHeader: { requests: 121, last: same.at(-1) } };
  });

  await check('H7', 'Cada petición sin cookie crea una fila permanente en SQLite (crecimiento sin límite)', async () => {
    time += 61_000;
    const before = rows();
    for (let i = 0; i < 100; i++) await post({ points: 0 }, { ip: `10.7.0.${i}` });
    const after = rows();
    assert.equal(after - before, 100, 'H7 ya no se reproduce: no se creó una fila por petición');
    return { requests: 100, newRows: after - before, totalRows: after };
  });

  await check('H8', 'Retrasar el reloj del dispositivo 1 s y recargar borra la fatiga guardada', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } };
    let fatigue = freshFatigue(1_000);
    for (let i = 0; i < 600; i++) fatigue = recordTap(fatigue, 1_000 + i * 50); // 20 clics/s durante 30 s
    saveFatigue(storage, fatigue);
    const hot = efficiency(fatigue);
    const reloaded = loadFatigue(storage, fatigue.updatedAt - 1_000);
    assert.equal(efficiency(reloaded), 1, 'H8 ya no se reproduce: la recarga con reloj atrasado conserva la fatiga');
    assert.ok(hot < 0.1);
    return { key: FATIGUE_KEY, efficiencyBefore: Number(hot.toFixed(4)), efficiencyAfterRollback: efficiency(reloaded) };
  });

  await check('H9', 'Entradas mal formadas responden 500 en vez de 4xx (Origin: null, ruta %E0)', async () => {
    const nullOrigin = await fetch(base + '/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'null', 'cf-connecting-ip': '10.9.0.1' }, body: '{"points":1}' });
    const badPath = await fetch(base + '/%E0');
    assert.equal(nullOrigin.status, 500, `H9 ya no se reproduce: Origin null → ${nullOrigin.status}`);
    assert.equal(badPath.status, 500, `H9 ya no se reproduce: ruta %E0 → ${badPath.status}`);
    return { originNull: nullOrigin.status, malformedPath: badPath.status };
  });

  // Control negativo: se espera que NO haya carrera. Si este caso "se reproduce", el crédito NO se duplica.
  await check('N1', 'Control: peticiones paralelas con la misma cookie no reutilizan el crédito de ráfaga', async () => {
    time += 61_000;
    const start = await post({ points: 0, name: 'Paralela' }, { ip: '10.10.0.1' });
    const steps = [0.3, 0.6, 0.9, 1.2].map(f => post({ points: SCORE_BURST * f }, { ip: '10.10.0.1', cookie: start.cookie }));
    const done = await Promise.all(steps);
    const final = await post({ points: 0 }, { ip: '10.10.0.1', cookie: start.cookie });
    assert.equal(final.data.me.suspected, true, 'apareció una carrera: 1,2× la ráfaga en paralelo no quedó marcada');
    return { statuses: done.map(d => d.status), suspected: final.data.me.suspected, note: 'Node procesa find→update sin await intermedio; no hay carrera en un solo proceso' };
  });

  await check('H10', 'El puesto se calcula con un SCAN completo hasta 61 veces por petición y bloquea el event loop', async () => {
    const db = new DatabaseSync(dbPath);
    try {
      const plan = db.prepare('EXPLAIN QUERY PLAN SELECT COUNT(*) + 1 AS rank FROM players WHERE suspected < ? OR (suspected = ? AND (best > ? OR (best = ? AND id < ?)))').all(0, 0, 0, 0, 'x').map((row: any) => String(row.detail));
      assert.ok(plan.some(detail => /^SCAN players/.test(detail)), `H10 ya no se reproduce: plan ${plan.join(' | ')}`);
      // Simula ~23 h de H7 desde una sola IP (120 filas/min).
      const insert = db.prepare('INSERT INTO players(id, token, name) VALUES (?, ?, ?)');
      db.exec('BEGIN'); for (let i = 0; i < 100_000; i++) insert.run(`bulk-${i}`, `bulk-${i}`, 'Invitado'); db.exec('COMMIT');
    } finally { db.close(); }
    time += 61_000;
    const started = performance.now();
    const r = await post({ points: 0 }, { ip: '10.11.0.1' });
    const ms = Math.round(performance.now() - started);
    assert.equal(r.status, 200);
    return { rows: rows(), rankQueriesPerRequest: 1 + r.data.players.length, requestMs: ms, note: 'requestMs es informativo y depende de la máquina' };
  });

  // H6 va al final: deja la instancia inutilizable hasta reiniciarla.
  await check('H6', 'Llenar el mapa de límites con 10 000 IPs falsas bloquea la API con 503 para siempre, incluso a IPs conocidas', async () => {
    time += 61_000;
    let sent = 0;
    for (let batch = 0; batch < 100; batch++) {
      await Promise.all(Array.from({ length: 100 }, (_, i) => fetch(base + '/api/nada', { headers: { 'cf-connecting-ip': `172.16.${batch}.${i}` } }).then(r => r.arrayBuffer())));
      sent += 100;
    }
    const legit = await post({ points: 10, name: 'Visitante' }, { ip: '192.168.1.50' });
    assert.equal(legit.status, 503, `H6 ya no se reproduce: visitante nuevo recibió ${legit.status}`);
    time += 3_600_000; // una hora después: todas las ventanas ya expiraron
    const later = await post({ points: 10, name: 'Visitante' }, { ip: '192.168.1.50' });
    const known = await post({ points: 10 }, { ip: '10.1.0.1' }); // IP usada en H1, antes del llenado
    assert.equal(later.status, 503, `H6 ya no se reproduce: el bloqueo no es permanente (${later.status})`);
    assert.equal(known.status, 503, `H6 ya no se reproduce: una IP conocida se recuperó (${known.status})`);
    return { spoofedIps: sent, newVisitorStatus: legit.status, newVisitorAfter1h: later.status, knownIpAfter1h: known.status, note: 'limits.size nunca supera 10 000, así que la limpieza de server/app.ts:61 nunca corre' };
  });
} finally {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await rm(dir, { recursive: true, force: true });
}

const reproduced = results.filter(r => r.reproduced && r.id.startsWith('H')).length;
console.log(`\n${reproduced} hallazgos reproducidos de ${results.filter(r => r.id.startsWith('H')).length}; control N1 ${results.find(r => r.id === 'N1')?.reproduced ? 'OK (sin carrera)' : 'FALLÓ'}`);
if (jsonPath) await writeFile(jsonPath, JSON.stringify({ node: process.version, scoreRate: SCORE_RATE, scoreBurst: SCORE_BURST, results }, null, 2) + '\n');
process.exitCode = results.every(r => r.reproduced) ? 0 : 1;
