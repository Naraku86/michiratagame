import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advance,
  buy,
  buySkin,
  equipSkin,
  click,
  cost,
  initialState,
  isGameState,
  milestoneMultiplier,
  pointsPerClick,
  production,
  tap,
  SKINS,
  type GameState,
} from './game.ts';

const MAX_POINTS = 1e12;

function state(partial: Partial<GameState> = {}): GameState {
  return { ...initialState(), ...partial };
}

test('initialState starts empty and valid', () => {
  assert.deepEqual(initialState(), { points: 0, clickLevel: 0, autoLevel: 0, ownedSkins: [], equippedSkin: 'original' });
  assert.ok(isGameState(initialState()));
});

test('pointsPerClick scales (1 + clickLevel) by the milestone', () => {
  assert.equal(pointsPerClick(state()), 1);
  assert.equal(pointsPerClick(state({ clickLevel: 7 })), 8);
});

test('production scales autoLevel by the milestone', () => {
  assert.equal(production(state()), 0);
  assert.equal(production(state({ autoLevel: 4 })), 4);
});

test('click adds points without mutating input', () => {
  const s = state({ points: 5, clickLevel: 2 });
  const next = click(s);
  assert.deepEqual(next, state({ points: 8, clickLevel: 2 }));
  assert.deepEqual(s, state({ points: 5, clickLevel: 2 }));
});

test('click caps points at 1e12', () => {
  assert.equal(click(state({ points: MAX_POINTS - 1, clickLevel: 0 })).points, MAX_POINTS);
  assert.equal(click(state({ points: MAX_POINTS })).points, MAX_POINTS);
});

test('cost escalates per level for both upgrades', () => {
  assert.equal(cost(state(), 'click'), 15);
  assert.equal(cost(state({ clickLevel: 1 }), 'click'), 23);
  assert.equal(cost(state({ clickLevel: 2 }), 'click'), 34);
  assert.equal(cost(state(), 'auto'), 30);
  assert.equal(cost(state({ autoLevel: 1 }), 'auto'), 45);
  assert.equal(cost(state({ autoLevel: 2 }), 'auto'), 68);
});

test('cost stays below the 1e12 cap through level 100', () => {
  assert.equal(cost(state({ clickLevel: 100 }), 'click'), 251078475);
  assert.equal(cost(state({ autoLevel: 100 }), 'auto'), 502156950);
  assert.ok(cost(state({ clickLevel: 100 }), 'click') < MAX_POINTS);
  assert.ok(cost(state({ autoLevel: 100 }), 'auto') < MAX_POINTS);
});

test('buy a valid upgrade deducts cost and raises level', () => {
  const s = state({ points: 15 });
  assert.deepEqual(buy(s, 'click'), state({ points: 0, clickLevel: 1 }));
  assert.deepEqual(s, state({ points: 15 }));

  const a = state({ points: 30 });
  assert.deepEqual(buy(a, 'auto'), state({ points: 0, autoLevel: 1 }));
  assert.deepEqual(a, state({ points: 30 }));
});

test('buy rejects when insufficient points', () => {
  const s = state({ points: 14 });
  assert.equal(buy(s, 'click'), s);
  assert.deepEqual(buy(state({ points: 29 }), 'auto'), state({ points: 29 }));
});

test('buy rejects at or above level 100', () => {
  const s = state({ points: MAX_POINTS, clickLevel: 100 });
  assert.equal(buy(s, 'click'), s);
  const a = state({ points: MAX_POINTS, autoLevel: 100 });
  assert.equal(buy(a, 'auto'), a);
});

test('advance adds production * seconds', () => {
  const s = state({ points: 10, autoLevel: 3 });
  assert.deepEqual(advance(s, 2), state({ points: 16, autoLevel: 3 }));
  assert.deepEqual(s, state({ points: 10, autoLevel: 3 }));
});

test('advance supports fractional points', () => {
  assert.equal(advance(state({ autoLevel: 1 }), 0.5).points, 0.5);
});

test('advance caps points at 1e12', () => {
  assert.equal(advance(state({ points: MAX_POINTS - 2, autoLevel: 5 }), 1).points, MAX_POINTS);
});

test('advance rejects invalid elapsed seconds', () => {
  const s = state({ points: 5, autoLevel: 2 });
  assert.equal(advance(s, -1), s);
  assert.equal(advance(s, NaN), s);
  assert.equal(advance(s, Infinity), s);
  assert.equal(advance(s, -Infinity), s);
});

test('isGameState validates shape and ranges', () => {
  assert.ok(isGameState(state()));
  assert.ok(isGameState(state({ points: 0.5 })));
  assert.ok(isGameState(state({ points: MAX_POINTS, clickLevel: 100, autoLevel: 100 })));
  assert.equal(isGameState(null), false);
  assert.equal(isGameState(undefined), false);
  assert.equal(isGameState(42), false);
  assert.equal(isGameState({}), false);
  assert.equal(isGameState({ points: -1, clickLevel: 0, autoLevel: 0 }), false);
  assert.equal(isGameState({ points: MAX_POINTS + 1, clickLevel: 0, autoLevel: 0 }), false);
  assert.equal(isGameState({ points: NaN, clickLevel: 0, autoLevel: 0 }), false);
  assert.equal(isGameState({ points: Infinity, clickLevel: 0, autoLevel: 0 }), false);
  assert.equal(isGameState({ points: 0, clickLevel: 1.5, autoLevel: 0 }), false);
  assert.equal(isGameState({ points: 0, clickLevel: -1, autoLevel: 0 }), false);
  assert.equal(isGameState({ points: 0, clickLevel: 101, autoLevel: 0 }), false);
  assert.equal(isGameState({ points: 0, clickLevel: 0, autoLevel: 1.5 }), false);
  assert.equal(isGameState({ points: 0, clickLevel: 0, autoLevel: -1 }), false);
});

test('skins require points, are bought once and powers apply only when equipped', () => {
  const poor = initialState();
  assert.equal(buySkin(poor, 'football'), poor);
  assert.equal(equipSkin(poor, 'robot'), poor);
  const funded = state({ points: 400 });
  const football = buySkin(funded, 'football');
  assert.equal(football.points, 300);
  assert.equal(funded.points, 400);
  assert.equal(football.equippedSkin, 'football');
  assert.equal(pointsPerClick(football), 3);
  assert.equal(buySkin(football, 'football'), football);
  const robot = buySkin(football, 'robot');
  assert.equal(robot.points, 100);
  assert.equal(production(robot), 2);
  assert.equal(pointsPerClick(robot), 1);
  assert.equal(advance(robot, 2).points, 104);
  const original = equipSkin(robot, 'original');
  assert.equal(production(original), 0);
  assert.equal(original.ownedSkins.length, 2);
  assert.equal(equipSkin(original, 'football').points, 100);
});

test('skin saves reject unknown, duplicate and unowned equipped skins', () => {
  assert.equal(isGameState({ ...initialState(), equippedSkin: 'robot' }), false);
  assert.equal(isGameState({ ...initialState(), ownedSkins: ['alien'] }), false);
  assert.equal(isGameState({ ...initialState(), ownedSkins: ['robot', 'robot'] }), false);
  assert.ok(isGameState(buySkin(state({ points: 200 }), 'robot')));
});

test('SKINS catalogue has all six entries with correct prices and assets', () => {
  const byId = new Map(SKINS.map(s => [s.id, s]));
  assert.equal(byId.size, 6);
  assert.equal(byId.get('original')!.price, 0);
  assert.equal(byId.get('football')!.price, 100);
  assert.equal(byId.get('robot')!.price, 200);
  assert.equal(byId.get('godin')!.price, 350);
  assert.equal(byId.get('jester')!.price, 500);
  assert.equal(byId.get('magnate')!.price, 800);
  assert.equal(byId.get('godin')!.image, '/assets/michirata-godin.jpg');
  assert.equal(byId.get('jester')!.image, '/assets/michirata-jester.jpg');
  assert.equal(byId.get('magnate')!.image, '/assets/michirata-magnate.jpg');
});

test('football keeps +2 per click and preserves base production', () => {
  const s = state({ clickLevel: 2, autoLevel: 5, equippedSkin: 'football' });
  assert.equal(pointsPerClick(s), 5);
  assert.equal(production(s), 5);
});

test('robot keeps +2 per second and preserves base click reward', () => {
  const s = state({ clickLevel: 2, autoLevel: 5, equippedSkin: 'robot' });
  assert.equal(pointsPerClick(s), 3);
  assert.equal(production(s), 7);
});

test('godin doubles worker production with no base automatic bonus', () => {
  assert.equal(production(state({ autoLevel: 0, equippedSkin: 'godin' })), 0);
  assert.equal(production(state({ autoLevel: 4, equippedSkin: 'godin' })), 8);
  assert.equal(pointsPerClick(state({ clickLevel: 2, equippedSkin: 'godin' })), 3);
});

test('magnate scales production and click reward from savings', () => {
  assert.equal(production(state({ autoLevel: 3, points: 0, equippedSkin: 'magnate' })), 3);
  assert.equal(production(state({ autoLevel: 3, points: 499, equippedSkin: 'magnate' })), 3);
  assert.equal(production(state({ autoLevel: 3, points: 500, equippedSkin: 'magnate' })), 6);
  assert.equal(production(state({ autoLevel: 3, points: 999, equippedSkin: 'magnate' })), 6);
  assert.equal(production(state({ autoLevel: 3, points: 1000, equippedSkin: 'magnate' })), 9);
  assert.equal(production(state({ autoLevel: 3, points: 1e9, equippedSkin: 'magnate' })), 9);

  assert.equal(pointsPerClick(state({ clickLevel: 0, points: 0, equippedSkin: 'magnate' })), 1);
  assert.equal(pointsPerClick(state({ clickLevel: 0, points: 199, equippedSkin: 'magnate' })), 1);
  assert.equal(pointsPerClick(state({ clickLevel: 0, points: 200, equippedSkin: 'magnate' })), 2);
  assert.equal(pointsPerClick(state({ clickLevel: 2, points: 2000, equippedSkin: 'magnate' })), 13);
  assert.equal(pointsPerClick(state({ clickLevel: 2, points: 1e9, equippedSkin: 'magnate' })), 13);
});

test('spending can lower the magnate savings bonus', () => {
  const before = state({ points: 2500, clickLevel: 0, autoLevel: 2, equippedSkin: 'magnate' });
  assert.equal(pointsPerClick(before), 11);
  assert.equal(production(before), 6);
  const after = { ...before, points: 190 };
  assert.equal(pointsPerClick(after), 1);
  assert.equal(production(after), 2);
});

test('tap does a normal per-click reward with no effect below thresholds', () => {
  const r = tap(state({ clickLevel: 2 }), 1, 0.5);
  assert.equal(r.effect, 'none');
  assert.equal(r.amount, 3);
  assert.equal(r.state.points, 3);
});

test('football goal every 8 chained clicks is 20x base click reward', () => {
  const s = state({ clickLevel: 2, equippedSkin: 'football' });
  const none = tap(s, 7, 0.5);
  assert.equal(none.effect, 'none');
  assert.equal(none.amount, 5);

  const goal = tap(s, 8, 0.5);
  assert.equal(goal.effect, 'goal');
  assert.equal(goal.amount, 5 + 20 * 3);
  assert.equal(goal.state.points, 65);

  const again = tap(s, 16, 0.5);
  assert.equal(again.effect, 'goal');
  assert.equal(again.amount, 65);
});

test('robot discharge adds ten seconds of production with a minimum of 20 points', () => {
  const low = state({ autoLevel: 0, equippedSkin: 'robot' });
  const lowNone = tap(low, 9, 0.5);
  assert.equal(lowNone.effect, 'none');
  assert.equal(lowNone.amount, 1);

  const lowDischarge = tap(low, 10, 0.5);
  assert.equal(lowDischarge.effect, 'sparks');
  assert.equal(lowDischarge.amount, 1 + 20);

  const high = state({ autoLevel: 5, equippedSkin: 'robot' });
  const highDischarge = tap(high, 10, 0.5);
  assert.equal(highDischarge.effect, 'sparks');
  assert.equal(highDischarge.amount, 1 + 70);
});

test('godin coffee every 12 chained clicks is base*3 + autoLevel*5', () => {
  const s = state({ clickLevel: 1, autoLevel: 3, equippedSkin: 'godin' });
  const none = tap(s, 11, 0.5);
  assert.equal(none.effect, 'none');
  assert.equal(none.amount, 2);

  const coffee = tap(s, 12, 0.5);
  assert.equal(coffee.effect, 'coffee');
  assert.equal(coffee.amount, 2 + 2 * 3 + 15);
  assert.equal(coffee.state.points, 23);
});

test('jester chaos every 5 chained clicks applies roll-driven multiplier', () => {
  const s = state({ clickLevel: 1, equippedSkin: 'jester' });
  assert.equal(tap(s, 4, 0.1).effect, 'none');
  assert.equal(tap(s, 4, 0.1).amount, 2);

  const m2 = tap(s, 5, 0.3);
  assert.equal(m2.effect, 'chaos');
  assert.equal(m2.amount, 2 + 2 * 2);

  const m5 = tap(s, 5, 0.7);
  assert.equal(m5.effect, 'chaos');
  assert.equal(m5.amount, 2 + 2 * 5);

  const m10 = tap(s, 5, 0.95);
  assert.equal(m10.effect, 'chaos');
  assert.equal(m10.amount, 2 + 2 * 10);
});

test('jester roll boundaries fall into the correct bucket', () => {
  const s = state({ equippedSkin: 'jester' });
  assert.equal(tap(s, 5, 0).amount, 1 + 2);
  assert.equal(tap(s, 5, 0.5999).amount, 1 + 2);
  assert.equal(tap(s, 5, 0.6).amount, 1 + 5);
  assert.equal(tap(s, 5, 0.8999).amount, 1 + 5);
  assert.equal(tap(s, 5, 0.9).amount, 1 + 10);
  assert.equal(tap(s, 5, 1).amount, 1 + 10);
});

test('tap treats invalid chain as 1 and invalid roll as 0.5', () => {
  const jester = state({ equippedSkin: 'jester' });
  for (const chain of [0, -1, 8.5, NaN, Infinity, 2 ** 53]) {
    assert.equal(tap(jester, chain, 0.9).effect, 'none');
  }
  const goalState = state({ equippedSkin: 'football' });
  assert.equal(tap(goalState, 0, 0.5).effect, 'none');
  assert.equal(tap(goalState, -8, 0.5).effect, 'none');
  assert.equal(tap(goalState, 8.5, 0.5).effect, 'none');

  for (const roll of [NaN, -0.1, 1.1, Infinity, -Infinity]) {
    const r = tap(state({ equippedSkin: 'jester' }), 5, roll);
    assert.equal(r.effect, 'chaos');
    assert.equal(r.amount, 1 + 2);
  }
});

test('magnate click emits coins only when the savings bonus applies', () => {
  const poor = state({ equippedSkin: 'magnate' });
  const poorTap = tap(poor, 1, 0.5);
  assert.equal(poorTap.effect, 'none');
  assert.equal(poorTap.amount, 1);

  const rich = state({ points: 200, clickLevel: 1, equippedSkin: 'magnate' });
  const richTap = tap(rich, 1, 0.5);
  assert.equal(richTap.effect, 'coins');
  assert.equal(richTap.amount, 3);

  const justUnder = state({ points: 199, equippedSkin: 'magnate' });
  assert.equal(tap(justUnder, 1, 0.5).effect, 'none');
});

test('only the equipped power applies', () => {
  const football = state({ clickLevel: 0, autoLevel: 0, equippedSkin: 'football' });
  assert.equal(pointsPerClick(football), 3);
  assert.equal(production(football), 0);
  assert.equal(tap(football, 8, 0.5).effect, 'goal');

  const robot = state({ clickLevel: 0, autoLevel: 0, equippedSkin: 'robot' });
  assert.equal(pointsPerClick(robot), 1);
  assert.equal(production(robot), 2);
  assert.equal(tap(robot, 8, 0.5).effect, 'none');
});

test('tap amount equals next.points - state.points including the cap', () => {
  const s = state({ points: MAX_POINTS - 1, clickLevel: 0, equippedSkin: 'football' });
  const r = tap(s, 8, 0.5);
  assert.equal(r.effect, 'goal');
  assert.equal(r.state.points, MAX_POINTS);
  assert.equal(r.amount, 1);
});

test('tap does not mutate its input state', () => {
  const s = state({ points: 5, clickLevel: 1, equippedSkin: 'football' });
  tap(s, 8, 0.5);
  assert.deepEqual(s, state({ points: 5, clickLevel: 1, equippedSkin: 'football' }));
});

test('switching skins changes which power is active', () => {
  const funded = state({ points: 2000, autoLevel: 2 });
  const godin = buySkin(funded, 'godin');
  assert.equal(godin.equippedSkin, 'godin');
  assert.equal(production(godin), 4);
  assert.equal(pointsPerClick(godin), 1);
  assert.equal(tap(godin, 12, 0.5).effect, 'coffee');

  const magnate = buySkin(godin, 'magnate');
  assert.equal(magnate.equippedSkin, 'magnate');
  assert.equal(production(magnate), 4);
  assert.equal(tap(magnate, 12, 0.5).effect, 'coins');
  assert.equal(tap(magnate, 12, 0.5).amount, 5);

  const backToGodin = equipSkin(magnate, 'godin');
  assert.equal(backToGodin.equippedSkin, 'godin');
  assert.equal(production(backToGodin), 4);
});

test('buySkin and equipSkin handle the new skin ids and reject unknown ids', () => {
  const funded = state({ points: 5000 });
  const godin = buySkin(funded, 'godin');
  assert.equal(godin.points, 4650);
  assert.deepEqual(godin.ownedSkins, ['godin']);
  assert.equal(godin.equippedSkin, 'godin');

  const jester = buySkin(godin, 'jester');
  assert.equal(jester.points, 4150);
  assert.deepEqual(jester.ownedSkins, ['godin', 'jester']);

  const magnate = buySkin(jester, 'magnate');
  assert.equal(magnate.points, 3350);
  assert.deepEqual(magnate.ownedSkins, ['godin', 'jester', 'magnate']);

  assert.equal(equipSkin(magnate, 'original').equippedSkin, 'original');
  const unowned = state({ points: 0 });
  assert.equal(equipSkin(unowned, 'magnate'), unowned);
  assert.equal(equipSkin(magnate, 'alien' as never), magnate);
  assert.equal(buySkin(magnate, 'alien' as never), magnate);
});

test('isGameState validates the new skin ids dynamically', () => {
  assert.ok(isGameState(state({ ownedSkins: ['godin'], equippedSkin: 'godin' })));
  assert.ok(isGameState(state({ ownedSkins: ['jester'], equippedSkin: 'jester' })));
  assert.ok(isGameState(state({ ownedSkins: ['magnate'], equippedSkin: 'magnate' })));
  assert.equal(isGameState(state({ ownedSkins: ['original'] })), false);
  assert.equal(isGameState({ ...initialState(), equippedSkin: 'godin' }), false);
  assert.equal(isGameState(state({ ownedSkins: ['godin', 'godin'], equippedSkin: 'godin' })), false);
  assert.equal(isGameState(state({ ownedSkins: ['godin', 'robot'], equippedSkin: 'jester' })), false);
  assert.equal(isGameState(state({ ownedSkins: ['godin', 'robot'], equippedSkin: 'robot' })), true);
});

test('milestoneMultiplier doubles every 10 levels up to 100', () => {
  for (let level = 0; level < 10; level++) assert.equal(milestoneMultiplier(level), 1);
  for (let level = 10; level < 20; level++) assert.equal(milestoneMultiplier(level), 2);
  assert.equal(milestoneMultiplier(20), 4);
  assert.equal(milestoneMultiplier(30), 8);
  assert.equal(milestoneMultiplier(40), 16);
  assert.equal(milestoneMultiplier(90), 512);
  assert.equal(milestoneMultiplier(100), 1024);
});

test('click and worker bases scale at levels 9/10/16/19/20/100', () => {
  assert.equal(pointsPerClick(state({ clickLevel: 9 })), 10);
  assert.equal(pointsPerClick(state({ clickLevel: 10 })), 22);
  assert.equal(pointsPerClick(state({ clickLevel: 16 })), 34);
  assert.equal(pointsPerClick(state({ clickLevel: 19 })), 40);
  assert.equal(pointsPerClick(state({ clickLevel: 20 })), 84);
  assert.equal(pointsPerClick(state({ clickLevel: 100 })), 101 * 1024);

  assert.equal(production(state({ autoLevel: 9 })), 9);
  assert.equal(production(state({ autoLevel: 10 })), 20);
  assert.equal(production(state({ autoLevel: 16 })), 32);
  assert.equal(production(state({ autoLevel: 19 })), 38);
  assert.equal(production(state({ autoLevel: 20 })), 80);
  assert.equal(production(state({ autoLevel: 100 })), 100 * 1024);
});

test('milestone crossover 9→10 and 19→20 doubles the whole upgrade family', () => {
  assert.equal(milestoneMultiplier(10), 2 * milestoneMultiplier(9));
  assert.equal(milestoneMultiplier(20), 2 * milestoneMultiplier(19));

  assert.equal(pointsPerClick(state({ clickLevel: 10 })), 22);
  assert.equal(pointsPerClick(state({ clickLevel: 20 })), 84);
  assert.equal(production(state({ autoLevel: 10 })), 20);
  assert.equal(production(state({ autoLevel: 20 })), 80);
});

test('milestone is derived from level, not stored, so reloading never stacks', () => {
  const saved: GameState = { points: 5000, clickLevel: 16, autoLevel: 16, ownedSkins: ['godin'], equippedSkin: 'godin' };
  const reloaded = state(saved);
  assert.equal(pointsPerClick(reloaded), 34);
  assert.equal(production(reloaded), 64);

  const again = state(saved);
  assert.equal(pointsPerClick(again), pointsPerClick(reloaded));
  assert.equal(production(again), production(reloaded));
  assert.deepEqual(reloaded, state(saved));
  assert.deepEqual(saved, { points: 5000, clickLevel: 16, autoLevel: 16, ownedSkins: ['godin'], equippedSkin: 'godin' });
});

test('derived scaling never mutates points or ownedSkins', () => {
  const s = state({ points: 1234, clickLevel: 16, autoLevel: 16, ownedSkins: ['football', 'robot'] });
  const before = { points: s.points, ownedSkins: [...s.ownedSkins] };
  pointsPerClick(s);
  production(s);
  cost(s, 'click');
  cost(s, 'auto');
  assert.equal(s.points, before.points);
  assert.deepEqual(s.ownedSkins, before.ownedSkins);
});

test('skin buffs apply on top of the milestone-scaled bases', () => {
  assert.equal(pointsPerClick(state({ clickLevel: 16, equippedSkin: 'football' })), 36);
  assert.equal(production(state({ autoLevel: 16, equippedSkin: 'robot' })), 34);
  assert.equal(production(state({ autoLevel: 16, equippedSkin: 'godin' })), 64);
  assert.equal(production(state({ autoLevel: 16, points: 500, equippedSkin: 'magnate' })), 64);
  assert.equal(pointsPerClick(state({ clickLevel: 16, points: 200, equippedSkin: 'magnate' })), 35);
});

test('godin coffee uses scaled worker base ×5 and honours the cap', () => {
  const s = state({ clickLevel: 16, autoLevel: 16, equippedSkin: 'godin' });
  const coffee = tap(s, 12, 0.5);
  assert.equal(coffee.effect, 'coffee');
  // click = 34, baseReward = 34, worker base = 32 → 34 + 34*3 + 32*5 = 296
  assert.equal(coffee.amount, 296);

  const capped = state({ points: MAX_POINTS - 1, clickLevel: 16, autoLevel: 16, equippedSkin: 'godin' });
  const r = tap(capped, 12, 0.5);
  assert.equal(r.state.points, MAX_POINTS);
  assert.equal(r.amount, 1);
});

test('regression: late-level prices and original base outputs', () => {
  assert.equal(cost(state({ clickLevel: 16 }), 'click'), 2001);
  assert.equal(pointsPerClick(state({ clickLevel: 16 })), 34);
  assert.equal(cost(state({ autoLevel: 16 }), 'auto'), 4002);
  assert.equal(production(state({ autoLevel: 16 })), 32);

  assert.equal(pointsPerClick(state({ clickLevel: 20 })), 84);
  assert.equal(production(state({ autoLevel: 20 })), 80);
});

test('cost grows 1.5× to level 10 then 1.15× and never decreases', () => {
  assert.equal(cost(state({ clickLevel: 9 }), 'click'), 577);
  assert.equal(cost(state({ clickLevel: 10 }), 'click'), 865);
  assert.equal(cost(state({ clickLevel: 11 }), 'click'), 995);

  let prev = 0;
  for (let level = 0; level <= 100; level++) {
    const c = cost(state({ clickLevel: level }), 'click');
    assert.ok(c >= prev, `click cost decreased at level ${level}`);
    prev = c;
  }
  assert.equal(cost(state({ clickLevel: 100 }), 'click'), 251078475);
});
