import { useMemo } from 'react';

export default function CandidatesTable({
  activeRows,
  reactorMode,
  scoreCol,
  scoreLabel,
  showCoal,
  onSelectGeoid,
  selectedGeoid,
}) {
  const top20 = useMemo(() => {
    if (!activeRows.length) return [];
    const sorted = [...activeRows].sort((a, b) => {
      if (reactorMode === 'LWR' && !showCoal) {
        return (a.rank > 0 ? a.rank : Infinity) - (b.rank > 0 ? b.rank : Infinity);
      }
      return (b[scoreCol] ?? -Infinity) - (a[scoreCol] ?? -Infinity);
    });
    return sorted.slice(0, 20);
  }, [activeRows, reactorMode, scoreCol, showCoal]);

  const csvData = useMemo(() => {
    if (!top20.length) return '';
    const cols = reactorMode === 'LWR'
      ? ['rank','county_name','state',scoreCol,'pga_max','pct_sfha','population_density','max_voltage','total_energy_consumption_mwh','on_nsga2_pareto']
      : ['county_name','state',scoreCol,'pga_max','pct_sfha','population_density','max_voltage'];
    if (showCoal) cols.push('coal_capacity_mw');
    const header = cols.join(',');
    const rows = top20.map((r) =>
      cols.map((c) => {
        const v = r[c];
        if (v == null) return '';
        if (typeof v === 'boolean') return v ? '1' : '0';
        if (typeof v === 'string' && v.includes(',')) return `"${v}"`;
        return v;
      }).join(',')
    );
    return [header, ...rows].join('\n');
  }, [top20, reactorMode, scoreCol, showCoal]);

  const downloadCsv = () => {
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prism_top20_${reactorMode.replace(/\s/g,'_').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!activeRows.length) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-[13px] p-4">
        No counties match the current filters.
      </div>
    );
  }

  const isLwr = reactorMode === 'LWR';

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 sm:py-2.5 border-b border-slate-200 bg-slate-50 shrink-0">
        <span className="text-[13px] font-semibold text-slate-600">
          Top 20 Candidates
        </span>
        <button
          onClick={downloadCsv}
          className="text-[12px] text-blue-700 hover:text-blue-900 font-medium border border-blue-200 hover:border-blue-400 bg-white rounded-md px-2.5 py-1 transition-colors shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          ↓ Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-auto flex-1">
        <table className="w-full text-[12px] border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
            <tr>
              {isLwr && <Th>Rank</Th>}
              <Th>County</Th>
              <Th>St</Th>
              <Th highlight>{scoreLabel}</Th>
              <Th right>Seis g</Th>
              <Th right>Flood</Th>
              <Th right>Pop/km²</Th>
              <Th right>kV</Th>
              {isLwr && <Th>Pareto</Th>}
              {showCoal && <Th right>Coal MW</Th>}
            </tr>
          </thead>
          <tbody>
            {top20.map((row, idx) => {
              const isSelected = row.geoid === selectedGeoid;
              const isEven = idx % 2 === 0;
              const displayScore = showCoal && row.has_coal_plant
                ? Math.min((row[scoreCol] ?? 0) + 0.05, 1.0)
                : (row[scoreCol] ?? null);

              return (
                <tr
                  key={row.geoid}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  aria-label={`${row.county_name}, ${row.state}`}
                  onClick={() => onSelectGeoid(row.geoid)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectGeoid(row.geoid);
                    }
                  }}
                  className={`cursor-pointer border-b border-slate-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 ${
                    isSelected
                      ? 'bg-blue-50 border-blue-200'
                      : isEven
                      ? 'bg-white hover:bg-slate-50'
                      : 'bg-slate-50/60 hover:bg-slate-100'
                  }`}
                >
                  {isLwr && (
                    <Td className={`text-slate-500 font-mono ${isSelected ? 'text-blue-700' : ''}`}>
                      {row.rank > 0 ? `#${parseInt(row.rank)}` : '—'}
                    </Td>
                  )}
                  <Td className={`font-medium max-w-[140px] truncate ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                    {row.county_name}
                  </Td>
                  <Td className="text-slate-500">{row.state}</Td>
                  {/* Score cell — highlighted blue background */}
                  <td className={`px-3 py-2 whitespace-nowrap font-mono font-semibold text-[12px] ${
                    isSelected
                      ? 'bg-blue-100 text-blue-900'
                      : 'bg-blue-50 text-blue-800'
                  }`}>
                    {displayScore?.toFixed(3) ?? '—'}
                  </td>
                  <Td className="font-mono text-slate-600 text-right">{(row.pga_max ?? 0).toFixed(3)}</Td>
                  <Td className="font-mono text-slate-600 text-right">{((row.pct_sfha ?? 0) * 100).toFixed(1)}%</Td>
                  <Td className="font-mono text-slate-600 text-right">{(row.population_density ?? 0).toFixed(1)}</Td>
                  <Td className="font-mono text-slate-600 text-right">{(row.max_voltage ?? 0).toFixed(0)}</Td>
                  {isLwr && (
                    <Td className="text-amber-500 font-bold text-center">
                      {row.on_nsga2_pareto ? '★' : ''}
                    </Td>
                  )}
                  {showCoal && (
                    <Td className="font-mono text-violet-700 text-right">
                      {row.has_coal_plant ? (row.coal_capacity_mw ?? 0).toFixed(0) : ''}
                    </Td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      {isLwr && (
        <div className="px-4 py-1.5 text-[11px] text-slate-500 border-t border-slate-100 bg-slate-50 shrink-0 [@media(max-height:820px)]:hidden">
          ★ Pareto-front counties — non-dominated across all 6 criteria, outlined in amber on the map.
        </div>
      )}
    </div>
  );
}

function Th({ children, highlight, right }) {
  return (
    <th className={`px-3 py-2 ${right ? 'text-right' : 'text-left'} font-semibold whitespace-nowrap text-[12px] text-slate-600 ${
      highlight ? 'bg-blue-50 text-blue-700' : ''
    }`}>
      {children}
    </th>
  );
}

function Td({ children, className = '' }) {
  return (
    <td className={`px-3 py-2 whitespace-nowrap ${className}`}>{children}</td>
  );
}
