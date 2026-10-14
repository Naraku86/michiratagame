import { isGameState, type GameState } from './game.ts';

const KEY = 'michiratagame.demo';
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export function load(storage: StorageLike): { state?: GameState; warning: string; writable: boolean } {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null) return { warning: '', writable: true };
    const value = JSON.parse(raw);
    const state = value?.version === 1 && typeof value.state === 'object' && value.state !== null
      ? { ...value.state, ownedSkins: [], equippedSkin: 'original' }
      : value?.state;
    if ((value?.version !== 1 && value?.version !== 2) || !isGameState(state))
      return { warning: 'El guardado no es compatible o está dañado. Se conserva: reinicia para reemplazarlo.', writable: false };
    return { state, warning: '', writable: true };
  } catch {
    return { warning: 'No se pudo leer el guardado. Puedes jugar; reinicia para intentar guardar de nuevo.', writable: false };
  }
}
export function save(storage: StorageLike, state: GameState): boolean {
  try {
    if (!isGameState(state)) return false;
    storage.setItem(KEY, JSON.stringify({ version: 2, state }));
    return true;
  } catch { return false; }
}
