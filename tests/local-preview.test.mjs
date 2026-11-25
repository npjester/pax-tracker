import assert from 'node:assert/strict';
import test from 'node:test';
import * as preview from '../src/local-preview.ts';
import { parseCollection } from '../src/collection.ts';

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
  data.set('pax-tracker-preview-collection', JSON.stringify(collection));
  assert.deepEqual(preview.getCollection(), collection);
  assert.deepEqual(preview.getSavedCollection(), { games: collection, sourceCsv: null });
  const sourceCsv = 'objectid,objectname,own,comment,other\n1,A game,1,"Private,\ncomment",extra\n2,Ignored,0,unselected,more';
  const saved = { games: parseCollection(sourceCsv), sourceCsv };
  preview.saveCollection(saved);
  assert.deepEqual(preview.getSavedCollection(), saved);
  assert.deepEqual(preview.getCollection(), saved.games);
  const replacement = { games: collection, sourceCsv: 'replacement CSV' };
  preview.saveCollection(replacement);
  assert.deepEqual(preview.getSavedCollection(), replacement);
  preview.removeCollection();
  assert.equal(preview.getCollection(), null);
  assert.equal(preview.getSavedCollection(), null);
  assert.equal(preview.listBooths().length, 1);
  const manual = preview.addGamePlan('buy', 'Existing game');
  preview.addGamePlan('try', 'Existing game');
  assert.equal(preview.importGamePlans('buy', ['existing game', 'New game', 'New game']), 1);
  assert.equal(preview.importGamePlans('buy', ['New game']), 0);
  assert.equal(preview.importGamePlans('try', ['Existing game']), 0);
  assert.equal(preview.importGamePlans('try', ['Want to play']), 1);
  assert.equal(preview.listGamePlans().length, 4);
  assert.equal(preview.checkGamePlan(manual.id, true).checked, true);
  preview.removeGamePlan(manual.id);
  assert.equal(preview.listGamePlans().length, 3);
});
