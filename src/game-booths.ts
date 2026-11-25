import { publisherMatches, titleKey, type CollectionGame, type ExpoGame } from './collection.ts';
import type { Exhibitor } from './expo.ts';

export type GameBoothMatch = { booth: Exhibitor; reason: string };

export function matchGameBooths(title: string, collection: CollectionGame[], exhibitors: Exhibitor[], listings: ExpoGame[]): GameBoothMatch[] {
  const key = titleKey(title);
  if (!key) return [];
  const games = collection.filter((game) => titleKey(game.title) === key);
  if (games.length > 1) return [];
  const listed = new Set(listings.filter((game) => titleKey(game.title) === key).map((game) => game.exhibitorId));
  const publishers = games[0]?.publishers ?? [];
  return exhibitors.flatMap((booth) => {
    if (listed.has(booth.id)) return [{ booth, reason: 'PAX lists this title' }];
    const publisher = publishers.find((name) => publisherMatches(name, booth.name));
    return publisher ? [{ booth, reason: `Publisher match: ${publisher}` }] : [];
  });
}
