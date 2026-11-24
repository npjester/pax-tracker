import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { CollectionGame } from './collection';
import * as store from './store';
import type { GamePlan, GamePlanKind } from './store';

export function GamesPage({ ownerId }: { ownerId: string }) {
  const [games, setGames] = useState<GamePlan[] | null>(null);
  const [collection, setCollection] = useState<CollectionGame[] | null>(null);
  const [collectionLoaded, setCollectionLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [collectionError, setCollectionError] = useState('');
  const [message, setMessage] = useState('');
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

  function section(kind: GamePlanKind, heading: string) {
    const flag = kind === 'try' ? 'wantToPlay' : 'wantToBuy';
    const column = kind === 'try' ? 'wanttoplay' : 'wanttobuy';
    const action = kind === 'try' ? 'play' : 'buy';
    const items = (games ?? []).filter((game) => game.kind === kind).sort((a, b) => a.title.localeCompare(b.title));
    return <section className="panel game-plan" aria-labelledby={`${kind}-heading`}>
      <h2 id={`${kind}-heading`}>{heading}</h2>
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
      {items.length ? <ul className="game-plan-list">{items.map((game) => <li key={game.id}>
        <label><input type="checkbox" checked={game.checked} disabled={busy} onChange={(event) => void run(async () => {
          const saved = await store.checkGamePlan(game.id, event.target.checked);
          if (active.current) setGames((current) => current?.map((item) => item.id === saved.id ? saved : item) ?? null);
        })} /><span>{game.title}</span></label>
        <button className="text-button" disabled={busy} onClick={() => void run(async () => {
          await store.removeGamePlan(game.id);
          if (active.current) setGames((current) => current?.filter((item) => item.id !== game.id) ?? null);
        })}>Remove<span className="sr-only"> {game.title} from {heading}</span></button>
      </li>)}</ul> : <p>{games ? 'No games added yet.' : error ? 'Game list unavailable.' : 'Loading games…'}</p>}
    </section>;
  }

  return <div className="games-page">
    {error && <p className="error" role="alert">{error}</p>}
    {!games && error && <button className="game-import" disabled={busy} onClick={() => void run(async () => {
      const items = await store.listGamePlans();
      if (active.current) setGames(items);
    })}>Retry loading games</button>}
    {message && <p role="status">{message}</p>}
    <div className="game-plan-grid">
      {section('try', 'Games to Try')}
      {section('buy', 'Games to Buy')}
    </div>
  </div>;
}
