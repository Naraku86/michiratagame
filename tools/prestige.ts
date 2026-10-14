// Prestige analysis: pure formulas and a deterministic benchmark.
// Reuses the real economy from src/game.ts and fatigue from src/fatigue.ts; changes neither.
// Run: node --experimental-strip-types tools/prestige.ts
import { pathToFileURL } from 'node:url';
import { advance, buy, cost, initialState, isGameState, milestoneMultiplier, production, SKINS, tap, type GameState, type Skin, type Upgrade } from '../src/game.ts';
import { efficiency, freshFatigue, recordTap, type Fatigue } from '../src/fatigue.ts';

// Mirrors server/app.ts SCORE_RATE; prestige must keep legit play far below it.
export const SUSPICIOUS_RATE = 10_000_000;
export const MAX_POINTS = 1e12;
export const MAX_LIFETIME = 1e15;
export const LIFETIME_DIVISOR = 4e5;
export const MIN_LEVEL_TO_PRESTIGE = 40;
export const LEVELS = [20, 40, 60, 100] as const;

export const SUPER = {
  garra: { name: 'Garra dorada', max: 5, step: 0.2, text: '+20 % por clic y bonos de clic por nivel (máx. ×2).' },
  sindicato: { name: 'Sindicato michi', max: 5, step: 0.2, text: '+20 % producción de la cuadrilla por nivel (máx. ×2).' },
  regateo: { name: 'Regateo', max: 5, step: 0.04, text: '−4 % precio de mejoras y trabajadoras por nivel (máx. −20 %).' },
} as const;
export type SuperId = keyof typeof SUPER;
export const SUPER_IDS = Object.keys(SUPER) as SuperId[];

export const ACHIEVEMENTS = {
  'primera-vuelta': 'Primera vuelta: reinicia con prestigio una vez. Desbloquea skin cosmética Dorada.',
  'vuelta-completa': 'Vuelta completa: reinicia con clic y cuadrilla en nivel 100. Desbloquea skin cosmética Astral.',
  'tercera-vuelta': 'Tercera vuelta: tres reinicios con prestigio.',
  'coleccion-heredada': 'Colección heredada: reinicia con todas las skins comprables.',
  'sindicato-total': 'Sindicato total: todas las super mejoras al máximo.',
} as const;
export type AchievementId = keyof typeof ACHIEVEMENTS;

export interface PrestigeState {
  lifetimeEarned: number;
  // 'counted': every point since the counter existed. 'derived-floor': migrated minimum, see migrateV2.
  lifetimeBasis: 'counted' | 'derived-floor';
  claimed: number;
  spent: number;
  runs: number;
  upgrades: Record<SuperId, number>;
  achievements: AchievementId[];
}

export function freshPrestige(): PrestigeState {
  return { lifetimeEarned: 0, lifetimeBasis: 'counted', claimed: 0, spent: 0, runs: 0, upgrades: { garra: 0, sindicato: 0, regateo: 0 }, achievements: [] };
}

// Depends only on cumulative earnings, so splitting them into more resets never yields more bigotes.
export function totalBigotes(lifetimeEarned: number): number {
  if (!Number.isFinite(lifetimeEarned) || lifetimeEarned <= 0) return 0;
  const lifetime = Math.min(lifetimeEarned, MAX_LIFETIME);
  let n = Math.floor(Math.cbrt(lifetime / LIFETIME_DIVISOR));
  // Correct floating-point rounding of cbrt against the exact thresholds.
  while (lifetimeForBigotes(n + 1) <= lifetime) n++;
  while (n > 0 && lifetimeForBigotes(n) > lifetime) n--;
  return n;
}

export function lifetimeForBigotes(bigotes: number): number {
  return bigotes ** 3 * LIFETIME_DIVISOR;
}

export function pendingBigotes(p: PrestigeState): number {
  return Math.max(0, totalBigotes(p.lifetimeEarned) - p.claimed);
}

export function availableBigotes(p: PrestigeState): number {
  return p.claimed - p.spent;
}

export function clickMultiplier(p: PrestigeState): number { return 1 + SUPER.garra.step * p.upgrades.garra; }
export function productionMultiplier(p: PrestigeState): number { return 1 + SUPER.sindicato.step * p.upgrades.sindicato; }
export function costMultiplier(p: PrestigeState): number { return 1 - SUPER.regateo.step * p.upgrades.regateo; }

export function superCost(level: number): number { return level + 1; }

export function buySuper(p: PrestigeState, id: SuperId): PrestigeState {
  const level = p.upgrades[id];
  if (level >= SUPER[id].max || availableBigotes(p) < superCost(level)) return p;
  const next = { ...p, spent: p.spent + superCost(level), upgrades: { ...p.upgrades, [id]: level + 1 } };
  return SUPER_IDS.every(key => next.upgrades[key] >= SUPER[key].max) ? unlock(next, 'sindicato-total') : next;
}

function unlock(p: PrestigeState, id: AchievementId): PrestigeState {
  return p.achievements.includes(id) ? p : { ...p, achievements: [...p.achievements, id] };
}

function earn(game: GameState, p: PrestigeState, amount: number): { game: GameState; prestige: PrestigeState; amount: number } {
  const points = Math.min(game.points + Math.max(0, amount), MAX_POINTS);
  const gained = points - game.points;
  if (gained <= 0) return { game, prestige: p, amount: 0 };
  return { game: { ...game, points }, prestige: { ...p, lifetimeEarned: Math.min(MAX_LIFETIME, p.lifetimeEarned + gained) }, amount: gained };
}

// Fatigue's efficiency is applied by tap() before the multiplier, so it still limits autoclickers.
export function prestigeTap(game: GameState, p: PrestigeState, chain: number, roll: number, eff = 1) {
  const result = tap(game, chain, roll, eff);
  const earned = earn(game, p, result.amount * clickMultiplier(p));
  return { ...earned, effect: result.effect };
}

export function prestigeAdvance(game: GameState, p: PrestigeState, seconds: number) {
  const next = advance(game, seconds * productionMultiplier(p));
  return earn(game, p, next.points - game.points);
}

export function prestigeCost(game: GameState, p: PrestigeState, upgrade: Upgrade): number {
  return Math.ceil(cost(game, upgrade) * costMultiplier(p));
}

export function prestigeBuy(game: GameState, p: PrestigeState, upgrade: Upgrade): GameState {
  const price = prestigeCost(game, p, upgrade);
  if (game.points < price) return game;
  // Lend buy() the discount so the real level cap and cost rules decide.
  const lent = { ...game, points: game.points - price + cost(game, upgrade) };
  const next = buy(lent, upgrade);
  return next === lent ? game : next;
}

export type PrestigeBlock = 'levels' | 'no-gain';
export function canPrestige(game: GameState, p: PrestigeState): { ok: boolean; reason?: PrestigeBlock } {
  if (game.clickLevel < MIN_LEVEL_TO_PRESTIGE || game.autoLevel < MIN_LEVEL_TO_PRESTIGE) return { ok: false, reason: 'levels' };
  if (pendingBigotes(p) < 1) return { ok: false, reason: 'no-gain' };
  return { ok: true };
}

// Everything the confirmation dialog must show; nothing here is decided by the UI.
export function previewPrestige(game: GameState, p: PrestigeState) {
  const after = achievementsAfter(game, p);
  return {
    allowed: canPrestige(game, p),
    loses: { points: game.points, clickLevel: game.clickLevel, autoLevel: game.autoLevel },
    keeps: { ownedSkins: [...game.ownedSkins], equippedSkin: game.equippedSkin, lifetimeEarned: p.lifetimeEarned, upgrades: { ...p.upgrades }, achievements: [...p.achievements] },
    gains: {
      bigotes: pendingBigotes(p),
      availableAfter: availableBigotes(p) + pendingBigotes(p),
      achievements: after.filter(id => !p.achievements.includes(id)),
      nextBigoteAt: lifetimeForBigotes(totalBigotes(p.lifetimeEarned) + 1),
    },
  };
}

function achievementsAfter(game: GameState, p: PrestigeState): AchievementId[] {
  const list = [...p.achievements];
  const add = (id: AchievementId) => { if (!list.includes(id)) list.push(id); };
  add('primera-vuelta');
  if (game.clickLevel >= 100 && game.autoLevel >= 100) add('vuelta-completa');
  if (p.runs + 1 >= 3) add('tercera-vuelta');
  if (SKINS.every(skin => skin.id === 'original' || game.ownedSkins.includes(skin.id))) add('coleccion-heredada');
  return list;
}

export function prestige(game: GameState, p: PrestigeState): { game: GameState; prestige: PrestigeState } {
  if (!canPrestige(game, p).ok) return { game, prestige: p };
  const next: PrestigeState = { ...p, claimed: totalBigotes(p.lifetimeEarned), runs: p.runs + 1, achievements: achievementsAfter(game, p) };
  // Skins stay purchased and equipped: no refund and no compensation needed.
  return { game: { ...initialState(), ownedSkins: [...game.ownedSkins], equippedSkin: game.equippedSkin }, prestige: next };
}

// Points provably earned by a v2 save under the current curve. Older curves were never cheaper.
export function earnedFloor(game: GameState): number {
  let total = game.points;
  for (const upgrade of ['click', 'auto'] as const) {
    const owned = upgrade === 'click' ? game.clickLevel : game.autoLevel;
    for (let level = 0; level < owned; level++)
      total += cost({ ...initialState(), clickLevel: level, autoLevel: level }, upgrade);
  }
  for (const skin of game.ownedSkins) total += SKINS.find(item => item.id === skin)!.price;
  return Math.min(total, MAX_LIFETIME);
}

export function migrateV2(game: GameState, basis: 'derived-floor' | 'zero' = 'derived-floor'): PrestigeState | undefined {
  if (!isGameState(game)) return undefined;
  return basis === 'zero' ? freshPrestige() : { ...freshPrestige(), lifetimeEarned: earnedFloor(game), lifetimeBasis: 'derived-floor' };
}

export function isPrestigeState(value: unknown): value is PrestigeState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const count = (n: unknown, max = Number.MAX_SAFE_INTEGER) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= max;
  if (typeof v.lifetimeEarned !== 'number' || !Number.isFinite(v.lifetimeEarned) || v.lifetimeEarned < 0 || v.lifetimeEarned > MAX_LIFETIME) return false;
  if (v.lifetimeBasis !== 'counted' && v.lifetimeBasis !== 'derived-floor') return false;
  if (!count(v.claimed) || !count(v.spent) || !count(v.runs)) return false;
  if ((v.claimed as number) > totalBigotes(v.lifetimeEarned) || (v.spent as number) > (v.claimed as number)) return false;
  const upgrades = v.upgrades as Record<string, unknown> | null;
  if (typeof upgrades !== 'object' || upgrades === null || !SUPER_IDS.every(id => count(upgrades[id], SUPER[id].max))) return false;
  const spentOnUpgrades = SUPER_IDS.reduce((sum, id) => sum + ((upgrades[id] as number) * ((upgrades[id] as number) + 1)) / 2, 0);
  if (spentOnUpgrades !== v.spent) return false;
  if (!Array.isArray(v.achievements) || v.achievements.some(id => !(id in ACHIEVEMENTS)) || new Set(v.achievements).size !== v.achievements.length) return false;
  return true;
}

// ---------- Deterministic simulation ----------

// untilPrestige: after targetLevel, keep playing until a prestige would actually grant a bigote.
// stopAtEarned: also stop once this run has earned that many points.
export interface RunOptions { tapsPerSecond: number; targetLevel: number; maxSeconds?: number; skin?: Skin; untilPrestige?: boolean; stopAtEarned?: number }
export interface RunResult { seconds: number; reached: Partial<Record<number, number>>; game: GameState; prestige: PrestigeState; earned: number }

// One-second steps: taps spread evenly (continuous chain, roll 0.5, real fatigue), then production, then greedy buys of the cheaper upgrade.
export function simulateRun(p: PrestigeState, options: RunOptions): RunResult {
  const { tapsPerSecond, targetLevel, maxSeconds = 2_000_000, skin = 'original', untilPrestige = false, stopAtEarned = Infinity } = options;
  let game: GameState = { ...initialState(), ownedSkins: skin === 'original' ? [] : [skin], equippedSkin: skin };
  let prestigeState = p;
  let fatigue: Fatigue = freshFatigue(0);
  let chain = 0;
  const startLifetime = p.lifetimeEarned;
  const reached: Partial<Record<number, number>> = {};
  let seconds = 0;
  const done = () => prestigeState.lifetimeEarned - startLifetime >= stopAtEarned || Math.min(game.clickLevel, game.autoLevel) >= targetLevel && (!untilPrestige || canPrestige(game, prestigeState).ok);
  for (; seconds < maxSeconds && !done(); seconds++) {
    for (let i = 0; i < tapsPerSecond; i++) {
      const now = seconds * 1000 + (i * 1000) / tapsPerSecond;
      fatigue = recordTap(fatigue, now);
      const result = prestigeTap(game, prestigeState, ++chain, 0.5, efficiency(fatigue));
      game = result.game; prestigeState = result.prestige;
    }
    const passive = prestigeAdvance(game, prestigeState, 1);
    game = passive.game; prestigeState = passive.prestige;
    for (;;) {
      const options = (['click', 'auto'] as const).filter(u => (u === 'click' ? game.clickLevel : game.autoLevel) < 100);
      if (options.length === 0) break;
      const cheapest = options.reduce((a, b) => (prestigeCost(game, prestigeState, b) < prestigeCost(game, prestigeState, a) ? b : a));
      const next = prestigeBuy(game, prestigeState, cheapest);
      if (next === game) break;
      game = next;
    }
    const level = Math.min(game.clickLevel, game.autoLevel);
    for (const mark of LEVELS) if (level >= mark && reached[mark] === undefined) reached[mark] = seconds + 1;
  }
  return { seconds, reached, game, prestige: prestigeState, earned: prestigeState.lifetimeEarned - startLifetime };
}

export function spendGreedy(p: PrestigeState): PrestigeState {
  for (;;) {
    const affordable = SUPER_IDS.filter(id => p.upgrades[id] < SUPER[id].max && superCost(p.upgrades[id]) <= availableBigotes(p));
    if (affordable.length === 0) return p;
    const id = affordable.reduce((a, b) => (p.upgrades[b] < p.upgrades[a] ? b : a));
    p = buySuper(p, id);
  }
}

export interface Lap { lap: number; seconds: number; resetLevel: number; reached: Partial<Record<number, number>>; bigotesGained: number; upgrades: Record<SuperId, number>; earned: number }

// Plays `laps` runs; each one ends at resetAt (both families), or later if no bigote is pending yet, and prestiges; bigotes are spent greedily before the next.
export function simulateLaps(resetAt: number, laps: number, tapsPerSecond: number, skin: Skin = 'original'): { laps: Lap[]; prestige: PrestigeState; totalSeconds: number } {
  let p = freshPrestige();
  const out: Lap[] = [];
  let totalSeconds = 0;
  for (let lap = 1; lap <= laps; lap++) {
    const upgrades = { ...p.upgrades };
    const run = simulateRun(p, { tapsPerSecond, targetLevel: resetAt, skin, untilPrestige: true });
    totalSeconds += run.seconds;
    const before = run.prestige.claimed;
    const reset = prestige(run.game, run.prestige);
    if (reset.prestige === run.prestige) throw Error(`lap ${lap}: cannot prestige at ${resetAt}`);
    out.push({ lap, seconds: run.seconds, resetLevel: Math.min(run.game.clickLevel, run.game.autoLevel), reached: run.reached, bigotesGained: reset.prestige.claimed - before, upgrades, earned: run.earned });
    p = spendGreedy(reset.prestige);
  }
  return { laps: out, prestige: p, totalSeconds };
}

// Worst sustained points/s at level 100/100 with every super upgrade maxed, tapping at the fatigue refill rate.
export function worstCaseRate(skin: Skin, tapsPerSecond = 8, seconds = 120): number {
  const p: PrestigeState = { ...freshPrestige(), upgrades: { garra: SUPER.garra.max, sindicato: SUPER.sindicato.max, regateo: SUPER.regateo.max } };
  // Magnate peaks with a large balance; keep it away from the cap so earnings are not clipped.
  let game: GameState = { ...initialState(), clickLevel: 100, autoLevel: 100, ownedSkins: skin === 'original' ? [] : [skin], equippedSkin: skin, points: 1e6 };
  let fatigue = freshFatigue(0);
  let chain = 0;
  let earned = 0;
  for (let s = 0; s < seconds; s++) {
    for (let i = 0; i < tapsPerSecond; i++) {
      fatigue = recordTap(fatigue, s * 1000 + (i * 1000) / tapsPerSecond);
      // Roll 0.95 picks the jester's ×10, the worst case.
      const r = prestigeTap(game, p, ++chain, 0.95, efficiency(fatigue));
      earned += r.amount; game = { ...r.game, points: 1e6 };
    }
    const passive = prestigeAdvance(game, p, 1);
    earned += passive.amount; game = { ...passive.game, points: 1e6 };
  }
  return earned / seconds;
}

export function lifetimeAtLevel(level: number): number {
  return earnedFloor({ ...initialState(), clickLevel: level, autoLevel: level });
}

// ---------- Report ----------

function fmt(seconds: number | undefined): string {
  if (seconds === undefined) return '—';
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  return `${(seconds / 3600).toFixed(2)} h`;
}
const num = (n: number) => Math.round(n).toLocaleString('es-MX');

export function report(): string {
  const lines: string[] = [];
  lines.push('## Puntos ganados mínimos y bigotes por nivel (ambas familias)', '', '| Nivel | Puntos acumulados | Bigotes totales |', '| --- | --- | --- |');
  for (const level of [...LEVELS, 30, 35].sort((a, b) => a - b)) lines.push(`| ${level} | ${num(lifetimeAtLevel(level))} | ${totalBigotes(lifetimeAtLevel(level))} |`);

  for (const tps of [5, 1]) {
    lines.push('', `## Vueltas a ${tps} clics/s (skin Original, tiempo activo)`, '');
    lines.push('| Reinicio en | Vuelta | Super mejoras al empezar (garra/sindicato/regateo) | A 20 | A 40 | A 60 | A 100 | Duración | Nivel al reiniciar | Bigotes ganados |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const resetAt of [40, 60, 100]) {
      const result = simulateLaps(resetAt, 3, tps);
      for (const lap of result.laps)
        lines.push(`| ${resetAt} | ${lap.lap} | ${lap.upgrades.garra}/${lap.upgrades.sindicato}/${lap.upgrades.regateo} | ${fmt(lap.reached[20])} | ${fmt(lap.reached[40])} | ${fmt(lap.reached[60])} | ${fmt(lap.reached[100])} | ${fmt(lap.seconds)} | ${lap.resetLevel} | ${lap.bigotesGained} |`);
    }
  }

  lines.push('', '## Reinicio frecuente frente a vueltas completas (5 clics/s, mismo presupuesto de tiempo)', '', '| Estrategia | Vueltas | Tiempo | Bigotes | Bigotes/h |', '| --- | --- | --- | --- | --- |');
  const full = simulateLaps(100, 2, 5);
  for (const resetAt of [40, 60, 100]) {
    let p = freshPrestige(); let time = 0; let laps = 0;
    while (time < full.totalSeconds) {
      const run = simulateRun(p, { tapsPerSecond: 5, targetLevel: resetAt, maxSeconds: full.totalSeconds - time, untilPrestige: true });
      time += run.seconds;
      const reset = prestige(run.game, run.prestige);
      if (reset.prestige === run.prestige) { p = run.prestige; break; }
      laps++; p = spendGreedy(reset.prestige);
    }
    lines.push(`| Reiniciar en ${resetAt} | ${laps} | ${fmt(time)} | ${p.claimed} | ${(p.claimed / (time / 3600)).toFixed(2)} |`);
  }

  const long = simulateLaps(100, 12, 5);
  const maxedAt = long.laps.findIndex(lap => SUPER_IDS.every(id => lap.upgrades[id] >= SUPER[id].max));
  lines.push('', `Vueltas completas a 100 (5 clics/s) jugadas antes de empezar una con todas las super mejoras al máximo: ${maxedAt === -1 ? 'más de 11' : maxedAt}; tiempo acumulado ${fmt(long.laps.slice(0, maxedAt).reduce((sum, lap) => sum + lap.seconds, 0))}. Duración de las vueltas 1–12: ${long.laps.map(lap => fmt(lap.seconds)).join(', ')}.`);

  const skinPrices = SKINS.reduce((sum, skin) => sum + skin.price, 0);
  const rebuy = simulateRun(freshPrestige(), { tapsPerSecond: 5, targetLevel: 100, stopAtEarned: skinPrices });
  lines.push('', '## Skins conservadas', '', `Volver a comprar las cinco skins costaría ${num(skinPrices)} puntos: ${fmt(rebuy.seconds)} de una vuelta nueva a 5 clics/s sin super mejoras.`);
  lines.push('', '| Skin equipada en todas las vueltas (reinicio en 100) | Vuelta 1 | Vuelta 2 | Vuelta 3 |', '| --- | --- | --- | --- |');
  for (const skin of ['original', 'football', 'godin'] as const) {
    const laps = simulateLaps(100, 3, 5, skin).laps;
    lines.push(`| ${SKINS.find(item => item.id === skin)!.name} | ${laps.map(lap => fmt(lap.seconds)).join(' | ')} |`);
  }

  lines.push('', '## Escalado alto: peor ritmo sostenido a 100/100 con super mejoras al máximo (8 clics/s)', '', '| Skin | Puntos/s | % del umbral 10 M/s |', '| --- | --- | --- |');
  for (const skin of SKINS) {
    const rate = worstCaseRate(skin.id);
    lines.push(`| ${skin.name} | ${num(rate)} | ${((rate / SUSPICIOUS_RATE) * 100).toFixed(1)} % |`);
  }
  lines.push('', `Base sin prestigio, Original 100/100: ${num(production({ ...initialState(), autoLevel: 100 }))}/s cuadrilla, ${num(101 * milestoneMultiplier(100))} por clic.`);
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(report());
