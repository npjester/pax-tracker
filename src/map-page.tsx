import { useEffect, useMemo, useRef, useState } from 'react';
import { aisles, boothNumbers, boothPoint, exhibitorNames, mappedBooths, partitionStops, planRoute, queueEntrance, type MapPosition, type RouteStart } from './booth-route';
import { fetchDirectory, type Exhibitor } from './expo';
import { initialMapState, readMapState, saveMapState, type Scope } from './map-state';
import type { Booth } from './store';

const officialMap = 'https://unplugged.paxsite.com/philly/en-us/info/maps.html';
const venueMap = 'https://unplugged.paxsite.com/content/dam/sitebuilder/rna/pax/unplugged/2026/docs/Convention-Center-Map_PAX-Unplugged-2026.pdf.coredownload.951710803.pdf';
const additionalExhibits = [
  ['Alexandria RPG Library', '108B'], ['Amoirais', '105'], ['Arkham Horror', '201B'],
  ['Avantris', '110A'], ['Baldman Games', '103'], ['Chaosium', '109A'],
  ['Co-Operatives', '118C'], ['Czech Games Edition', '203AB'], ['Games on Demand', '106 & 107'],
  ['Limithron', '101'], ['Lurking Fears', '110B & 111'], ['Megagame Society', '118AB'],
  ['Mox Boarding House', '201A'], ['Mystic Realms', '120B'], ['Open the Gates', '124'],
  ['Paizo', '109B'], ['Renegade Games', '202AB'], ['Spectacle Ink', '120C'],
  ['Suspense Studio', '117'], ['Winding Path Initiative', '120A'],
];

export function MapPage({ booths, ownerId }: { booths: Booth[]; ownerId: string }) {
  const [mapLink] = useState(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
    const number = params.get('booth');
    return { number: mappedBooths.some((position) => position.number === number) ? number : null, search: params.get('search') ?? '' };
  });
  const [restored] = useState(() => {
    try {
      return { state: readMapState(localStorage, ownerId), error: false };
    } catch {
      return { state: initialMapState, error: true };
    }
  });
  const [scope, setScope] = useState<Scope>(restored.state.scope);
  const [selected, setSelected] = useState<string[]>(restored.state.selected);
  const [startValue, setStartValue] = useState(restored.state.startValue);
  const [choices, setChoices] = useState<Record<string, string>>(restored.state.choices);
  const [fitMap, setFitMap] = useState(false);
  const [zoomed, setZoomed] = useState(!!mapLink.number);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(mapLink.number);
  const [activeStopId, setActiveStopId] = useState<string | null>(restored.state.activeStopId);
  const [storageError, setStorageError] = useState(restored.error);
  const [restoreFailed, setRestoreFailed] = useState(restored.error);
  const [startSearch, setStartSearch] = useState('');
  const [boothSearch, setBoothSearch] = useState(mapLink.search);
  const [focusRequest, setFocusRequest] = useState<{ number: string } | null>(mapLink.number ? { number: mapLink.number } : null);
  const [directory, setDirectory] = useState<Exhibitor[]>([]);
  const [directoryStatus, setDirectoryStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [directoryAttempt, setDirectoryAttempt] = useState(0);
  const boothElements = useRef(new Map<string, SVGGElement>());

  useEffect(() => {
    if (restoreFailed) return;
    try {
      saveMapState(localStorage, ownerId, { scope, selected, startValue, choices, activeStopId });
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [ownerId, scope, selected, startValue, choices, activeStopId, restoreFailed]);

  useEffect(() => {
    const controller = new AbortController();
    setDirectoryStatus('loading');
    void fetchDirectory(controller.signal).then((entries) => {
      if (!controller.signal.aborted) {
        setDirectory(entries);
        setDirectoryStatus('ready');
      }
    }).catch(() => {
      if (!controller.signal.aborted) setDirectoryStatus('error');
    });
    return () => controller.abort();
  }, [directoryAttempt]);

  useEffect(() => {
    if (focusRequest) boothElements.current.get(focusRequest.number)?.scrollIntoView({ block: 'center', inline: 'center' });
  }, [focusRequest]);

  const startBooth = mappedBooths.find((item) => `booth:${item.number}` === startValue);
  const start: RouteStart | null = startValue === 'entrance:queue' ? { kind: 'entrance', id: 'queue' } :
    startBooth ? { kind: 'booth', position: startBooth } : null;
  const included = booths.filter((booth) => scope === 'all' || (scope === 'remaining' ? !booth.visited : selected.includes(booth.id)));
  const { mapped, unmapped } = partitionStops(included, choices);
  const multipleLocations = included.map((booth) => ({
    booth,
    numbers: boothNumbers(booth.booth_number),
  })).filter(({ numbers }) => numbers.length > 1);
  const route = start && mapped.length ? planRoute(start, mapped) : null;
  const stops = route?.stops ?? [];
  const line = route?.points.map((point) => `${point.x},${point.y}`).join(' ') ?? '';
  const selectedPosition = mappedBooths.find((position) => position.number === selectedNumber);
  const selectedNames = selectedPosition ? exhibitorNames(selectedPosition, directory, booths) : [];
  const boothNames = useMemo(() => new Map(mappedBooths.map((position) =>
    [position.number, exhibitorNames(position, directory, booths)])), [directory, booths]);
  const sortedBooths = useMemo(() => [...mappedBooths].sort((a, b) => a.number.localeCompare(b.number)), []);
  function matchingBooths(query: string) {
    const search = query.trim().toLowerCase();
    return sortedBooths.filter((position) =>
      `${position.number} ${position.name} ${(boothNames.get(position.number) ?? []).join(' ')}`.toLowerCase().includes(search));
  }
  function boothLabel(position: MapPosition) {
    const names = boothNames.get(position.number) ?? [];
    return names.length ? `${position.number} · ${names.join(' / ')}` : `Booth ${position.number}`;
  }
  const startingBooths = matchingBooths(startSearch);
  const foundBooths = boothSearch.trim() ? matchingBooths(boothSearch) : [];
  const activeIndex = Math.max(0, stops.findIndex((stop) => stop.booth.id === activeStopId));
  const activeStop = stops[activeIndex];

  function selectBooth(position: MapPosition) {
    setSelectedNumber(position.number);
    const stop = stops.find((item) => item.position.number === position.number);
    if (stop) setActiveStopId(stop.booth.id);
  }

  function showStop(index: number) {
    const stop = stops[index];
    if (!stop) return;
    setActiveStopId(stop.booth.id);
    setSelectedNumber(stop.position.number);
    setFitMap(false);
    setFocusRequest({ number: stop.position.number });
  }

  function showBooth(position: MapPosition) {
    selectBooth(position);
    setFitMap(false);
    setZoomed(true);
    setFocusRequest({ number: position.number });
  }

  function moveBoothFocus(position: MapPosition, key: string) {
    const direction = key === 'ArrowLeft' ? [-1, 0] : key === 'ArrowRight' ? [1, 0] :
      key === 'ArrowUp' ? [0, -1] : key === 'ArrowDown' ? [0, 1] : null;
    if (!direction) return false;
    const x = position.x + position.width / 2;
    const y = position.y + position.height / 2;
    const next = mappedBooths.map((candidate) => {
      const dx = candidate.x + candidate.width / 2 - x;
      const dy = candidate.y + candidate.height / 2 - y;
      const forward = dx * direction[0] + dy * direction[1];
      const sideways = Math.abs(dx * direction[1] - dy * direction[0]);
      return { candidate, forward, sideways };
    }).filter((item) => item.forward > 0)
      .sort((a, b) => (a.forward + a.sideways * 2) - (b.forward + b.sideways * 2))[0]?.candidate;
    if (next) {
      selectBooth(next);
      boothElements.current.get(next.number)?.focus();
    }
    return true;
  }

  return <section className="map-page" aria-labelledby="map-heading">
    <div className="map-intro">
      <div>
        <h2 id="map-heading">Expo hall map</h2>
        <p>{mappedBooths.length} booths in parts of Halls A and B are mapped. Routes are approximate; check the <a href={officialMap} target="_blank" rel="noreferrer">official 2026 expo map</a> and follow on-site signs.</p>
      </div>
      <span className="tag">Partial map · prototype</span>
    </div>
    {storageError && <div className="map-storage-error" role="alert">
      <p className="error">Map settings could not be {restoreFailed ? 'restored' : 'saved'} on this device. Route progress may reset.</p>
      <button type="button" onClick={() => {
        try {
          if (restoreFailed) localStorage.removeItem(`pax-tracker-map:${ownerId}`);
          else saveMapState(localStorage, ownerId, { scope, selected, startValue, choices, activeStopId });
          setRestoreFailed(false);
          setStorageError(false);
        } catch {
          setStorageError(true);
        }
      }}>{restoreFailed ? 'Discard saved map settings' : 'Retry saving'}</button>
      <p>Check browser storage settings if the problem continues.</p>
    </div>}
    {!booths.length && <div className="map-setup">
      <p>Add booths to your checklist, then choose a starting location to plan a route.</p>
      <div className="actions"><a className="button" href="#update">Find or add booths</a><a className="button" href="#collection">Import from BGG</a></div>
    </div>}
    <div className="map-controls">
      <label>Include in route
        <select value={scope} onChange={(event) => setScope(event.target.value as Scope)}>
          <option value="remaining">All unvisited</option>
          <option value="all">All checklist booths</option>
          <option value="selected">Selected only</option>
        </select>
      </label>
      <div className="map-start-controls">
      <label>Find a starting booth
        <input type="search" value={startSearch} onChange={(event) => setStartSearch(event.target.value)} placeholder="Booth number or exhibitor" />
      </label>
      <label>Starting location
        <select value={startValue} onChange={(event) => setStartValue(event.target.value)}>
          <option value="">Choose a starting location</option>
          <optgroup label="Entrance">
            <option value="entrance:queue">Queue entrance near booth 1821 (approximate)</option>
          </optgroup>
          <optgroup label="Mapped booths">
            {sortedBooths.filter((position) => startingBooths.includes(position) || `booth:${position.number}` === startValue).map((position) =>
              <option value={`booth:${position.number}`} key={position.number}>{boothLabel(position)}</option>)}
          </optgroup>
        </select>
      </label>
      {startSearch.trim() && startingBooths.length === 0 && <p>No mapped booths match that search.</p>}
      </div>
    </div>
    <p>The Queue starting point is approximate. Routes follow the mapped aisles, not live location or crowd conditions.</p>
    {scope === 'selected' && (booths.length ? <fieldset className="map-selection">
      <legend>Select checklist booths</legend>
      {booths.map((booth) => <label key={booth.id}>
        <input type="checkbox" checked={selected.includes(booth.id)} onChange={(event) =>
          setSelected((items) => event.target.checked ? [...items, booth.id] : items.filter((id) => id !== booth.id))} />
        <span>{booth.name} · {booth.booth_number || 'Booth TBD'}</span>
      </label>)}
    </fieldset> : <p>Add booths to your checklist before selecting stops.</p>)}
    {multipleLocations.length > 0 && <div className="map-location-choices">
      <h3>Choose a location</h3>
      <p>These exhibitors list multiple booth numbers. Choose one mapped booth for each route; other locations are not included.</p>
      {multipleLocations.map(({ booth, numbers }) => {
        const options = mappedBooths.filter((position) => numbers.includes(position.number));
        return <label key={booth.id}>{booth.name} · {booth.booth_number}
          <select value={options.some((position) => position.number === choices[booth.id]) ? choices[booth.id] : ''} onChange={(event) =>
            setChoices((current) => ({ ...current, [booth.id]: event.target.value }))}>
            <option value="">{options.length ? 'Choose a mapped booth' : 'No mapped locations yet'}</option>
            {options.map((position) => <option value={position.number} key={position.number}>Booth {position.number}</option>)}
          </select>
        </label>;
      })}
    </div>}
    <div className="map-layout">
      <div className="map-surface">
        <div className="map-caption"><div><strong>Halls A &amp; B</strong><span>{fitMap ? 'Full map overview' : 'Swipe or scroll to explore'}</span></div><div className="actions"><button type="button" className="map-zoom" onClick={() => { setZoomed(fitMap || !zoomed); setFitMap(false); }}>{!fitMap && zoomed ? 'Zoom out' : 'Zoom in'}</button><button type="button" className="map-zoom" onClick={() => setFitMap(!fitMap)}>{fitMap ? 'Show detail' : 'Fit map'}</button></div></div>
        <div className="map-finder">
          <label>Find a booth on the map
            <input type="search" value={boothSearch} onChange={(event) => setBoothSearch(event.target.value)} placeholder="Booth number or exhibitor" />
          </label>
          {boothSearch.trim() && (foundBooths.length ? <>
            <p>{foundBooths.length > 12 ? `Showing 12 of ${foundBooths.length} matches. Refine your search to see others.` : `${foundBooths.length} ${foundBooths.length === 1 ? 'match' : 'matches'}. Select one to find it on the map.`}</p>
            <ul>{foundBooths.slice(0, 12).map((position) => <li key={position.number}><button type="button" onClick={() => showBooth(position)}>{boothLabel(position)}</button></li>)}</ul>
          </> : <p>No mapped booths match that search.</p>)}
        </div>
        <div className="map-overlay">
        <div className="map-inspection" aria-live="polite">
          {selectedPosition ? <>
            <div><span className="map-inspection-label">Booth {selectedPosition.number}</span>
              <strong>{selectedNames.length ? selectedNames.join(' / ') : directoryStatus === 'loading' ? 'Loading exhibitor…' : directoryStatus === 'error' ? 'Exhibitor unavailable' : 'Exhibitor not listed'}</strong></div>
            {directoryStatus === 'error' && <p>Couldn’t load the official directory. <button type="button" className="text-button" onClick={() => setDirectoryAttempt((n) => n + 1)}>Retry</button></p>}
          </> : <p>Tap a booth to see its exhibitor, or search above. Use arrow keys to move between booths.</p>}
        </div>
        {activeStop && <div className="route-navigation" aria-label="Route navigation">
          <div aria-live="polite"><span>Stop {activeIndex + 1} of {stops.length}</span><strong>{activeStop.booth.name} · {activeStop.position.number}</strong></div>
          <div className="actions">
            <button type="button" disabled={activeIndex === 0} onClick={() => showStop(activeIndex - 1)}>Previous stop</button>
            <button type="button" disabled={activeIndex === stops.length - 1} onClick={() => showStop(activeIndex + 1)}>Next stop</button>
          </div>
        </div>}
        </div>
        <div className={`map-scroll${fitMap ? ' map-scroll-fit' : zoomed ? ' map-scroll-zoom' : ''}`} tabIndex={0} aria-label="Scroll the partial expo hall map horizontally">
          <svg viewBox="105 -45 2055 1205" role="group" aria-labelledby="aisle-title aisle-description">
            <title id="aisle-title">Partial expo hall map</title>
            <desc id="aisle-description">Select a booth for details. Use arrow keys to move between booths. The route and excluded stops are also listed below.</desc>
            {aisles.map(({ x1, y1, x2, y2 }) => <path key={`${x1},${y1}-${x2},${y2}`} d={`M ${x1} ${y1} L ${x2} ${y2}`} className="map-aisle" />)}
            <rect x="136" y="-37" width="101" height="116" rx="3" className="map-obstacle" />
            <text x="186.5" y="18" textAnchor="middle" className="map-context">Minis</text>
            <text x="186.5" y="36" textAnchor="middle" className="map-context">Gaming</text>
            <rect x="136" y="895" width="154" height="240" rx="3" className="map-obstacle" />
            <text x="213" y="1008" textAnchor="middle" className="map-context">Warhammer</text>
            <text x="213" y="1026" textAnchor="middle" className="map-context">Paint &amp; Take</text>
            {line && <polyline points={line} className="map-route" />}
            {mappedBooths.map((position) => {
              const stopIndex = stops.findIndex((stop) => stop.position.number === position.number);
              const x = position.x + position.width / 2;
              const y = position.y + position.height / 2;
              const entry = boothPoint(position);
              const large = position.width >= 70 && position.height >= 70;
              const names = large ? boothNames.get(position.number) ?? [] : [];
              const label = position.name !== `Booth ${position.number}` ? position.name :
                names.length ? `${names[0]}${names.length > 1 ? ` + ${names.length - 1} more` : ''}` :
                  directoryStatus === 'loading' ? 'Loading…' : directoryStatus === 'error' ? 'Exhibitor unavailable' : 'Exhibitor not listed';
              return <g key={position.number} ref={(element) => {
                if (element) boothElements.current.set(position.number, element);
                else boothElements.current.delete(position.number);
              }} role="button" tabIndex={selectedNumber === position.number || (!selectedNumber && position === mappedBooths[0]) ? 0 : -1}
                aria-label={boothLabel(position)} aria-pressed={selectedNumber === position.number}
                className="map-booth-button" onClick={() => selectBooth(position)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectBooth(position);
                  } else if (moveBoothFocus(position, event.key)) event.preventDefault();
                }}>
                <rect x={position.x} y={position.y} width={position.width} height={position.height} rx="3" className={`map-booth${stopIndex >= 0 ? ' map-booth-active' : ''}${activeStop?.position.number === position.number ? ' map-booth-current' : ''}${selectedNumber === position.number ? ' map-booth-selected' : ''}`} />
                {large ? <foreignObject x={position.x + 3} y={position.y + 3} width={position.width - 6} height={position.height - 6}>
                  <div className="map-large-label"><span>{label}</span><strong>{position.number}</strong></div>
                </foreignObject> : <text x={x} y={y + 3} textAnchor="middle" className="map-number" textLength={Math.min(position.width - 4, 25)} lengthAdjust="spacingAndGlyphs">{position.number}</text>}
                {stopIndex >= 0 && <><circle cx={position.x + position.width - 3} cy={position.y + 3} r="11" className="map-marker" /><text x={position.x + position.width - 3} y={position.y + 7} textAnchor="middle" className="map-marker-label">{stopIndex + 1}</text></>}
                {startBooth?.number === position.number && <circle cx={entry.x} cy={entry.y} r="6" className="map-start" />}
              </g>;
            })}
            <circle cx={queueEntrance.x} cy={queueEntrance.y} r="6" className={start?.kind === 'entrance' ? 'map-start' : 'map-entrance'} />
            <text x="140" y="884" className="map-aisle-label">QUEUE ENTRANCE</text>
          </svg>
        </div>
      </div>
      <div className="route-list">
        <h3>Route stops</h3>
        {!included.length ? <p>{scope === 'selected' ? 'Select booths from your checklist above to plan a route.' : booths.length ? 'No checklist booths are included. Change the route filter above or add more booths.' : 'Add booths to your checklist to build a route.'}</p> :
          !mapped.length ? <p>{multipleLocations.some(({ booth, numbers }) => !choices[booth.id] && mappedBooths.some((position) => numbers.includes(position.number))) ?
            'Choose a mapped location above to include it in the route.' : 'None of the included booths are in the mapped section yet.'}</p> :
            !start ? <p>Choose a starting location to see the route.</p> : <ol>
              {stops.map(({ booth, position }, index) => <li key={booth.id}><button type="button" className="route-stop" aria-current={index === activeIndex ? 'step' : undefined} onClick={() => showStop(index)}><strong>{booth.name}</strong><span>Booth {position.number}{booth.visited ? ' · Visited' : ''}</span></button></li>)}
            </ol>}
        {unmapped.length > 0 && <div className="unmapped">
          <h3>Not included on map ({unmapped.length})</h3>
          <p>Outside the prototype, awaiting a location choice, or sharing a number with another included stop.</p>
          <ul>{unmapped.map((booth) => <li key={booth.id}>{booth.name} · {booth.booth_number || 'Booth TBD'}</li>)}</ul>
        </div>}
      </div>
    </div>
    <details className="additional-exhibits">
      <summary>Exhibits in other rooms</summary>
      <p>These locations are outside the expo hall and are not included in routes. Check the <a href={venueMap} target="_blank" rel="noreferrer">official venue map</a> for directions.</p>
      <ul>{additionalExhibits.map(([name, rooms]) => <li key={name}>{name} · {rooms.includes('&') ? 'Rooms' : 'Room'} {rooms}</li>)}</ul>
    </details>
  </section>;
}
