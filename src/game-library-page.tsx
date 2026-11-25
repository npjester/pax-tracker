import { useEffect, useMemo, useState } from 'react';
import type { CollectionGame } from './collection';
import { libraryGames } from './game-library';
import * as store from './store';

const initialLimit = 36;

export function GameLibraryPage({ ownerId }: { ownerId: string }) {
  const [collection, setCollection] = useState<CollectionGame[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(initialLimit);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void store.getCollection(ownerId).then((games) => {
      if (active) setCollection(games);
    }).catch((failure) => {
      if (active) setError(`Could not load your saved BGG collection. ${store.errorMessage(failure)}`);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [ownerId, attempt]);

  const games = useMemo(() => libraryGames(collection ?? [], query), [collection, query]);
  const needsFlags = collection?.some((game) => game.wantToPlay === undefined);
  const needsScores = collection?.some((game) => game.wantToPlay && game.averageRating === undefined);

  if (loading) return <p role="status">Loading your game library…</p>;
  if (error) return <div className="panel empty"><p className="error" role="alert">{error}</p>
    <button onClick={() => setAttempt((value) => value + 1)}>Retry</button></div>;
  if (!collection) return <div className="panel empty"><h2>Your library starts with BGG.</h2>
    <p>Import your collection to see games marked “want to play” here.</p>
    <a className="button" href="#collection">Import a BGG collection</a></div>;

  return <section className="game-library" aria-labelledby="library-heading">
    <div className="library-intro">
      <div>
        <h2 id="library-heading">Want to play</h2>
        <p>From your saved BGG collection, sorted by community average. Games without a score appear last.</p>
      </div>
      <label>Find a game<input type="search" value={query} placeholder="Search titles" onChange={(event) => {
        setQuery(event.target.value);
        setLimit(initialLimit);
      }} /></label>
    </div>
    {(needsFlags || needsScores) && <p>For {needsFlags ? 'want-to-play flags' : 'community scores'}, re-import a current BGG CSV on the <a href="#collection">Collection page</a>.</p>}
    <p>Box art is not available yet. Select a title to view it on BoardGameGeek.</p>
    {games.length ? <>
      <p className="library-count">{games.length.toLocaleString()} {games.length === 1 ? 'game' : 'games'}{query.trim() ? ' found' : ' to play'}</p>
      <ul className="library-list">{games.slice(0, limit).map((game) => <li key={game.id}>
        <a href={`https://boardgamegeek.com/boardgame/${encodeURIComponent(game.id)}`} target="_blank" rel="noreferrer">{game.title}</a>
        <span>{game.averageRating == null ? 'No BGG average' : <>BGG average <strong>{game.averageRating.toFixed(1)}</strong> / 10</>}</span>
      </li>)}</ul>
      {games.length > limit && <button className="library-more" onClick={() => setLimit((value) => value + initialLimit)}>
        Show more games <span>({Math.min(limit, games.length)} of {games.length})</span>
      </button>}
    </> : <div className="panel empty"><p>{query.trim() ? 'No games match this search.' : 'No games are marked “want to play” in your saved collection.'}</p>
      {query.trim() ? <button onClick={() => setQuery('')}>Clear search</button> : <a className="button" href="#collection">Go to Collection</a>}</div>}
  </section>;
}
