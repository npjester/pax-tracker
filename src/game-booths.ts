import { publisherMatches, titleKey, type CollectionGame, type ExpoGame } from './collection.ts';
import { matchingBooth, type Exhibitor } from './expo.ts';
import type { Booth, GamePlan } from './store.ts';

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

export type PlannedBoothGame = { title: string; plans: GamePlan[]; reason: string };

export function plannedGamesByBooth(
  plans: GamePlan[], collection: CollectionGame[], exhibitors: Exhibitor[], listings: ExpoGame[], booths: Booth[],
): Map<string, PlannedBoothGame[]> {
  const resolved = exhibitors.flatMap((exhibitor) => {
    const booth = matchingBooth(exhibitor, booths);
    return booth ? [{ exhibitor, booth }] : [];
  });
  const groups = new Map<string, GamePlan[]>();
  for (const plan of plans) {
    const key = titleKey(plan.title);
    if (key) groups.set(key, [...(groups.get(key) ?? []), plan]);
  }
  const resolvedById = new Map(resolved.map(({ exhibitor, booth }) => [exhibitor.id, booth]));
  const result = new Map<string, Map<string, PlannedBoothGame>>();
  for (const group of groups.values()) {
    const matches = matchGameBooths(group[0].title, collection, resolved.map(({ exhibitor }) => exhibitor), listings);
    for (const match of matches) {
      const booth = resolvedById.get(match.booth.id);
      if (!booth) continue;
      const games = result.get(booth.id) ?? new Map<string, PlannedBoothGame>();
      const key = titleKey(group[0].title);
      if (!games.has(key) || match.reason === 'PAX lists this title') {
        games.set(key, { title: group[0].title, plans: group, reason: match.reason });
      }
      result.set(booth.id, games);
    }
  }
  return new Map([...result].map(([id, games]) =>
    [id, [...games.values()].sort((a, b) => a.title.localeCompare(b.title))]));
}
