import { useEffect, useState } from 'react';
import { expoPage, expoYear, fetchDirectory, matchingBooth, searchDirectory, type Exhibitor } from './expo';
import type { Booth } from './store';

const pageSize = 25;

export function ExpoLookup({ booths, busy, onImport, onUpdate }: {
  booths: Booth[];
  busy: boolean;
  onImport: (entry: Exhibitor) => Promise<boolean>;
  onUpdate: (booth: Booth, entry: Exhibitor) => Promise<boolean>;
}) {
  const [attempt, setAttempt] = useState(0);
  const [entries, setEntries] = useState<Exhibitor[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(pageSize);
  const [result, setResult] = useState('');

  useEffect(() => {
    if (!attempt) return;
    const controller = new AbortController();
    setStatus('loading');
    void fetchDirectory(controller.signal).then((data) => {
      if (!controller.signal.aborted) { setEntries(data); setStatus('ready'); }
    }).catch(() => {
      if (!controller.signal.aborted) setStatus('error');
    });
    return () => controller.abort();
  }, [attempt]);

  const matches = searchDirectory(entries, query);
  return <section id="expo-lookup" className="panel expo-lookup" aria-labelledby="expo-heading">
    <p className="eyebrow">{expoYear} PAX UNPLUGGED</p>
    <h2 id="expo-heading">Expo booth lookup</h2>
    <p>Find an exhibitor in the <a href={expoPage} target="_blank" rel="noreferrer">official expo directory</a> and add it to your checklist.</p>
    {status === 'idle' && <button className="primary" onClick={() => setAttempt(1)}>Load exhibitor directory</button>}
    {status === 'loading' && <p role="status">Loading exhibitor directory…</p>}
    {status === 'error' && <>
      <p className="error" role="alert">Couldn’t load the official directory. Try again or add a booth manually.</p>
      <button onClick={() => setAttempt((n) => n + 1)}>Retry directory</button>
    </>}
    {status === 'ready' && <>
      <label>Search exhibitors or booth numbers
        <input type="search" value={query} placeholder="e.g. Button Shy or 3609" onChange={(event) => {
          setQuery(event.target.value);
          setLimit(pageSize);
        }} />
      </label>
      <p role="status">{matches.length ? `Showing ${Math.min(limit, matches.length)} of ${matches.length} exhibitors` : 'No exhibitors match your search.'}</p>
      <p role="status">{result}</p>
      <ul className="expo-results">
        {matches.slice(0, limit).map((entry) => {
          const saved = matchingBooth(entry, booths);
          const canUpdate = saved && entry.booth_number && entry.booth_number !== saved.booth_number;
          return <li key={entry.id}>
            <div><strong>{entry.name}</strong><p>{entry.booth_number ? `Booth ${entry.booth_number}` : 'Booth TBD'}</p></div>
            {!saved ? <button disabled={busy} onClick={async () => {
              setResult('');
              setResult(await onImport(entry) ? `Added ${entry.name} to your checklist.` : `Couldn’t import ${entry.name}. Refresh your checklist or try again.`);
            }}>Import<span className="sr-only"> {entry.name}</span></button> :
              canUpdate ? <button disabled={busy} onClick={async () => {
                setResult('');
                setResult(await onUpdate(saved, entry) ? `Updated the booth number for ${saved.name}.` : `Couldn’t update ${saved.name}. Try again.`);
              }}>Update from {saved.booth_number || 'TBD'}<span className="sr-only"> for {saved.name}</span></button> :
                <span className="tag">In checklist</span>}
          </li>;
        })}
      </ul>
      {matches.length > limit && <button onClick={() => setLimit((n) => n + pageSize)}>Show more exhibitors</button>}
    </>}
  </section>;
}
