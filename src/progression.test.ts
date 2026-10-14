import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, advance, tap, buy, pointsPerClick } from './game.ts';

test('an active level-16 player reaches the next milestone within a short session', () => {
  // Original skin, 16 workers, zero balance, 2 taps/s, buying only click upgrades.
  let state = { ...initialState(), clickLevel: 16, autoLevel: 16 };
  let seconds = 0;
  let chain = 0;
  while (seconds < 150 && state.clickLevel < 20) {
    state = advance(state, 0.5);
    state = tap(state, ++chain, 0.5).state;
    state = buy(state, 'click');
    seconds += 0.5;
  }
  assert.equal(state.clickLevel, 20);
  assert.equal(pointsPerClick(state), 84);
  assert.ok(seconds <= 150);
  assert.ok(state.points >= 0);
  assert.equal(state.autoLevel, 16);
});
