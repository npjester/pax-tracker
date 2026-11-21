import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCollection, parseExpoGames, publisherMatches, suggestBooths } from '../src/collection.ts';

test('imports quoted BGG titles, merges copies, and drops irrelevant columns and rows', () => {
  const csv = '\ufeffobjectname,objectid,own,wishlist,wanttobuy,rating,boardgamepublisher,comment\r\n'
    + '"Game, ""Deluxe""",123,1,0,0,8.5,"Fancy Games, Second Publisher","Private,\nmultiline"\r\n'
    + '"Game, ""Deluxe""",123,0,0,1,N/A,Second Publisher,Other copy\r\n'
    + 'Ignored,456,0,0,0,N/A,Irrelevant,Drop';
  assert.deepEqual(parseCollection(csv), [{
    id: '123', title: 'Game, "Deluxe"', publishers: ['Fancy Games', 'Second Publisher'],
    owned: true, wanted: true, rating: 8.5,
  }]);
  assert.throws(() => parseCollection('objectid,objectname,own\n123,"unfinished,1'), /malformed/);
  assert.throws(() => parseCollection('game,owned\nUnknown,1'), /original BoardGameGeek/);
});

test('matches BGG publishers to complete and qualified exhibitor names', () => {
  assert.equal(publisherMatches('Devir', 'Devir Americas, LLC'), true);
  assert.equal(publisherMatches('Dire Wolf Games', 'Dire Wolf Digital'), true);
  assert.equal(publisherMatches('The Game Company', 'Board Game Company'), false);
  assert.equal(publisherMatches('A', 'A Games'), false);
});

test('ranks listed games above transparent publisher matches and skips ambiguous titles', () => {
  const collection = parseCollection('objectname,objectid,own,wishlist,rating\n'
    + 'Café Game,1,0,1,N/A\nRated,2,1,0,9\nOwned,3,1,0,4\nTwin,4,0,1,N/A\nTwin,5,1,0,10');
  const listings = parseExpoGames({ space_order_specials: [
    { space_order_id: '10', title: 'Cafe Game' },
    { space_order_id: '10', title: 'Cafe Game' },
    { space_order_id: '20', title: 'Rated' },
    { space_order_id: '30', title: 'Owned' },
    { space_order_id: '40', title: 'Twin' },
    { space_order_id: '50', title: 'Cafe Game: Expansion' },
  ] });
  const booths = ['50', '40', '30', '20', '10'].map((n) => ({
    id: `paxu-2026-${n}`, name: `Publisher ${n}`, booth_number: n,
  }));
  assert.deepEqual(suggestBooths(collection, booths, listings).map(({ booth, reasons }) => [booth.booth_number, reasons.map((reason) => reason.reason)]), [
    ['10', ['On your want list']], ['20', ['You rated it 9/10']], ['30', ['In your collection']],
  ]);
});

test('adds publisher matches from the full booth list and supports older saved collections', () => {
  const collection = [{ id: '1', title: 'Favorite Game', publishers: ['Bright Fox Games'], owned: true, wanted: false, rating: 8 }];
  const exhibitors = [{ id: 'paxu-2026-7', name: 'Bright Fox Games', booth_number: '1701' }];
  const suggestions = suggestBooths(collection, exhibitors, []);
  assert.equal(suggestions[0].booth.booth_number, '1701');
  assert.match(suggestions[0].reasons[0].reason, /Publisher match; rated 8\/10/);
  assert.deepEqual(suggestBooths([{ id: '2', title: 'No publisher metadata', owned: true, wanted: false, rating: null }], exhibitors, []), []);
});

test('ranks an exact PAX game listing ahead of a publisher-only suggestion', () => {
  const collection = [{ id: '1', title: 'Favorite Game', publishers: ['Bright Fox Games'], owned: true, wanted: false, rating: null }];
  const exhibitors = [
    { id: 'paxu-2026-7', name: 'Bright Fox Games', booth_number: '1701' },
    { id: 'paxu-2026-8', name: 'Other Publisher', booth_number: '1702' },
  ];
  const suggestions = suggestBooths(collection, exhibitors, [{ exhibitorId: 'paxu-2026-8', title: 'Favorite Game' }]);
  assert.deepEqual(suggestions.map(({ booth }) => booth.booth_number), ['1702', '1701']);
});
