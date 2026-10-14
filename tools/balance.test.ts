import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, random, rankingAllowance } from './balance.ts';

test('idle integrates real production exactly and never applies fatigue', () => {
  const run = simulate('original', 20, 0, 60);
  assert.equal(run.total, 80 * 60);
  assert.equal(run.clickPoints, 0);
});
test('original 8/s sustains full yield, excessive autoclick has declining marginal yield', () => {
  assert.equal(simulate('original', 20, 8, 60).finalEfficiency, 1);
  assert.ok(simulate('original', 20, 100, 60).finalEfficiency < 0.001);
  assert.ok(simulate('original', 20, 100, 60).clickPoints < simulate('original', 20, 8, 60).clickPoints);
});
test('seeded simulation reproducible and random bonus EV matches known formula', () => {
  assert.deepEqual(simulate('jester', 20, 4, 600), simulate('jester', 20, 4, 600));
  const roll = random(17);
  let sum = 0;
  for (let i = 0; i < 100_000; i++) { const r = roll(); sum += r < 0.6 ? 2 : r < 0.9 ? 5 : 10; }
  assert.ok(Math.abs(sum / 100_000 - 3.7) < 0.03);
  const run = simulate('jester', 20, 4, 600);
  assert.ok(Math.abs(run.clickPoints / (4 * 600 * 84) - 1.74) < 0.08);
});
test('ranking envelope covers current maximum at sustained accepted rate', () => {
  const run = simulate('football', 100, 8, 600);
  assert.ok(run.total < rankingAllowance(600));
  assert.equal(run.nextClickCost, null);
});

test('tuned late-game skins provide distinct idle, relaxed and active niches', () => {
  for (const level of [16, 60, 100]) {
    assert.ok(simulate('oficinista', level, 0, 600).pointsPerSecond > simulate('magnate', level, 0, 600).pointsPerSecond);
    assert.ok(simulate('magica', level, 1, 600).pointsPerSecond > simulate('football', level, 1, 600).pointsPerSecond);
    assert.ok(simulate('ni', level, 4, 600).pointsPerSecond > simulate('football', level, 4, 600).pointsPerSecond);
    assert.ok(simulate('ni', level, 4, 600).pointsPerSecond > simulate('magica', level, 4, 600).pointsPerSecond);
    assert.ok(simulate('magica', level, 1, 600).pointsPerSecond > simulate('ni', level, 1, 600).pointsPerSecond);
  }
});
