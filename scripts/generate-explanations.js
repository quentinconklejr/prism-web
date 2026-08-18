import fs from 'fs';
import path from 'path';

// ============================================================
// CONFIG
// ============================================================

const SCORES_PATH = './data/scored_counties.json';
const OUTPUT_PATH = './public/explanations.json';
const LIMIT       = Infinity;

// ============================================================
// NORMALIZE
// ============================================================

function normalize(raw) {
  const lakeDist  = +(raw.dist_to_lakes_km      ?? 999);
  const riverDist = +(raw.distance_to_rivers_km  ?? 999);
  const nearest   = Math.min(lakeDist, riverDist);
  return {
    id:        raw.geoid,
    name:      raw.county_name,
    state:     raw.state,
    rank:      Number(raw.rank),
    composite: Number(raw.mcda_score),
    raw_values: {
      pga:     Number(raw.pga_max),
      sfha:    Number(raw.pct_sfha),
      pop:     Number(raw.population_density),
      water:   nearest > 0 && nearest < 500 ? nearest : null,
      voltage: Number(raw.max_voltage),
      energy:  Number(raw.total_energy_consumption_mwh),
    },
  };
}

// ============================================================
// FORMAT HELPERS
// ============================================================

function fmtSfha(n) {
  const pct = (n * 100).toFixed(2);
  if (pct === '0.00') return 'less than 0.01% of county area falls within special flood hazard zones';
  return `${pct}% of county area falls within special flood hazard zones`;
}

function fmtPop(n) {
  const r = Math.round(n);
  return `${r} ${r === 1 ? 'person' : 'people'} per sq km`;
}

function fmtEnergy(n) {
  return Math.round(n).toLocaleString('en-US') + ' MWh';
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ============================================================
// TEMPLATE VARIANTS  (selected by rank % 4)
// ============================================================

function fallback(c) {
  const rv    = c.raw_values;
  const loc   = `${c.name}, ${c.state}`;
  const score = `a composite score of ${c.composite.toFixed(3)}`;
  const pga   = `peak ground acceleration is ${rv.pga.toFixed(2)} g`;
  const sfha  = fmtSfha(rv.sfha);
  const pop   = `population density is ${fmtPop(rv.pop)}`;
  const volt  = `maximum transmission voltage is ${Math.round(rv.voltage)} kV`;
  const nrg   = `annual energy consumption is ${fmtEnergy(rv.energy)}`;

  switch (c.rank % 4) {

    case 0:
      // rank/composite leads → PGA + SFHA → pop
      return {
        text: `${loc} ranks ${c.rank} with ${score}. ${cap(pga)} and ${sfha}. ${cap(pop)}.`,
        factors_cited: ['seismic hazard', 'flood exposure', 'population density'],
        generated: false,
      };

    case 1:
      // pop density leads → rank/composite → PGA + SFHA → voltage
      return {
        text: `At ${fmtPop(rv.pop)}, ${loc} ranks ${c.rank} with ${score}. ${cap(pga)} and ${sfha}. ${cap(volt)}.`,
        factors_cited: ['population density', 'seismic hazard', 'flood exposure', 'grid connectivity'],
        generated: false,
      };

    case 2:
      // PGA + SFHA leads → county + rank/composite → voltage
      return {
        text: `${cap(pga)} and ${sfha}. ${loc} ranks ${c.rank} with ${score}. ${cap(volt)}.`,
        factors_cited: ['seismic hazard', 'flood exposure', 'grid connectivity'],
        generated: false,
      };

    default:
      // voltage + energy leads → rank/composite → PGA + pop
      return {
        text: `${cap(volt)} and ${nrg}. ${loc} ranks ${c.rank} with ${score}. ${cap(pga)} and ${pop}.`,
        factors_cited: ['grid connectivity', 'energy demand', 'seismic hazard', 'population density'],
        generated: false,
      };
  }
}

function explain(c) { return fallback(c); }

// ============================================================
// MAIN
// ============================================================

const EXCLUDE = new Set(['AS', 'GU', 'MP', 'PR', 'VI']);

async function main() {
  const raw = JSON.parse(fs.readFileSync(SCORES_PATH, 'utf8'));
  const list = (Array.isArray(raw) ? raw : Object.values(raw))
    .map(normalize)
    .filter((c) =>
      c.id != null && c.name && !EXCLUDE.has(c.state) &&
      Number.isFinite(c.rank) && c.rank > 0 &&
      Number.isFinite(c.composite) && c.composite > 0
    )
    .sort((a, b) => a.rank - b.rank)
    .slice(0, LIMIT === Infinity ? undefined : LIMIT);

  if (list.length === 0) {
    console.error('normalize() produced zero valid records. Check field names.');
    process.exit(1);
  }

  console.log(`Processing ${list.length} counties...`);

  const done = {};
  list.forEach((c) => {
    done[c.id] = { name: c.name, state: c.state, rank: c.rank, ...explain(c) };
  });

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(done));
  console.log(`Wrote ${OUTPUT_PATH} (${list.length} counties)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
