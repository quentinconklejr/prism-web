import Papa from 'papaparse';

// Everything on /illinois comes from this file. Edit the CSV and redeploy;
// there is no other copy of the data in the code.
export const RULES_CSV = '/data/illinois-rules.csv';
export const COUNTIES_GEOJSON = '/data/illinois_counties.geojson';

// Okabe-Ito colours: distinguishable with the common forms of colour blindness,
// and the two pause states share a hue family so "proposed" reads as the
// lighter version of "in effect". Order here is the legend order and also the
// precedence when a county has more than one county-level row.
export const STATUSES = {
  pause_in_effect: { label: 'Pause in effect', color: '#D55E00' },
  rules_adopted:   { label: 'Rules adopted',   color: '#0072B2' },
  pause_proposed:  { label: 'Pause proposed',  color: '#E69F00' },
  other_action:    { label: 'Other action',    color: '#9CA3AF' },
};
const STATUS_ORDER = Object.keys(STATUSES);
const UNKNOWN_COLOR = '#CBD5E1';

const humanize = (s) => {
  const t = String(s ?? '').replace(/_/g, ' ').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : 'Unknown';
};

// A status the code has never seen still renders, in neutral grey, under its
// own name, so adding a new status to the CSV never drops a row from the page.
export function statusInfo(status) {
  return STATUSES[status] ?? { label: humanize(status), color: UNKNOWN_COLOR };
}

export function statusRank(status) {
  const i = STATUS_ORDER.indexOf(status);
  return i === -1 ? STATUS_ORDER.length : i;
}

// Rule detail columns, shown when a row has them. Label is what the page shows.
export const DETAIL_FIELDS = [
  ['applies_to',            'Applies to'],
  ['where_and_how_approved','Where and how approved'],
  ['setbacks',              'Setbacks'],
  ['noise',                 'Noise'],
  ['water_and_cooling',     'Water and cooling'],
  ['energy',                'Energy'],
  ['nuclear',               'Nuclear'],
  ['studies_and_who_pays',  'Studies and who pays'],
];

const safeUrl = (u) => (/^https?:\/\//i.test(u) ? u : null);

const hostOf = (u) => {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; }
};

// source_outlets is "A; B" and source_urls is space-separated, in the same
// order. If the counts ever disagree, unmatched URLs fall back to their host.
function pairSources(outlets, urls) {
  const names = outlets.split(/\s*;\s*/).filter(Boolean);
  const links = urls.split(/\s+/).map(safeUrl).filter(Boolean);
  return links.map((url, i) => ({
    url,
    label: names.length === links.length ? names[i] : (names[i] ?? hostOf(url)),
  }));
}

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

export function parseRules(text) {
  const { data } = Papa.parse(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
    transform: (v) => (typeof v === 'string' ? v.trim() : v),
  });
  return data
    .filter((r) => r.jurisdiction)
    .map((r, i) => ({
      ...r,
      id: i,
      isCounty: (r.jurisdiction_type ?? '').toLowerCase() === 'county',
      countyKey: countyKey(r.county),
      sources: pairSources(r.source_outlets ?? '', r.source_urls ?? ''),
      // City, village and town dots are placed from these. A row without them
      // falls back to its county's centre.
      lat: num(r.lat ?? r.latitude),
      lon: num(r.lon ?? r.lng ?? r.longitude),
    }));
}

export async function loadRules() {
  const res = await fetch(RULES_CSV, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${RULES_CSV} (${res.status})`);
  return parseRules(await res.text());
}

/* ---------- Dates ---------- */

const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

// The CSV writes dates loosely ("May 2026", "Apr 27, 2026", "About May 2027",
// "Mid-April 2027"). Pull out the first month+year (optionally a day) for
// sorting. Text with no year ("End date not stated") returns null and sorts last.
export function looseDate(s) {
  const t = String(s ?? '');
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(t);
  if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3]);
  const m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:(\d{1,2})(?:st|nd|rd|th)?,?\s+)?(\d{4})\b/i.exec(t);
  if (m) return Date.UTC(+m[3], MONTHS.indexOf(m[1].toLowerCase()), m[2] ? +m[2] : 1);
  const season = /\b(spring|summer|fall|autumn|winter)\s+(\d{4})\b/i.exec(t);
  if (season) {
    const month = { spring: 2, summer: 5, fall: 8, autumn: 8, winter: 11 }[season[1].toLowerCase()];
    return Date.UTC(+season[2], month, 1);
  }
  const y = /\b(20\d{2})\b/.exec(t);
  return y ? Date.UTC(+y[1], 0, 1) : null;
}

export function formatIsoDate(s) {
  const t = looseDate(s);
  if (t == null || !/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return s || '—';
  return new Date(t).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

/* ---------- Counties ---------- */

// "LaSalle" / "La Salle County" / "St. Clair" / "Saint Clair" all match.
export const countyKey = (name) =>
  String(name ?? '')
    .toLowerCase()
    .replace(/\bcounty\b/g, '')
    .replace(/\bst\.?\s/g, 'saint ')
    .replace(/[^a-z]/g, '');

function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return a / 2;
}

// Area-weighted centroid of the largest polygon's outer ring. Used to label a
// county and as the fallback spot for a city dot with no lat/lon.
export function centroid(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const ring = polys
    .map((p) => p[0])
    .reduce((best, r) => (Math.abs(ringArea(r)) > Math.abs(ringArea(best)) ? r : best));
  const a = ringArea(ring);
  let cx = 0, cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    cx += (ring[j][0] + ring[i][0]) * f;
    cy += (ring[j][1] + ring[i][1]) * f;
  }
  return [cx / (6 * a), cy / (6 * a)];
}

/* ---------- City locations ---------- */

// A [lon, lat] for every non-county row, straight from the CSV's lat/lon
// columns. A row missing them (or with a typo that fails to parse) still gets a
// dot, at its county's centre, and the popup says the spot is approximate.
export function locateCities(rows, countyByKey) {
  const out = new Map();
  rows.filter((r) => !r.isCounty).forEach((r) => {
    if (r.lat != null && r.lon != null) {
      out.set(r.id, { coords: [r.lon, r.lat], approx: false });
      return;
    }
    const c = countyByKey.get(r.countyKey);
    if (c) out.set(r.id, { coords: c.center, approx: true });
  });
  return out;
}
