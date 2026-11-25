import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { parseExpoGames, type CollectionGame, type ExpoGame } from './collection';
import { boothNumbers, mappedBooths, partitionStops } from './booth-route';
import { expoGamesFeed, fetchDirectory, type Exhibitor } from './expo';
import { matchGameBooths } from './game-booths';
import { includeBoothInRoute, readMapState, saveMapState } from './map-state';
import * as store from './store';
import type { Booth, GamePlan, GamePlanKind } from './store';

export function GamesPage({ ownerId, booths, boothBusy, onGetBooth }: {
  ownerId: string; booths: Booth[]; boothBusy: boolean; onGetBooth: (entry: Exhibitor) => Promise<Booth | null>;
}) {
  const [games, setGames] = useState<GamePlan[] | null>(null);
  const [collection, setCollection] = useState<CollectionGame[] | null>(null);
  const [collectionLoaded, setCollectionLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [collectionError, setCollectionError] = useState('');
  const [message, setMessage] = useState('');
  const [catalog, setCatalog] = useState<{ exhibitors: Exhibitor[]; listings: ExpoGame[] } | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [expandedBooths, setExpandedBooths] = useState<Set<string>>(() => new Set());
  const active = useRef(true);
  const pending = useRef(false);

  useEffect(() => {
    active.current = true;
    void store.listGamePlans().then((items) => {
      if (active.current) setGames(items);
    }).catch((error) => {
      if (active.current) setError(`Could not load game lists. ${store.errorMessage(error)}`);
    });
    void store.getCollection(ownerId).then((items) => {
      if (active.current) { setCollection(items); setCollectionLoaded(true); }
    }).catch((error) => {
      if (active.current) setCollectionError(`Could not load the saved BGG collection. ${store.errorMessage(error)}`);
    });
    return () => { active.current = false; };
  }, [ownerId]);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogError('');
    setCatalog(null);
    const listings = fetch(expoGamesFeed, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]), cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('The PAX game listings could not be loaded.');
      return parseExpoGames(await response.json());
    });
    void Promise.all([fetchDirectory(controller.signal), listings]).then(([exhibitors, entries]) => {
      if (!controller.signal.aborted) setCatalog({ exhibitors, listings: entries });
    }).catch((error) => {
      if (!controller.signal.aborted) setCatalogError(`Could not find booths. ${store.errorMessage(error)}`);
    });
    return () => controller.abort();
  }, [catalogAttempt]);

  const boothMatches = useMemo(() => new Map((games ?? []).map((game) => [
    game.id, catalog ? matchGameBooths(game.title, collection ?? [], catalog.exhibitors, catalog.listings) : [],
  ])), [games, collection, catalog]);

  async function run(action: () => Promise<void>) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      return true;
    } catch (error) {
      if (active.current) setError(store.errorMessage(error));
      return false;
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }

  async function add(event: FormEvent<HTMLFormElement>, kind: GamePlanKind) {
    event.preventDefault();
    const form = event.currentTarget;
    const title = String(new FormData(form).get('title') ?? '').trim();
    if (!title) return;
    if (await run(async () => {
      const game = await store.addGamePlan(kind, title);
      if (active.current) setGames((items) => [...(items ?? []), game]);
    })) form.reset();
  }

  async function importCollection(kind: GamePlanKind) {
    if (!collection) return;
    const flag = kind === 'try' ? 'wantToPlay' : 'wantToBuy';
    const listName = kind === 'try' ? 'Try' : 'Buy';
    const titles = collection.filter((game) => game[flag]).map((game) => game.title);
    await run(async () => {
      const added = await store.importGamePlans(kind, titles);
      try {
        const updated = await store.listGamePlans();
        if (active.current) {
          setGames(updated);
          setMessage(`Added ${added} game${added === 1 ? '' : 's'} to Games to ${listName} from BGG. Existing entries were kept.`);
        }
      } catch (error) {
        throw new Error(`Imported ${added} games, but could not reload the list. Refresh the page. ${store.errorMessage(error)}`);
      }
    });
  }

  async function addToRoute(entry: Exhibitor) {
    await run(async () => {
      let state;
      try {
        state = readMapState(localStorage, ownerId);
      } catch {
        throw new Error('Could not read map settings. Open Map & route to resolve the storage issue before adding a stop.');
      }
      const booth = await onGetBooth(entry);
      if (!booth) throw new Error(`Could not add ${entry.name} to your checklist. Try again.`);
      const allBooths = [...booths.filter((item) => item.id !== booth.id), booth];
      const updated = includeBoothInRoute(state, allBooths, booth.id);
      try {
        saveMapState(localStorage, ownerId, updated);
      } catch {
        throw new Error(`${booth.name} is on your checklist, but could not be added to the route. Check browser storage and try again.`);
      }
      const included = allBooths.filter((item) => updated.selected.includes(item.id));
      const unresolved = partitionStops(included, updated.choices).unmapped.some((item) => item.id === booth.id);
      if (active.current) setMessage(unresolved
        ? `${booth.name} is selected for your route, but its location needs attention on Map & route before it can be included.`
        : `${booth.name} added to your route. Choose a starting location on Map & route if needed.`);
    });
  }

  function section(kind: GamePlanKind, heading: string) {
    const flag = kind === 'try' ? 'wantToPlay' : 'wantToBuy';
    const column = kind === 'try' ? 'wanttoplay' : 'wanttobuy';
    const action = kind === 'try' ? 'play' : 'buy';
    const items = (games ?? []).filter((game) => game.kind === kind).sort((a, b) => a.title.localeCompare(b.title));
    return <section className="panel game-plan" aria-labelledby={`${kind}-heading`}>
      <div className="game-plan-heading">
        <h2 id={`${kind}-heading`}>{heading}</h2>
        {games && <span>{items.length} {items.length === 1 ? 'game' : 'games'}</span>}
      </div>
      <>
        <p>Import games marked “want to {action}” in your saved BGG collection. Existing entries stay on your list.</p>
        {collectionError && <p className="error" role="alert">{collectionError}</p>}
        {collectionLoaded && !collection && <p>Import a CSV on the <a href="#collection">Collection page</a> first.</p>}
        {collection && collection.some((game) => game[flag] === undefined) &&
          <p>Re-import a BGG CSV with the {column} column on the <a href="#collection">Collection page</a> to enable this import.</p>}
        <button className="game-import" disabled={busy || !games || !collection || collection.some((game) => game[flag] === undefined)}
          onClick={() => void importCollection(kind)}>Import BGG want-to-{action} games</button>
      </>
      <form className="inline-form" onSubmit={(event) => void add(event, kind)}>
        <input aria-label={`Add a game to ${heading}`} name="title" placeholder="Game title" required maxLength={300} disabled={busy || !games} />
        <button disabled={busy || !games}>Add</button>
      </form>
      {items.length ? <ul className="game-plan-list">{items.map((game) => {
        const matches = boothMatches.get(game.id) ?? [];
        const expanded = expandedBooths.has(game.id);
        const boothLabel = catalogError ? 'Booths unavailable' : !catalog ? 'Find booths' :
          matches.length ? `${matches.length} ${matches.length === 1 ? 'booth match' : 'booth matches'}` : 'No booth matches';
        return <li key={game.id}>
          <div className="game-plan-row">
            <label><input type="checkbox" checked={game.checked} disabled={busy} onChange={(event) => void run(async () => {
              const saved = await store.checkGamePlan(game.id, event.target.checked);
              if (active.current) setGames((current) => current?.map((item) => item.id === saved.id ? saved : item) ?? null);
            })} /><span>{game.title}</span></label>
            <button type="button" className={`game-booths-toggle${matches.length ? ' has-matches' : ''}`}
              aria-expanded={expanded} aria-controls={`game-booths-${game.id}`} onClick={() => setExpandedBooths((current) => {
                const next = new Set(current);
                if (next.has(game.id)) next.delete(game.id);
                else next.add(game.id);
                return next;
              })}>
              {boothLabel}<span className="sr-only"> for {game.title}</span>
              <svg aria-hidden="true" viewBox="0 0 16 16" className="game-booths-chevron"><path d="m4 6 4 4 4-4" /></svg>
            </button>
            <button className="text-button game-remove" disabled={busy} onClick={() => void run(async () => {
              await store.removeGamePlan(game.id);
              if (active.current) setGames((current) => current?.filter((item) => item.id !== game.id) ?? null);
            })}>Remove<span className="sr-only"> {game.title} from {heading}</span></button>
          </div>
          <div id={`game-booths-${game.id}`} className="game-booths" hidden={!expanded}>
            {catalogError ? <p>Booth matches are unavailable. Try reloading below.</p> : !catalog ? <p>Loading booth matches…</p> :
              !matches.length ? <p>No matching booths found. PAX listings may be incomplete; publisher matches require a saved BGG collection.</p> :
              <ul>{matches.map(({ booth, reason }) => {
                const numbers = boothNumbers(booth.booth_number);
                const number = numbers.length === 1 && mappedBooths.some((position) => position.number === numbers[0]) ? numbers[0] : null;
                const href = number ? `#map?booth=${encodeURIComponent(number)}` : `#map?search=${encodeURIComponent(booth.name)}`;
                return <li key={booth.id}>
                  <div><strong>{booth.name}</strong><p>{booth.booth_number ? `Booth ${booth.booth_number}` : 'Booth TBD'} · {reason}</p></div>
                  <div className="actions">
                    <a className="button" href={href}>{number ? 'View on map' : 'Find on map'}<span className="sr-only">: {booth.name}</span></a>
                    <button disabled={busy || boothBusy} onClick={() => void addToRoute(booth)}>Add to route<span className="sr-only">: {booth.name}</span></button>
                  </div>
                </li>;
              })}</ul>}
          </div>
        </li>;
      })}</ul> : <p>{games ? 'No games added yet.' : error ? 'Game list unavailable.' : 'Loading games…'}</p>}
    </section>;
  }

  return <div className="games-page">
    {error && <p className="error" role="alert">{error}</p>}
    {!games && error && <button className="game-import" disabled={busy} onClick={() => void run(async () => {
      const items = await store.listGamePlans();
      if (active.current) setGames(items);
    })}>Retry loading games</button>}
    {message && <p role="status">{message}</p>}
    {catalogError && <p className="error" role="alert">{catalogError} <button type="button" className="text-button" onClick={() => setCatalogAttempt((n) => n + 1)}>Retry booth lookup</button></p>}
    <p>Find booths from the PAX game listings or publishers in your saved BGG collection. Adding a booth includes it in your device’s route and checklist.</p>
    <div className="game-plan-grid">
      {section('try', 'Games to Try')}
      {section('buy', 'Games to Buy')}
    </div>
  </div>;
}
