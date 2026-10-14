import { advance, buy, cost, initialState, isGameState, SKINS, tap, type GameState, type Upgrade } from './game.ts';

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
export function prestigeTap(game: GameState, p: PrestigeState, chain: number, roll: number, eff = 1, rhythmBonus = 1) {
  const result = tap(game, chain, roll, eff);
  const earned = earn(game, p, result.amount * clickMultiplier(p) * (Number.isFinite(rhythmBonus) ? Math.max(1, Math.min(1.1, rhythmBonus)) : 1));
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
  if (!Array.isArray(v.achievements) || v.achievements.some(id => !Object.hasOwn(ACHIEVEMENTS, id)) || new Set(v.achievements).size !== v.achievements.length) return false;
  return true;
}

