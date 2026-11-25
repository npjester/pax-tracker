import assert from 'node:assert/strict';
import test from 'node:test';
import { matchGameBooths } from '../src/game-booths.ts';

const exhibitors = [
  { id: 'one', name: 'Bright Fox Games', booth_number: '1701' },
  { id: 'two', name: 'Other Publisher', booth_number: '1702' },
];
const game = { id: '1', title: 'Café Game', publishers: ['Bright Fox Games'], owned: false, wanted: true, rating: null };

test('finds exact PAX listings and collection publisher matches without duplicating a booth', () => {
  const listings = [{ exhibitorId: 'one', title: 'Cafe Game' }, { exhibitorId: 'two', title: 'Cafe Game' }];
  const matches = matchGameBooths('Café Game', [game], exhibitors, listings);
  assert.deepEqual(matches.map(({ booth, reason }) => [booth.id, reason]), [
    ['one', 'PAX lists this title'], ['two', 'PAX lists this title'],
  ]);
  assert.equal(matchGameBooths('Cafe Game', [game], exhibitors, [])[0].reason, 'Publisher match: Bright Fox Games');
  assert.equal(matchGameBooths('Cafe Game', [], exhibitors, listings).length, 2);
});

test('does not guess between identically named collection games or match partial titles', () => {
  assert.deepEqual(matchGameBooths('Cafe Game', [game, { ...game, id: '2' }], exhibitors, [{ exhibitorId: 'one', title: 'Cafe Game' }]), []);
  assert.deepEqual(matchGameBooths('Cafe Game Expansion', [game], exhibitors, [{ exhibitorId: 'one', title: 'Cafe Game' }]), []);
});
