import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
  const [replacement, setReplacement] = useState<store.SavedCollection | null>(null);
  const [hasSourceCsv, setHasSourceCsv] = useState(false);
  const [importing, setImporting] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [catalog, setCatalog] = useState<{ booths: Exhibitor[]; games: ExpoGame[] } | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [limit, setLimit] = useState(10);
  const formRef = useRef<HTMLFormElement>(null);
  const replacementHeadingRef = useRef<HTMLHeadingElement>(null);
  const hasCollection = !!games?.length;

  useEffect(() => {
    if (replacement) replacementHeadingRef.current?.focus();
  }, [replacement]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoaded(false);
    setError('');
    void store.getSavedCollection(ownerId).then((data) => {
      if (active) { setGames(data?.games ?? null); setHasSourceCsv(data?.sourceCsv != null); setLoaded(true); }
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
    const listings = fetch(expoGamesFeed, { signal, cache: 'no-store' }).then(async (response) => {
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
  const ownedChoices = useMemo(() => games && catalog ? suggestBooths(games.filter((game) => game.owned), catalog.booths, catalog.games) : [], [games, catalog]);
  const ownedToImport = ownedChoices.filter(({ booth }) => !matchingBooth(booth, booths));

  async function importOwned() {
    setImporting(true);
    setError('');
    setMessage('');
    const knownBooths: Exhibitor[] = [...booths];
    let added = 0;
    try {
      for (const { booth } of ownedToImport) {
        if (matchingBooth(booth, knownBooths)) continue;
        if (!await onImport(booth)) {
          setError(`Couldn’t add ${booth.name}. ${added} booth${added === 1 ? '' : 's'} added before the error. Refresh and try again.`);
          return;
        }
        knownBooths.push(booth);
        added++;
      }
      setMessage(`Added ${added} booth${added === 1 ? '' : 's'} for owned games to your checklist.`);
    } finally {
      setImporting(false);
    }
  }

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
      const sourceCsv = await file.text();
      const imported = { games: parseCollection(sourceCsv), sourceCsv };
      if (hasCollection) {
        setReplacement(imported);
      } else {
        await saveImportedCollection(imported);
      }
    } catch (error) {
      setError(`Couldn’t import the collection. ${store.errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveImportedCollection(imported: store.SavedCollection) {
    await store.saveCollection(ownerId, imported);
    setGames(imported.games);
    setHasSourceCsv(imported.sourceCsv != null);
    setReplacement(null);
    setLimit(10);
    setMessage(`Saved ${imported.games.length.toLocaleString()} games ${store.localPreview ? 'in this browser' : 'to your account'}.`);
    formRef.current?.reset();
  }

  async function confirmReplacement() {
    if (!replacement || saving) return;
    setSaving(true);
    setError('');
    try {
      await saveImportedCollection(replacement);
    } catch (error) {
      setError(`Couldn’t replace the collection. ${store.errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(store.localPreview
      ? 'Remove the saved BGG collection from this browser? Your booth checklist will stay as it is.'
      : 'Remove the saved BGG collection from all devices? Your booth checklist will stay as it is.')) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await store.removeCollection(ownerId);
      setGames(null);
      setHasSourceCsv(false);
      setMessage('Removed the saved collection. Your booth checklist is unchanged.');
    } catch {
      setError('Couldn’t remove the saved collection. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return <section id="bgg-collection" className="panel expo-lookup" aria-labelledby="bgg-heading">
    <h2 id="bgg-heading">BoardGameGeek collection</h2>
    <p>In BoardGameGeek, open <strong>Collection</strong> and use <strong>Download board games → all</strong>. Upload the CSV here. The full CSV, including all columns and personal comments, {store.localPreview ? 'is saved in this browser' : 'syncs to your private account'} for future features.</p>
    {hasCollection && !hasSourceCsv && <p>Your saved collection predates full CSV storage. Re-import it once to preserve all its columns for future features.</p>}
    {loading && <p role="status">Loading your saved collection…</p>}
    {loaded && <form ref={formRef} className="add-form" onSubmit={importCollection}>
      <label>BGG collection CSV<input type="file" name="collection" accept=".csv,text/csv" required disabled={loading || saving || importing || !!replacement} /></label>
      <button className="primary" disabled={loading || saving || importing || !!replacement}>{saving ? 'Saving…' : hasCollection ? 'Review replacement' : 'Import & sync collection'}</button>
    </form>}
    {replacement && <section className="collection-preview" aria-labelledby="replacement-heading">
      <h3 id="replacement-heading" ref={replacementHeadingRef} tabIndex={-1}>Review replacement</h3>
      <p>This file contains {replacement.games.length.toLocaleString()} {replacement.games.length === 1 ? 'game' : 'games'} used by the app. Replacing your saved collection of {games?.length.toLocaleString()} {games?.length === 1 ? 'game' : 'games'} and its CSV cannot be undone. Your booth checklist and game lists won’t change.</p>
      <p>Example titles:</p>
      <ul>{replacement.games.slice(0, 5).map((game) => <li key={game.id}>{game.title}</li>)}</ul>
      <div className="actions">
        <button className="primary" disabled={saving} onClick={() => void confirmReplacement()}>{saving ? 'Saving…' : 'Replace collection'}</button>
        <button disabled={saving} onClick={() => { setReplacement(null); formRef.current?.reset(); }}>Cancel</button>
      </div>
    </section>}
    <div className="actions">
      {hasCollection && <span>{games.length.toLocaleString()} games saved</span>}
      {!hasCollection && !loading && <button className="text-button" disabled={saving || importing} onClick={() => setRefresh((n) => n + 1)}>Reload saved collection</button>}
      {!loaded && hasCollection && !loading && <button className="text-button" disabled={saving || importing} onClick={() => { setRefresh((n) => n + 1); setCatalogAttempt((n) => n + 1); }}>Retry refresh</button>}
      {hasCollection && <button className="text-button" disabled={loading || saving || importing || !!replacement} onClick={() => void remove()}>Remove collection</button>}
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    <p role="status">{message}</p>
    {hasCollection && loaded && !loading && <>
      <h3>Suggested booths</h3>
      <p>Refresh to use the latest saved collection and PAX listings. To update your BGG collection, export and upload a new CSV first.</p>
      <div className="actions">
        <button disabled={saving || importing || busy || !!replacement} onClick={() => { setMessage(''); setLimit(10); setRefresh((n) => n + 1); setCatalogAttempt((n) => n + 1); }}>Refresh suggestions</button>
        {catalog && <button className="primary" disabled={busy || saving || importing || !ownedToImport.length} onClick={() => void importOwned()}>
          {importing ? 'Importing booths…' : `Import owned-game booths (${ownedToImport.length})`}
        </button>}
      </div>
      {games.every((game) => !game.publishers?.length) &&
        <p>Replace your saved CSV to enable publisher matches; your previous import didn’t include publisher data.</p>}
      <p>Game-title matches come from the <a href={gamesPage} target="_blank" rel="noreferrer">official PAX Games &amp; Goods listings</a>; publisher matches use the full exhibitor directory.</p>
      {catalogError ? <>
        <p className="error" role="alert">{catalogError}</p>
        <button onClick={() => setCatalogAttempt((n) => n + 1)}>Retry PAX listings</button>
      </> : !catalog ? <p role="status">Finding PAX matches…</p> :
        choices.length === 0 ? <p>No matching titles or publishers were found in the published PAX listings.</p> :
          <ul className="expo-results">
            {choices.slice(0, limit).map(({ booth, reasons }) => <li key={booth.id}>
              <div>
                <strong>{booth.name}</strong><p>{booth.booth_number ? `Booth ${booth.booth_number}` : 'Booth TBD'}</p>
                {reasons.map(({ title, reason, source }) => <p key={`${source}:${title}`}>
                  {source === 'game' ? `PAX lists ${title}` : `Publisher match: ${title}`} · {reason}
                </p>)}
              </div>
              {matchingBooth(booth, booths) ? <span className="tag">In checklist</span> :
                <button disabled={busy || saving || importing} onClick={async () => {
                  setMessage(await onImport(booth) ? `Added ${booth.name} to your checklist.` : `Couldn’t add ${booth.name}. Refresh your checklist or try again.`);
                }}>Add to checklist<span className="sr-only">: {booth.name}</span></button>}
            </li>)}
          </ul>}
      {choices.length > limit && <button onClick={() => setLimit((n) => n + 10)}>Show more matches</button>}
    </>}
  </section>;
}
