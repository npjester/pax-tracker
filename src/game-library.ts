import { parseCollection, type CollectionGame } from './collection.ts';
import type { SavedCollection } from './store.ts';

export function libraryCollection(saved: SavedCollection): CollectionGame[] {
  return saved.sourceCsv === null ? saved.games : parseCollection(saved.sourceCsv);
}

export function metricLevel(value: number, max: number) {
  return [1, 2, 3, 4].filter((step) => value >= 1 + (max - 1) * step / 5).length;
}

export function libraryGames(collection: CollectionGame[], query = '') {
  const search = query.trim().toLocaleLowerCase();
  return collection.filter((game) => game.wantToPlay && game.title.toLocaleLowerCase().includes(search))
    .sort((a, b) => (b.averageRating ?? -1) - (a.averageRating ?? -1) ||
      a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}
