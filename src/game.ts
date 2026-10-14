export type Upgrade = 'click' | 'auto';

export const SKINS = [
  { id: 'original', name: 'Original', price: 0, power: 'La clásica: sin bono', image: '/assets/michirata-original.jpg' },
  { id: 'football', name: 'Futbolista', price: 100, power: '+2 por clic. Cada 8 clics seguidos: ¡gol y bono ×20!', image: '/assets/michirata-football.jpg' },
  { id: 'robot', name: 'Robot', price: 200, power: '+2/s. Cada 10 clics seguidos: descarga de 10 segundos de producción (mínimo 20 puntos).', image: '/assets/michirata-robot.jpg' },
  { id: 'godin', name: 'Godín', price: 350, power: 'La cuadrilla produce el doble. Cada 12 clics seguidos: café y bono por trabajadora.', image: '/assets/michirata-godin.jpg' },
  { id: 'jester', name: 'Bufón', price: 500, power: 'Cada 5 clics seguidos: bono sorpresa ×2, ×5 o ×10. ¡Que empiece el caos!', image: '/assets/michirata-jester.jpg' },
  { id: 'magnate', name: 'Magnate', price: 800, power: 'Ahorrar potencia clics (hasta +10) y cuadrilla (hasta ×3). Gastar puede reducir el bono.', image: '/assets/michirata-magnate.jpg' },
  {"id": "mapache", "name": "Mapache", "price": 900, "power": "Clic ×1.4; cuadrilla ×1. Cada 6 clics seguidos: 5× clic base + 0 segundos de producción.", "image": "/assets/michirata-mapache.webp"},
  {"id": "walkman", "name": "Walkman", "price": 1100, "power": "Clic ×1.2; cuadrilla ×1.2. Cada 8 clics seguidos: 7× clic base + 0 segundos de producción.", "image": "/assets/michirata-walkman.webp"},
  {"id": "sirena", "name": "Sirena", "price": 1400, "power": "Clic ×1; cuadrilla ×1.4. Cada 10 clics seguidos: 2× clic base + 5 segundos de producción.", "image": "/assets/michirata-sirena.webp"},
  {"id": "ranita", "name": "Ranita", "price": 1700, "power": "Clic ×1.6; cuadrilla ×1. Cada 4 clics seguidos: 3× clic base + 0 segundos de producción.", "image": "/assets/michirata-ranita.webp"},
  {"id": "dibujo", "name": "Garabato", "price": 2000, "power": "Clic ×1.8; cuadrilla ×1. Cada 12 clics seguidos: 10× clic base + 0 segundos de producción.", "image": "/assets/michirata-dibujo.webp"},
  {"id": "peluca", "name": "Peluca", "price": 2400, "power": "Clic ×1.3; cuadrilla ×1.3. Cada 6 clics seguidos: 4× clic base + 1 segundos de producción.", "image": "/assets/michirata-peluca.webp"},
  {"id": "presidenta", "name": "Presidenta", "price": 2800, "power": "Clic ×1; cuadrilla ×2.2. Cada 15 clics seguidos: 2× clic base + 4 segundos de producción.", "image": "/assets/michirata-presidenta.webp"},
  {"id": "queso", "name": "Queso gigante", "price": 3300, "power": "Clic ×1; cuadrilla ×2.4. Cada 16 clics seguidos: 0× clic base + 4 segundos de producción.", "image": "/assets/michirata-queso.webp"},
  {"id": "brujita", "name": "Brujita", "price": 3900, "power": "Clic ×1.5; cuadrilla ×1.2. Cada 9 clics seguidos: 8× clic base + 1 segundos de producción.", "image": "/assets/michirata-brujita.webp"},
  {"id": "calabaza", "name": "Calabaza", "price": 4500, "power": "Clic ×1.2; cuadrilla ×1.5. Cada 7 clics seguidos: 5× clic base + 2 segundos de producción.", "image": "/assets/michirata-calabaza.webp"},
  {"id": "sumo", "name": "Sumo", "price": 5200, "power": "Clic ×2; cuadrilla ×1. Cada 10 clics seguidos: 8× clic base + 0 segundos de producción.", "image": "/assets/michirata-sumo.webp"},
  {"id": "mole", "name": "Mole", "price": 6000, "power": "Clic ×1.1; cuadrilla ×2. Cada 12 clics seguidos: 1× clic base + 4 segundos de producción.", "image": "/assets/michirata-mole.webp"},
  {"id": "venadito", "name": "Venadito alado", "price": 6900, "power": "Clic ×1.7; cuadrilla ×1.3. Cada 8 clics seguidos: 6× clic base + 1 segundos de producción.", "image": "/assets/michirata-venadito.webp"},
  {"id": "oficinista", "name": "Oficinista", "price": 7900, "power": "Clic ×1.1; cuadrilla ×2.6. Cada 18 clics seguidos: 0× clic base + 4 segundos de producción.", "image": "/assets/michirata-oficinista.webp"},
  {"id": "tecladista", "name": "Tecladista", "price": 9000, "power": "Clic ×1.3; cuadrilla ×1.8. Cada 11 clics seguidos: 3× clic base + 3 segundos de producción.", "image": "/assets/michirata-tecladista.webp"},
  {"id": "ni", "name": "Ñi", "price": 10200, "power": "Clic ×2.2; cuadrilla ×1. Cada 3 clics seguidos: 2× clic base + 0 segundos de producción.", "image": "/assets/michirata-ni.webp"},
  {"id": "locutora", "name": "Locutora", "price": 11500, "power": "Clic ×1.5; cuadrilla ×1.6. Cada 10 clics seguidos: 4× clic base + 2 segundos de producción.", "image": "/assets/michirata-locutora.webp"},
  {"id": "magica", "name": "Mágica", "price": 13000, "power": "Clic ×1.8; cuadrilla ×1.8. Cada 14 clics seguidos: 7× clic base + 3 segundos de producción.", "image": "/assets/michirata-magica.webp"},
] as const;

export type Skin = typeof SKINS[number]["id"];

export type TapEffect = 'none' | 'goal' | 'sparks' | 'coffee' | 'chaos' | 'coins';

export const NEW_SKIN_POWERS = {
  mapache: { click: 1.4, auto: 1, chain: 6, bonusClick: 5, bonusProduction: 0, effect: 'coins' },
  walkman: { click: 1.2, auto: 1.2, chain: 8, bonusClick: 7, bonusProduction: 0, effect: 'chaos' },
  sirena: { click: 1, auto: 1.4, chain: 10, bonusClick: 2, bonusProduction: 5, effect: 'sparks' },
  ranita: { click: 1.6, auto: 1, chain: 4, bonusClick: 3, bonusProduction: 0, effect: 'goal' },
  dibujo: { click: 1.8, auto: 1, chain: 12, bonusClick: 10, bonusProduction: 0, effect: 'chaos' },
  peluca: { click: 1.3, auto: 1.3, chain: 6, bonusClick: 4, bonusProduction: 1, effect: 'chaos' },
  presidenta: { click: 1, auto: 2.2, chain: 15, bonusClick: 2, bonusProduction: 4, effect: 'coins' },
  queso: { click: 1, auto: 2.4, chain: 16, bonusClick: 0, bonusProduction: 4, effect: 'coffee' },
  brujita: { click: 1.5, auto: 1.2, chain: 9, bonusClick: 8, bonusProduction: 1, effect: 'sparks' },
  calabaza: { click: 1.2, auto: 1.5, chain: 7, bonusClick: 5, bonusProduction: 2, effect: 'chaos' },
  sumo: { click: 2, auto: 1, chain: 10, bonusClick: 8, bonusProduction: 0, effect: 'goal' },
  mole: { click: 1.1, auto: 2, chain: 12, bonusClick: 1, bonusProduction: 4, effect: 'coffee' },
  venadito: { click: 1.7, auto: 1.3, chain: 8, bonusClick: 6, bonusProduction: 1, effect: 'goal' },
  oficinista: { click: 1.1, auto: 2.6, chain: 18, bonusClick: 0, bonusProduction: 4, effect: 'coffee' },
  tecladista: { click: 1.3, auto: 1.8, chain: 11, bonusClick: 3, bonusProduction: 3, effect: 'sparks' },
  ni: { click: 2.2, auto: 1, chain: 3, bonusClick: 2, bonusProduction: 0, effect: 'chaos' },
  locutora: { click: 1.5, auto: 1.6, chain: 10, bonusClick: 4, bonusProduction: 2, effect: 'coins' },
  magica: { click: 1.8, auto: 1.8, chain: 14, bonusClick: 7, bonusProduction: 3, effect: 'sparks' },
} as const;

export function newSkinPower(skin: Skin) {
  return skin in NEW_SKIN_POWERS ? NEW_SKIN_POWERS[skin as keyof typeof NEW_SKIN_POWERS] : undefined;
}

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
  const power = newSkinPower(state.equippedSkin);
  if (power) return base * power.click;
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
  const power = newSkinPower(state.equippedSkin);
  if (power) return base * power.auto;
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

  const power = newSkinPower(state.equippedSkin);
  if (power && effectiveChain % power.chain === 0) {
    reward += baseReward * power.bonusClick + production(state) * power.bonusProduction;
    effect = power.effect;
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
