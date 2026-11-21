import { shortlist } from './shortlist.ts';
import type { Booth, Game } from './store.ts';
import type { CollectionGame } from './collection.ts';

const boothKey = 'pax-tracker-preview-booths';
const collectionKey = 'pax-tracker-preview-collection';
type BoothFields = Pick<Booth, 'name' | 'booth_number' | 'priority'> & Partial<Pick<Booth, 'id'>>;
type BoothPatch = Partial<Omit<Booth, 'id' | 'games'>>;

export function listBooths(): Booth[] {
  const saved = localStorage.getItem(boothKey);
  return saved === null ? [] : JSON.parse(saved);
}

function saveBooths(booths: Booth[]) {
  localStorage.setItem(boothKey, JSON.stringify(booths));
}

export function loadShortlist() {
  const booths = listBooths();
  for (const entry of shortlist) {
    if (!booths.some((booth) => booth.id === entry.id)) {
      booths.push({ ...entry, visited: false, notes: '', games: entry.games.map((game) => ({ ...game, checked: false })) });
    }
  }
  saveBooths(booths);
  return booths;
}

export function addBooth(fields: BoothFields): Booth {
  const booths = listBooths();
  const booth: Booth = { ...fields, id: fields.id ?? crypto.randomUUID(), visited: false, notes: '', demo: false, buy: false, promo: false, games: [] };
  if (booths.some((item) => item.id === booth.id)) throw new Error('This booth is already in your checklist.');
  booths.push(booth);
  saveBooths(booths);
  return booth;
}

export function updateBooth(id: string, changes: BoothPatch) {
  const booths = listBooths();
  const booth = booths.find((item) => item.id === id);
  if (!booth) throw new Error('This booth no longer exists.');
  Object.assign(booth, changes);
  saveBooths(booths);
  const { games: _games, ...saved } = booth;
  return saved;
}

export function addGame(boothId: string, title: string): Game {
  const booths = listBooths();
  const booth = booths.find((item) => item.id === boothId);
  if (!booth) throw new Error('This booth no longer exists.');
  const game = { id: crypto.randomUUID(), title, checked: false };
  booth.games.push(game);
  saveBooths(booths);
  return game;
}

export function checkGame(id: string, checked: boolean): Game {
  const booths = listBooths();
  const game = booths.flatMap((booth) => booth.games).find((item) => item.id === id);
  if (!game) throw new Error('This game no longer exists.');
  game.checked = checked;
  saveBooths(booths);
  return game;
}

export function getCollection(): CollectionGame[] | null {
  const saved = localStorage.getItem(collectionKey);
  return saved === null ? null : JSON.parse(saved);
}

export function saveCollection(games: CollectionGame[]) {
  localStorage.setItem(collectionKey, JSON.stringify(games));
}

export function removeCollection() {
  localStorage.removeItem(collectionKey);
}
