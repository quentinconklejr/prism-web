import { useMemo } from 'react';
import ExplanationPanel from './ExplanationPanel';
import {
  PLANT_NET_MW, COST_LAYER_LABEL, CAPEX_PER_KW_BASE,
  fmtPerKw, fmtTotalCapex, fmtVsBaseline,
} from '../cost';

const NORM_COLS = [
  'norm_seismic_risk','norm_flood_risk','norm_pop_density',
  'norm_water_access','norm_grid_connectivity','norm_energy_demand',
];
const BAR_LABELS = [
  'Seismic Safety','Flood Safety','Population',
  'Water Access','Grid Connectivity','Energy Demand',
];

export default function DetailPanel({ row, reactorMode, rankMax, coalLookup }) {
  const barVals = useMemo(() => {
    if (!row) return null;
    const raw = NORM_COLS.map((c) => row[c] ?? null);
    if (raw.every((v) => v == null)) return null;
    // Invert risk cols (0=good → 1 best); fill nulls with 0 so bars still render
    return [
      raw[0] != null ? 1 - raw[0] : 0,
      raw[1] != null ? 1 - raw[1] : 0,
      raw[2] != null ? 1 - raw[2] : 0,
      raw[3] ?? 0,
      raw[4] ?? 0,
      raw[5] ?? 0,
    ];
  }, [row]);

  if (!row) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 text-[13px] gap-3 px-5 bg-white">
        <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <p className="text-center font-medium text-slate-500">Click a county on the map to view its profile.</p>
        <p className="text-[12px] text-slate-500 text-center leading-snug">
          Darker blue = higher score. Amber outlines mark Pareto-front sites (★).
        </p>
      </div>
    );
  }

  const isLwr   = reactorMode === 'LWR';
  const isPareto = isLwr && !!row.on_nsga2_pareto;
  const coalDetail = coalLookup?.[row.geoid];

  const pga = row.pga_max ?? 0;
  const seismicTxt = pga < 0.05 ? 'minimal'
    : pga < 0.10 ? 'low'
    : pga < 0.15 ? 'moderate'
    : pga < 0.20 ? 'elevated, near NRC review threshold'
    : 'high, near the 0.30 g limit';

  const sfha = row.pct_sfha ?? 0;
  const floodTxt = sfha < 0.03 ? 'negligible'
    : sfha < 0.08 ? 'low'
    : sfha < 0.14 ? 'moderate'
    : 'high, near the 20% filter threshold';

  const popD = row.population_density ?? 0;
  const popTxt = popD < 10 ? 'very sparse, suitable for NRC exclusion zones'
    : popD < 30 ? 'low density'
    : popD < 100 ? 'moderate'
    : 'dense; exclusion zone would need careful review';

  const lakeD  = row.dist_to_lakes_km;
  const riverD = row.distance_to_rivers_km;
  let waterStr = null;
  if (lakeD != null && riverD != null) {
    const nearest = Math.min(lakeD, riverD);
    const src = lakeD <= riverD ? 'lake' : 'river';
    const waterTxt = nearest < 5  ? 'close; good for once-through cooling'
      : nearest < 15 ? 'workable for cooling intake'
      : nearest < 30 ? 'feasible with a pump station'
      : 'far; cooling logistics would need planning';
    waterStr = `${nearest.toFixed(1)} km (${src}, ${waterTxt})`;
  }

  const volt = row.max_voltage;
  let gridStr = null;
  if (volt != null && volt > 0) {
    const gridTxt = volt >= 345 ? '345+ kV line present'
      : volt >= 230 ? '230 kV line nearby'
      : volt >= 138 ? '138 kV, adequate for most SMR designs'
      : 'below 138 kV; grid upgrade likely needed';
    gridStr = `${volt.toFixed(0)} kV (${gridTxt})`;
  }

  const energy = row.total_energy_consumption_mwh;
  let energyStr = null;
  if (energy != null) {
    energyStr = `${energy.toLocaleString(undefined, { maximumFractionDigits: 0 })} MWh`;
  }

  let rankStr = null, rankInterp = null;
  if (isLwr && row.rank != null) {
    const rank   = parseInt(row.rank);
    const pctile = Math.round(100 * (1 - rank / rankMax));
    rankStr   = `#${rank}`;
    rankInterp = rank <= 50  ? 'Top 50 nationally'
      : rank <= 600 ? `Top ${pctile}%`
      : `of ${rankMax?.toLocaleString()} ranked`;
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-white">
      <div className="px-4 py-3 space-y-3">

        {/* County name + Pareto badge */}
        <div className="flex items-start gap-2 flex-wrap pt-0.5">
          <h2 className="text-slate-800 font-semibold text-[15px] leading-tight">
            {row.county_name}, {row.state}
          </h2>
          {isPareto && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">
              ★ Pareto Tier 1
            </span>
          )}
        </div>

        {/* Score cards */}
        <div className="grid grid-cols-2 gap-2">
          {isLwr ? (
            <>
              <ScoreCard label="LWR Rank" value={rankStr ?? 'N/A'} sub={rankInterp} />
              <ScoreCard label="MCDA Score" value={row.mcda_score?.toFixed(3) ?? 'N/A'} accent />
            </>
          ) : (
            <>
              <ScoreCard
                label="SMR Score"
                value={row.smr_score != null ? row.smr_score.toFixed(3) : 'Disqualified'}
                accent
              />
              <ScoreCard
                label="Mode"
                value={reactorMode.includes('NuScale') ? 'NuScale VOYGR' : 'General SMR'}
              />
            </>
          )}
        </div>

        <ExplanationPanel countyId={row.geoid} />

        {/* Per-criterion bars */}
        {barVals && (
          <div className="space-y-1.5">
            <SectionHeader>Criterion Scores</SectionHeader>
            {BAR_LABELS.map((label, i) => (
              <BarRow key={label} label={label} value={barVals[i]} />
            ))}
          </div>
        )}

        {/* Safety */}
        <div className="space-y-1">
          <SectionHeader>Safety Criteria</SectionHeader>
          <Bullet label="Seismic Risk">{pga.toFixed(3)} g — {seismicTxt}</Bullet>
          <Bullet label="Flood Risk">{(sfha * 100).toFixed(1)}% SFHA — {floodTxt}</Bullet>
          <Bullet label="Population Density">{popD.toFixed(1)} /km² — {popTxt}</Bullet>
          {row.pct_military != null && row.pct_military > 0 && (
            <Bullet label="Military Coverage">{(row.pct_military * 100).toFixed(1)}% of county</Bullet>
          )}
        </div>

        {/* Infrastructure */}
        <div className="space-y-1">
          <SectionHeader>Infrastructure &amp; Demand</SectionHeader>
          {waterStr && <Bullet label="Nearest Water">{waterStr}</Bullet>}
          {gridStr  && <Bullet label="Transmission">{gridStr}</Bullet>}
          {energyStr && <Bullet label="Energy Demand">{energyStr}</Bullet>}
          {row.data_centers_count > 0 && (
            <Bullet label="Data Centers">{parseInt(row.data_centers_count)} (high baseload demand)</Bullet>
          )}
        </div>

        {/* Construction cost — a parallel axis, never folded into the score above */}
        <div className="space-y-1">
          <SectionHeader>Estimated Construction Cost</SectionHeader>
          {row.est_capex_per_kw != null ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <ScoreCard label="Est. $/kW" value={fmtPerKw(row.est_capex_per_kw)} />
                <ScoreCard
                  label={`Est. total (${PLANT_NET_MW} MW)`}
                  value={fmtTotalCapex(row.est_total_capex)}
                />
              </div>
              <Bullet label={COST_LAYER_LABEL}>
                {row.location_factor.toFixed(3)} — {fmtVsBaseline(row.location_factor)} (1.00)
              </Bullet>
              <p className="text-[11px] leading-snug text-slate-500 pt-0.5">
                State-level construction labor adjustment (EIA/S&amp;L 2023, SL-018001 Rev A,
                App. A). Applied to the {fmtPerKw(CAPEX_PER_KW_BASE)}/kW SMR overnight capital cost from Case 10
                ({PLANT_NET_MW} MW net). Reflects craft wage rates and labor productivity only —
                it does not include seismic or environmental cost factors, which are scored
                separately. Not included in the suitability score.
              </p>
            </>
          ) : (
            <p className="text-[12px] leading-snug text-slate-500">
              No cost estimate — this county is outside the coverage of the source report.
            </p>
          )}
        </div>

        {/* Alert boxes */}
        {!!row.has_plant && (
          <AlertBox color="blue">NRC records show a nuclear plant in this county.</AlertBox>
        )}
        {!!row.has_coal_plant && (
          <AlertBox color="violet">
            This county has{' '}
            {[coalDetail?.has_operating_coal && 'operating', coalDetail?.has_retired_coal && 'retired']
              .filter(Boolean).join(' and ') || 'existing'}{' '}
            coal capacity ({(row.coal_capacity_mw ?? 0).toFixed(0)} MW). The existing grid interconnection and workforce make it a reasonable conversion candidate.
          </AlertBox>
        )}
        {isPareto && (
          <AlertBox color="amber">
            ★ Pareto-front site — no other county in the dataset scores better on all six criteria at once.
          </AlertBox>
        )}

      </div>
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <div className="text-[13px] font-semibold text-[#374151] border-b border-slate-200 pb-1 mb-1.5">
      {children}
    </div>
  );
}

function ScoreCard({ label, value, sub, accent }) {
  return (
    <div className={`rounded-lg border p-2.5 ${
      accent
        ? 'bg-blue-50 border-blue-200'
        : 'bg-slate-50 border-slate-200'
    }`}>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
      <div className={`text-[17px] font-bold leading-tight mt-0.5 ${
        accent ? 'text-blue-700' : 'text-slate-800'
      }`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function BarRow({ label, value }) {
  const pct = Math.max(0, Math.min(1, value ?? 0));
  const color = pct >= 0.70 ? '#166534' : pct >= 0.45 ? '#1d4ed8' : '#93c5fd';
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-slate-500 w-[118px] shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct * 100}%`, background: color }}
        />
      </div>
      <span className="text-[11px] font-mono text-slate-600 w-9 text-right tabular-nums">
        {(pct * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function Bullet({ label, children }) {
  return (
    <p className="text-[12px] text-slate-600 leading-snug">
      <span className="font-medium text-slate-700">{label}:</span>{' '}{children}
    </p>
  );
}

function AlertBox({ color, children }) {
  const styles = {
    blue:   'bg-blue-50 border-blue-200 text-blue-800',
    violet: 'bg-violet-50 border-violet-200 text-violet-800',
    amber:  'bg-amber-50 border-amber-200 text-amber-800',
    green:  'bg-green-50 border-green-200 text-green-800',
  };
  return (
    <div className={`rounded-lg border px-3 py-2 text-[12px] leading-snug ${styles[color]}`}>
      {children}
    </div>
  );
}
