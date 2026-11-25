import assert from 'node:assert/strict';
import test from 'node:test';
import { includeBoothInRoute, initialMapState, readMapState, saveMapState } from '../src/map-state.ts';

test('route settings survive reload and are isolated by account', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const state = { scope: 'selected', selected: ['one'], startValue: 'entrance:queue', choices: { one: '1821' }, activeStopId: 'one' };
  saveMapState(storage, 'first', state);
  assert.deepEqual(readMapState(storage, 'first'), state);
  assert.deepEqual(readMapState(storage, 'second'), initialMapState);
});

test('invalid saved settings and storage failures are reported', () => {
  assert.throws(() => readMapState({ getItem: () => '{"scope":"all"}' }, 'first'), /Invalid map settings/);
  assert.throws(() => readMapState({ getItem: () => '{' }, 'first'), SyntaxError);
  assert.throws(() => saveMapState({ setItem: () => { throw new Error('storage unavailable'); } }, 'first', initialMapState), /storage unavailable/);
});

test('adding a booth preserves existing route scope contents and route settings', () => {
  const booths = [{ id: 'one', visited: false }, { id: 'two', visited: true }];
  const state = { ...initialMapState, startValue: 'entrance:queue', choices: { one: '1821' }, activeStopId: 'one' };
  assert.deepEqual(includeBoothInRoute(state, booths, 'two'), {
    ...state, scope: 'selected', selected: ['one', 'two'],
  });
  assert.deepEqual(includeBoothInRoute({ ...state, scope: 'all' }, booths, 'one').selected, ['one', 'two']);
  assert.deepEqual(includeBoothInRoute({ ...state, scope: 'selected', selected: ['two'] }, booths, 'two').selected, ['two']);
});
