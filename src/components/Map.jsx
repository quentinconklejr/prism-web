import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const DISPLAY_EXCLUDED = new Set(['26083','25019','25007','15005']);

// FIPS → state abbreviation for the label layer (state GeoJSON has only state_fips)
const FIPS_ABBR = ['match', ['get', 'state_fips'],
  '01','AL', '02','AK', '04','AZ', '05','AR', '06','CA',
  '08','CO', '09','CT', '10','DE', '11','DC', '12','FL',
  '13','GA', '15','HI', '16','ID', '17','IL', '18','IN',
  '19','IA', '20','KS', '21','KY', '22','LA', '23','ME',
  '24','MD', '25','MA', '26','MI', '27','MN', '28','MS',
  '29','MO', '30','MT', '31','NE', '32','NV', '33','NH',
  '34','NJ', '35','NM', '36','NY', '37','NC', '38','ND',
  '39','OH', '40','OK', '41','OR', '42','PA', '44','RI',
  '45','SC', '46','SD', '47','TN', '48','TX', '49','UT',
  '50','VT', '51','VA', '53','WA', '54','WV', '55','WI', '56','WY',
  '',
];

// ColorBrewer YlGn 6-class — perceptually uniform, colorblind-safe.
// Low score (worst site) → pale yellow, high score (best site) → deep green.
const YLGN_STOPS = [
  '#ffffcc',
  '#d9f0a3',
  '#addd8e',
  '#78c679',
  '#31a354',
  '#006837',
];

// Neutral light gray for counties with no score (filtered out / no data)
const NO_DATA_COLOR = '#f0f0f0';

function prepareCountyGeo(raw) {
  return {
    ...raw,
    features: raw.features
      .filter((f) => !DISPLAY_EXCLUDED.has(String(f.id)))
      .map((f) => ({
        ...f,
        id: String(f.id),
        properties: { ...f.properties, GEOID: String(f.id) },
      })),
  };
}

export default function Map({
  countyGeojson,
  stateGeojson,
  activeRows,
  reactorMode,
  scoreCol,
  showCoal,
  coalLookup,
  selectedGeoid,
  onSelectGeoid,
}) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const popupRef     = useRef(null);
  const readyRef     = useRef(false);

  const activeRef     = useRef(activeRows);
  const scoreColRef   = useRef(scoreCol);
  const reactorRef    = useRef(reactorMode);
  const showCoalRef   = useRef(showCoal);
  const coalRef       = useRef(coalLookup);
  const selectedRef   = useRef(selectedGeoid);
  activeRef.current   = activeRows;
  scoreColRef.current = scoreCol;
  reactorRef.current  = reactorMode;
  showCoalRef.current = showCoal;
  coalRef.current     = coalLookup;
  selectedRef.current = selectedGeoid;

  useEffect(() => {
    if (!countyGeojson || !stateGeojson || mapRef.current) return;

    const prepared = prepareCountyGeo(countyGeojson);

    let map;
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-96, 39.5],
        zoom: 3.5,
        projection: 'mercator',
      });
    } catch (err) {
      console.error('Mapbox init failed:', err.message);
      return;
    }
    mapRef.current = map;
    popupRef.current = new mapboxgl.Popup({
      closeButton: false,
      closeOnMove: true,
      maxWidth: '260px',
    });

    map.on('load', () => {
      map.addSource('counties', { type: 'geojson', data: prepared, promoteId: 'GEOID' });
      map.addSource('states',   { type: 'geojson', data: stateGeojson });

      // Remove non-US label clutter (Canada, Mexico cities; country name labels)
      const usOnlyFilter = ['==', ['get', 'iso_3166_1_alpha_2'], 'US'];
      [
        'settlement-label',
        'settlement-subdivision-label',
        'state-label',
      ].forEach((lyr) => {
        try { if (map.getLayer(lyr)) map.setFilter(lyr, usOnlyFilter); } catch (_) {}
      });
      ['country-label'].forEach((lyr) => {
        try { if (map.getLayer(lyr)) map.setLayoutProperty(lyr, 'visibility', 'none'); } catch (_) {}
      });

      // Find first basemap label layer so our data layers insert below it
      const firstLabelId = map.getStyle().layers.find(
        (l) => l.type === 'symbol' && l.id && l.id.includes('label')
      )?.id;

      // Background county fill — neutral light gray for filtered-out / no-data counties
      map.addLayer({
        id: 'county-bg',
        type: 'fill',
        source: 'counties',
        paint: { 'fill-color': NO_DATA_COLOR, 'fill-opacity': 0.9 },
      }, firstLabelId);

      // Subtle county borders in background
      map.addLayer({
        id: 'county-bg-line',
        type: 'line',
        source: 'counties',
        paint: { 'line-color': '#e0e0e0', 'line-width': 0.5 },
      }, firstLabelId);

      // Scored county fills — colors set dynamically
      map.addLayer({
        id: 'county-scored',
        type: 'fill',
        source: 'counties',
        paint: { 'fill-color': '#e2e8f0', 'fill-opacity': 0 },
      }, firstLabelId);

      // Coal overlay (violet border)
      map.addLayer({
        id: 'county-coal',
        type: 'line',
        source: 'counties',
        filter: ['in', ['get', 'GEOID'], ['literal', []]],
        paint: { 'line-color': '#7c3aed', 'line-width': 2.0, 'line-opacity': 0.85 },
      }, firstLabelId);

      // Pareto outline — subtle amber/gold
      map.addLayer({
        id: 'county-pareto',
        type: 'line',
        source: 'counties',
        filter: ['in', ['get', 'GEOID'], ['literal', []]],
        paint: { 'line-color': '#d4a843', 'line-width': 1, 'line-opacity': 0.6 },
      }, firstLabelId);

      // Selected county — white halo for contrast against any fill color
      map.addLayer({
        id: 'county-selected-halo',
        type: 'line',
        source: 'counties',
        filter: ['==', ['get', 'GEOID'], ''],
        paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.85 },
      }, firstLabelId);

      // Selected county — blue ring on top of halo
      map.addLayer({
        id: 'county-selected',
        type: 'line',
        source: 'counties',
        filter: ['==', ['get', 'GEOID'], ''],
        paint: { 'line-color': '#2563eb', 'line-width': 3 },
      }, firstLabelId);

      // State borders — dark slate, visually dominant on light map
      map.addLayer({
        id: 'state-borders',
        type: 'line',
        source: 'states',
        paint: { 'line-color': '#475569', 'line-width': 1.2, 'line-opacity': 0.75 },
      }, firstLabelId);

      // State name labels — added last so they render above all fill layers
      map.addLayer({
        id: 'state-labels-custom',
        type: 'symbol',
        source: 'states',
        minzoom: 2,
        layout: {
          'text-field': FIPS_ABBR,
          'text-font': ['DIN Pro Regular', 'Arial Unicode MS Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 3, 9, 5, 11, 7, 14],
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.08,
          'text-max-width': 6,
          'symbol-spacing': 400,
        },
        paint: {
          'text-color': '#374151',
          'text-halo-color': 'rgba(255,255,255,0.9)',
          'text-halo-width': 1.5,
          // fade out as zoom increases — city labels take over
          'text-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0.85, 6, 1.0, 7.5, 0.4, 8.5, 0],
        },
      });

      // Hover popup
      map.on('mousemove', 'county-scored', (e) => {
        const geoid = e.features[0]?.properties?.GEOID;
        if (!geoid) return;
        const row = activeRef.current.find((r) => r.geoid === geoid);
        if (!row) return;

        const sc    = scoreColRef.current;
        const mode  = reactorRef.current;
        const label = mode === 'LWR' ? 'MCDA Score' : 'SMR Score';
        const coalMw  = row.has_coal_plant
          ? `<br/><span style="color:#7c3aed">Coal: ${(row.coal_capacity_mw ?? 0).toFixed(0)} MW</span>` : '';
        const pareto  = row.on_nsga2_pareto && mode === 'LWR'
          ? `<br/><span style="color:#d97706;font-weight:600">★ Pareto-Optimal</span>` : '';

        popupRef.current
          .setLngLat(e.lngLat)
          .setHTML(
            `<span style="font-weight:600;color:#1e293b">${row.county_name}, ${row.state}</span><br/>` +
            `${label}: <b>${row[sc]?.toFixed(3) ?? 'N/A'}</b><br/>` +
            `Seismic: ${(row.pga_max ?? 0).toFixed(3)} g<br/>` +
            `Flood: ${((row.pct_sfha ?? 0) * 100).toFixed(1)}% SFHA<br/>` +
            `Pop: ${(row.population_density ?? 0).toFixed(1)} /km²` +
            pareto + coalMw
          )
          .addTo(map);
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'county-scored', () => {
        popupRef.current.remove();
        map.getCanvas().style.cursor = '';
      });

      map.on('click', 'county-scored', (e) => {
        const geoid = e.features[0]?.properties?.GEOID;
        if (geoid) onSelectGeoid(geoid);
      });

      map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['county-scored'] });
        if (!features.length) onSelectGeoid(null);
      });

      readyRef.current = true;
      applyPaint(map, activeRef.current, scoreColRef.current, showCoalRef.current, coalRef.current, reactorRef.current, selectedRef.current);
    });

    return () => { map.remove(); mapRef.current = null; readyRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countyGeojson, stateGeojson]);

  useEffect(() => {
    if (!mapRef.current || !readyRef.current) return;
    applyPaint(mapRef.current, activeRows, scoreCol, showCoal, coalLookup, reactorMode, selectedGeoid);
  }, [activeRows, scoreCol, showCoal, coalLookup, reactorMode, selectedGeoid]);

  return <div ref={containerRef} className="w-full h-full" />;
}

function applyPaint(map, activeRows, scoreCol, showCoal, coalLookup, reactorMode, selectedGeoid) {
  try {
    // Clear stale per-feature scores from previous filter / mode
    map.removeFeatureState({ source: 'counties' });

    // Compute score range from currently-active rows (max visual contrast under filter)
    const scores = activeRows.map((r) => r[scoreCol]).filter((v) => v != null);
    const mn = scores.length ? Math.min(...scores) : 0;
    const mx = scores.length ? Math.max(...scores) : 1;
    const range = Math.max(mx - mn, 1e-9);

    // Attach each active county's score (with optional coal bump) to feature-state.
    // The fill-color expression then reads feature-state.score via interpolate.
    activeRows.forEach((r) => {
      const raw = r[scoreCol];
      if (raw == null) return;
      const bumped = showCoal && r.has_coal_plant
        ? Math.min(raw + 0.05, 1.0)
        : raw;
      map.setFeatureState({ source: 'counties', id: r.geoid }, { score: bumped });
    });

    // Interpolate the YlGn ramp across 6 evenly-spaced stops from mn → mx.
    // Counties without a feature-state score render fully transparent (revealing county-bg).
    const scoreExpr = ['number', ['feature-state', 'score'], -1];
    map.setPaintProperty('county-scored', 'fill-color', [
      'interpolate', ['linear'], scoreExpr,
      -1,                 NO_DATA_COLOR,
      mn,                 YLGN_STOPS[0],
      mn + range * 0.2,   YLGN_STOPS[1],
      mn + range * 0.4,   YLGN_STOPS[2],
      mn + range * 0.6,   YLGN_STOPS[3],
      mn + range * 0.8,   YLGN_STOPS[4],
      mn + range,         YLGN_STOPS[5],
    ]);
    map.setPaintProperty('county-scored', 'fill-opacity', 0.85);

    const paretoIds = reactorMode === 'LWR'
      ? activeRows.filter((r) => r.on_nsga2_pareto).map((r) => r.geoid)
      : [];
    map.setFilter('county-pareto', ['in', ['get', 'GEOID'], ['literal', paretoIds]]);

    const coalIds = showCoal && coalLookup ? Object.keys(coalLookup) : [];
    map.setFilter('county-coal', ['in', ['get', 'GEOID'], ['literal', coalIds]]);

    const selFilter = selectedGeoid
      ? ['==', ['get', 'GEOID'], selectedGeoid]
      : ['==', ['get', 'GEOID'], ''];
    map.setFilter('county-selected-halo', selFilter);
    map.setFilter('county-selected', selFilter);
  } catch (_) {
    // style not yet ready
  }
}
