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
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3 px-3 sm:px-5 py-2 sm:py-3 border-b border-slate-200 bg-white shrink-0 [@media(max-height:800px)]:py-1.5 [@media(max-height:800px)]:gap-2">
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
    <div className={`min-w-0 rounded-lg border px-2.5 sm:px-4 py-2 sm:py-3 shadow-sm [@media(max-height:800px)]:py-1.5 ${
      accent
        ? 'bg-blue-50 border-blue-200'
        : 'bg-white border-slate-200'
    }`}>
      <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5 sm:mb-1 truncate">
        {label}
      </div>
      <div className={`font-bold leading-none tabular-nums truncate text-[19px] sm:text-[22px] xl:text-[26px] [@media(max-height:800px)]:text-[19px] ${
        accent ? 'text-blue-700' : 'text-slate-800'
      }`}>
        {value}
      </div>
      {sub && (
        <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 sm:mt-1 leading-tight truncate [@media(max-height:760px)]:hidden">
          {sub}
        </div>
      )}
    </div>
  );
}
