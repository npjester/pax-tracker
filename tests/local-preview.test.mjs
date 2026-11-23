import assert from 'node:assert/strict';
import test from 'node:test';
import * as preview from '../src/local-preview.ts';

test('local preview persists checklist and collection separately and reports missing records', () => {
  const data = new Map();
  globalThis.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
  assert.deepEqual(preview.listBooths(), []);
  const booth = preview.addBooth({ id: 'booth', name: 'Publisher', booth_number: '123', priority: 'regular' });
  const game = preview.addGame(booth.id, 'A game');
  preview.checkGame(game.id, true);
  preview.updateBooth(booth.id, { visited: true });
  assert.equal(preview.listBooths()[0].games[0].checked, true);
  assert.equal(preview.listBooths()[0].visited, true);
  assert.throws(() => preview.addBooth({ id: 'booth', name: 'Duplicate', booth_number: '', priority: 'regular' }), /already/);
  assert.throws(() => preview.updateBooth('missing', { visited: true }), /no longer exists/);
  const collection = [{ id: '1', title: 'A game', publishers: [], owned: true, wanted: false, rating: null }];
  preview.saveCollection(collection);
  assert.deepEqual(preview.getCollection(), collection);
  preview.removeCollection();
  assert.equal(preview.getCollection(), null);
  assert.equal(preview.listBooths().length, 1);
  const manual = preview.addGamePlan('buy', 'Existing game');
  preview.addGamePlan('try', 'Existing game');
  assert.equal(preview.importGamesToBuy(['existing game', 'New game', 'New game']), 1);
  assert.equal(preview.importGamesToBuy(['New game']), 0);
  assert.equal(preview.listGamePlans().length, 3);
  assert.equal(preview.checkGamePlan(manual.id, true).checked, true);
  preview.removeGamePlan(manual.id);
  assert.equal(preview.listGamePlans().length, 2);
});
