import './style.css';
import { advance, buy, buySkin, equipSkin, tap, initialState, pointsPerClick, milestoneMultiplier, SKINS, type Upgrade } from './game.ts';
import { load, save, type StorageLike } from './storage.ts';
import { createUI } from './ui.ts';
import { createSound } from './sound.ts';
import { startCommunity } from './community.ts';

// Access itself can throw when browser storage is disabled.
let storage: StorageLike;
try { storage = window.localStorage; }
catch {
  storage = { getItem: () => { throw Error('Storage unavailable'); }, setItem: () => { throw Error('Storage unavailable'); } };
}
const loaded = load(storage);
const sound = createSound(storage);
let state = loaded.state ?? initialState();
let communityBest = state.points;
let writable = loaded.writable;
let dirty = false;
let chain = 0;
let lastTap = -Infinity;
const ui = createUI(document.querySelector<HTMLElement>('#app')!, {
  click: () => {
    const now = performance.now();
    chain = now - lastTap <= 1500 ? chain + 1 : 1;
    lastTap = now;
    const result = tap(state, chain, Math.random());
    state = result.state; communityBest = Math.max(communityBest, state.points); dirty = true;
    const pitch = { original: 1, football: 0.95, robot: 1.4, godin: 0.8, jester: 1.15, magnate: 1.05 }[state.equippedSkin];
    sound.play(pitch);
    ui.render(state); ui.feedback(result.amount, result.effect, chain);
  },
  soundEnabled: sound.enabled,
  toggleSound: () => sound.toggle(),
  buy: (upgrade: Upgrade) => {
    const previousLevel = upgrade === 'auto' ? state.autoLevel : state.clickLevel;
    const next = buy(state, upgrade);
    if (next === state) return;
    state = next; dirty = true; ui.render(state); persist();
    const level = upgrade === 'auto' ? state.autoLevel : state.clickLevel;
    const hitMilestone = milestoneMultiplier(level) > milestoneMultiplier(previousLevel);
    sound.play(1.2);
    ui.celebrate(hitMilestone
      ? `¡Hito de nivel ${level}! ${upgrade === 'auto' ? 'Tu cuadrilla' : 'Tus clics'} alcanza potencia base ×${milestoneMultiplier(level)}.`
      : upgrade === 'auto'
      ? `¡Nueva trabajadora! Ya tienes ${state.autoLevel} en tu cuadrilla.`
      : `¡Mejora conseguida! Ahora ganas ${pointsPerClick(state)} puntos por clic.`, upgrade === 'auto' ? 'jump' : 'face');
  },
  skin: (skin) => {
    const unlocked = skin !== 'original' && !state.ownedSkins.includes(skin);
    const next = unlocked ? buySkin(state, skin) : equipSkin(state, skin);
    if (next === state) return;
    chain = 0; lastTap = -Infinity;
    state = next;
    dirty = true; ui.render(state); persist();
    if (unlocked) {
      sound.play(1.3);
      const item = SKINS.find(item => item.id === skin)!;
      ui.celebrate(`¡${item.name} desbloqueada! ${item.power}`);
    }
  },
  reset: () => {
    if (!window.confirm('¿Borrar el progreso de este dispositivo y empezar de cero?')) return;
    state = initialState(); writable = true; dirty = true; last = performance.now(); chain = 0; lastTap = -Infinity;
    ui.render(state); persist();
  },
});
ui.render(state);
ui.status(loaded.warning);
startCommunity(document.querySelector<HTMLElement>('.game__header')!, () => communityBest);
function persist() {
  if (!writable || !dirty) return;
  if (save(storage, state)) { dirty = false; ui.status(''); }
  else ui.status('No se pudo guardar. Tu progreso puede perderse al cerrar.');
}
let last = performance.now();
setInterval(() => {
  const now = performance.now();
  if (!document.hidden) {
    // shortcut: ignore long stalls, use server time when shared progress is added.
    const seconds = Math.min((now - last) / 1000, 1);
    const next = advance(state, seconds);
    if (next.points !== state.points) { state = next; communityBest = Math.max(communityBest, state.points); dirty = true; ui.render(state); }
  }
  last = now;
}, 100);
setInterval(persist, 1000);
document.addEventListener('visibilitychange', () => { persist(); last = performance.now(); chain = 0; lastTap = -Infinity; });
window.addEventListener('pagehide', persist);
