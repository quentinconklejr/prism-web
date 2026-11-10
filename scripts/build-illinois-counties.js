// Builds public/data/illinois_counties.geojson for the /illinois page.
//
// Same source the national map loads at runtime (plotly's Census county
// GeoJSON), cut down to Illinois's 102 counties and rounded to 4 decimals
// (~10 m), so the page loads ~100 KB instead of the 3 MB national file.
// County shapes rarely change; rerun only if the source does.
//
//   node scripts/build-illinois-counties.js
import { writeFileSync } from 'node:fs';

const SRC = 'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json';
const OUT = new URL('../public/data/illinois_counties.geojson', import.meta.url);

const round = (c) => (typeof c[0] === 'number'
  ? [Math.round(c[0] * 1e4) / 1e4, Math.round(c[1] * 1e4) / 1e4]
  : c.map(round));

const res = await fetch(SRC);
if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
const all = await res.json();

const features = all.features
  .filter((f) => String(f.id).startsWith('17'))
  .map((f) => ({
    type: 'Feature',
    id: String(f.id),
    properties: { GEOID: String(f.id), NAME: f.properties.NAME },
    geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) },
  }));

writeFileSync(OUT, JSON.stringify({ type: 'FeatureCollection', features }));
console.log(`Wrote ${features.length} Illinois counties`);
