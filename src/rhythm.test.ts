import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshRhythm, rhythmTap, settleRhythm, rhythmBonus, penalized, decayPoints, isRhythm } from './rhythm.ts';
function run(rate: number, seconds: number) {
  let r = freshRhythm(0);
  for (let s = 0; s < seconds; s++) {
    for (let i = 0; i < rate; i++) r = rhythmTap(r, s * 1000 + i * 1000 / rate);
    r = settleRhythm(r, (s + 1) * 1000);
  }
  return r;
}
test('steady play earns a bonus, 30/s is allowed, sustained excess triggers decay', () => {
  assert.equal(rhythmBonus(run(4, 6), 6000), 1.1);
  assert.equal(penalized(run(30, 20), 20000), false);
  assert.equal(penalized(run(10000, 9), 9000), false);
  assert.equal(penalized(run(31, 10), 10000), true);
  assert.equal(penalized(run(10000, 10), 10000), true);
  assert.equal(rhythmBonus(run(100, 10), 10000), 1);
  const hot = run(100, 10);
  assert.equal(penalized(settleRhythm(hot, 12001), 12001), false);
});
test('decay is independent of tick size, nonnegative and does not turn a burst into sustained abuse', () => {
  assert.equal(decayPoints(10000, 1), 9900);
  assert.ok(Math.abs(decayPoints(decayPoints(10000, .5), .5) - 9900) < 1e-9);
  assert.equal(decayPoints(0, 100), 0);
  let r = freshRhythm(0);
  for(let i=0;i<1000;i++)r=rhythmTap(r,0);
  r=settleRhythm(r,1000);
  for(let i=2;i<15;i++)r=settleRhythm(r,i*1000);
  assert.equal(penalized(r,14000),false);
  assert.equal(isRhythm(r),true);
  assert.equal(isRhythm({...r,count:Infinity}),false);
});
