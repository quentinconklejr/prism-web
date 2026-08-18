import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const CANDIDATES = './public/data/candidates_ranked.csv';
const PARETO     = './public/data/pareto_front.csv';
const OUTPUT     = './data/scored_counties.json';

// src/useData.js:58-69
const fipsToState = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO',
  '09':'CT','10':'DE','11':'DC','12':'FL','13':'GA','15':'HI',
  '16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY',
  '22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN',
  '28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH',
  '34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH',
  '40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD',
  '47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA',
  '54':'WV','55':'WI','56':'WY','60':'AS','66':'GU','69':'MP',
  '72':'PR','78':'VI',
};

function parseCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;
}

// src/useData.js:101-109 — exact copy
function normMinMax(arr) {
  const nums = arr.filter((v) => v != null && isFinite(v));
  if (nums.length === 0) return arr.map(() => null);
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const span = hi - lo;
  return arr.map((v) =>
    v == null || !isFinite(v) || span === 0 ? null : (v - lo) / span
  );
}

const candidates = parseCsv(CANDIDATES);
const paretoRaw  = parseCsv(PARETO);

const normGeoid = (v) => String(v ?? '').padStart(5, '0');
const paretoMap = {};
paretoRaw.forEach((r) => { paretoMap[normGeoid(r.geo_id)] = r; });

const merged = candidates.map((r) => {
  const geoid = normGeoid(r.geo_id);
  const p = paretoMap[geoid] ?? {};
  return {
    ...r,
    geoid,
    state:             fipsToState[geoid.slice(0, 2)] ?? '',
    // Pre-computed by upstream Python pipeline; formula not in this repo
    norm_seismic_risk: p.norm_seismic_risk ?? null,
    norm_flood_risk:   p.norm_flood_risk   ?? null,
    norm_water_access: p.norm_water_access  ?? null,
    // norm_grid_connectivity from pareto_front.csv is near-zero for all counties
    // (heavily right-skewed max_voltage distribution); recomputed below via normMinMax
    // like src/useData.js:113 to match what the app displays.
    norm_pop_density:       null,
    norm_grid_connectivity: null,
    norm_energy_demand:     null,
  };
});

// src/useData.js:112-119 — exact same columns and formula as the live app
const normPop    = normMinMax(merged.map((r) => r.population_density));
const normGrid   = normMinMax(merged.map((r) => r.max_voltage));
const normEnergy = normMinMax(merged.map((r) => r.total_energy_consumption_mwh));
merged.forEach((r, i) => {
  r.norm_pop_density       = normPop[i];
  r.norm_grid_connectivity = normGrid[i];
  r.norm_energy_demand     = normEnergy[i];
});

const nullAll = merged.filter((r) =>
  r.norm_seismic_risk == null &&
  r.norm_flood_risk   == null &&
  r.norm_pop_density  == null &&
  r.norm_water_access == null &&
  r.norm_grid_connectivity == null &&
  r.norm_energy_demand     == null
);

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(merged));
console.log(`wrote ${merged.length} records -> ${OUTPUT}`);
if (nullAll.length > 0) {
  console.warn(`WARNING: ${nullAll.length} counties have null in all six score fields`);
} else {
  console.log('all counties have at least one non-null score field');
}
