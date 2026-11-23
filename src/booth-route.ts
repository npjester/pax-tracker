import type { Booth } from './store.ts';

// Relative positions along the same aisle on page 2 of the 2026 official expo map.
export const mappedBooths = [
  { number: '1851', name: 'Red Raven Games', x: 52 },
  { number: '1951', name: 'Calliope Games', x: 96 },
  { number: '2051', name: 'Inside Up Games', x: 162 },
  { number: '2151', name: 'Grand Gamers Guild', x: 228 },
  { number: '2251', name: 'Archon Games', x: 294 },
  { number: '2451', name: 'Contention Games', x: 406 },
  { number: '2651', name: 'Dragon Shield', x: 518 },
  { number: '2751', name: 'Mighty Boards', x: 580 },
  { number: '2851', name: 'Mythworks', x: 621 },
  { number: '2951', name: 'Studio 2 Publishing', x: 718 },
] as const;

export type MapPosition = (typeof mappedBooths)[number];
export type MappedStop = { booth: Booth; position: MapPosition };

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

export function orderStops(start: MapPosition, stops: MappedStop[]): MappedStop[] {
  if (!stops.length) return [];
  const sorted = [...stops].sort((a, b) => a.position.x - b.position.x);
  const atStart = sorted.filter((stop) => stop.position.number === start.number);
  const others = sorted.filter((stop) => stop.position.number !== start.number);
  if (!others.length) return atStart;
  const left = others[0].position.x;
  const right = others[others.length - 1].position.x;
  const leftFirst = Math.abs(start.x - left) + right - left <= Math.abs(start.x - right) + right - left;
  const ordered = leftFirst
    ? [...others.filter((stop) => stop.position.x < start.x).reverse(), ...others.filter((stop) => stop.position.x > start.x)]
    : [...others.filter((stop) => stop.position.x > start.x), ...others.filter((stop) => stop.position.x < start.x).reverse()];
  return [...atStart, ...ordered];
}
