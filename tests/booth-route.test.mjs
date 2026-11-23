import assert from 'node:assert/strict';
import test from 'node:test';
import { mappedBooths, orderStops, partitionStops } from '../src/booth-route.ts';

const booth = (id, booth_number) => ({ id, booth_number, name: id, visited: false });

test('excludes missing, multi-location and duplicate booth numbers', () => {
  const { mapped, unmapped } = partitionStops([
    booth('one', '1851'), booth('two', '2051'), booth('duplicate', '2051'),
    booth('multi', '1951/2051'), booth('unknown', ''),
  ]);
  assert.deepEqual(mapped.map((stop) => stop.booth.id), ['one']);
  assert.deepEqual(unmapped.map((stop) => stop.id), ['two', 'duplicate', 'multi', 'unknown']);
});

test('orders mapped stops via the closer end of the aisle, including the starting booth', () => {
  const { mapped } = partitionStops([booth('left', '1851'), booth('middle', '2051'), booth('right', '2651')]);
  const start = mappedBooths.find((item) => item.number === '2051');
  assert.deepEqual(orderStops(start, mapped).map((stop) => stop.booth.id), ['middle', 'left', 'right']);
  const rightStart = mappedBooths.find((item) => item.number === '2851');
  assert.deepEqual(orderStops(rightStart, mapped).map((stop) => stop.booth.id), ['right', 'middle', 'left']);
  assert.deepEqual(orderStops(start, []), []);
});
