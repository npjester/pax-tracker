import assert from 'node:assert/strict';
import test from 'node:test';
import { boothNumbers, mappedBooths, partitionStops, planRoute, queueEntrance } from '../src/booth-route.ts';

const booth = (id, booth_number) => ({ id, booth_number, name: id, visited: false });

test('excludes missing, unresolved multi-location and duplicate booth numbers', () => {
  const { mapped, unmapped } = partitionStops([
    booth('one', '1851'), booth('two', '2051'), booth('duplicate', '2051'),
    booth('multi', '1951/2051'), booth('unknown', ''),
  ]);
  assert.deepEqual(mapped.map((stop) => stop.booth.id), ['one']);
  assert.deepEqual(unmapped.map((stop) => stop.id), ['two', 'duplicate', 'multi', 'unknown']);
});

test('matches booth numbers without treating rooms and other locations as booth numbers', () => {
  assert.deepEqual(boothNumbers('2626, Room 201B, Gaming Hall Block 32'), ['2626']);
  assert.deepEqual(boothNumbers('Booth 2547/2551; 2911'), ['2547', '2551', '2911']);
  assert.deepEqual(boothNumbers('Room 2026, GH-4301'), []);
  const { mapped } = partitionStops([booth('asmodee', '2626, Room 201B, Gaming Hall Block 32')]);
  assert.equal(mapped[0].position.number, '2626');
});

test('requires a valid explicit location for a multi-booth exhibitor', () => {
  const multi = booth('allplay', '2905, 2911, GH-43C');
  assert.equal(partitionStops([multi]).unmapped.length, 1);
  assert.equal(partitionStops([multi], { allplay: '1851' }).unmapped.length, 1);
  const { mapped, unmapped } = partitionStops([multi], { allplay: '2911' });
  assert.equal(mapped[0].position.number, '2911');
  assert.equal(unmapped.length, 0);
  assert.equal(partitionStops([multi, booth('duplicate', '2911')], { allplay: '2911' }).unmapped.length, 2);
});

test('starts at the chosen booth, then follows mapped aisles to the nearest stop', () => {
  const { mapped } = partitionStops([booth('left', '1851'), booth('middle', '2051'), booth('right', '2651')]);
  const start = mappedBooths.find((item) => item.number === '2051');
  const route = planRoute({ kind: 'booth', position: start }, mapped);
  assert.deepEqual(route.stops.map((stop) => stop.booth.id), ['middle', 'left', 'right']);
  assert.deepEqual(route.points[0], { x: start.x + start.width / 2, y: start.y + start.height });
});

test('routes between mapped booths and the queue without crossing booth interiors', () => {
  const obstacles = [
    { number: 'Warhammer', x: 136, y: 895, width: 154, height: 240 },
    { number: 'C6', x: 215, y: 339, width: 30, height: 30 },
    { number: 'C7', x: 225, y: 746, width: 30, height: 30 },
  ];
  for (const start of [null, ...mappedBooths]) for (const target of mappedBooths) {
    const stop = { booth: booth(target.number, target.number), position: target };
    const route = planRoute(start ? { kind: 'booth', position: start } : { kind: 'entrance', id: 'queue' }, [stop]);
    if (!start) assert.deepEqual(route.points[0], { x: queueEntrance.x, y: queueEntrance.y });
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1];
      const b = route.points[i];
      assert.ok(a.x === b.x || a.y === b.y, `Diagonal segment to ${target.number}`);
      for (const rectangle of [...mappedBooths, ...obstacles]) {
        const crosses = a.x === b.x
          ? a.x > rectangle.x && a.x < rectangle.x + rectangle.width &&
            Math.max(a.y, b.y) > rectangle.y && Math.min(a.y, b.y) < rectangle.y + rectangle.height
          : a.y > rectangle.y && a.y < rectangle.y + rectangle.height &&
            Math.max(a.x, b.x) > rectangle.x && Math.min(a.x, b.x) < rectangle.x + rectangle.width;
        assert.equal(crosses, false, `Route to ${target.number} crosses booth ${rectangle.number}`);
      }
    }
  }
});
