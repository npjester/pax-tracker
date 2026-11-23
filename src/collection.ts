import Papa from 'papaparse';
import { exhibitorId, type Exhibitor } from './expo.ts';

export type CollectionGame = {
  id: string; title: string; publishers: string[]; owned: boolean; wanted: boolean; wantToBuy?: boolean; rating: number | null;
};
export type ExpoGame = { exhibitorId: string; title: string };
export const collectionFileLimit = 5 * 1024 * 1024;
const column = (name: string) => name.trim().toLowerCase().replace(/[\s_-]+/g, '');
const titleKey = (name: string) => name.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const marked = (value?: string) => /^(1|true|yes)$/i.test(value?.trim() ?? '');
const companyKey = (name: string) => titleKey(name).replace(/\b(llc|inc|ltd|limited|corp|corporation|company|co)\b/g, ' ').replace(/\s+/g, ' ').trim();
const genericPublisherWords = new Set(['a', 'and', 'company', 'edition', 'game', 'games', 'inc', 'ltd', 'llc', 'of', 'publishing', 'publisher', 'publishers', 'the']);

export function publisherMatches(publisher: string, exhibitor: string) {
  const a = companyKey(publisher);
  const b = companyKey(exhibitor);
  if (!a || !b) return false;
  if (a === b) return true;
  const aTokens = new Set(a.split(' ').filter((word) => !genericPublisherWords.has(word)));
  const bTokens = new Set(b.split(' ').filter((word) => !genericPublisherWords.has(word)));
  const shorter = aTokens.size <= bTokens.size ? aTokens : bTokens;
  const longer = shorter === aTokens ? bTokens : aTokens;
  return shorter.size > 0 && [...shorter].every((word) => longer.has(word)) &&
    (shorter.size > 1 || [...shorter][0].length >= 5);
}

export function parseCollection(csv: string): CollectionGame[] {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true, delimiter: ',', skipEmptyLines: 'greedy', transformHeader: column,
  });
  const fields = parsed.meta.fields ?? [];
  if (!fields.includes('objectid') || !fields.includes('objectname')) {
    throw new Error('Use an original BoardGameGeek collection CSV with objectid and objectname columns.');
  }
  if (parsed.errors.length || Object.keys(parsed.meta.renamedHeaders ?? {}).length) {
    throw new Error('This CSV has malformed rows or duplicate columns. Download a fresh copy from BoardGameGeek.');
  }
  const games = new Map<string, CollectionGame>();
  for (const row of parsed.data) {
    const decode = (value: string) => value.replace(/&amp;/gi, '&');
    const listed = decode(row.boardgamepublisher || row.publisher || '').split(/[,;|]/);
    // Version publishers can contain commas ("Rock, Stone & Dice Games"), so only split on ; and |.
    const versions = decode(row.versionpublishers || '').split(/[;|]/);
    const publishers = [...listed, ...versions]
      .map((publisher) => publisher.replace(/\(self-published\)/i, '').trim())
      .filter((publisher) => publisher.length > 1 && publisher.length <= 160);
    const owned = marked(row.own);
    const wanted = marked(row.wishlist) || marked(row.wanttobuy) || marked(row.wanttoplay);
    const number = Number(row.rating);
    const rating = Number.isFinite(number) && number >= 1 && number <= 10 ? number : null;
    if (!owned && !wanted && rating === null) continue;

    const id = row.objectid.trim();
    const title = row.objectname.trim();
    if (!/^\d{1,20}$/.test(id) || !title || title.length > 300) {
      throw new Error('An owned, wanted, or rated game has an invalid BGG ID or title.');
    }
    const previous = games.get(id);
    games.set(id, {
      id, title, owned: owned || !!previous?.owned, wanted: wanted || !!previous?.wanted,
      ...(fields.includes('wanttobuy') ? { wantToBuy: marked(row.wanttobuy) || !!previous?.wantToBuy } : {}),
      rating: rating !== null || previous?.rating != null ? Math.max(rating ?? 0, previous?.rating ?? 0) : null,
      publishers: [...new Set([...(previous?.publishers ?? []), ...publishers])],
    });
  }
  if (!games.size) throw new Error('No owned, wanted, or rated games were found. Try the “all” collection export from BGG.');
  if (games.size > 10000) throw new Error('This collection exceeds the 10,000-game limit.');
  return [...games.values()];
}

export function parseExpoGames(payload: unknown): ExpoGame[] {
  if (!payload || typeof payload !== 'object' || !('space_order_specials' in payload) || !Array.isArray(payload.space_order_specials)) {
    throw new Error('The official games listings returned an unexpected response.');
  }
  return payload.space_order_specials.flatMap((row): ExpoGame[] => {
    const id = row && exhibitorId(row.space_order_id);
    const title = typeof row?.title === 'string' ? row.title.trim() : '';
    return id && title ? [{ exhibitorId: id, title }] : [];
  });
}

type Match = { title: string; reason: string; score: number; source: 'game' | 'publisher' };

export function suggestBooths(games: CollectionGame[], exhibitors: Exhibitor[], listings: ExpoGame[]) {
  const byTitle = new Map<string, CollectionGame[]>();
  for (const game of games) {
    const key = titleKey(game.title);
    if (key) byTitle.set(key, [...(byTitle.get(key) ?? []), game]);
  }
  const matches = new Map<string, Map<string, Match>>();
  for (const listing of listings) {
    const key = titleKey(listing.title);
    const candidates = byTitle.get(key);
    // The PAX feed has titles but no BGG IDs; don't guess between identically named games.
    if (candidates?.length !== 1) continue;
    const game = candidates[0];
    const reason = game.wanted ? 'On your want list' : game.rating !== null && game.rating >= 8 ? `You rated it ${game.rating}/10` : game.owned ? 'In your collection' : '';
    if (!reason) continue;
    const score = game.wanted ? 3 : game.rating !== null && game.rating >= 8 ? 2 : 1;
    const boothMatches = matches.get(listing.exhibitorId) ?? new Map<string, Match>();
    boothMatches.set(`game:${key}`, { title: listing.title, reason, score, source: 'game' });
    matches.set(listing.exhibitorId, boothMatches);
  }

  for (const game of games) {
    const interest = game.wanted ? 'on your want list' :
      game.rating !== null && game.rating >= 8 ? `rated ${game.rating}/10` :
        game.owned ? 'in your collection' : '';
    if (!interest) continue;
    for (const publisher of game.publishers ?? []) {
      for (const booth of exhibitors) {
        if (!publisherMatches(publisher, booth.name)) continue;
        const boothMatches = matches.get(booth.id) ?? new Map<string, Match>();
        boothMatches.set(`publisher:${titleKey(publisher)}:${titleKey(game.title)}`, {
          title: `${publisher} · ${game.title}`,
          reason: `Publisher match; ${interest}`,
          score: game.wanted ? 3 : game.rating !== null && game.rating >= 8 ? 2 : 1,
          source: 'publisher',
        });
        matches.set(booth.id, boothMatches);
      }
    }
  }

  return exhibitors.flatMap((booth) => {
    const reasons = [...(matches.get(booth.id)?.values() ?? [])].sort((a, b) =>
      Number(b.source === 'game') - Number(a.source === 'game') || b.score - a.score || a.title.localeCompare(b.title));
    return reasons.length ? [{ booth, reasons }] : [];
  }).sort((a, b) => Number(b.reasons[0].source === 'game') - Number(a.reasons[0].source === 'game') ||
    b.reasons[0].score - a.reasons[0].score || b.reasons.length - a.reasons.length || a.booth.name.localeCompare(b.booth.name));
}
