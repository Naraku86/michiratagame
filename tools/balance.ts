import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SKINS, initialState, tap, advance, cost, production, pointsPerClick, type Skin } from '../src/game.ts';
import { freshFatigue, recordTap, efficiency } from '../src/fatigue.ts';

export const LEVELS = [0, 9, 10, 16, 20, 40, 60, 80, 100];
export const RATES = [0, 1, 4, 8, 20, 100];
export const SEEDS = [17, 431, 20261013];
// Keep the guard independent of server imports (which start HTTP/SQLite).
export const rankingAllowance = (seconds: number) => 40_000_000 + seconds * 10_000_000;
export function random(seed: number) {
  let value = seed >>> 0;
  return () => { value = (Math.imul(1664525, value) + 1013904223) >>> 0; return value / 2 ** 32; };
}

export function simulate(skin: Skin, level: number, rate: number, seconds = 600, seed = SEEDS[0], useFatigue = true) {
  let state = { ...initialState(), points: 2_000, clickLevel: level, autoLevel: level, equippedSkin: skin };
  let fatigue = freshFatigue(0);
  let previous = 0, clicks = 0, idle = 0, lastEfficiency = 1;
  const roll = random(seed);
  const startingProduction = production(state), clickPrice = cost(state, 'click'), autoPrice = cost(state, 'auto');
  const count = Math.floor(rate * seconds);
  for (let index = 1; index <= count; index++) {
    const time = index / rate;
    const advanced = advance(state, time - previous);
    idle += advanced.points - state.points;
    state = advanced;
    fatigue = recordTap(fatigue, time * 1000);
    lastEfficiency = useFatigue ? efficiency(fatigue) : 1;
    const chain = rate >= 1 / 1.5 ? index : 1;
    const result = tap(state, chain, roll(), lastEfficiency);
    clicks += result.amount;
    state = result.state;
    previous = time;
  }
  const final = advance(state, seconds - previous);
  idle += final.points - state.points;
  const total = clicks + idle;
  return { skin, level, rate, seconds, seed, total, clickPoints: clicks, idlePoints: idle,
    pointsPerSecond: total / seconds, finalEfficiency: lastEfficiency, startingProduction,
    baseClick: pointsPerClick({ ...state, points: 2_000 }),
    nextClickCost: level < 100 ? clickPrice : null, nextWorkerCost: level < 100 ? autoPrice : null,
    nextClickSeconds: level < 100 && total > 0 ? clickPrice / (total / seconds) : null,
    rankingMargin: rankingAllowance(seconds) - total };
}

export function report(seconds = 600) {
  return SKINS.flatMap(skin => LEVELS.flatMap(level => RATES.map(rate => {
    const runs = SEEDS.map(seed => simulate(skin.id, level, rate, seconds, seed));
    const first = runs[0];
    const mean = (key: 'total' | 'pointsPerSecond' | 'clickPoints') => runs.reduce((sum, row) => sum + row[key], 0) / runs.length;
    return { ...first, seed: undefined, total: mean('total'), clickPoints: mean('clickPoints'), pointsPerSecond: mean('pointsPerSecond'),
      rankingMargin: Math.min(...runs.map(row => row.rankingMargin)), minTotal: Math.min(...runs.map(row => row.total)), maxTotal: Math.max(...runs.map(row => row.total)) };
  })));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const started = performance.now();
  const rows = report();
  writeFileSync(new URL('../artifacts/balance-summary.json', import.meta.url), JSON.stringify({ seconds: 600, seeds: SEEDS, rows }, null, 2) + '\n');
  const columns = Object.keys(rows[0]);
  writeFileSync(new URL('../artifacts/balance-summary.csv', import.meta.url), columns.join(',') + '\n' + rows.map(row => columns.map(key => row[key as keyof typeof row] ?? '').join(',')).join('\n') + '\n');
  console.log(JSON.stringify({ skins: SKINS.length, scenarios: rows.length, runs: rows.length * SEEDS.length, elapsedSeconds: (performance.now() - started) / 1000, negativeRankingMargins: rows.filter(row => row.rankingMargin < 0).length }));
}
