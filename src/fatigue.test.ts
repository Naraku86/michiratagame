import { test } from 'node:test';
import assert from 'node:assert/strict';
import { efficiency, freshFatigue, loadFatigue, recordTap, saveFatigue, settleFatigue, FATIGUE_KEY } from './fatigue.ts';
import { advance, initialState, tap, type Skin } from './game.ts';

function run(rate: number, seconds: number) {
  let fatigue = freshFatigue(1000);
  const samples: number[] = [];
  for (let i = 0; i < rate * seconds; i++) {
    fatigue = recordTap(fatigue, 1000 + i * 1000 / rate);
    if ((i + 1) % rate === 0) samples.push(efficiency(fatigue));
  }
  return { fatigue, samples };
}
test('eight clicks per second stay fully rewarded and a short rapid burst is tolerated', () => {
  assert.equal(efficiency(run(8, 60).fatigue), 1);
  assert.equal(efficiency(run(12, 3).fatigue), 1);
  let burst = freshFatigue(1000);
  for (let i = 0; i < 24; i++) burst = recordTap(burst, 1000);
  assert.equal(efficiency(burst), 1);
});
test('sustained autoclicking progressively reduces rewards without banning clicks', () => {
  for (const rate of [20, 100, 500]) {
    const { samples } = run(rate, 30);
    assert.ok(samples[9] < samples[4]);
    assert.ok(samples[29] < samples[9]);
    assert.ok(samples[29] > 0);
    assert.ok(samples[29] < 0.01);
  }
  assert.ok(efficiency(run(100, 30).fatigue) < efficiency(run(20, 30).fatigue));
});
test('rest restores rewards while clock rollback does not grant extra recovery', () => {
  const hot = run(20, 30).fatigue;
  assert.ok(efficiency(settleFatigue(hot, hot.updatedAt + 10_000)) > efficiency(hot));
  assert.equal(efficiency(settleFatigue(hot, hot.updatedAt + hot.heat * 1000 + 1000)), 1);
  assert.deepEqual(settleFatigue(hot, hot.updatedAt - 1000), hot);
});
test('reload retains fatigue, applies elapsed recovery and tolerates unavailable storage', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const hot = run(20, 30).fatigue;
  saveFatigue(storage, hot);
  assert.deepEqual(loadFatigue(storage, hot.updatedAt), hot);
  assert.deepEqual(loadFatigue(storage, hot.updatedAt + 1000), settleFatigue(hot, hot.updatedAt + 1000));
  values.set(FATIGUE_KEY, '{bad'); assert.deepEqual(loadFatigue(storage, 1000), freshFatigue(1000));
  values.set(FATIGUE_KEY, JSON.stringify({ heat: -1, credits: 999, updatedAt: 1 })); assert.deepEqual(loadFatigue(storage, 1000), freshFatigue(1000));
  const blocked = { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('blocked'); } };
  assert.deepEqual(loadFatigue(blocked, 1000), freshFatigue(1000));
  assert.doesNotThrow(() => saveFatigue(blocked, hot));
});
test('fatigue scales the entire tap reward, including every skin bonus, without weakening workers', () => {
  for (const [skin, chain] of [['original', 1], ['football', 8], ['robot', 10], ['godin', 12], ['jester', 5], ['magnate', 1]] as [Skin, number][]) {
    const state = { ...initialState(), points: 5000, clickLevel: 16, autoLevel: 16, equippedSkin: skin };
    const normal = tap(state, chain, 0.5);
    const worn = tap(state, chain, 0.5, 0.25);
    assert.equal(worn.amount, normal.amount * 0.25);
    assert.equal(worn.effect, normal.effect);
    assert.equal(advance(state, 1).points, advance(worn.state, 1).points - worn.amount);
  }
});
test('tap scaling happens before the point cap and cannot boost rewards', () => {
  const state = { ...initialState(), points: 1e12 - 1, clickLevel: 16 };
  assert.equal(tap(state, 1, 0.5, 0.5).state.points, 1e12);
  const empty = initialState();
  assert.equal(tap(empty, 1, 0.5, 2).amount, 1);
  assert.equal(tap(empty, 1, 0.5, NaN).amount, 1);
  assert.equal(tap(empty, 1, 0.5, -1).amount, 0);
});
