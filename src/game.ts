export type Upgrade = 'click' | 'auto';
export type Skin = 'original' | 'football' | 'robot' | 'godin' | 'jester' | 'magnate';

export const SKINS = [
  { id: 'original', name: 'Original', price: 0, power: 'La clásica: sin bono', image: '/assets/michirata-original.jpg' },
  { id: 'football', name: 'Futbolista', price: 100, power: '+2 por clic. Cada 8 clics seguidos: ¡gol y bono ×20!', image: '/assets/michirata-football.jpg' },
  { id: 'robot', name: 'Robot', price: 200, power: '+2/s. Cada 10 clics seguidos: descarga de 10 segundos de producción (mínimo 20 puntos).', image: '/assets/michirata-robot.jpg' },
  { id: 'godin', name: 'Godín', price: 350, power: 'La cuadrilla produce el doble. Cada 12 clics seguidos: café y bono por trabajadora.', image: '/assets/michirata-godin.jpg' },
  { id: 'jester', name: 'Bufón', price: 500, power: 'Cada 5 clics seguidos: bono sorpresa ×2, ×5 o ×10. ¡Que empiece el caos!', image: '/assets/michirata-jester.jpg' },
  { id: 'magnate', name: 'Magnate', price: 800, power: 'Ahorrar potencia clics (hasta +10) y cuadrilla (hasta ×3). Gastar puede reducir el bono.', image: '/assets/michirata-magnate.jpg' },
] as const;

export type TapEffect = 'none' | 'goal' | 'sparks' | 'coffee' | 'chaos' | 'coins';

export interface GameState {
  points: number;
  clickLevel: number;
  autoLevel: number;
  ownedSkins: Skin[];
  equippedSkin: Skin;
}

const MAX_POINTS = 1e12;
const MAX_LEVEL = 100;
const CLICK_BASE_COST = 15;
const AUTO_BASE_COST = 30;

function isSkinId(value: unknown): value is Skin {
  return typeof value === 'string' && SKINS.some(skin => skin.id === value);
}

export function initialState(): GameState {
  return { points: 0, clickLevel: 0, autoLevel: 0, ownedSkins: [], equippedSkin: 'original' };
}

export function milestoneMultiplier(level: number): number {
  return 2 ** Math.floor(level / 10);
}

export function pointsPerClick(state: GameState): number {
  const base = (1 + state.clickLevel) * milestoneMultiplier(state.clickLevel);
  switch (state.equippedSkin) {
    case 'football':
      return base + 2;
    case 'magnate':
      return base + Math.min(10, Math.floor(state.points / 200));
    default:
      return base;
  }
}

export function production(state: GameState): number {
  const base = state.autoLevel * milestoneMultiplier(state.autoLevel);
  switch (state.equippedSkin) {
    case 'robot':
      return base + 2;
    case 'godin':
      return base * 2;
    case 'magnate':
      return base * (1 + Math.min(2, Math.floor(state.points / 500)));
    default:
      return base;
  }
}

export function buySkin(state: GameState, skin: Skin): GameState {
  const item = SKINS.find(item => item.id === skin);
  if (!item || skin === 'original' || state.ownedSkins.includes(skin) || state.points < item.price) return state;
  return { ...state, points: state.points - item.price, ownedSkins: [...state.ownedSkins, skin], equippedSkin: skin };
}

export function equipSkin(state: GameState, skin: Skin): GameState {
  if (!isSkinId(skin)) return state;
  if (skin !== 'original' && !state.ownedSkins.includes(skin)) return state;
  return { ...state, equippedSkin: skin };
}

export function cost(state: GameState, upgrade: Upgrade): number {
  const base = upgrade === 'click' ? CLICK_BASE_COST : AUTO_BASE_COST;
  const level = upgrade === 'click' ? state.clickLevel : state.autoLevel;
  return Math.min(Math.ceil(base * 1.5 ** Math.min(level, 10) * 1.15 ** Math.max(0, level - 10)), MAX_POINTS);
}

export function click(state: GameState): GameState {
  const points = Math.min(state.points + pointsPerClick(state), MAX_POINTS);
  return points === state.points ? state : { ...state, points };
}

export function buy(state: GameState, upgrade: Upgrade): GameState {
  const level = upgrade === 'click' ? state.clickLevel : state.autoLevel;
  if (level >= MAX_LEVEL) return state;
  const price = cost(state, upgrade);
  if (state.points < price) return state;
  return upgrade === 'click'
    ? { ...state, points: state.points - price, clickLevel: state.clickLevel + 1 }
    : { ...state, points: state.points - price, autoLevel: state.autoLevel + 1 };
}

export function advance(state: GameState, seconds: number): GameState {
  if (!Number.isFinite(seconds) || seconds < 0) return state;
  const points = Math.min(state.points + production(state) * seconds, MAX_POINTS);
  return points === state.points ? state : { ...state, points };
}

function addPoints(state: GameState, amount: number): GameState {
  const points = Math.min(state.points + amount, MAX_POINTS);
  return points === state.points ? state : { ...state, points };
}

export function tap(state: GameState, chain: number, roll: number, efficiency = 1): { state: GameState; amount: number; effect: TapEffect } {
  const effectiveChain = Number.isSafeInteger(chain) && chain > 0 ? chain : 1;
  const effectiveRoll = Number.isFinite(roll) && roll >= 0 && roll <= 1 ? roll : 0.5;
  const baseReward = (1 + state.clickLevel) * milestoneMultiplier(state.clickLevel);

  let reward = pointsPerClick(state);
  let effect: TapEffect = 'none';

  switch (state.equippedSkin) {
    case 'football':
      if (effectiveChain % 8 === 0) {
        reward += 20 * baseReward;
        effect = 'goal';
      }
      break;
    case 'robot':
      if (effectiveChain % 10 === 0) {
        reward += Math.max(20, production(state) * 10);
        effect = 'sparks';
      }
      break;
    case 'godin':
      if (effectiveChain % 12 === 0) {
        reward += baseReward * 3 + state.autoLevel * milestoneMultiplier(state.autoLevel) * 5;
        effect = 'coffee';
      }
      break;
    case 'jester':
      if (effectiveChain % 5 === 0) {
        const multiplier = effectiveRoll < 0.6 ? 2 : effectiveRoll < 0.9 ? 5 : 10;
        reward += baseReward * multiplier;
        effect = 'chaos';
      }
      break;
    case 'magnate':
      if (Math.min(10, Math.floor(state.points / 200)) > 0) effect = 'coins';
      break;
    default:
      break;
  }

  const factor = Number.isFinite(efficiency) ? Math.min(1, Math.max(0, efficiency)) : 1;
  const next = addPoints(state, reward * factor);
  return { state: next, amount: next.points - state.points, effect };
}

export function isGameState(value: unknown): value is GameState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const { points, clickLevel, autoLevel } = v;
  if (typeof points !== 'number' || !Number.isFinite(points) || points < 0 || points > MAX_POINTS) return false;
  if (typeof clickLevel !== 'number' || !Number.isInteger(clickLevel) || clickLevel < 0 || clickLevel > MAX_LEVEL) return false;
  if (typeof autoLevel !== 'number' || !Number.isInteger(autoLevel) || autoLevel < 0 || autoLevel > MAX_LEVEL) return false;
  if (!Array.isArray(v.ownedSkins)) return false;
  if (v.ownedSkins.some(skin => !isSkinId(skin) || skin === 'original')) return false;
  if (new Set(v.ownedSkins).size !== v.ownedSkins.length) return false;
  if (v.equippedSkin !== 'original' && !v.ownedSkins.includes(v.equippedSkin)) return false;
  return true;
}
