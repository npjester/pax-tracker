import { useState } from 'react';
import { aisles, boothNumbers, boothPoint, mappedBooths, partitionStops, planRoute, queueEntrance, type RouteStart } from './booth-route';
import type { Booth } from './store';

const officialMap = 'https://unplugged.paxsite.com/philly/en-us/info/maps.html';
const venueMap = 'https://unplugged.paxsite.com/content/dam/sitebuilder/rna/pax/unplugged/2026/docs/Convention-Center-Map_PAX-Unplugged-2026.pdf.coredownload.951710803.pdf';
type Scope = 'remaining' | 'all' | 'selected';
const additionalExhibits = [
  ['Alexandria RPG Library', '108B'], ['Amoirais', '105'], ['Arkham Horror', '201B'],
  ['Avantris', '110A'], ['Baldman Games', '103'], ['Chaosium', '109A'],
  ['Co-Operatives', '118C'], ['Czech Games Edition', '203AB'], ['Games on Demand', '106 & 107'],
  ['Limithron', '101'], ['Lurking Fears', '110B & 111'], ['Megagame Society', '118AB'],
  ['Mox Boarding House', '201A'], ['Mystic Realms', '120B'], ['Open the Gates', '124'],
  ['Paizo', '109B'], ['Renegade Games', '202AB'], ['Spectacle Ink', '120C'],
  ['Suspense Studio', '117'], ['Winding Path Initiative', '120A'],
];

export function MapPage({ booths }: { booths: Booth[] }) {
  const [scope, setScope] = useState<Scope>('remaining');
  const [selected, setSelected] = useState<string[]>([]);
  const [startValue, setStartValue] = useState('');
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [fitMap, setFitMap] = useState(false);
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

  return <section className="map-page" aria-labelledby="map-heading">
    <div className="map-intro">
      <div>
        <h2 id="map-heading">Expo hall map</h2>
        <p>{mappedBooths.length} booths in parts of Halls A and B are mapped. Routes are approximate; check the <a href={officialMap} target="_blank" rel="noreferrer">official 2026 expo map</a> and follow on-site signs.</p>
      </div>
      <span className="tag">Partial map · prototype</span>
    </div>
    <div className="map-controls">
      <label>Include in route
        <select value={scope} onChange={(event) => setScope(event.target.value as Scope)}>
          <option value="remaining">All unvisited</option>
          <option value="all">All checklist booths</option>
          <option value="selected">Selected only</option>
        </select>
      </label>
      <label>Starting location
        <select value={startValue} onChange={(event) => setStartValue(event.target.value)}>
          <option value="">Choose a starting location</option>
          <optgroup label="Entrance">
            <option value="entrance:queue">Queue entrance near booth 1821 (approximate)</option>
          </optgroup>
          <optgroup label="Mapped booths">
            {[...mappedBooths].sort((a, b) => a.number.localeCompare(b.number)).map((position) =>
              <option value={`booth:${position.number}`} key={position.number}>{position.name === `Booth ${position.number}` ? position.name : `${position.number} · ${position.name}`}</option>)}
          </optgroup>
        </select>
      </label>
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
        <div className="map-caption"><div><strong>Halls A &amp; B</strong><span>{fitMap ? 'Full map overview' : 'Swipe or scroll to explore'}</span></div><button type="button" className="map-zoom" onClick={() => setFitMap(!fitMap)}>{fitMap ? 'Show detail' : 'Fit map'}</button></div>
        <div className={`map-scroll${fitMap ? ' map-scroll-fit' : ''}`} tabIndex={0} aria-label="Scroll the partial expo hall map horizontally">
          <svg viewBox="105 -45 2055 1205" role="img" aria-labelledby="aisle-title aisle-description">
            <title id="aisle-title">Partial expo hall map</title>
            <desc id="aisle-description">Mapped booths and approximate aisles near the Queue entrance. The route and excluded stops are also listed below.</desc>
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
              return <g key={position.number}>
                <rect x={position.x} y={position.y} width={position.width} height={position.height} rx="3" className={stopIndex >= 0 ? 'map-booth map-booth-active' : 'map-booth'} />
                <text x={x} y={y + 3} textAnchor="middle" className="map-number" textLength={Math.min(position.width - 4, 25)} lengthAdjust="spacingAndGlyphs">{position.number}</text>
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
        {!included.length ? <p>{scope === 'selected' ? 'Select booths from your checklist to plan a route.' : 'No checklist booths are included in this route.'}</p> :
          !mapped.length ? <p>{multipleLocations.some(({ booth, numbers }) => !choices[booth.id] && mappedBooths.some((position) => numbers.includes(position.number))) ?
            'Choose a mapped location above to include it in the route.' : 'None of the included booths are in the mapped section yet.'}</p> :
            !start ? <p>Choose a starting location to see the route.</p> : <ol>
              {stops.map(({ booth, position }) => <li key={booth.id}><strong>{booth.name}</strong><span>Booth {position.number}{booth.visited ? ' · Visited' : ''}</span></li>)}
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
