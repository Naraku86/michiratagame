import './style.css';
import { buySkin, equipSkin, initialState, pointsPerClick, milestoneMultiplier, SKINS, type Upgrade, type Skin, type TapEffect } from './game.ts';
import { load, save, type StorageLike } from './storage.ts';
import { createUI } from './ui.ts';
import { createSound } from './sound.ts';
import { startCommunity } from './community.ts';
import { freshPrestige, migrateV2, prestigeTap, prestigeAdvance, prestigeBuy, prestige as restartPrestige, previewPrestige, buySuper, type SuperId } from './prestige.ts';
import { freshRhythm, rhythmTap, settleRhythm, rhythmBonus, penalized, decayPoints } from './rhythm.ts';
import { efficiency, loadFatigue, recordTap, saveFatigue, settleFatigue } from './fatigue.ts';

let online = import.meta.env.VITE_GAME_MODE === 'online';
try { const response = await fetch('/api/config', {signal: AbortSignal.timeout(3000)}); if(response.ok) online ||= (await response.json()).authoritative === true; } catch { /* Standalone itch package retains local play. */ }
if (online) { const { startOnlineGame } = await import('./online.ts'); await startOnlineGame(); } else {
const pitches: Partial<Record<Skin, number>> = { original: 1, football: 0.95, robot: 1.4, godin: 0.8, jester: 1.15, magnate: 1.05 };

// Access itself can throw when browser storage is disabled.
let storage: StorageLike;
try { storage = window.localStorage; }
catch {
  storage = { getItem: () => { throw Error('Storage unavailable'); }, setItem: () => { throw Error('Storage unavailable'); } };
}
const loaded = load(storage);
const sound = createSound(storage);
let state = loaded.state ?? initialState();
let prestige = loaded.progress?.prestige ?? migrateV2(state) ?? freshPrestige();
let rhythm = loaded.progress?.rhythm ?? freshRhythm(Date.now());
// A future client clock must not freeze counters or extend a saved penalty.
if (rhythm.start > Date.now()) rhythm = { ...freshRhythm(Date.now()), penaltyUntil: rhythm.penaltyUntil > rhythm.start ? Date.now() + 2000 : 0 };
let communityBest = loaded.progress?.boardBest ?? state.points;
let penalty = loaded.progress?.penalty ?? 0;
let fatigue = loadFatigue(storage, Date.now());
let lastFeedback = -Infinity;
let feedbackPoints = 0;
let feedbackEffect: TapEffect = 'none';
function clearFeedback() { feedbackPoints = 0; feedbackEffect = 'none'; }
let writable = loaded.writable;
let dirty = false;
let chain = 0;
let lastTap = -Infinity;
const ui = createUI(document.querySelector<HTMLElement>('#app')!, {
  click: () => {
    const now = performance.now();
    chain = now - lastTap <= 1500 ? chain + 1 : 1;
    lastTap = now;
    const wallNow = Date.now();
    rhythm = rhythmTap(rhythm, wallNow);
    fatigue = recordTap(fatigue, wallNow);
    if (penalized(rhythm, wallNow)) { clearFeedback(); return; }
    const result = prestigeTap(state, prestige, chain, Math.random(), efficiency(fatigue), rhythmBonus(rhythm, wallNow));
    prestige = result.prestige;
    state = result.game; communityBest = Math.max(communityBest, state.points); dirty = true;
    const pitch = pitches[state.equippedSkin] ?? 1;
    // Limit audiovisual work during autoclicking, without dropping rewarded taps.
    feedbackPoints += result.amount;
    if (result.effect !== 'none') feedbackEffect = result.effect;
    const showFeedback = now - lastFeedback >= 80;
    if (showFeedback) { sound.play(pitch); lastFeedback = now; }
    if (showFeedback) {
      ui.render(state, prestige); ui.fatigue(efficiency(fatigue), false, rhythmBonus(rhythm, wallNow) > 1);
      ui.feedback(feedbackPoints, feedbackEffect, chain); clearFeedback();
    }
  },
  soundEnabled: sound.enabled,
  toggleSound: () => sound.toggle(),
  buy: (upgrade: Upgrade) => {
    const previousLevel = upgrade === 'auto' ? state.autoLevel : state.clickLevel;
    const next = prestigeBuy(state, prestige, upgrade);
    if (next === state) return;
    state = next; dirty = true; ui.render(state, prestige); persist();
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
    chain = 0; lastTap = -Infinity; clearFeedback();
    state = next;
    dirty = true; ui.render(state, prestige); persist();
    if (unlocked) {
      sound.play(1.3);
      const item = SKINS.find(item => item.id === skin)!;
      ui.celebrate(`¡${item.name} desbloqueada! ${item.power}`);
    }
  },
  prestige: () => {
    const preview = previewPrestige(state, prestige);
    if (!preview.allowed.ok) return;
    if (!window.confirm(`¿Renacer por ${preview.gains.bigotes} bigotes? Pierdes el saldo y los niveles de clic/trabajadoras. Conservas skins, mejoras permanentes y récord. El bono del tablero será +${Math.min(25, prestige.claimed + preview.gains.bigotes)} %.`)) return;
    const next = restartPrestige(state, prestige);
    state = next.game; prestige = next.prestige;
    dirty = true; chain = 0; lastTap = -Infinity; clearFeedback();
    last = performance.now(); ui.render(state, prestige); persist();
    ui.celebrate(`¡Nueva vida! ${preview.gains.bigotes} bigotes para mejoras permanentes.`, 'jump');
  },
  super: (id: SuperId) => {
    const next = buySuper(prestige, id);
    if (next === prestige) return;
    prestige = next; dirty = true; ui.render(state, prestige); persist();
    ui.celebrate('¡Super mejora permanente! Se conserva al renacer.');
  },
  reset: () => {
    if (!window.confirm('¿Borrar también bigotes y super mejoras de este dispositivo? Esto NO es renacer con premios.')) return;
    clearFeedback();
    state = initialState(); prestige = freshPrestige(); writable = true; dirty = true; last = performance.now(); chain = 0; lastTap = -Infinity;
    ui.render(state, prestige); persist();
  },
});
ui.render(state, prestige);
ui.status(loaded.warning);
ui.fatigue(efficiency(fatigue));
startCommunity(document.querySelector<HTMLElement>('.game__header')!, () => ({ points: communityBest, bigotes: prestige.claimed, penalty }), (record, deductions) => { communityBest = Math.max(communityBest, record); penalty = Math.max(penalty, deductions); dirty = true; });
function persist() {
  saveFatigue(storage, fatigue);
  if (!writable || !dirty) return;
  if (save(storage, state, { prestige, rhythm, boardBest: communityBest, penalty })) { dirty = false; ui.status(''); }
  else ui.status('No se pudo guardar. Tu progreso puede perderse al cerrar.');
}
let last = performance.now();
setInterval(() => {
  const now = performance.now();
  if (!document.hidden) {
    fatigue = settleFatigue(fatigue, Date.now());
    rhythm = settleRhythm(rhythm, Date.now());
    ui.fatigue(efficiency(fatigue), penalized(rhythm, Date.now()), rhythmBonus(rhythm, Date.now()) > 1);
    // shortcut: ignore long stalls, use server time when shared progress is added.
    const seconds = Math.min((now - last) / 1000, 1);
    if (penalized(rhythm, Date.now())) {
      state = { ...state, points: decayPoints(state.points, seconds) };
      const remaining = Math.max(0, communityBest * (1 + Math.min(25, prestige.claimed) / 100) - penalty);
      penalty = Math.min(1e15, penalty + remaining - decayPoints(remaining, seconds));
      dirty = true; ui.render(state, prestige);
    } else {
      const next = prestigeAdvance(state, prestige, seconds);
      prestige = next.prestige;
      if (next.game.points !== state.points) { state = next.game; communityBest = Math.max(communityBest, state.points); dirty = true; ui.render(state, prestige); }
    }
  }
  last = now;
}, 100);
setInterval(persist, 1000);
document.addEventListener('visibilitychange', () => { persist(); last = performance.now(); chain = 0; lastTap = -Infinity; clearFeedback(); });
window.addEventListener('pagehide', persist);

}
