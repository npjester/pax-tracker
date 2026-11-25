export type Scope = 'remaining' | 'all' | 'selected';

export type MapState = {
  scope: Scope;
  selected: string[];
  startValue: string;
  choices: Record<string, string>;
  activeStopId: string | null;
};

export const initialMapState: MapState = {
  scope: 'remaining', selected: [], startValue: '', choices: {}, activeStopId: null,
};

export function readMapState(storage: Storage, ownerId: string): MapState {
  const saved = storage.getItem(`pax-tracker-map:${ownerId}`);
  if (saved === null) return initialMapState;
  const value: unknown = JSON.parse(saved);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid map settings');
  const state = value as Record<string, unknown>;
  if (!['remaining', 'all', 'selected'].includes(String(state.scope)) ||
      !Array.isArray(state.selected) || !state.selected.every((id) => typeof id === 'string') ||
      typeof state.startValue !== 'string' ||
      !state.choices || typeof state.choices !== 'object' || Array.isArray(state.choices) ||
      !Object.values(state.choices).every((choice) => typeof choice === 'string') ||
      !(state.activeStopId === null || typeof state.activeStopId === 'string')) {
    throw new Error('Invalid map settings');
  }
  return state as MapState;
}

export function saveMapState(storage: Storage, ownerId: string, state: MapState) {
  storage.setItem(`pax-tracker-map:${ownerId}`, JSON.stringify(state));
}

export function includeBoothInRoute(state: MapState, booths: { id: string; visited: boolean }[], boothId: string): MapState {
  const included = state.scope === 'selected' ? state.selected :
    booths.filter((booth) => state.scope === 'all' || !booth.visited).map((booth) => booth.id);
  return { ...state, scope: 'selected', selected: [...new Set([...included, boothId])] };
}
