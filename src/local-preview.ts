import { shortlist } from './shortlist.ts';
import type { Booth, Game, GamePlan, GamePlanKind } from './store.ts';
import type { CollectionGame } from './collection.ts';

const boothKey = 'pax-tracker-preview-booths';
const collectionKey = 'pax-tracker-preview-collection';
const gamePlansKey = 'pax-tracker-preview-game-plans';
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

export function listGamePlans(): GamePlan[] {
  const saved = localStorage.getItem(gamePlansKey);
  return saved === null ? [] : JSON.parse(saved);
}

function saveGamePlans(games: GamePlan[]) {
  localStorage.setItem(gamePlansKey, JSON.stringify(games));
}

export function addGamePlan(kind: GamePlanKind, title: string): GamePlan {
  const games = listGamePlans();
  const name = title.trim();
  if (!name || name.length > 300) throw new Error('Enter a game title of up to 300 characters.');
  if (games.some((game) => game.kind === kind && game.title.trim().toLowerCase() === name.toLowerCase())) {
    throw new Error('This game is already on this list.');
  }
  const game = { id: crypto.randomUUID(), kind, title: name, checked: false };
  games.push(game);
  saveGamePlans(games);
  return game;
}

export function checkGamePlan(id: string, checked: boolean): GamePlan {
  const games = listGamePlans();
  const game = games.find((item) => item.id === id);
  if (!game) throw new Error('This game no longer exists.');
  game.checked = checked;
  saveGamePlans(games);
  return game;
}

export function removeGamePlan(id: string) {
  const games = listGamePlans();
  if (!games.some((game) => game.id === id)) throw new Error('This game no longer exists.');
  saveGamePlans(games.filter((game) => game.id !== id));
}

export function importGamesToBuy(titles: string[]) {
  return importGamePlans('buy', titles);
}

export function importGamesToTry(titles: string[]) {
  return importGamePlans('try', titles);
}

function importGamePlans(kind: GamePlanKind, titles: string[]) {
  const games = listGamePlans();
  const existing = new Set(games.filter((game) => game.kind === kind).map((game) => game.title.trim().toLowerCase()));
  let added = 0;
  for (const title of titles) {
    const name = title.trim();
    if (!name || name.length > 300) throw new Error('Enter a game title of up to 300 characters.');
    if (existing.has(name.toLowerCase())) continue;
    games.push({ id: crypto.randomUUID(), kind, title: name, checked: false });
    existing.add(name.toLowerCase());
    added++;
  }
  saveGamePlans(games);
  return added;
}
