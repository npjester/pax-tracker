import { createClient } from '@supabase/supabase-js';
import { shortlist, type Goal, type Priority } from './shortlist';
import type { CollectionGame } from './collection';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;

export type Game = { id: string; title: string; checked: boolean };
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
  const { data, error } = await db().from('booths').select(`${boothColumns},games(${gameColumns})`).order('id');
  if (error) throw error;
  return data as Booth[];
}

export async function loadShortlist() {
  const { error } = await db().rpc('load_shortlist', { shortlist });
  if (error) throw error;
  return listBooths();
}

export async function addBooth(booth: BoothFields): Promise<Booth> {
  const { data, error } = await db().from('booths').insert(booth).select(boothColumns).single();
  if (error) throw error;
  return { ...(data as Omit<Booth, 'games'>), games: [] };
}

export async function updateBooth(id: string, changes: BoothPatch) {
  const { data, error } = await db().from('booths').update(changes).eq('id', id).select(boothColumns).single();
  if (error) throw error;
  return data as Omit<Booth, 'games'>;
}

export async function addGame(booth_id: string, title: string) {
  const { data, error } = await db().from('games').insert({ booth_id, title }).select(gameColumns).single();
  if (error) throw error;
  return data;
}

export async function checkGame(id: string, checked: boolean) {
  const { data, error } = await db().from('games').update({ checked }).eq('id', id).select(gameColumns).single();
  if (error) throw error;
  return data;
}

export async function getCollection(ownerId: string): Promise<CollectionGame[] | null> {
  const { data, error } = await db().from('bgg_collections').select('games').eq('owner_id', ownerId).maybeSingle();
  if (error) throw error;
  return data?.games ?? null;
}

export async function saveCollection(ownerId: string, games: CollectionGame[]) {
  const { error } = await db().from('bgg_collections').upsert({ owner_id: ownerId, games }, { onConflict: 'owner_id' });
  if (error) throw error;
}

export async function removeCollection(ownerId: string) {
  const { error } = await db().from('bgg_collections').delete().eq('owner_id', ownerId);
  if (error) throw error;
}

export function errorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'An unexpected error occurred.';
}
