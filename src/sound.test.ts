import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSound } from './sound.ts';

test('sound defaults on, persists mute and tolerates missing audio/storage', () => {
  let value: string | null = null;
  const storage = { getItem: () => value, setItem: (_: string, next: string) => { value = next; } };
  const sound = createSound(storage);
  assert.equal(sound.enabled, true);
  assert.doesNotThrow(() => sound.play());
  assert.equal(sound.toggle(), false);
  assert.equal(value, 'off');
  assert.equal(createSound(storage).enabled, false);
  assert.doesNotThrow(() => sound.play());
  assert.equal(sound.toggle(), true);
  assert.equal(value, 'on');
  const blocked = createSound({ getItem: () => { throw Error(); }, setItem: () => { throw Error(); } });
  assert.doesNotThrow(() => blocked.toggle());
});
