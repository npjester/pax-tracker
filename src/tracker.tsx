import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { goals, type Priority } from './shortlist';
import { boothNumberLimit, expoGamesFeed, expoPage, fetchDirectory, matchingBooth, type Exhibitor } from './expo';
import { parseExpoGames, titleKey, type CollectionGame, type ExpoGame } from './collection';
import { plannedGamesByBooth, type PlannedBoothGame } from './game-booths';
import { ExpoLookup } from './expo-lookup';
import { CollectionPanel } from './collection-panel';
import { MapPage } from './map-page';
import { GamesPage } from './games-page';
import { GameLibraryPage } from './game-library-page';
import * as store from './store';
import type { Booth, Game, GamePlan } from './store';

type Filter = 'all' | 'must' | 'remaining' | 'visited';
type Page = 'tracker' | 'collection' | 'update' | 'map' | 'games' | 'library';
type Update = Parameters<typeof store.updateBooth>[1];
const filters: [Filter, string][] = [['all', 'All booths'], ['must', 'Must visit'], ['remaining', 'Remaining'], ['visited', 'Visited']];
const priorities: Record<Priority, string> = { must: 'Must visit', recommended: 'Recommended', regular: 'Custom stop' };
const pages: [Page, string][] = [
  ['tracker', 'Tracker'], ['collection', 'Collection'], ['games', 'Games'],
  ['library', 'Game Library'], ['map', 'Map & route'], ['update', 'Update booths'],
];

function currentPage(): Page {
  const hash = window.location.hash;
  if (hash === '#games') return 'games';
  if (hash === '#library') return 'library';
  if (hash === '#map' || hash.startsWith('#map?')) return 'map';
  if (hash === '#collection' || hash === '#bgg-collection') return 'collection';
  if (hash === '#update' || hash === '#expo-lookup' || hash === '#add-booth') return 'update';
  return 'tracker';
}

function numberOf(booth: Booth) {
  return Number(booth.booth_number.match(/\d+/)?.[0] ?? Infinity);
}

function boothOrder(a: Booth, b: Booth) {
  return numberOf(a) - numberOf(b) || a.name.localeCompare(b.name);
}

function exportChecklist(booths: Booth[]) {
  const contents = ['PAX Unplugged | My checklist', 'Verify booth numbers and game availability against the official expo guide.', '',
    ...[...booths].sort(boothOrder).map((b) => [
      `- [${b.visited ? 'x' : ' '}] ${b.name} | ${b.booth_number || 'Booth TBD'} | ${priorities[b.priority]}`,
      goals.filter((goal) => b[goal]).join(' / '),
      ...b.games.map((g) => `  - [${g.checked ? 'x' : ' '}] ${g.title}`),
      b.notes && `  Notes: ${b.notes}`,
    ].filter(Boolean).join('\n')),
  ].join('\n\n');
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'pax-checklist.txt';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function planDescription(match: PlannedBoothGame) {
  return `${match.plans.map((plan) => `${plan.kind === 'try' ? 'Try' : 'Buy'}${plan.checked ? ' (checked)' : ''}`).join(' / ')} · ${match.reason}`;
}

function BoothCard({ booth, busy, planned, update, game, addGame }: {
  booth: Booth; busy: boolean;
  planned: PlannedBoothGame[];
  update: (changes: Update) => Promise<boolean>;
  game: (item: Game, checked: boolean) => void;
  addGame: (title: string) => Promise<boolean>;
}) {
  const [gameTitle, setGameTitle] = useState('');
  type Details = Pick<Booth, 'notes' | 'booth_number' | 'priority'>;
  const [editor, setEditor] = useState<{ draft: Details; original: Details } | null>(null);
  const checked = booth.games.filter((game) => game.checked).length;
  const manualTitles = new Set(booth.games.map((item) => titleKey(item.title)));
  const byTitle = new Map(planned.map((item) => [titleKey(item.title), item]));

  return <article className={`panel booth ${booth.visited ? 'seen' : ''}`}>
    <div className="booth-top">
      <span className="booth-number"><small>BOOTH</small>{booth.booth_number || 'TBD'}</span>
      <div className="booth-title"><span className={`tag ${booth.priority}`}>{priorities[booth.priority]}</span><h3>{booth.name}</h3></div>
    </div>
    <div className="actions booth-actions">
      <label className="visit"><input type="checkbox" checked={booth.visited} disabled={busy} onChange={(e) => void update({ visited: e.target.checked })} /> <span>{booth.visited ? 'Visited' : 'Mark visited'}<span className="sr-only">: {booth.name}</span></span></label>
      <div className="actions" aria-label="Booth goals" role="group">
        {goals.map((goal) => <button key={goal} className="chip" aria-pressed={booth[goal]} disabled={busy} onClick={() => void update({ [goal]: !booth[goal] })}>{goal}</button>)}
      </div>
    </div>
    <details>
      <summary>Game checklist <span>{checked}/{booth.games.length}{planned.length ? ` · ${planned.length} matched` : ''}</span></summary>
      <ul className="game-list">
        {booth.games.map((item) => {
          const match = byTitle.get(titleKey(item.title));
          return <li key={item.id}>
            <label><input type="checkbox" checked={item.checked} disabled={busy} onChange={(e) => game(item, e.target.checked)} /><span>{item.title}</span></label>
            {match && <p className="booth-game-match">From Games to Try &amp; Buy · {planDescription(match)}</p>}
          </li>;
        })}
      </ul>
      {planned.some((item) => !manualTitles.has(titleKey(item.title))) && <>
        <p className="booth-game-hint">From <a href="#games">Games to Try &amp; Buy</a> · verify availability</p>
        <ul className="booth-planned-games">
          {planned.filter((item) => !manualTitles.has(titleKey(item.title))).map((item) => <li key={titleKey(item.title)}>
            <strong>{item.title}</strong><span>{planDescription(item)}</span>
          </li>)}
        </ul>
      </>}
      <form className="inline-form" onSubmit={async (event) => {
        event.preventDefault();
        if (gameTitle.trim() && await addGame(gameTitle.trim())) setGameTitle('');
      }}>
        <input aria-label={`New game for ${booth.name}`} placeholder="Add a game" required maxLength={160} value={gameTitle} onChange={(e) => setGameTitle(e.target.value)} />
        <button disabled={busy || !gameTitle.trim()}>Add</button>
      </form>
    </details>
    {editor ? <form className="booth-edit" onSubmit={async (event) => {
      event.preventDefault();
      const current = { ...editor.draft, booth_number: editor.draft.booth_number.trim() };
      const patch: Update = {};
      if (current.notes !== editor.original.notes) patch.notes = current.notes;
      if (current.booth_number !== editor.original.booth_number) patch.booth_number = current.booth_number;
      if (current.priority !== editor.original.priority) patch.priority = current.priority;
      if (Object.keys(patch).length === 0 || await update(patch)) setEditor(null);
    }}>
      <div className="fields">
        <label>Booth number<input maxLength={boothNumberLimit} value={editor.draft.booth_number} onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, booth_number: e.target.value } })} /></label>
        <label>Priority<select value={editor.draft.priority} onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, priority: e.target.value as Priority } })}>
          {Object.entries(priorities).map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select></label>
      </div>
      <label>Notes<textarea maxLength={4000} rows={3} value={editor.draft.notes} onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, notes: e.target.value } })} placeholder="Demo times, prices, or reminders…" /></label>
      <div className="actions"><button className="primary" disabled={busy}>Save details</button><button type="button" disabled={busy} onClick={() => setEditor(null)}>Cancel</button></div>
    </form> : <div className="booth-notes">
      {booth.notes && <p>{booth.notes}</p>}
      <button className="text-button" onClick={() => {
        const values = { notes: booth.notes, booth_number: booth.booth_number, priority: booth.priority };
        setEditor({ draft: values, original: values });
      }}>Edit booth &amp; notes<span className="sr-only">: {booth.name}</span></button>
    </div>}
  </article>;
}

export function Tracker({ ownerId, email }: { ownerId: string; email?: string }) {
  const [page, setPage] = useState<Page>(currentPage);
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [booths, setBooths] = useState<Booth[] | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState('priority');
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('Loading checklist…');
  const [error, setError] = useState('');
  const [matchData, setMatchData] = useState<{ plans: GamePlan[]; collection: CollectionGame[]; exhibitors: Exhibitor[]; listings: ExpoGame[] } | null>(null);
  const [matchError, setMatchError] = useState('');
  const [matchAttempt, setMatchAttempt] = useState(0);
  const active = useRef(true);
  const pending = useRef(true);

  useEffect(() => {
    const navigate = () => { setPage(currentPage()); setMenuOpen(false); };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !navRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuOpen(false); menuButtonRef.current?.focus(); }
    };
    const closeOnResize = () => {
      if (window.matchMedia('(min-width: 768px)').matches) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnResize);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnResize);
    };
  }, [menuOpen]);

  useEffect(() => {
    active.current = true;
    void store.listBooths().then((data) => {
      if (active.current) { setBooths(data); setMessage('Synced'); }
    }).catch((error) => {
      if (active.current) { setError(`Could not load checklist. ${store.errorMessage(error)}`); setMessage(''); }
    }).finally(() => {
      pending.current = false;
      if (active.current) setBusy(false);
    });
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    if (page !== 'tracker' || !booths?.length) return;
    const controller = new AbortController();
    let active = true;
    setMatchData(null);
    setMatchError('');
    void Promise.all([
      store.listGamePlans(),
      store.getCollection(ownerId),
      fetchDirectory(controller.signal),
      fetch(expoGamesFeed, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]), cache: 'no-store' }).then(async (response) => {
        if (!response.ok) throw new Error('The PAX game listings could not be loaded.');
        return parseExpoGames(await response.json());
      }),
    ]).then(([plans, collection, exhibitors, listings]) => {
      if (active) setMatchData({ plans, collection: collection ?? [], exhibitors, listings });
    }).catch((error) => {
      if (active) setMatchError(`Could not load game matches. ${store.errorMessage(error)}`);
    });
    return () => { active = false; controller.abort(); };
  }, [page, ownerId, !!booths?.length, matchAttempt]);

  const plannedMatches = useMemo(() => matchData && booths
    ? plannedGamesByBooth(matchData.plans, matchData.collection, matchData.exhibitors, matchData.listings, booths)
    : new Map<string, PlannedBoothGame[]>(), [matchData, booths]);

  async function run<T>(request: () => Promise<T>, apply: (data: T) => void, label: string) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError('');
    setMessage(label === 'refresh' ? 'Refreshing…' : label === 'sign out' ? 'Signing out…' : 'Saving…');
    try {
      const data = await request();
      if (!active.current) return false;
      apply(data);
      setMessage(label === 'refresh' ? 'Synced' : 'Saved');
      return true;
    } catch (error) {
      if (active.current) { setError(`Could not ${label}. ${store.errorMessage(error)}`); setMessage(''); }
      return false;
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  }

  async function addBooth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name')).trim();
    if (!name) { setError('Enter an exhibitor name.'); return; }
    if (await run(() => store.addBooth({ name, booth_number: String(data.get('booth')).trim(), priority: 'regular' }),
      (booth) => setBooths((items) => [...(items ?? []), booth]), 'add booth')) {
      form.reset();
      setFilter('all');
      setQuery('');
    }
  }

  function editBooth(id: string, change: (booth: Booth) => Booth) {
    setBooths((items) => items?.map((item) => item.id === id ? change(item) : item) ?? null);
  }

  async function importExhibitor(entry: Exhibitor) {
    const saved = await run(() => store.addBooth({ ...entry, priority: 'regular' }),
      (booth) => setBooths((items) => [...(items ?? []), booth]), 'import exhibitor');
    if (saved) { setFilter('all'); setQuery(''); }
    return saved;
  }

  async function getOrImportExhibitor(entry: Exhibitor) {
    const existing = matchingBooth(entry, booths ?? []);
    if (existing) return existing;
    let imported: Booth | null = null;
    await run(() => store.addBooth({ ...entry, priority: 'regular' }), (booth) => {
      imported = booth;
      setBooths((items) => [...(items ?? []), booth]);
    }, 'import exhibitor');
    return imported;
  }

  const list = booths ?? [];
  const visited = list.filter((b) => b.visited).length;
  const must = list.filter((b) => b.priority === 'must' && !b.visited).length;
  const games = list.reduce((count, booth) => count + booth.games.filter((g) => g.checked).length, 0);
  const search = query.trim().toLowerCase();
  const rank = { must: 0, recommended: 1, regular: 2 };
  const shown = list.filter((b) =>
    (filter === 'all' || (filter === 'must' && b.priority === 'must') || (filter === 'remaining' && !b.visited) || (filter === 'visited' && b.visited)) &&
    (!search || [b.name, b.booth_number, ...b.games.map((g) => g.title), ...(plannedMatches.get(b.id) ?? []).map((g) => g.title)].some((value) => value.toLowerCase().includes(search))),
  ).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'booth' ? boothOrder(a, b) : rank[a.priority] - rank[b.priority] || boothOrder(a, b));

  return <main className="shell tracker">
    <div className="account actions"><span>{email ?? 'Signed in'}</span>{!store.localPreview && <button className="text-button" disabled={busy} onClick={() => void run(async () => {
      const { error } = await store.supabase!.auth.signOut({ scope: 'local' });
      if (error) throw error;
    }, () => {}, 'sign out')}>Sign out</button>}</div>
    <nav ref={navRef} className="page-nav" aria-label="Main navigation" data-open={menuOpen}>
      <span className="page-nav-current">{pages.find(([id]) => id === page)?.[1]}</span>
      <button ref={menuButtonRef} type="button" className="page-nav-toggle" aria-expanded={menuOpen} aria-controls="page-nav-links"
        onClick={() => setMenuOpen((open) => !open)}>
        <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M3 5h14M3 10h14M3 15h14" /></svg>
        Menu
      </button>
      <div id="page-nav-links" className="page-nav-links">
        {pages.map(([id, label]) => <a key={id} href={`#${id}`} aria-current={page === id ? 'page' : undefined}
          onClick={() => { if (menuOpen) { setMenuOpen(false); menuButtonRef.current?.focus(); } }}>{label}</a>)}
      </div>
    </nav>
    <section className="tracker-hero">
      <div><h1>{page === 'tracker' ? <>My booth <em>tracker.</em></> : page === 'collection' ? <>My <em>collection.</em></> : page === 'games' ? <>My <em>games.</em></> : page === 'library' ? <>Game <em>library.</em></> : page === 'map' ? <>Map &amp; <em>route.</em></> : <>Update <em>booths.</em></>}</h1>
        <p>{page === 'tracker' ? <>Verify booth numbers and game availability with the <a href={expoPage} target="_blank" rel="noreferrer">official PAX Unplugged guide</a>.</> :
          page === 'collection' ? 'Import your BGG collection and find booths worth visiting.' : page === 'games' ? 'Keep track of games to try and buy.' : page === 'library' ? 'See what you want to play at a glance.' : page === 'map' ? 'Plan a walk through mapped booths in the expo hall.' : 'Find exhibitors, update booth numbers, or add your own stops.'}</p></div>
    </section>
    {page === 'tracker' && <section className="stats" aria-label="Checklist progress">
      <div><span>BOOTHS VISITED</span><strong>{visited}<small> / {list.length}</small></strong></div>
      <div><span>MUST VISITS LEFT</span><strong>{must}</strong></div>
      <div><span>GAMES CHECKED</span><strong>{games}</strong></div>
    </section>}
    <div className="sync-row">
      <p className={error ? 'error' : ''} role={error ? 'alert' : 'status'}>{error || message}</p>
      {page === 'tracker' && <div className="actions">
        <button disabled={busy} onClick={() => { setMatchAttempt((n) => n + 1); void run(store.listBooths, setBooths, 'refresh'); }}>Refresh</button>
        <button disabled={!list.length} onClick={() => exportChecklist(list)}>Export list</button>
      </div>}
    </div>
    {booths && page === 'tracker' && <>
      {list.length ? <>
        {!matchData && !matchError && <p role="status">Loading game matches…</p>}
        {matchError && <p className="error" role="alert">{matchError} <button type="button" className="text-button" onClick={() => setMatchAttempt((n) => n + 1)}>Retry game matches</button></p>}
        <section className="filters" aria-label="Filter booths">
          <div className="actions">{filters.map(([id, label]) => <button key={id} className="chip" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>
          <div className="fields">
            <label>Find a stop<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Booth, exhibitor, or game" /></label>
            <label>Sort by<select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="priority">Priority</option><option value="booth">Booth order</option><option value="name">Name</option>
            </select></label>
          </div>
        </section>
        <div className="list-heading"><h2>Booth checklist</h2><span>{shown.length} of {list.length}</span></div>
        <div className="booth-grid">{shown.map((booth) => <BoothCard key={booth.id} booth={booth} busy={busy} planned={plannedMatches.get(booth.id) ?? []}
          update={(changes) => run(() => store.updateBooth(booth.id, changes), (saved) => editBooth(booth.id, (b) => ({ ...b, ...saved })), 'save booth')}
          game={(item, checked) => void run(() => store.checkGame(item.id, checked), (saved) =>
            editBooth(booth.id, (b) => ({ ...b, games: b.games.map((g) => g.id === item.id ? saved : g) })), 'save game')}
          addGame={(title) => run(() => store.addGame(booth.id, title), (saved) =>
            editBooth(booth.id, (b) => ({ ...b, games: [...b.games, saved] })), 'add game')} />)}</div>
        {!shown.length && <div className="panel empty"><p>No booths match these filters.</p><button onClick={() => { setFilter('all'); setQuery(''); }}>Clear filters</button></div>}
      </> : <section className="panel empty">
        <p className="eyebrow">YOUR FIELD GUIDE</p><h2>Your checklist is ready.</h2>
        <p>Search the official expo directory and add booths you want to visit, or enter a stop manually.</p>
        <div className="actions">
          <a className="primary button" href="#update">Find or add a booth</a>
          <a className="button" href="#collection">Import from BGG</a>
        </div>
      </section>}
    </>}
    {booths && page === 'collection' &&
      <CollectionPanel ownerId={ownerId} booths={list} busy={busy} onImport={importExhibitor} />
    }
    {booths && page === 'map' && <MapPage booths={list} ownerId={ownerId} />}
    {booths && page === 'games' && <GamesPage ownerId={ownerId} booths={list} boothBusy={busy} onGetBooth={getOrImportExhibitor} />}
    {booths && page === 'library' && <GameLibraryPage ownerId={ownerId} />}
    {booths && page === 'update' && <>
      <ExpoLookup booths={list} busy={busy} onImport={importExhibitor} onUpdate={(booth, entry) => run(() => store.updateBooth(booth.id, { booth_number: entry.booth_number }),
        (saved) => editBooth(booth.id, (b) => ({ ...b, ...saved })), 'update booth number')} />
      <section id="add-booth" className="panel add-booth">
        <h2>Add a custom booth</h2>
        <form className="add-form" onSubmit={addBooth}>
          <label>Exhibitor name<input name="name" required maxLength={100} placeholder="Publisher or exhibitor" /></label>
          <label>Booth number<input name="booth" maxLength={boothNumberLimit} placeholder="Optional" /></label>
          <button className="primary" disabled={busy}>Add booth</button>
        </form>
      </section>
    </>}
  </main>;
}
