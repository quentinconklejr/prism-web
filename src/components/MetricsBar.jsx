export default function MetricsBar({ activeRows, totalRows, reactorMode, scoreCol, rankMax }) {
  const count = activeRows.length;
  const paretoCount = activeRows.filter((r) => r.on_nsga2_pareto).length;
  const topScore = count > 0
    ? Math.max(...activeRows.map((r) => r[scoreCol] ?? -Infinity))
    : null;
  const bestRank = reactorMode === 'LWR' && count > 0
    ? Math.min(...activeRows.map((r) => r.rank ?? Infinity))
    : null;

  return (
    <div className="grid grid-cols-4 gap-3 px-5 py-3 border-b border-slate-200 bg-white shrink-0">
      <MetricCard
        label="Counties Shown"
        value={count.toLocaleString()}
        sub={`of ${totalRows.toLocaleString()} scored`}
      />
      {reactorMode === 'LWR' ? (
        <>
          <MetricCard
            label="Pareto-Optimal"
            value={paretoCount.toLocaleString()}
            sub="non-dominated across 6 criteria"
            accent
          />
          <MetricCard
            label="Top MCDA Score"
            value={topScore != null && isFinite(topScore) ? topScore.toFixed(3) : '—'}
            sub="best visible score"
          />
          <MetricCard
            label="Highest Ranked"
            value={bestRank != null && isFinite(bestRank) ? `#${bestRank}` : '—'}
            sub="national rank"
          />
        </>
      ) : (
        <>
          <MetricCard
            label="Reactor Mode"
            value={reactorMode.includes('NuScale') ? 'NuScale VOYGR' : 'General SMR'}
            sub="active SMR profile"
            accent
          />
          <MetricCard
            label="Top SMR Score"
            value={topScore != null && isFinite(topScore) ? topScore.toFixed(3) : '—'}
            sub="best visible score"
          />
          <MetricCard
            label="Qualifying Sites"
            value={count.toLocaleString()}
            sub="meet mode criteria"
          />
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, accent }) {
  return (
    <div className={`rounded-lg border px-4 py-3 shadow-sm ${
      accent
        ? 'bg-blue-50 border-blue-200'
        : 'bg-white border-slate-200'
    }`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
        {label}
      </div>
      <div className={`font-bold leading-none tabular-nums ${
        accent ? 'text-blue-700 text-[26px]' : 'text-slate-800 text-[26px]'
      }`}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-slate-400 mt-1 leading-tight">{sub}</div>
      )}
    </div>
  );
}
