import type { CollectionGame } from './collection.ts';

export function libraryGames(collection: CollectionGame[], query = '') {
  const search = query.trim().toLocaleLowerCase();
  return collection.filter((game) => game.wantToPlay && game.title.toLocaleLowerCase().includes(search))
    .sort((a, b) => (b.averageRating ?? -1) - (a.averageRating ?? -1) ||
      a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}
