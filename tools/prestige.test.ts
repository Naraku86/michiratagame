import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, buy, cost, initialState, isGameState, SKINS, tap, type GameState } from '../src/game.ts';
import {
  availableBigotes, buySuper, canPrestige, clickMultiplier, costMultiplier, earnedFloor, freshPrestige, isPrestigeState, lifetimeAtLevel,
  lifetimeForBigotes, migrateV2, pendingBigotes, prestige, prestigeAdvance, prestigeBuy, prestigeCost, prestigeTap, previewPrestige,
  productionMultiplier, simulateLaps, simulateRun, spendGreedy, SUPER, SUPER_IDS, SUSPICIOUS_RATE, totalBigotes, worstCaseRate, type PrestigeState,
} from './prestige.ts';

const allSkins = SKINS.filter(skin => skin.id !== 'original').map(skin => skin.id);
const ready = (level = 40, extra = 0): { game: GameState; p: PrestigeState } => ({
  game: { ...initialState(), clickLevel: level, autoLevel: level, points: 1234, ownedSkins: ['godin', 'robot'], equippedSkin: 'robot' },
  p: { ...freshPrestige(), lifetimeEarned: lifetimeAtLevel(level) + extra },
});

test('bigotes follow the cube root of lifetime earnings and stay inside the cap', () => {
  assert.equal(totalBigotes(0), 0);
  assert.equal(totalBigotes(-5), 0);
  assert.equal(totalBigotes(Number.NaN), 0);
  for (let n = 1; n <= 60; n++) {
    assert.equal(totalBigotes(lifetimeForBigotes(n)), n);
    assert.equal(totalBigotes(lifetimeForBigotes(n) - 1), n - 1);
  }
  assert.equal(totalBigotes(Infinity), 0);
  assert.equal(totalBigotes(1e300), totalBigotes(1e15));
});

test('level thresholds 20/40/60/100 map to 0/1/3/23 bigotes with the real cost curve', () => {
  assert.deepEqual([20, 40, 60, 100].map(level => totalBigotes(lifetimeAtLevel(level))), [0, 1, 3, 23]);
  // Lifetime at level 20 equals the sum of real prices of 20 click and 20 auto purchases.
  let expected = 0;
  for (let level = 0; level < 20; level++) expected += cost({ ...initialState(), clickLevel: level }, 'click') + cost({ ...initialState(), autoLevel: level }, 'auto');
  assert.equal(lifetimeAtLevel(20), expected);
});

test('reset spam: total bigotes depend only on lifetime, never on how many resets', () => {
  const lifetime = lifetimeAtLevel(100) * 3;
  let p = freshPrestige();
  let claimedBySteps = 0;
  for (let i = 1; i <= 1000; i++) {
    p = { ...p, lifetimeEarned: (lifetime * i) / 1000 };
    claimedBySteps += pendingBigotes(p);
    p = { ...p, claimed: totalBigotes(p.lifetimeEarned) };
  }
  assert.equal(claimedBySteps, totalBigotes(lifetime));
});

test('prestige is blocked below level 40 in either family or without a pending bigote', () => {
  const { game, p } = ready(40);
  assert.deepEqual(canPrestige({ ...game, autoLevel: 39 }, p), { ok: false, reason: 'levels' });
  assert.deepEqual(canPrestige({ ...game, clickLevel: 39 }, p), { ok: false, reason: 'levels' });
  assert.deepEqual(canPrestige(game, { ...p, claimed: 1 }), { ok: false, reason: 'no-gain' });
  assert.deepEqual(canPrestige(game, p), { ok: true });
  const blocked = { ...game, autoLevel: 39 };
  const result = prestige(blocked, p);
  assert.equal(result.game, blocked);
  assert.equal(result.prestige, p);
});

test('prestige resets balance and levels, keeps skins and lifetime, and cannot repeat immediately', () => {
  const { game, p } = ready(60);
  const { game: after, prestige: next } = prestige(game, p);
  assert.deepEqual(after, { ...initialState(), ownedSkins: ['godin', 'robot'], equippedSkin: 'robot' });
  assert.ok(isGameState(after));
  assert.equal(next.lifetimeEarned, p.lifetimeEarned);
  assert.equal(next.claimed, 3);
  assert.equal(availableBigotes(next), 3);
  assert.equal(next.runs, 1);
  assert.deepEqual(next.achievements, ['primera-vuelta']);
  assert.ok(isPrestigeState(next));
  const again = prestige({ ...after, clickLevel: 40, autoLevel: 40 }, next);
  assert.equal(again.prestige, next);
});

test('confirmation preview lists exactly what is lost, kept and gained', () => {
  const { game, p } = ready(100);
  const owned = { ...game, ownedSkins: [...allSkins] };
  const preview = previewPrestige(owned, p);
  assert.deepEqual(preview.allowed, { ok: true });
  assert.deepEqual(preview.loses, { points: 1234, clickLevel: 100, autoLevel: 100 });
  assert.deepEqual(preview.keeps.ownedSkins, allSkins);
  assert.equal(preview.keeps.equippedSkin, 'robot');
  assert.equal(preview.gains.bigotes, 23);
  assert.deepEqual(preview.gains.achievements, ['primera-vuelta', 'vuelta-completa', 'coleccion-heredada']);
  assert.equal(preview.gains.nextBigoteAt, lifetimeForBigotes(24));
  assert.deepEqual(prestige(owned, p).prestige.achievements, preview.gains.achievements);
});

test('super upgrades cost 1..5 bigotes per level, cap at ×2 / ×2 / −20 % and unlock the final achievement', () => {
  let p: PrestigeState = { ...freshPrestige(), lifetimeEarned: lifetimeForBigotes(45), claimed: 45 };
  assert.equal(buySuper({ ...p, claimed: 0 }, 'garra').upgrades.garra, 0);
  for (const id of SUPER_IDS) for (let i = 0; i < 10; i++) p = buySuper(p, id);
  assert.deepEqual(p.upgrades, { garra: 5, sindicato: 5, regateo: 5 });
  assert.equal(p.spent, 45);
  assert.equal(clickMultiplier(p), 2);
  assert.equal(productionMultiplier(p), 2);
  assert.ok(Math.abs(costMultiplier(p) - 0.8) < 1e-12);
  assert.ok(p.achievements.includes('sindicato-total'));
  assert.ok(isPrestigeState(p));
  assert.equal(isPrestigeState({ ...p, spent: 44 }), false);
  assert.equal(isPrestigeState({ ...p, claimed: 46 }), false);
  assert.equal(isPrestigeState({ ...p, upgrades: { ...p.upgrades, garra: 6 } }), false);
});

test('without upgrades the wrappers match the real engine exactly', () => {
  const p = freshPrestige();
  const game: GameState = { ...initialState(), clickLevel: 23, autoLevel: 17, points: 500, ownedSkins: ['football'], equippedSkin: 'football' };
  assert.equal(prestigeTap(game, p, 8, 0.5).game.points, tap(game, 8, 0.5).state.points);
  assert.equal(prestigeAdvance(game, p, 3).game.points, advance(game, 3).points);
  assert.equal(prestigeCost(game, p, 'auto'), cost(game, 'auto'));
  const rich = { ...game, points: 1e6 };
  assert.deepEqual(prestigeBuy(rich, p, 'click'), buy(rich, 'click'));
});

test('upgrades multiply taps and production, discount prices and still respect fatigue and level cap', () => {
  const p: PrestigeState = { ...freshPrestige(), upgrades: { garra: 5, sindicato: 5, regateo: 5 } };
  const game: GameState = { ...initialState(), clickLevel: 23, autoLevel: 17 };
  const base = tap(game, 1, 0.5).state.points;
  assert.equal(prestigeTap(game, p, 1, 0.5).game.points, base * 2);
  assert.equal(prestigeTap(game, p, 1, 0.5, 0).amount, 0);
  assert.equal(prestigeAdvance(game, p, 1).game.points, advance(game, 2).points);
  const price = prestigeCost(game, p, 'click');
  assert.equal(price, Math.ceil(cost(game, 'click') * 0.8));
  assert.equal(prestigeBuy({ ...game, points: price - 1 }, p, 'click').clickLevel, 23);
  const bought = prestigeBuy({ ...game, points: price }, p, 'click');
  assert.deepEqual([bought.clickLevel, bought.points], [24, 0]);
  const capped = { ...game, clickLevel: 100, points: 1e11 };
  assert.equal(prestigeBuy(capped, p, 'click'), capped);
  const counted = prestigeTap(game, { ...p, lifetimeEarned: 10 }, 1, 0.5);
  assert.equal(counted.prestige.lifetimeEarned, 10 + counted.amount);
});

test('migration from v2 derives a verifiable floor or starts at zero, without touching the game state', () => {
  const game: GameState = { ...initialState(), clickLevel: 2, autoLevel: 1, points: 7, ownedSkins: ['football'], equippedSkin: 'football' };
  // 15 + 23 (click), 30 (auto), 100 (skin), 7 (balance).
  assert.equal(earnedFloor(game), 175);
  assert.deepEqual(migrateV2(game), { ...freshPrestige(), lifetimeEarned: 175, lifetimeBasis: 'derived-floor' });
  assert.deepEqual(migrateV2(game, 'zero'), freshPrestige());
  assert.equal(migrateV2({ ...game, clickLevel: 101 }), undefined);
  assert.equal(totalBigotes(earnedFloor({ ...initialState(), clickLevel: 100, autoLevel: 100 })), 23);
  assert.ok(isPrestigeState(migrateV2(game)));
});

test('bench: second and third laps are faster than the first at every milestone', () => {
  for (const resetAt of [40, 60, 100]) {
    const { laps } = simulateLaps(resetAt, 3, 5);
    for (const mark of [20, 40, 60, 100].filter(mark => mark <= resetAt)) {
      assert.ok(laps[1].reached[mark]! < laps[0].reached[mark]!, `lap 2 at ${mark} with reset ${resetAt}`);
      assert.ok(laps[2].reached[mark]! <= laps[1].reached[mark]!, `lap 3 at ${mark} with reset ${resetAt}`);
    }
  }
  const full = simulateLaps(100, 3, 5).laps;
  assert.deepEqual(full.map(lap => lap.bigotesGained), [23, 5, 4]);
  // Second lap roughly halves the first, then gains shrink.
  assert.ok(full[1].seconds < full[0].seconds * 0.55);
  assert.ok(full[2].seconds > full[1].seconds * 0.9);
});

test('bench: frequent resets earn fewer bigotes per hour than full laps', () => {
  const full = simulateLaps(100, 2, 5);
  const fullRate = full.prestige.claimed / full.totalSeconds;
  for (const resetAt of [40, 60]) {
    let p = freshPrestige(); let time = 0;
    while (time < full.totalSeconds) {
      const run = simulateRun(p, { tapsPerSecond: 5, targetLevel: resetAt, maxSeconds: full.totalSeconds - time, untilPrestige: true });
      time += run.seconds;
      const reset = prestige(run.game, run.prestige);
      if (reset.prestige === run.prestige) { p = run.prestige; break; }
      p = spendGreedy(reset.prestige);
    }
    assert.ok(p.claimed / time < fullRate, `reset at ${resetAt}`);
  }
});

test('high scaling: maxed prestige stays under the suspicious-score rate for every skin', () => {
  for (const skin of SKINS) assert.ok(worstCaseRate(skin.id) < SUSPICIOUS_RATE * 0.75, skin.id);
  // A 30 taps/s autoclicker gains little over 8 taps/s because of fatigue.
  assert.ok(worstCaseRate('football', 30) < worstCaseRate('football', 8) * 1.1);
});

test('the simulation is deterministic', () => {
  assert.deepEqual(simulateLaps(60, 2, 3), simulateLaps(60, 2, 3));
  assert.equal(SUPER.garra.max + SUPER.sindicato.max + SUPER.regateo.max, 15);
});
