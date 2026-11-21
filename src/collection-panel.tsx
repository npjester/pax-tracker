import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { collectionFileLimit, parseCollection, parseExpoGames, suggestBooths, type CollectionGame, type ExpoGame } from './collection';
import { expoGamesFeed, fetchDirectory, matchingBooth, type Exhibitor } from './expo';
import * as store from './store';

const gamesPage = 'https://unplugged.paxsite.com/philly/en-us/expo-hall/games-and-tabletop-goods.html';

export function CollectionPanel({ ownerId, booths, busy, onImport }: {
  ownerId: string; booths: store.Booth[]; busy: boolean; onImport: (entry: Exhibitor) => Promise<boolean>;
}) {
  const [games, setGames] = useState<CollectionGame[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [catalog, setCatalog] = useState<{ booths: Exhibitor[]; games: ExpoGame[] } | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [limit, setLimit] = useState(10);
  const hasCollection = !!games?.length;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void store.getCollection(ownerId).then((data) => {
      if (active) { setGames(data); setLoaded(true); }
    }).catch(() => {
      if (active) setError('Couldn’t load your saved collection. Try refreshing it.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [ownerId, refresh]);

  useEffect(() => {
    if (!hasCollection) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]);
    setCatalogError('');
    setCatalog(null);
    const listings = fetch(expoGamesFeed, { signal }).then(async (response) => {
      if (!response.ok) throw new Error('Games & Goods listings are unavailable.');
      return parseExpoGames(await response.json());
    });
    void Promise.all([fetchDirectory(controller.signal), listings]).then(([booths, games]) => {
      if (!controller.signal.aborted) setCatalog({ booths, games });
    }).catch(() => {
      if (!controller.signal.aborted) setCatalogError('Couldn’t load the PAX listings. Your collection is still saved.');
    });
    return () => controller.abort();
  }, [hasCollection, catalogAttempt]);

  const choices = useMemo(() => games && catalog ? suggestBooths(games, catalog.booths, catalog.games) : [], [games, catalog]);

  async function importCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loaded || loading || saving) return;
    const form = event.currentTarget;
    const file = new FormData(form).get('collection');
    if (!(file instanceof File) || !file.size) { setError('Choose a BoardGameGeek CSV file.'); return; }
    if (file.size > collectionFileLimit) { setError('Choose a CSV no larger than 5 MB.'); return; }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const imported = parseCollection(await file.text());
      await store.saveCollection(ownerId, imported);
      setGames(imported);
      setLimit(10);
      setMessage(`Saved ${imported.length.toLocaleString()} games to your account.`);
      form.reset();
    } catch (error) {
      setError(`Couldn’t import the collection. ${store.errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm('Remove the saved BGG collection from all devices? Your booth checklist will stay as it is.')) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await store.removeCollection(ownerId);
      setGames(null);
      setMessage('Removed the saved collection. Your booth checklist is unchanged.');
    } catch {
      setError('Couldn’t remove the saved collection. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return <section id="bgg-collection" className="panel expo-lookup" aria-labelledby="bgg-heading">
    <p className="eyebrow">PERSONALIZED EXPO STOPS</p>
    <h2 id="bgg-heading">BoardGameGeek collection</h2>
    <p>In BoardGameGeek, open <strong>Collection</strong> and use <strong>Download board games → all</strong>. Upload the CSV here. Only game IDs, titles, publisher names, owned and want flags, and your ratings sync to your private account; the original file isn’t saved.</p>
    {loading && <p role="status">Loading your saved collection…</p>}
    {loaded && <form className="add-form" onSubmit={importCollection}>
      <label>BGG collection CSV<input type="file" name="collection" accept=".csv,text/csv" required disabled={loading || saving} /></label>
      <button className="primary" disabled={loading || saving}>{saving ? 'Saving…' : hasCollection ? 'Replace saved collection' : 'Import & sync collection'}</button>
    </form>}
    <div className="actions">
      {hasCollection && <span>{games.length.toLocaleString()} games saved</span>}
      <button className="text-button" disabled={loading || saving} onClick={() => { setMessage(''); setRefresh((n) => n + 1); }}>Refresh collection</button>
      {hasCollection && <button className="text-button" disabled={loading || saving} onClick={() => void remove()}>Remove collection</button>}
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    <p role="status">{message}</p>
    {hasCollection && <>
      <h3>Suggested booths</h3>
      {games.every((game) => !game.publishers?.length) &&
        <p>Replace your saved CSV to enable publisher matches; your previous import didn’t include publisher data.</p>}
      <p>Game-title matches come from the <a href={gamesPage} target="_blank" rel="noreferrer">official PAX Games &amp; Goods listings</a>; publisher matches use the full exhibitor directory.</p>
      {catalogError ? <>
        <p className="error" role="alert">{catalogError}</p>
        <button onClick={() => setCatalogAttempt((n) => n + 1)}>Retry PAX listings</button>
      </> : !catalog ? <p role="status">Finding PAX matches…</p> :
        choices.length === 0 ? <p>No exact title matches in the published PAX listings.</p> :
          <ul className="expo-results">
            {choices.slice(0, limit).map(({ booth, reasons }) => <li key={booth.id}>
              <div>
                <strong>{booth.name}</strong><p>{booth.booth_number ? `Booth ${booth.booth_number}` : 'Booth TBD'}</p>
                {reasons.map(({ title, reason, source }) => <p key={`${source}:${title}`}>
                  {source === 'game' ? `PAX lists ${title}` : `Publisher match: ${title}`} · {reason}
                </p>)}
              </div>
              {matchingBooth(booth, booths) ? <span className="tag">In checklist</span> :
                <button disabled={busy || saving} onClick={async () => {
                  setMessage(await onImport(booth) ? `Added ${booth.name} to your checklist.` : `Couldn’t add ${booth.name}. Refresh your checklist or try again.`);
                }}>Add to checklist<span className="sr-only">: {booth.name}</span></button>}
            </li>)}
          </ul>}
      {choices.length > limit && <button onClick={() => setLimit((n) => n + 10)}>Show more matches</button>}
    </>}
  </section>;
}
