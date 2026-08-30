import { useState, useMemo, useEffect } from 'react';
import { useData } from './useData';
import { computeSmrScores } from './scoring';
import Sidebar from './components/Sidebar';
import MetricsBar from './components/MetricsBar';
import Map from './components/Map';
import DetailPanel from './components/DetailPanel';
import CandidatesTable from './components/CandidatesTable';
import { COST_RAMP, costScore } from './cost';

// Below this width the map and the panels cannot sit side by side without
// squeezing the map, so controls and results move into overlays. Matches the
// `lg:` breakpoint used throughout the markup.
const LG = 1024;

export default function App() {
  const [reactorMode, setReactorMode]   = useState('LWR');
  const [mapLayer,    setMapLayer]      = useState('suitability');
  const [costWeight,  setCostWeight]    = useState(0);   // percent; 0 = pure suitability
  const [pgaFilter,   setPgaFilter]     = useState(0.30);
  const [sfhaFilter,  setSfhaFilter]    = useState(20);
  const [popFilter,   setPopFilter]     = useState(10000);
  const [paretoOnly,  setParetoOnly]    = useState(false);
  const [showCoal,    setShowCoal]      = useState(false);
  const [selectedGeoid, setSelectedGeoid] = useState(null);

  // Overlay state, only meaningful below lg
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sheetOpen,   setSheetOpen]   = useState(false);
  const [sheetTab,    setSheetTab]    = useState('table');

  const { candidates, coalLookup, stateGeojson, countyGeojson, loading, error } = useData();

  const handleSetReactorMode = (m) => {
    setReactorMode(m);
    setPgaFilter(m !== 'LWR' ? 0.50 : 0.30);
    if (m !== 'LWR') setParetoOnly(false);
  };

  // Picking a county below lg should surface its profile, which lives in an
  // overlay there rather than beside the map.
  const handleSelectGeoid = (geoid) => {
    setSelectedGeoid(geoid);
    if (geoid && window.innerWidth < LG) {
      setSheetTab('detail');
      setSheetOpen(true);
    }
  };

  // Overlays are a small-screen affordance; leaving them latched while the
  // window grows into the desktop layout would double up the panels.
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= LG) { setFiltersOpen(false); setSheetOpen(false); }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setFiltersOpen(false); setSheetOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => {
    if (!candidates) return [];
    const sfhaDecimal = sfhaFilter / 100;
    let rows = candidates.filter(
      (r) =>
        (r.pga_max ?? 0) <= pgaFilter &&
        (r.pct_sfha ?? 0) <= sfhaDecimal &&
        (r.population_density ?? 0) <= popFilter
    );
    if (paretoOnly && reactorMode === 'LWR') {
      rows = rows.filter((r) => r.on_nsga2_pareto);
    }
    return rows;
  }, [candidates, pgaFilter, sfhaFilter, popFilter, paretoOnly, reactorMode]);

  const modeRows = useMemo(() => {
    if (reactorMode === 'LWR') return filtered;
    const scored = computeSmrScores(filtered, reactorMode);
    return scored.filter((r) => r.smr_score != null);
  }, [filtered, reactorMode]);

  const baseScoreCol = reactorMode === 'LWR' ? 'mcda_score' : 'smr_score';

  // Optional cost blend. At the default weight of 0 this is a no-op and the rows
  // pass through untouched, so the baseline ranking is exactly what it was before
  // the cost layer existed. Counties with no cost data drop out of the blended
  // view rather than being imputed — there is no honest way to blend a number we
  // do not have.
  const activeRows = useMemo(() => {
    if (costWeight === 0) return modeRows;
    const w = costWeight / 100;
    return modeRows.flatMap((r) => {
      const base = r[baseScoreCol];
      const cs   = costScore(r.location_factor);
      if (base == null || cs == null) return [];
      return [{ ...r, blended_score: (1 - w) * base + w * cs }];
    });
  }, [modeRows, costWeight, baseScoreCol]);

  const scoreCol   = costWeight > 0 ? 'blended_score' : baseScoreCol;
  const scoreLabel = costWeight > 0
    ? `Blended (${costWeight}% cost)`
    : reactorMode === 'LWR'
    ? (showCoal ? 'MCDA (+coal)' : 'MCDA Score')
    : (showCoal ? 'SMR (+coal)'  : 'SMR Score');

  const rankMax = useMemo(() => {
    if (!candidates?.length) return null;
    return Math.max(...candidates.map((r) => r.rank ?? 0));
  }, [candidates]);

  const selectedRow = useMemo(() => {
    if (!selectedGeoid) return null;
    return (
      activeRows.find((r) => r.geoid === selectedGeoid) ??
      candidates?.find((r) => r.geoid === selectedGeoid) ??
      null
    );
  }, [selectedGeoid, activeRows, candidates]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-[100dvh] text-red-600 text-sm px-8 text-center bg-slate-50">
        <div className="bg-white border border-red-200 rounded-lg px-6 py-5 shadow-sm max-w-md">
          <p className="font-semibold text-red-700 mb-1">Error loading data</p>
          <p className="text-slate-500 text-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] text-slate-500 gap-3 bg-slate-50">
        <div className="prism-spinner w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        <p className="text-sm font-medium text-slate-600">Loading PRISM data…</p>
      </div>
    );
  }

  const tableEl = (
    <CandidatesTable
      activeRows={activeRows}
      reactorMode={reactorMode}
      scoreCol={scoreCol}
      scoreLabel={scoreLabel}
      showCoal={showCoal}
      onSelectGeoid={setSelectedGeoid}
      selectedGeoid={selectedGeoid}
    />
  );

  const detailEl = (
    <DetailPanel
      row={selectedRow}
      reactorMode={reactorMode}
      rankMax={rankMax}
      coalLookup={coalLookup}
    />
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#f1f5f9]">
      <Sidebar
        reactorMode={reactorMode}   setReactorMode={handleSetReactorMode}
        pgaFilter={pgaFilter}       setPgaFilter={setPgaFilter}
        sfhaFilter={sfhaFilter}     setSfhaFilter={setSfhaFilter}
        popFilter={popFilter}       setPopFilter={setPopFilter}
        paretoOnly={paretoOnly}     setParetoOnly={setParetoOnly}
        showCoal={showCoal}         setShowCoal={setShowCoal}
        mapLayer={mapLayer}         setMapLayer={setMapLayer}
        costWeight={costWeight}     setCostWeight={setCostWeight}
        open={filtersOpen}          onClose={() => setFiltersOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Compact header, only below lg where the sidebar is an overlay */}
        <div className="lg:hidden flex items-center justify-between gap-2 px-3 py-2 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <svg width="24" height="18" viewBox="0 0 38 26" fill="none" aria-hidden="true" className="shrink-0">
              <polygon points="2,2 2,24 20,13" stroke="#2563eb" strokeWidth="1.5" strokeLinejoin="round" fill="rgba(37,99,235,0.07)" />
              <line x1="20" y1="13" x2="37" y2="4"  stroke="#1e3a8a" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="20" y1="13" x2="37" y2="9"  stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="20" y1="13" x2="37" y2="17" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="20" y1="13" x2="37" y2="22" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span
              className="truncate"
              style={{
                fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
                fontWeight: 700, fontSize: '1.05rem', letterSpacing: '0.12em',
                background: 'linear-gradient(90deg, #1e293b 0%, #2563eb 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}
            >
              PRISM
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <BarButton onClick={() => setFiltersOpen(true)} expanded={filtersOpen}>Filters</BarButton>
            <BarButton
              onClick={() => { setSheetTab('table'); setSheetOpen(true); }}
              expanded={sheetOpen}
            >
              Results
            </BarButton>
          </div>
        </div>

        <MetricsBar
          activeRows={activeRows}
          totalRows={candidates?.length ?? 0}
          reactorMode={reactorMode}
          scoreCol={scoreCol}
          rankMax={rankMax}
        />

        {/* SMR mode banner */}
        {reactorMode !== 'LWR' && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-blue-800 text-[12px] sm:text-[13px] leading-snug shrink-0 flex items-start gap-2 max-h-24 overflow-y-auto">
            <span className="shrink-0 mt-0.5">ℹ</span>
            <span>
              {reactorMode === 'SMR - NuScale VOYGR'
                ? 'NuScale VOYGR mode — NRC-approved EPZ ~400 m (ML22287A155). Supports islanded operation at 115 kV; dry cooling supported; seismic cutoff raised to 0.50 g.'
                : 'SMR General mode — Xe-100 / KP-FHR profile. Pop cutoff raised to 1,000/mi², full grid score at 230 kV, water proximity relaxed; seismic cutoff 0.50 g.'}
            </span>
          </div>
        )}

        {/*
          The map takes every pixel the chrome above and below does not need.
          `basis-0 grow` plus `min-h-0` means it absorbs the remainder instead of
          sizing to content, and the min-height floor stops it collapsing into a
          strip on a short laptop. The old layout paired this with a fixed 340px
          bottom panel, so on a 900px-tall screen the chrome ate half the viewport.
        */}
        <div className="relative basis-0 grow min-h-0 [min-height:clamp(240px,38vh,760px)]">
          {countyGeojson && stateGeojson ? (
            <Map
              countyGeojson={countyGeojson}
              stateGeojson={stateGeojson}
              activeRows={activeRows}
              reactorMode={reactorMode}
              scoreCol={scoreCol}
              mapLayer={mapLayer}
              showCoal={showCoal}
              coalLookup={coalLookup}
              selectedGeoid={selectedGeoid}
              onSelectGeoid={handleSelectGeoid}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
              Loading map…
            </div>
          )}

          {/* Map legend — scales down on short viewports so it never covers the map */}
          <div className="absolute bottom-3 left-3 max-w-[min(15rem,55vw)] bg-white/95 border border-slate-200 rounded-lg px-2.5 py-2 text-[10px] sm:text-[11px] text-slate-600 space-y-1 sm:space-y-1.5 pointer-events-none shadow-sm [@media(max-height:700px)]:py-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-block w-8 sm:w-10 h-2.5 rounded shrink-0"
                style={{ background: mapLayer === 'cost'
                  ? `linear-gradient(to right, ${COST_RAMP.join(', ')})`
                  : 'linear-gradient(to right, #ffffcc, #d9f0a3, #addd8e, #78c679, #31a354, #006837)' }} />
              <span>{mapLayer === 'cost' ? 'Est. $/kW (low → high)' : 'Score (low → high)'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-8 sm:w-10 h-2.5 rounded shrink-0" style={{ background: '#f0f0f0' }} />
              <span>No data</span>
            </div>
            {reactorMode === 'LWR' && (
              <div className="flex items-center gap-2 [@media(max-height:640px)]:hidden">
                <span className="inline-block w-4 border-t-2 border-amber-500 shrink-0" />
                <span>★ Pareto-optimal</span>
              </div>
            )}
            {showCoal && (
              <div className="flex items-center gap-2 [@media(max-height:640px)]:hidden">
                <span className="inline-block w-4 border-t-2 border-violet-600 shrink-0" />
                <span>Coal infrastructure</span>
              </div>
            )}
          </div>
        </div>

        {/*
          Bottom panel, lg and up. Height is a clamp on viewport height rather
          than a fixed 340px, so it shrinks with the screen instead of taking a
          constant bite out of a laptop's 900px. Both children scroll internally.
        */}
        <div className="hidden lg:flex border-t border-slate-200 bg-white shrink-0 [height:clamp(184px,25vh,340px)]">
          <div className="flex-1 min-w-0 border-r border-slate-200 overflow-hidden">
            {tableEl}
          </div>
          <div className="flex-1 min-w-0 overflow-hidden bg-white">
            {detailEl}
          </div>
        </div>
      </div>

      {/*
        Below lg the map goes full-bleed and results become an overlay sheet.
        A stacked column was the alternative; it was rejected because on a
        768x1024 tablet the table and profile would push the map down to a few
        hundred pixels, and the map is the product. An overlay keeps the map at
        full size and puts the panels one tap away.
      */}
      {sheetOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end">
          <button
            type="button"
            aria-label="Close results"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setSheetOpen(false)}
          />
          <div className="relative bg-white rounded-t-xl shadow-2xl flex flex-col [height:min(72dvh,640px)] overflow-hidden">
            <div className="flex items-center gap-1 px-2 pt-2 pb-1 border-b border-slate-200 shrink-0">
              <SheetTab active={sheetTab === 'table'}  onClick={() => setSheetTab('table')}>Top 20</SheetTab>
              <SheetTab active={sheetTab === 'detail'} onClick={() => setSheetTab('detail')}>County profile</SheetTab>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close results"
                className="ml-auto px-2.5 py-1.5 text-slate-500 hover:text-slate-800 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {sheetTab === 'table' ? tableEl : detailEl}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BarButton({ children, onClick, expanded }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className="text-[12px] font-medium text-slate-700 bg-white border border-slate-300 rounded-md px-2.5 py-1.5 shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      {children}
    </button>
  );
}

function SheetTab({ children, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-[13px] font-medium rounded-md px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
        active ? 'bg-blue-50 text-blue-800' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}
