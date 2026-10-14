import type { StorageLike } from './storage.ts';

export const FATIGUE_KEY = 'michiratagame.fatigue';
const CAPACITY = 24;
const REFILL_PER_SECOND = 8;
const RECOVERY_PER_SECOND = 1;
export interface Fatigue { heat: number; credits: number; updatedAt: number }
export function freshFatigue(now: number): Fatigue { return { heat: 0, credits: CAPACITY, updatedAt: now }; }
export function efficiency(fatigue: Fatigue): number { return 1 / (1 + fatigue.heat / 20) ** 2; }
export function settleFatigue(fatigue: Fatigue, now: number): Fatigue {
  const seconds = Math.max(0, now - fatigue.updatedAt) / 1000;
  return { heat: Math.max(0, fatigue.heat - seconds * RECOVERY_PER_SECOND), credits: Math.min(CAPACITY, fatigue.credits + seconds * REFILL_PER_SECOND), updatedAt: Math.max(now, fatigue.updatedAt) };
}
export function recordTap(fatigue: Fatigue, now: number): Fatigue {
  const next = settleFatigue(fatigue, now);
  const excess = Math.max(0, 1 - next.credits);
  return { ...next, credits: Math.max(0, next.credits - 1), heat: Math.min(1e6, next.heat + excess) };
}
export function loadFatigue(storage: StorageLike, now: number): Fatigue {
  try {
    const value = JSON.parse(storage.getItem(FATIGUE_KEY) ?? 'null');
    if (value && Number.isFinite(value.heat) && value.heat >= 0 && value.heat <= 1e6 && Number.isFinite(value.credits) && value.credits >= 0 && value.credits <= CAPACITY && Number.isFinite(value.updatedAt) && value.updatedAt >= 0)
      // Rebase future saves without granting recovery or freezing recovery until the old date.
      return settleFatigue({ ...value, updatedAt: Math.min(value.updatedAt, now) }, now);
  } catch { /* Storage failures must not stop play. */ }
  return freshFatigue(now);
}
export function saveFatigue(storage: StorageLike, fatigue: Fatigue): void {
  try { storage.setItem(FATIGUE_KEY, JSON.stringify(fatigue)); } catch { /* Keep fatigue for this session when storage is unavailable. */ }
}
