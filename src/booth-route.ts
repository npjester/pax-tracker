import type { Booth } from './store.ts';
import { mappedBooths, queueEntrance, type MapPosition } from './hall-b-map.ts';

export { mappedBooths, queueEntrance };
export type { MapPosition };
export type Point = { x: number; y: number };
export type MappedStop = { booth: Booth; position: MapPosition };
export type RouteStart = { kind: 'booth'; position: MapPosition } | { kind: 'entrance'; id: 'queue' };

const spineX = 262;
const pointKey = (point: Point) => `${point.x},${point.y}`;
const center = (position: MapPosition) => position.x + position.width / 2;
const aislePoint = (position: MapPosition): Point => ({ x: center(position), y: position.aisle });
const boothPoint = (position: MapPosition): Point => ({
  x: center(position), y: position.access === 'top' ? position.y : position.y + position.height,
});

export function partitionStops(booths: Booth[]) {
  const counts = new Map<string, number>();
  for (const booth of booths) {
    const number = booth.booth_number.trim();
    counts.set(number, (counts.get(number) ?? 0) + 1);
  }
  const mapped: MappedStop[] = [];
  const unmapped: Booth[] = [];
  for (const booth of booths) {
    const number = booth.booth_number.trim();
    const position = mappedBooths.find((item) => item.number === number);
    if (position && counts.get(number) === 1) mapped.push({ booth, position });
    else unmapped.push(booth);
  }
  return { mapped, unmapped };
}

function buildGraph() {
  const lanes = new Map<number, Set<number>>();
  for (const position of mappedBooths) {
    const xs = lanes.get(position.aisle) ?? new Set<number>([spineX]);
    xs.add(center(position));
    lanes.set(position.aisle, xs);
  }
  lanes.get(queueEntrance.y)!.add(queueEntrance.x);
  const edges = new Map<string, { key: string; distance: number }[]>();
  function connect(a: Point, b: Point) {
    const ak = pointKey(a);
    const bk = pointKey(b);
    const distance = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    edges.set(ak, [...(edges.get(ak) ?? []), { key: bk, distance }]);
    edges.set(bk, [...(edges.get(bk) ?? []), { key: ak, distance }]);
  }
  for (const [y, positions] of lanes) {
    const xs = [...positions].sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) connect({ x: xs[i - 1], y }, { x: xs[i], y });
  }
  const ys = [...lanes.keys()].sort((a, b) => a - b);
  for (let i = 1; i < ys.length; i++) connect({ x: spineX, y: ys[i - 1] }, { x: spineX, y: ys[i] });
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
