import assert from 'node:assert/strict';
import test from 'node:test';
import { aisles, boothNumbers, mappedBooths, partitionStops, planRoute, queueEntrance } from '../src/booth-route.ts';

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

test('routes to and from side-access booths and accounts for their access distance', () => {
  const start = mappedBooths.find((item) => item.number === '2511');
  const { mapped } = partitionStops([booth('right', '2604'), booth('left', '2605')]);
  const route = planRoute({ kind: 'booth', position: start }, mapped);
  assert.deepEqual(route.stops.map((stop) => stop.position.number), ['2605', '2604']);
  const left = mappedBooths.find((item) => item.number === '2501');
  const right = mappedBooths.find((item) => item.number === '2600');
  const sideRoute = planRoute({ kind: 'booth', position: left }, [{ booth: booth('right', '2600'), position: right }]);
  assert.deepEqual(sideRoute.points[0], { x: left.x, y: left.y + left.height / 2 });
  assert.deepEqual(sideRoute.points.at(-1), { x: right.x + right.width, y: right.y + right.height / 2 });
});

const obstacles = [
  { number: 'Minis Gaming', x: 136, y: -37, width: 101, height: 116 },
  { number: 'Warhammer', x: 136, y: 895, width: 154, height: 240 },
  { number: 'C6', x: 215, y: 339, width: 30, height: 30 },
  { number: 'C7', x: 225, y: 746, width: 30, height: 30 },
  { number: 'BC2', x: 543, y: 339, width: 30, height: 30 },
  { number: 'BC3', x: 543, y: 746, width: 30, height: 30 },
  { number: 'B2', x: 860, y: 339, width: 30, height: 30 },
  { number: 'B3', x: 865, y: 746, width: 30, height: 30 },
  { number: 'AB2', x: 1176, y: 339, width: 30, height: 30 },
  { number: 'AB3', x: 1183, y: 751, width: 30, height: 30 },
  { number: 'A2', x: 1502, y: 339, width: 30, height: 30 },
  { number: 'A3', x: 1502, y: 751, width: 30, height: 30 },
  { number: 'A6', x: 1825, y: 339, width: 30, height: 30 },
  { number: 'A7', x: 1825, y: 751, width: 30, height: 30 },
];

test('mapped booth numbers uniquely identify a location', () => {
  const numbers = mappedBooths.map((position) => position.number);
  assert.equal(new Set(numbers).size, numbers.length);
});

test('routes between the Queue, Hall B and newly mapped Hall A booths', () => {
  const { mapped, unmapped } = partitionStops([
    booth('hall-b', '1821'), booth('hall-a-north', '3342'), booth('hall-a-south', '3209'),
    booth('hall-a-east', '4143'), booth('hall-a-edge', '4359'),
  ]);
  assert.equal(unmapped.length, 0);
  const route = planRoute({ kind: 'entrance', id: 'queue' }, mapped);
  assert.equal(route.stops.length, 5);
  assert.ok(route.points.some((point) => point.x > 1200 && point.y === 1018));
  assert.deepEqual(new Set(route.stops.map((stop) => stop.booth.id)), new Set([
    'hall-b', 'hall-a-north', 'hall-a-south', 'hall-a-east', 'hall-a-edge',
  ]));
});

function crossesInterior(a, b, rectangle) {
  return a.x === b.x
    ? a.x > rectangle.x && a.x < rectangle.x + rectangle.width &&
      Math.max(a.y, b.y) > rectangle.y && Math.min(a.y, b.y) < rectangle.y + rectangle.height
    : a.y > rectangle.y && a.y < rectangle.y + rectangle.height &&
      Math.max(a.x, b.x) > rectangle.x && Math.min(a.x, b.x) < rectangle.x + rectangle.width;
}

test('new cross-aisles provide shorter paths between booth rows', () => {
  for (const [from, to, crossAisle] of [
    ['2151', '2143', 333],
    ['2251', '2243', 413],
    ['2551', '2542', 678],
    ['2651', '2643', 758],
    ['2951', '2853', 884],
  ]) {
    const start = mappedBooths.find((item) => item.number === from);
    const position = mappedBooths.find((item) => item.number === to);
    const route = planRoute({ kind: 'booth', position: start }, [{ booth: booth(to, to), position }]);
    assert.ok(route.points.some((point, index) => index > 0 && point.x === crossAisle &&
      route.points[index - 1].x === crossAisle && point.y !== route.points[index - 1].y), `${from} to ${to} should use aisle ${crossAisle}`);
  }
});

test('drawn aisles do not cross mapped booths or known obstacles', () => {
  for (const segment of aisles) {
    const a = { x: segment.x1, y: segment.y1 };
    const b = { x: segment.x2, y: segment.y2 };
    for (const rectangle of [...mappedBooths, ...obstacles]) {
      assert.equal(crossesInterior(a, b, rectangle), false, `Aisle crosses ${rectangle.number}`);
    }
  }
});

test('routes between mapped booths and the queue without crossing booth interiors', () => {
  for (const start of [null, ...mappedBooths]) for (const target of mappedBooths) {
    const stop = { booth: booth(target.number, target.number), position: target };
    const route = planRoute(start ? { kind: 'booth', position: start } : { kind: 'entrance', id: 'queue' }, [stop]);
    if (!start) assert.deepEqual(route.points[0], { x: queueEntrance.x, y: queueEntrance.y });
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1];
      const b = route.points[i];
      assert.ok(a.x === b.x || a.y === b.y, `Diagonal segment to ${target.number}`);
      for (const rectangle of [...mappedBooths, ...obstacles]) {
        assert.equal(crossesInterior(a, b, rectangle), false, `Route to ${target.number} crosses booth ${rectangle.number}`);
      }
    }
  }
});
