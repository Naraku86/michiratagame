import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, save } from './storage.ts';
import { initialState } from './game.ts';

test('save/load roundtrip and preserve incompatible or corrupt saves', () => {
  let raw: string | null = null;
  const storage = { getItem: () => raw, setItem: (_: string, value: string) => { raw = value; } };
  assert.equal(load(storage).writable, true);
  assert.equal(save(storage, initialState()), true);
  assert.deepEqual(load(storage).state, initialState());
  raw = '{"version":2,"state":{}}';
  assert.equal(load(storage).writable, false);
  assert.equal(raw, '{"version":2,"state":{}}');
  raw = '{invalid';
  assert.equal(load(storage).writable, false);
});
test('storage failures do not crash play', () => {
  const storage = { getItem: (): string => { throw Error('blocked'); }, setItem: () => { throw Error('quota'); } };
  assert.equal(load(storage).writable, false);
  assert.equal(save(storage, initialState()), false);
});

 test('legacy progress migrates without losing points and new skins roundtrip', () => {
  let raw = JSON.stringify({ version: 1, state: { points: 123, clickLevel: 2, autoLevel: 3 } });
  const storage = { getItem: () => raw, setItem: (_: string, value: string) => { raw = value; } };
  assert.deepEqual(load(storage).state, { ...initialState(), points: 123, clickLevel: 2, autoLevel: 3 });
  const state = { ...initialState(), points: 17, ownedSkins: ['robot'] as const, equippedSkin: 'robot' as const };
  const saved = { ...state, ownedSkins: [...state.ownedSkins] };
  assert.equal(save(storage, saved), true);
  assert.equal(JSON.parse(raw).version, 2);
  assert.deepEqual(load(storage).state, saved);
 });
