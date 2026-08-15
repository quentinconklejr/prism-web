import { useState, useMemo } from 'react';
import { useData } from './useData';
import { computeSmrScores } from './scoring';
import Sidebar from './components/Sidebar';
import MetricsBar from './components/MetricsBar';
import Map from './components/Map';
import DetailPanel from './components/DetailPanel';
import CandidatesTable from './components/CandidatesTable';

export default function App() {
  const [reactorMode, setReactorMode]   = useState('LWR');
  const [pgaFilter,   setPgaFilter]     = useState(0.30);
  const [sfhaFilter,  setSfhaFilter]    = useState(20);
  const [popFilter,   setPopFilter]     = useState(10000);
  const [paretoOnly,  setParetoOnly]    = useState(false);
  const [showCoal,    setShowCoal]      = useState(false);
  const [selectedGeoid, setSelectedGeoid] = useState(null);

  const { candidates, coalLookup, stateGeojson, countyGeojson, loading, error } = useData();

  const handleSetReactorMode = (m) => {
    setReactorMode(m);
    setPgaFilter(m !== 'LWR' ? 0.50 : 0.30);
    if (m !== 'LWR') setParetoOnly(false);
  };

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

  const activeRows = useMemo(() => {
    if (reactorMode === 'LWR') return filtered;
    const scored = computeSmrScores(filtered, reactorMode);
    return scored.filter((r) => r.smr_score != null);
  }, [filtered, reactorMode]);

  const scoreCol   = reactorMode === 'LWR' ? 'mcda_score' : 'smr_score';
  const scoreLabel = reactorMode === 'LWR'
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
      <div className="flex items-center justify-center h-screen text-red-600 text-sm px-8 text-center bg-slate-50">
        <div className="bg-white border border-red-200 rounded-lg px-6 py-5 shadow-sm max-w-md">
          <p className="font-semibold text-red-700 mb-1">Error loading data</p>
          <p className="text-slate-500 text-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-slate-500 gap-3 bg-slate-50">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-600">Loading PRISM data…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f1f5f9]">
      <Sidebar
        reactorMode={reactorMode}   setReactorMode={handleSetReactorMode}
        pgaFilter={pgaFilter}       setPgaFilter={setPgaFilter}
        sfhaFilter={sfhaFilter}     setSfhaFilter={setSfhaFilter}
        popFilter={popFilter}       setPopFilter={setPopFilter}
        paretoOnly={paretoOnly}     setParetoOnly={setParetoOnly}
        showCoal={showCoal}         setShowCoal={setShowCoal}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <MetricsBar
          activeRows={activeRows}
          totalRows={candidates?.length ?? 0}
          reactorMode={reactorMode}
          scoreCol={scoreCol}
          rankMax={rankMax}
        />

        {/* SMR mode banner */}
        {reactorMode !== 'LWR' && (
          <div className="bg-blue-50 border-b border-blue-200 px-5 py-2.5 text-blue-800 text-[13px] leading-snug shrink-0 flex items-start gap-2">
            <span className="shrink-0 mt-0.5">ℹ</span>
            <span>
              {reactorMode === 'SMR - NuScale VOYGR'
                ? 'NuScale VOYGR mode — NRC-approved EPZ ~400 m (ML22287A155). Supports islanded operation at 115 kV; dry cooling supported; seismic cutoff raised to 0.50 g.'
                : 'SMR General mode — Xe-100 / KP-FHR profile. Pop cutoff raised to 1,000/mi², full grid score at 230 kV, water proximity relaxed; seismic cutoff 0.50 g.'}
            </span>
          </div>
        )}

        {/* Map */}
        <div className="flex-1 min-h-0 relative">
          {countyGeojson && stateGeojson ? (
            <Map
              countyGeojson={countyGeojson}
              stateGeojson={stateGeojson}
              activeRows={activeRows}
              reactorMode={reactorMode}
              scoreCol={scoreCol}
              showCoal={showCoal}
              coalLookup={coalLookup}
              selectedGeoid={selectedGeoid}
              onSelectGeoid={setSelectedGeoid}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              Loading map…
            </div>
          )}

          {/* Map legend */}
          <div className="absolute bottom-4 left-4 bg-white/95 border border-slate-200 rounded-lg px-3 py-2.5 text-[11px] text-slate-600 space-y-1.5 pointer-events-none shadow-sm">
            <div className="flex items-center gap-2">
              <span className="inline-block w-10 h-2.5 rounded"
                style={{ background: 'linear-gradient(to right, #ffffcc, #d9f0a3, #addd8e, #78c679, #31a354, #006837)' }} />
              <span>Score (low → high)</span>
            </div>
            {reactorMode === 'LWR' && (
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 border-t-2 border-amber-500" />
                <span>★ Pareto-optimal</span>
              </div>
            )}
            {showCoal && (
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 border-t-2 border-violet-600" />
                <span>Coal infrastructure</span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom panel: table + detail */}
        <div className="flex border-t border-slate-200 bg-white" style={{ height: '340px' }}>
          <div className="flex-1 min-w-0 border-r border-slate-200 overflow-hidden">
            <CandidatesTable
              activeRows={activeRows}
              reactorMode={reactorMode}
              scoreCol={scoreCol}
              scoreLabel={scoreLabel}
              showCoal={showCoal}
              onSelectGeoid={setSelectedGeoid}
              selectedGeoid={selectedGeoid}
            />
          </div>
          <div className="flex-1 min-w-0 overflow-hidden bg-white">
            <DetailPanel
              row={selectedRow}
              reactorMode={reactorMode}
              rankMax={rankMax}
              coalLookup={coalLookup}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
