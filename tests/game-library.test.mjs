import assert from 'node:assert/strict';
import test from 'node:test';
import { libraryCollection, libraryGames, metricLevel } from '../src/game-library.ts';

test('shows only wanted-to-play games, sorting by community score then title', () => {
  const games = [
    { id: '1', title: 'Zoo', wantToPlay: true, averageRating: null },
    { id: '2', title: 'Beta', wantToPlay: true, averageRating: 8, rating: 2 },
    { id: '3', title: 'Alpha', wantToPlay: true, averageRating: 8, rating: 10 },
    { id: '4', title: 'Other', wantToPlay: false, averageRating: 10 },
    { id: '5', title: 'Before', wantToPlay: true },
  ];
  assert.deepEqual(libraryGames(games).map((game) => game.title), ['Alpha', 'Beta', 'Before', 'Zoo']);
  assert.deepEqual(libraryGames(games, '  BEt  ').map((game) => game.title), ['Beta']);
  assert.deepEqual(games.map((game) => game.title), ['Zoo', 'Beta', 'Alpha', 'Other', 'Before']);
});

test('reconstructs library scores and weights from the saved CSV, without requiring a re-import', () => {
  const games = [{ id: '1', title: 'Saved game', publishers: [], owned: false, wanted: true, wantToPlay: true, rating: null }];
  const sourceCsv = 'objectid,objectname,own,wanttoplay,average,avgweight\n1,Saved game,0,1,8.4,3.2';
  const [game] = libraryCollection({ games, sourceCsv });
  assert.equal(game.averageRating, 8.4);
  assert.equal(game.averageWeight, 3.2);
  assert.deepEqual(libraryCollection({ games, sourceCsv: null }), games);
  assert.throws(() => libraryCollection({ games, sourceCsv: 'invalid' }), /original BoardGameGeek/);
});

test('maps score and weight scales to color levels', () => {
  assert.deepEqual([1, 2.8, 5.5, 8.2, 10].map((value) => metricLevel(value, 10)), [0, 1, 2, 4, 4]);
  assert.deepEqual([1, 1.8, 3, 4.2, 5].map((value) => metricLevel(value, 5)), [0, 1, 2, 4, 4]);
});
