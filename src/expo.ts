export const expoPage = 'https://unplugged.paxsite.com/philly/en-us/expo-hall.html';
export const expoYear = 2026;
// This event identifier is published in the official expo page's browser widget.
const eventKey = '50cbfcc3-af7e-4089-892e-004fceeb57ef';
const expoFeed = `https://conventions.leapevent.tech/api/space_orders?key=${eventKey}&category=20455`;
export const expoGamesFeed = `https://conventions.leapevent.tech/api/space_order_specials?type=exclusive&key=${eventKey}`;

export const boothNumberLimit = 96;
export type Exhibitor = { id: string; name: string; booth_number: string };

export function exhibitorId(id: unknown) {
  return typeof id === 'string' && /^\d{1,20}$/.test(id) ? `paxu-${expoYear}-${id}` : undefined;
}

export function parseDirectory(payload: unknown): Exhibitor[] {
  if (!payload || typeof payload !== 'object' || !('space_orders' in payload) || !Array.isArray(payload.space_orders)) {
    throw new Error('The official directory returned an unexpected response.');
  }
  const entries = new Map<string, Exhibitor>();
  for (const row of payload.space_orders) {
    const id = row && exhibitorId(row.id);
    if (!id || typeof row.company !== 'string') continue;
    const name = row.company.trim();
    const booth_number = typeof row.booth === 'string' ? row.booth.trim() : '';
    if (!name || name.length > 100 || booth_number.length > boothNumberLimit) continue;
    if (!entries.has(id)) entries.set(id, { id, name, booth_number });
  }
  if (!entries.size) throw new Error('The official directory is empty or unavailable.');
  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name) || a.booth_number.localeCompare(b.booth_number));
}

export async function fetchDirectory(signal: AbortSignal) {
  const response = await fetch(expoFeed, { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]), cache: 'no-store' });
  if (!response.ok) throw new Error('The official directory could not be loaded.');
  return parseDirectory(await response.json());
}

const normalize = (text: string) => text.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '');
const companyName = (text: string) => normalize(text).replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/ (llc|inc|ltd|corp)$/, '');

export function searchDirectory(entries: Exhibitor[], query: string) {
  const terms = normalize(query).trim().split(/\s+/);
  return entries.filter((entry) => {
    const text = normalize(`${entry.name} ${entry.booth_number}`);
    return terms.every((term) => text.includes(term));
  });
}

export function matchingBooth<T extends Exhibitor>(entry: Exhibitor, booths: T[]) {
  const imported = booths.find((booth) => booth.id === entry.id);
  if (imported) return imported;
  const matches = booths.filter((booth) => !booth.id.startsWith('paxu-') && companyName(booth.name) === companyName(entry.name));
  return matches.length === 1 ? matches[0] : undefined;
}
