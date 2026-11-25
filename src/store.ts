import { createClient } from '@supabase/supabase-js';
import { shortlist, type Goal, type Priority } from './shortlist';
import type { CollectionGame } from './collection';
import * as preview from './local-preview';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const localPreview = import.meta.env.DEV && import.meta.env.VITE_LOCAL_PREVIEW === 'true' &&
  ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
export const supabase = !localPreview && url && key ? createClient(url, key) : null;

export type Game = { id: string; title: string; checked: boolean };
export type GamePlanKind = 'try' | 'buy';
export type GamePlan = { id: string; title: string; kind: GamePlanKind; checked: boolean };
export type SavedCollection = { games: CollectionGame[]; sourceCsv: string | null };
export type Booth = {
  id: string; name: string; booth_number: string; priority: Priority; visited: boolean; notes: string;
  games: Game[];
} & Record<Goal, boolean>;

type BoothFields = Pick<Booth, 'name' | 'booth_number' | 'priority'> & Partial<Pick<Booth, 'id'>>;
type BoothPatch = Partial<Omit<Booth, 'id' | 'games'>>;
const boothColumns = 'id,name,booth_number,priority,visited,notes,demo,buy,promo';
const gameColumns = 'id,title,checked';

function db() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function listBooths() {
  if (localPreview) return preview.listBooths();
  const { data, error } = await db().from('booths').select(`${boothColumns},games(${gameColumns})`).order('id');
  if (error) throw error;
  return data as Booth[];
}

export async function loadShortlist() {
  if (localPreview) return preview.loadShortlist();
  const { error } = await db().rpc('load_shortlist', { shortlist });
  if (error) throw error;
  return listBooths();
}

export async function addBooth(booth: BoothFields): Promise<Booth> {
  if (localPreview) return preview.addBooth(booth);
  const { data, error } = await db().from('booths').insert(booth).select(boothColumns).single();
  if (error) throw error;
  return { ...(data as Omit<Booth, 'games'>), games: [] };
}

export async function updateBooth(id: string, changes: BoothPatch) {
  if (localPreview) return preview.updateBooth(id, changes);
  const { data, error } = await db().from('booths').update(changes).eq('id', id).select(boothColumns).single();
  if (error) throw error;
  return data as Omit<Booth, 'games'>;
}

export async function addGame(booth_id: string, title: string) {
  if (localPreview) return preview.addGame(booth_id, title);
  const { data, error } = await db().from('games').insert({ booth_id, title }).select(gameColumns).single();
  if (error) throw error;
  return data;
}

export async function checkGame(id: string, checked: boolean) {
  if (localPreview) return preview.checkGame(id, checked);
  const { data, error } = await db().from('games').update({ checked }).eq('id', id).select(gameColumns).single();
  if (error) throw error;
  return data;
}

export async function getCollection(ownerId: string): Promise<CollectionGame[] | null> {
  if (localPreview) return preview.getCollection();
  const { data, error } = await db().from('bgg_collections').select('games').eq('owner_id', ownerId).maybeSingle();
  if (error) throw error;
  return data?.games ?? null;
}

export async function getSavedCollection(ownerId: string): Promise<SavedCollection | null> {
  if (localPreview) return preview.getSavedCollection();
  const { data, error } = await db().from('bgg_collections').select('games,source_csv').eq('owner_id', ownerId).maybeSingle();
  if (error) throw error;
  return data ? { games: data.games, sourceCsv: data.source_csv } : null;
}

export async function saveCollection(ownerId: string, collection: SavedCollection) {
  if (localPreview) return preview.saveCollection(collection);
  const { error } = await db().from('bgg_collections').upsert({
    owner_id: ownerId, games: collection.games, source_csv: collection.sourceCsv,
  }, { onConflict: 'owner_id' });
  if (error) throw error;
}

export async function removeCollection(ownerId: string) {
  if (localPreview) return preview.removeCollection();
  const { error } = await db().from('bgg_collections').delete().eq('owner_id', ownerId);
  if (error) throw error;
}

export async function listGamePlans(): Promise<GamePlan[]> {
  if (localPreview) return preview.listGamePlans();
  const { data, error } = await db().from('game_plans').select('id,title,kind,checked').order('title');
  if (error) throw error;
  return data as GamePlan[];
}

export async function addGamePlan(kind: GamePlanKind, title: string): Promise<GamePlan> {
  if (localPreview) return preview.addGamePlan(kind, title);
  const { data, error } = await db().from('game_plans').insert({ kind, title: title.trim() }).select('id,title,kind,checked').single();
  if (error) {
    if (error.code === '23505') throw new Error('This game is already on this list.');
    throw error;
  }
  return data as GamePlan;
}

export async function checkGamePlan(id: string, checked: boolean): Promise<GamePlan> {
  if (localPreview) return preview.checkGamePlan(id, checked);
  const { data, error } = await db().from('game_plans').update({ checked }).eq('id', id).select('id,title,kind,checked').single();
  if (error) throw error;
  return data as GamePlan;
}

export async function removeGamePlan(id: string) {
  if (localPreview) return preview.removeGamePlan(id);
  const { error } = await db().from('game_plans').delete().eq('id', id);
  if (error) throw error;
}

export async function importGamePlans(kind: GamePlanKind, titles: string[]): Promise<number> {
  if (localPreview) return preview.importGamePlans(kind, titles);
  const { data, error } = await db().rpc('import_game_plans', { plan_kind: kind, titles });
  if (error) throw error;
  return data;
}

export function errorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'An unexpected error occurred.';
}
