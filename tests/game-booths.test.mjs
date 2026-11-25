import assert from 'node:assert/strict';
import test from 'node:test';
import { matchGameBooths, plannedGamesByBooth } from '../src/game-booths.ts';

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

test('cross-references both game lists with saved booths without duplicating titles', () => {
  const plans = [
    { id: 'try', title: 'Café Game', kind: 'try', checked: false },
    { id: 'buy', title: 'Cafe Game', kind: 'buy', checked: true },
    { id: 'other', title: 'Listed', kind: 'try', checked: false },
    { id: 'none', title: 'No match', kind: 'buy', checked: false },
  ];
  const booths = [
    { id: 'manual', name: 'Bright Fox Games', booth_number: '1701' },
    { id: 'two', name: 'Other Publisher', booth_number: '1702' },
  ];
  const matches = plannedGamesByBooth(plans, [game], exhibitors, [{ exhibitorId: 'two', title: 'Listed' }], booths);
  assert.deepEqual(matches.get('manual'), [{ title: 'Café Game', plans: plans.slice(0, 2), reason: 'Publisher match: Bright Fox Games' }]);
  assert.deepEqual(matches.get('two'), [{ title: 'Listed', plans: [plans[2]], reason: 'PAX lists this title' }]);
});

test('does not assign a publisher to ambiguous custom booths or guess ambiguous game titles', () => {
  const booths = [
    { id: 'manual-1', name: 'Bright Fox Games', booth_number: '1701' },
    { id: 'manual-2', name: 'Bright Fox Games', booth_number: '1701' },
  ];
  const plan = { id: 'try', title: 'Cafe Game', kind: 'try', checked: false };
  assert.equal(plannedGamesByBooth([plan], [game], exhibitors, [], booths).size, 0);
  assert.equal(plannedGamesByBooth([plan], [game, { ...game, id: '2' }], exhibitors, [], [exhibitors[0]]).size, 0);
});
