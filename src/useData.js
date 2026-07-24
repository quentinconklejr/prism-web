import { useState, useEffect } from 'react';
import Papa from 'papaparse';

function parseCsv(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (r) => resolve(r.data),
      error: reject,
    });
  });
}

export function useData() {
  const [state, setState] = useState({
    candidates: null,
    pareto: null,
    coalLookup: null,
    stateGeojson: null,
    countyGeojson: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    async function load() {
      try {
        const [candidates, paretoRaw, coalRaw, stateGeo, countyGeo] = await Promise.all([
          parseCsv('/data/candidates_ranked.csv'),
          parseCsv('/data/pareto_front.csv'),
          parseCsv('/data/coal_counties.csv'),
          fetch('/data/state_boundaries_cartographic.geojson').then((r) => r.json()),
          fetch('https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json').then((r) => r.json()),
        ]);

        // Normalize geoid to zero-padded 5-char string
        const normGeoid = (v) => String(v ?? '').padStart(5, '0');

        candidates.forEach((r) => { r.geoid = normGeoid(r.geo_id); });

        const paretoMap = {};
        paretoRaw.forEach((r) => {
          const g = normGeoid(r.geo_id);
          paretoMap[g] = r;
        });

        // Coal lookup keyed by geoid
        const coalLookup = {};
        coalRaw.forEach((r) => {
          const g = normGeoid(r.geoid);
          coalLookup[g] = { ...r, geoid: g };
        });

        // FIPS → state abbrev (same as Python app)
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

        // Python/pandas writes "True"/"False"; PapaParse dynamicTyping does not convert these.
        const toBool = (v) => {
          if (typeof v === 'boolean') return v;
          if (typeof v === 'number') return v !== 0;
          if (typeof v === 'string') return v.toLowerCase() === 'true';
          return false;
        };

        // Merge pareto columns into candidates
        const NORM_COLS = [
          'norm_seismic_risk','norm_flood_risk','norm_pop_density',
          'norm_water_access','norm_grid_connectivity','norm_energy_demand',
        ];
        const merged = candidates.map((r) => {
          const p = paretoMap[r.geoid] ?? {};
          const state = fipsToState[r.geoid.slice(0, 2)] ?? '';
          return {
            ...r,
            state,
            on_nsga2_pareto: toBool(p.on_nsga2_pareto),
            on_both_fronts: toBool(p.on_both_fronts),
            has_coal_plant: !!coalLookup[r.geoid],
            coal_capacity_mw: coalLookup[r.geoid]?.coal_capacity_mw ?? 0,
            ...NORM_COLS.reduce((acc, c) => { acc[c] = p[c] ?? null; return acc; }, {}),
          };
        });

        setState({
          candidates: merged,
          coalLookup,
          stateGeojson: stateGeo,
          countyGeojson: countyGeo,
          error: null,
          loading: false,
        });
      } catch (e) {
        setState((s) => ({ ...s, error: String(e), loading: false }));
      }
    }
    load();
  }, []);

  return state;
}
