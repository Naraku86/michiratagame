import { isGameState, type GameState } from './game.ts';

import { isPrestigeState, type PrestigeState } from './prestige.ts';
import { isRhythm, type Rhythm } from './rhythm.ts';

export interface Progress { prestige: PrestigeState; rhythm: Rhythm; boardBest: number; penalty: number }
function isProgress(p: unknown): p is Progress {
  if (!p || typeof p !== 'object') return false;
  const v = p as Progress;
  return isPrestigeState(v.prestige) && isRhythm(v.rhythm) && Number.isFinite(v.boardBest) && v.boardBest >= 0 && v.boardBest <= 1e12 && Number.isFinite(v.penalty) && v.penalty >= 0 && v.penalty <= 1e15;
}

const KEY = 'michiratagame.demo';
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export function load(storage: StorageLike): { state?: GameState; progress?: Progress; warning: string; writable: boolean } {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null) return { warning: '', writable: true };
    const value = JSON.parse(raw);
    const state = value?.version === 1 && typeof value.state === 'object' && value.state !== null
      ? { ...value.state, ownedSkins: [], equippedSkin: 'original' }
      : value?.state;
    if (![1, 2, 3].includes(value?.version) || !isGameState(state) || (value.version === 3 && !isProgress(value.progress)))
      return { warning: 'El guardado no es compatible o está dañado. Se conserva: reinicia para reemplazarlo.', writable: false };
    return { state, ...(value.version === 3 ? { progress: value.progress } : {}), warning: '', writable: true };
  } catch {
    return { warning: 'No se pudo leer el guardado. Puedes jugar; reinicia para intentar guardar de nuevo.', writable: false };
  }
}
export function save(storage: StorageLike, state: GameState, progress?: Progress): boolean {
  try {
    if (!isGameState(state) || (progress !== undefined && !isProgress(progress))) return false;
    storage.setItem(KEY, JSON.stringify(progress ? { version: 3, state, progress } : { version: 2, state }));
    return true;
  } catch { return false; }
}
