import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { statusInfo, statusRank } from './rules';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

// Illinois plus a little room east of the lakefront, so Chicago-area labels
// are not clipped at the edge.
const IL_BOUNDS = [[-91.52, 36.97], [-87.1, 42.51]];
const NO_ACTION_COLOR = '#f8fafc';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function rowHtml(r) {
  const s = statusInfo(r.status);
  const when = [r.since && `Since ${esc(r.since)}`, r.ends_or_next_step && esc(r.ends_or_next_step)]
    .filter(Boolean).join(' · ');
  return (
    `<div style="margin-top:6px">` +
      `<div style="font-weight:600;color:#1e293b">${esc(r.jurisdiction)}` +
        ` <span style="font-weight:400;color:#64748b">${esc(r.jurisdiction_type)}</span></div>` +
      `<div style="display:flex;align-items:center;gap:6px;color:#334155">` +
        `<span style="width:9px;height:9px;border-radius:9999px;background:${s.color};flex:none"></span>${esc(s.label)}</div>` +
      (r.action ? `<div style="color:#334155">${esc(r.action)}</div>` : '') +
      (when ? `<div style="color:#64748b">${when}</div>` : '') +
    `</div>`
  );
}

// County fill = what the county government did. City dots = what a city,
// village or town did. A city's pause does not cover its county, so the two
// are kept apart on the map rather than letting Chicago shade all of Cook.
function buildCountyData(counties, rows) {
  const byCounty = new Map();
  rows.forEach((r) => {
    const k = r.countyKey;
    if (!byCounty.has(k)) byCounty.set(k, []);
    byCounty.get(k).push(r);
  });
  return {
    type: 'FeatureCollection',
    features: counties.map((c) => {
      const here = byCounty.get(c.key) ?? [];
      const own = here.filter((r) => r.isCounty).sort((a, b) => statusRank(a.status) - statusRank(b.status));
      return {
        type: 'Feature',
        id: c.geoid,
        geometry: c.geometry,
        properties: {
          GEOID: c.geoid,
          name: c.name,
          color: own.length ? statusInfo(own[0].status).color : NO_ACTION_COLOR,
          hasAction: own.length > 0,
          rowIds: JSON.stringify(here.map((r) => r.id)),
        },
      };
    }),
  };
}

function buildCityData(rows, cityLocations) {
  return {
    type: 'FeatureCollection',
    features: rows
      .filter((r) => !r.isCounty && cityLocations.has(r.id))
      .map((r) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: cityLocations.get(r.id).coords },
        properties: {
          rowId: r.id,
          name: r.jurisdiction,
          color: statusInfo(r.status).color,
          // Draw stronger statuses on top where dots overlap.
          sortKey: -statusRank(r.status),
        },
      })),
  };
}

export default function RulesMap({ counties, rows, cityLocations }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const readyRef = useRef(false);
  const dataRef = useRef({ counties, rows, cityLocations });
  dataRef.current = { counties, rows, cityLocations };

  useEffect(() => {
    if (mapRef.current) return;
    let map;
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        bounds: IL_BOUNDS,
        fitBoundsOptions: { padding: 16 },
        projection: 'mercator',
        // The map sits in a scrolling page. Without this a phone user swiping
        // down the page gets stuck panning the map instead.
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        minZoom: 4.5,
        maxZoom: 11,
      });
    } catch (err) {
      console.error('Mapbox init failed:', err.message);
      return;
    }
    map.touchZoomRotate.disableRotation();
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: false, maxWidth: '280px' });

    // Refit when the card gets wider or narrower (rotating a phone, resizing a
    // window). Height-only changes are ignored so a phone's toolbar sliding in
    // and out does not throw away the reader's zoom.
    let lastWidth = containerRef.current.clientWidth;
    const ro = new ResizeObserver(() => {
      map.resize();
      const w = containerRef.current?.clientWidth ?? lastWidth;
      if (w !== lastWidth) {
        lastWidth = w;
        map.fitBounds(IL_BOUNDS, { padding: 16, animate: false });
      }
    });
    ro.observe(containerRef.current);

    map.on('load', () => {
      // Basemap city names would double up with ours and crowd the dots.
      ['settlement-label', 'settlement-subdivision-label', 'settlement-major-label', 'settlement-minor-label']
        .forEach((id) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); });

      const firstLabelId = map.getStyle().layers.find(
        (l) => l.type === 'symbol' && l.id && l.id.includes('label')
      )?.id;

      const { counties: cs, rows: rs, cityLocations: cl } = dataRef.current;
      map.addSource('il-counties', { type: 'geojson', data: buildCountyData(cs, rs), promoteId: 'GEOID' });
      map.addSource('il-cities', { type: 'geojson', data: buildCityData(rs, cl) });

      map.addLayer({
        id: 'il-county-fill',
        type: 'fill',
        source: 'il-counties',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['case', ['get', 'hasAction'], 0.8, 0.9],
        },
      }, firstLabelId);
      map.addLayer({
        id: 'il-county-line',
        type: 'line',
        source: 'il-counties',
        paint: { 'line-color': '#94a3b8', 'line-width': 0.6 },
      }, firstLabelId);
      map.addLayer({
        id: 'il-county-hover',
        type: 'line',
        source: 'il-counties',
        paint: {
          'line-color': '#1e293b',
          'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2, 0],
        },
      }, firstLabelId);
      map.addLayer({
        id: 'il-county-label',
        type: 'symbol',
        source: 'il-counties',
        filter: ['get', 'hasAction'],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 8, 12],
          'text-max-width': 6,
        },
        paint: { 'text-color': '#1e293b', 'text-halo-color': 'rgba(255,255,255,0.85)', 'text-halo-width': 1.2 },
      });
      map.addLayer({
        id: 'il-city-label',
        type: 'symbol',
        source: 'il-cities',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 9, 13],
          'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
          'text-radial-offset': 0.8,
          'text-justify': 'auto',
        },
        paint: { 'text-color': '#0f172a', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
      });
      // Dots go above every label so a neighbour's name can never hide one.
      map.addLayer({
        id: 'il-city-dot',
        type: 'circle',
        source: 'il-cities',
        layout: { 'circle-sort-key': ['get', 'sortKey'] },
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 5, 9, 8],
          'circle-stroke-color': '#1e293b',
          'circle-stroke-width': 1.5,
        },
      });

      let hovered = null;
      const setHover = (id) => {
        if (hovered === id) return;
        if (hovered != null) map.setFeatureState({ source: 'il-counties', id: hovered }, { hover: false });
        hovered = id;
        if (id != null) map.setFeatureState({ source: 'il-counties', id }, { hover: true });
      };

      const byId = (id) => dataRef.current.rows.find((r) => r.id === id);

      const show = (e) => {
        const city = map.queryRenderedFeatures(e.point, { layers: ['il-city-dot'] })[0];
        if (city) {
          const r = byId(city.properties.rowId);
          const approx = dataRef.current.cityLocations.get(r?.id)?.approx;
          if (!r) return;
          popup.setLngLat(city.geometry.coordinates)
            .setHTML(
              `<div style="color:#64748b">${esc(r.county)} County</div>` + rowHtml(r) +
              (approx ? `<div style="margin-top:4px;color:#94a3b8;font-size:11px">Location approximate (county center)</div>` : '')
            )
            .addTo(map);
          setHover(null);
          return;
        }
        const county = map.queryRenderedFeatures(e.point, { layers: ['il-county-fill'] })[0];
        if (!county) { popup.remove(); setHover(null); return; }
        setHover(county.id);
        const ids = JSON.parse(county.properties.rowIds);
        const here = ids.map(byId).filter(Boolean)
          .sort((a, b) => Number(b.isCounty) - Number(a.isCounty) || statusRank(a.status) - statusRank(b.status));
        popup.setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-weight:600;color:#1e293b">${esc(county.properties.name)} County</div>` +
            (here.length ? here.map(rowHtml).join('') : `<div style="color:#64748b">No action tracked</div>`)
          )
          .addTo(map);
      };

      // Hover on a mouse, tap on a phone — same popup either way.
      const canHover = window.matchMedia('(hover: hover)').matches;
      if (canHover) {
        map.on('mousemove', (e) => {
          const hit = map.queryRenderedFeatures(e.point, { layers: ['il-city-dot', 'il-county-fill'] }).length;
          map.getCanvas().style.cursor = hit ? 'pointer' : '';
          show(e);
        });
        map.on('mouseout', () => { popup.remove(); setHover(null); });
      }
      map.on('click', show);

      readyRef.current = true;
    });

    return () => { ro.disconnect(); map.remove(); mapRef.current = null; readyRef.current = false; };
  }, []);

  // Data changes update the sources in place.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.getSource('il-counties')?.setData(buildCountyData(counties, rows));
    map.getSource('il-cities')?.setData(buildCityData(rows, cityLocations));
  }, [counties, rows, cityLocations]);

  return <div ref={containerRef} className="w-full h-full" />;
}
