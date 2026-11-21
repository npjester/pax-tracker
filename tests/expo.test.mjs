import assert from 'node:assert/strict';
import test from 'node:test';
import { matchingBooth, parseDirectory, searchDirectory } from '../src/expo.ts';

const entries = parseDirectory({ space_orders: [
  { id: '1', company: 'Asmodée USA', booth: '2626, Room 201B, Gaming Hall Block 32' },
  { id: '2', company: 'Devir Americas, LLC', booth: '3435' },
  { id: '2', company: 'Devir Americas, LLC', booth: '3435' },
  { id: 'not-an-id', company: 'Broken record' },
] });

test('normalizes and deduplicates entries without losing multi-location booth labels', () => {
  assert.equal(entries.length, 2);
  assert.equal(entries[0].booth_number, '2626, Room 201B, Gaming Hall Block 32');
  assert.throws(() => parseDirectory({ space_orders: [] }));
});

test('finds an exhibitor using mixed name and booth terms', () => {
  assert.deepEqual(searchDirectory(entries, 'asModee 201b'), [entries[0]]);
  assert.deepEqual(searchDirectory(entries, '3435'), [entries[1]]);
});

test('matches an existing imported booth first and avoids ambiguous name matches', () => {
  const [entry] = searchDirectory(entries, 'Devir');
  const seed = { id: 'seed-devir', name: 'Devir Americas', booth_number: '2722' };
  const imported = { ...entry, name: 'Edited name' };
  assert.equal(matchingBooth(entry, [seed]), seed);
  assert.equal(matchingBooth(entry, [seed, imported]), imported);
  assert.equal(matchingBooth(entry, [seed, { ...seed, id: 'custom-id' }]), undefined);
});
