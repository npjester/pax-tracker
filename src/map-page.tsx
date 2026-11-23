import { useState } from 'react';
import { mappedBooths, orderStops, partitionStops } from './booth-route';
import type { Booth } from './store';

const officialMap = 'https://unplugged.paxsite.com/philly/en-us/info/maps.html';
type Scope = 'remaining' | 'all' | 'selected';

export function MapPage({ booths }: { booths: Booth[] }) {
  const [scope, setScope] = useState<Scope>('remaining');
  const [selected, setSelected] = useState<string[]>([]);
  const [startNumber, setStartNumber] = useState('');
  const start = mappedBooths.find((item) => item.number === startNumber);
  const included = booths.filter((booth) => scope === 'all' || (scope === 'remaining' ? !booth.visited : selected.includes(booth.id)));
  const { mapped, unmapped } = partitionStops(included);
  const stops = start ? orderStops(start, mapped) : [];
  const line = start && stops.length
    ? [`${start.x},170 ${start.x},205`, ...stops.map(({ position }) => `${position.x},205 ${position.x},170 ${position.x},205`)].join(' ')
    : '';

  return <section className="map-page" aria-labelledby="map-heading">
    <div className="map-intro">
      <div>
        <h2 id="map-heading">Hall B aisle prototype</h2>
        <p>Only ten booths along one aisle are mapped. This simplified diagram is not to scale; check the <a href={officialMap} target="_blank" rel="noreferrer">official 2026 expo map</a> before walking.</p>
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
      <label>Start at a booth
        <select value={startNumber} onChange={(event) => setStartNumber(event.target.value)}>
          <option value="">Choose a starting booth</option>
          {mappedBooths.map((position) => <option value={position.number} key={position.number}>{position.number} · {position.name}</option>)}
        </select>
      </label>
    </div>
    <p>The Queue entrance is near booth 1821, outside the mapped aisle. Entrance starts will be available once the connecting aisles are mapped.</p>
    {scope === 'selected' && (booths.length ? <fieldset className="map-selection">
      <legend>Select checklist booths</legend>
      {booths.map((booth) => <label key={booth.id}>
        <input type="checkbox" checked={selected.includes(booth.id)} onChange={(event) =>
          setSelected((items) => event.target.checked ? [...items, booth.id] : items.filter((id) => id !== booth.id))} />
        <span>{booth.name} · {booth.booth_number || 'Booth TBD'}</span>
      </label>)}
    </fieldset> : <p>Add booths to your checklist before selecting stops.</p>)}
    <div className="map-layout">
      <div className="map-surface">
        <div className="map-caption"><strong>Hall B</strong><span>One aisle shown</span></div>
        <div className="map-scroll" tabIndex={0} aria-label="Scroll the partial Hall B map horizontally">
          <svg viewBox="0 0 770 260" role="img" aria-labelledby="aisle-title aisle-description">
            <title id="aisle-title">Partial Hall B aisle</title>
            <desc id="aisle-description">Ten mapped booths in their relative order along one aisle. The route and excluded stops are also listed below.</desc>
            <path d="M 25 205 H 745" className="map-aisle" />
            {line && <polyline points={line} className="map-route" />}
            {mappedBooths.map((position) => {
              const stopIndex = stops.findIndex((stop) => stop.position.number === position.number);
              return <g key={position.number}>
                <rect x={position.x - 19} y="85" width="38" height="85" rx="3" className={stopIndex >= 0 ? 'map-booth map-booth-active' : 'map-booth'} />
                <text x={position.x} y="132" textAnchor="middle" className="map-number">{position.number}</text>
                {stopIndex >= 0 && <><circle cx={position.x} cy="65" r="13" className="map-marker" /><text x={position.x} y="69" textAnchor="middle" className="map-marker-label">{stopIndex + 1}</text></>}
                {start?.number === position.number && <circle cx={position.x} cy="170" r="5" className="map-start" />}
              </g>;
            })}
            <text x="25" y="239" className="map-aisle-label">AISLE</text>
          </svg>
        </div>
      </div>
      <div className="route-list">
        <h3>Route stops</h3>
        {!included.length ? <p>{scope === 'selected' ? 'Select booths from your checklist to plan a route.' : 'No checklist booths are included in this route.'}</p> :
          !mapped.length ? <p>None of the included booths are in the mapped aisle yet.</p> :
            !start ? <p>Choose a starting booth to see the route.</p> : <ol>
              {stops.map(({ booth, position }) => <li key={booth.id}><strong>{booth.name}</strong><span>Booth {position.number}{booth.visited ? ' · Visited' : ''}</span></li>)}
            </ol>}
        {unmapped.length > 0 && <div className="unmapped">
          <h3>Not included on map ({unmapped.length})</h3>
          <p>Outside the prototype, missing a single booth number, or sharing a number with another included stop.</p>
          <ul>{unmapped.map((booth) => <li key={booth.id}>{booth.name} · {booth.booth_number || 'Booth TBD'}</li>)}</ul>
        </div>}
      </div>
    </div>
  </section>;
}
