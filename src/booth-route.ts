import type { Booth } from './store.ts';
import { aisles, mappedBooths, queueEntrance, type MapPosition } from './hall-b-map.ts';

export { aisles, mappedBooths, queueEntrance };
export type { MapPosition };
export type Point = { x: number; y: number };
export type MappedStop = { booth: Booth; position: MapPosition };
export type RouteStart = { kind: 'booth'; position: MapPosition } | { kind: 'entrance'; id: 'queue' };

const pointKey = (point: Point) => `${point.x},${point.y}`;
const center = (position: MapPosition) => position.x + position.width / 2;
const aislePoint = (position: MapPosition): Point => ({ x: center(position), y: position.aisle });
const boothPoint = (position: MapPosition): Point => ({
  x: center(position), y: position.access === 'top' ? position.y : position.y + position.height,
});

export function boothNumbers(value: string) {
  return [...new Set(value.split(/[,/;]/).map((part) => part.trim().replace(/^booth\s+/i, ''))
    .filter((part) => /^\d{4}$/.test(part)))];
}

export function partitionStops(booths: Booth[], choices: Record<string, string> = {}) {
  const counts = new Map<string, number>();
  const resolved = booths.map((booth) => {
    const numbers = boothNumbers(booth.booth_number);
    const number = numbers.length === 1 ? numbers[0] : numbers.includes(choices[booth.id]) ? choices[booth.id] : '';
    const position = mappedBooths.find((item) => item.number === number);
    if (position) counts.set(number, (counts.get(number) ?? 0) + 1);
    return { booth, position };
  });
  const mapped: MappedStop[] = [];
  const unmapped: Booth[] = [];
  for (const { booth, position } of resolved) {
    if (position && counts.get(position.number) === 1) mapped.push({ booth, position });
    else unmapped.push(booth);
  }
  return { mapped, unmapped };
}

function buildGraph() {
  const onSegment = (point: Point, segment: typeof aisles[number]) =>
    point.x >= Math.min(segment.x1, segment.x2) && point.x <= Math.max(segment.x1, segment.x2) &&
    point.y >= Math.min(segment.y1, segment.y2) && point.y <= Math.max(segment.y1, segment.y2) &&
    (segment.x1 === segment.x2 ? point.x === segment.x1 : point.y === segment.y1);
  const accessPoints = [...mappedBooths.map(aislePoint), queueEntrance];
  for (const point of accessPoints) {
    if (!aisles.some((segment) => onSegment(point, segment))) {
      throw new Error(`No mapped aisle at ${pointKey(point)}.`);
    }
  }
  const edges = new Map<string, { key: string; distance: number }[]>();
  function connect(a: Point, b: Point) {
    const ak = pointKey(a);
    const bk = pointKey(b);
    const distance = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    edges.set(ak, [...(edges.get(ak) ?? []), { key: bk, distance }]);
    edges.set(bk, [...(edges.get(bk) ?? []), { key: ak, distance }]);
  }
  for (const segment of aisles) {
    const points = new Map<string, Point>();
    const add = (point: Point) => {
      if (onSegment(point, segment)) points.set(pointKey(point), point);
    };
    add({ x: segment.x1, y: segment.y1 });
    add({ x: segment.x2, y: segment.y2 });
    accessPoints.forEach(add);
    for (const other of aisles) {
      if ((segment.x1 === segment.x2) === (other.x1 === other.x2)) continue;
      const intersection = segment.x1 === segment.x2
        ? { x: segment.x1, y: other.y1 } : { x: other.x1, y: segment.y1 };
      if (onSegment(intersection, other)) add(intersection);
    }
    const ordered = [...points.values()].sort((a, b) => a.x - b.x || a.y - b.y);
    for (let i = 1; i < ordered.length; i++) connect(ordered[i - 1], ordered[i]);
  }
  return edges;
}

const graph = buildGraph();

function shortestPaths(start: Point) {
  const source = pointKey(start);
  const distances = new Map<string, number>([[source, 0]]);
  const previous = new Map<string, string>();
  const pending = new Set(graph.keys());
  while (pending.size) {
    let current: string | undefined;
    for (const key of pending) {
      if (distances.has(key) && (current === undefined || distances.get(key)! < distances.get(current)!)) current = key;
    }
    if (current === undefined) break;
    pending.delete(current);
    for (const edge of graph.get(current) ?? []) {
      const distance = distances.get(current)! + edge.distance;
      if (distance < (distances.get(edge.key) ?? Infinity)) {
        distances.set(edge.key, distance);
        previous.set(edge.key, current);
      }
    }
  }
  return { distances, previous };
}

export function planRoute(start: RouteStart, stops: MappedStop[]) {
  const startingBooth = start.kind === 'booth' ? start.position : null;
  const startPoint = startingBooth ? boothPoint(startingBooth) : { x: queueEntrance.x, y: queueEntrance.y };
  let current = startingBooth ? aislePoint(startingBooth) : startPoint;
  const points: Point[] = [startPoint];
  if (startingBooth) points.push(current);
  const remaining = [...stops];
  const ordered: MappedStop[] = [];
  if (startingBooth) {
    const index = remaining.findIndex((stop) => stop.position.number === startingBooth.number);
    if (index >= 0) ordered.push(...remaining.splice(index, 1));
  }
  while (remaining.length) {
    const { distances, previous } = shortestPaths(current);
    remaining.sort((a, b) => {
      const cost = (stop: MappedStop) => (distances.get(pointKey(aislePoint(stop.position))) ?? Infinity) +
        Math.abs(boothPoint(stop.position).y - stop.position.aisle);
      return cost(a) - cost(b) || a.position.number.localeCompare(b.position.number);
    });
    const next = remaining.shift()!;
    const target = aislePoint(next.position);
    const targetKey = pointKey(target);
    if (!distances.has(targetKey)) throw new Error(`No mapped aisle connects booth ${next.position.number}.`);
    const path = [targetKey];
    while (path[0] !== pointKey(current)) path.unshift(previous.get(path[0])!);
    points.push(...path.slice(1).map((key) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    }), boothPoint(next.position));
    ordered.push(next);
    current = target;
    if (remaining.length) points.push(current);
  }
  return { stops: ordered, points };
}
