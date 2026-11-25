import assert from 'node:assert/strict';
import test from 'node:test';
import { libraryGames } from '../src/game-library.ts';

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
