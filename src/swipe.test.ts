import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDismissSwipe } from './swipe.ts';

test('panel dismissal requires a deliberate horizontal swipe in either direction', () => {
  assert.equal(isDismissSwipe(60, 10), true);
  assert.equal(isDismissSwipe(-90, 20), true);
  for (const [x, y] of [[0, 0], [59, 0], [80, 100], [-80, -100], [60, 40]])
    assert.equal(isDismissSwipe(x, y), false);
});
