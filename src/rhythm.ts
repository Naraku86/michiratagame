// One bounded counter per second; never store a growing list of autoclick events.
export interface Rhythm {
  start: number; count: number; rate: number; overSeconds: number;
  steadySeconds: number; penaltyUntil: number;
}
export function freshRhythm(now: number): Rhythm {
  return { start: now, count: 0, rate: 0, overSeconds: 0, steadySeconds: 0, penaltyUntil: 0 };
}
export function settleRhythm(r: Rhythm, now: number): Rhythm {
  if (now < r.start || now - r.start < 1000) return r;
  const consecutive = now - r.start < 2000;
  const rate = r.count / ((now - r.start) / 1000);
  const overSeconds = rate > 30 ? (consecutive ? r.overSeconds : 0) + 1 : 0;
  const steadySeconds = rate >= 1 && rate <= 8 ? (consecutive ? r.steadySeconds : 0) + 1 : 0;
  return { start: now, count: 0, rate, overSeconds, steadySeconds,
    penaltyUntil: overSeconds >= 10 ? now + 2000 : r.penaltyUntil };
}
export function rhythmTap(r: Rhythm, now: number): Rhythm {
  const next = settleRhythm(r, now);
  return { ...next, count: Math.min(1e6, next.count + 1) };
}
export function rhythmBonus(r: Rhythm, now: number): number {
  return r.steadySeconds >= 5 && r.count <= 8 && now - r.start < 2000 && !penalized(r, now) ? 1.1 : 1;
}
export function penalized(r: Rhythm, now: number): boolean { return now < r.penaltyUntil; }
export function decayPoints(points: number, seconds: number): number {
  return Math.max(0, points * 0.99 ** Math.max(0, seconds));
}
export function isRhythm(value: unknown): value is Rhythm {
  if (!value || typeof value !== 'object') return false;
  const r = value as Rhythm;
  return ['start', 'count', 'rate', 'overSeconds', 'steadySeconds', 'penaltyUntil'].every(key => {
    const v = r[key as keyof Rhythm]; return Number.isFinite(v) && v >= 0 && v <= 1e15;
  }) && Number.isInteger(r.count) && r.count <= 1e6;
}
