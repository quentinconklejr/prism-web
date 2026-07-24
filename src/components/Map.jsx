import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const DISPLAY_EXCLUDED = new Set(['26083','25019','25007','15005']);

// Wide sequential scale: #f0f4ff (near-white periwinkle) → #1e3a5f (deep navy)
function scoreToColor(score, min, max) {
  if (score == null) return 'rgba(0,0,0,0)';
  const t = max === min ? 0.5 : Math.max(0, Math.min(1, (score - min) / (max - min)));
  const r = Math.round(240 - t * 210);  // 240 → 30
  const g = Math.round(244 - t * 186);  // 244 → 58
  const b = Math.round(255 - t * 160);  // 255 → 95
  return `rgb(${r},${g},${b})`;
}

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

      // Background county fill — warm gray for filtered-out counties
      map.addLayer({
        id: 'county-bg',
        type: 'fill',
        source: 'counties',
        paint: { 'fill-color': '#f0eeeb', 'fill-opacity': 0.88 },
      });

      // Subtle county borders in background
      map.addLayer({
        id: 'county-bg-line',
        type: 'line',
        source: 'counties',
        paint: { 'line-color': '#e0e0e0', 'line-width': 0.5 },
      });

      // Scored county fills — colors set dynamically
      map.addLayer({
        id: 'county-scored',
        type: 'fill',
        source: 'counties',
        paint: { 'fill-color': '#e2e8f0', 'fill-opacity': 0 },
      });

      // Coal overlay (violet border)
      map.addLayer({
        id: 'county-coal',
        type: 'line',
        source: 'counties',
        filter: ['in', ['get', 'GEOID'], ['literal', []]],
        paint: { 'line-color': '#7c3aed', 'line-width': 2.0, 'line-opacity': 0.85 },
      });

      // Pareto outline — subtle amber/gold
      map.addLayer({
        id: 'county-pareto',
        type: 'line',
        source: 'counties',
        filter: ['in', ['get', 'GEOID'], ['literal', []]],
        paint: { 'line-color': '#d4a843', 'line-width': 1, 'line-opacity': 0.6 },
      });

      // Selected county — white halo for contrast against any fill color
      map.addLayer({
        id: 'county-selected-halo',
        type: 'line',
        source: 'counties',
        filter: ['==', ['get', 'GEOID'], ''],
        paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.85 },
      });

      // Selected county — blue ring on top of halo
      map.addLayer({
        id: 'county-selected',
        type: 'line',
        source: 'counties',
        filter: ['==', ['get', 'GEOID'], ''],
        paint: { 'line-color': '#2563eb', 'line-width': 3 },
      });

      // State borders — dark slate, visually dominant on light map
      map.addLayer({
        id: 'state-borders',
        type: 'line',
        source: 'states',
        paint: { 'line-color': '#475569', 'line-width': 1.2, 'line-opacity': 0.75 },
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
    const scores = activeRows.map((r) => r[scoreCol]).filter((v) => v != null);
    const mn = scores.length ? Math.min(...scores) : 0;
    const mx = scores.length ? Math.max(...scores) : 1;

    const matchArgs = ['match', ['get', 'GEOID']];
    activeRows.forEach((r) => {
      const raw = r[scoreCol] ?? null;
      const display = showCoal && r.has_coal_plant && raw != null
        ? Math.min(raw + 0.05, 1.0) : raw;
      matchArgs.push(r.geoid, scoreToColor(display, mn, mx));
    });
    matchArgs.push('#f0eeeb'); // warm gray for counties outside active filter

    map.setPaintProperty('county-scored', 'fill-color', matchArgs);
    map.setPaintProperty('county-scored', 'fill-opacity', 0.82);

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
