export default function Sidebar({
  reactorMode, setReactorMode,
  pgaFilter, setPgaFilter,
  sfhaFilter, setSfhaFilter,
  popFilter, setPopFilter,
  paretoOnly, setParetoOnly,
  showCoal, setShowCoal,
}) {
  const pgaMax = reactorMode !== 'LWR' ? 0.50 : 0.30;

  return (
    <aside className="w-[290px] shrink-0 bg-[#f8f9fa] border-r border-slate-200 overflow-y-auto flex flex-col">
      <div className="px-5 py-5 space-y-6">

        {/* Title / brand */}
        <div className="pb-1">
          <div className="flex items-center gap-2.5">
            {/* Prism glyph: triangle + incoming ray splitting into 4 dispersed output lines */}
            <svg width="30" height="22" viewBox="0 0 38 26" fill="none" aria-hidden="true">
              <polygon
                points="2,2 2,24 20,13"
                stroke="#2563eb"
                strokeWidth="1.5"
                strokeLinejoin="round"
                fill="rgba(37,99,235,0.07)"
              />
              <line x1="0" y1="13" x2="2"  y2="13" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="20" y1="13" x2="37" y2="4"  stroke="#1e3a8a" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="20" y1="13" x2="37" y2="9"  stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="20" y1="13" x2="37" y2="17" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="20" y1="13" x2="37" y2="22" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
            </svg>

            {/* PRISM wordmark — Space Grotesk, slate-to-blue gradient */}
            <span
              style={{
                fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
                fontWeight: 700,
                fontSize: '1.65rem',
                letterSpacing: '0.13em',
                lineHeight: 1,
                background: 'linear-gradient(90deg, #1e293b 0%, #2563eb 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              PRISM
            </span>
          </div>

          <p className="text-slate-400 text-[10.5px] mt-2 leading-snug" style={{ letterSpacing: '0.05em' }}>
            Pareto Reactor Infrastructure Siting Model
          </p>
        </div>

        <Divider />

        {/* Reactor Mode */}
        <section className="space-y-2">
          <SectionLabel>Reactor Type</SectionLabel>
          <select
            value={reactorMode}
            onChange={(e) => setReactorMode(e.target.value)}
            className="w-full bg-white border border-slate-300 text-slate-700 text-[13px] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
          >
            <option>LWR</option>
            <option>SMR - NuScale VOYGR</option>
            <option>SMR - General</option>
          </select>
          <p className="text-slate-500 text-[12px] leading-snug">
            {reactorMode === 'LWR'
              ? 'Standard siting criteria per NRC RG 4.7.'
              : reactorMode === 'SMR - NuScale VOYGR'
              ? 'NRC-approved site-boundary EPZ ~400 m (ML22287A155). Supports islanded operation at 115 kV.'
              : 'For designs like Xe-100 / KP-FHR. Relaxed EPZ, pop, and grid thresholds.'}
          </p>
        </section>

        <Divider />

        {/* Filters */}
        <section className="space-y-4">
          <SectionLabel>Site Filters</SectionLabel>
          <p className="text-slate-500 text-[12px] -mt-2">Counties exceeding a threshold are removed.</p>

          <SliderField
            label="Seismic cutoff"
            value={pgaFilter}
            min={0} max={pgaMax} step={0.01}
            onChange={setPgaFilter}
            format={(v) => v.toFixed(2) + ' g'}
            hint={reactorMode !== 'LWR'
              ? 'NRC allows up to 0.50 g for SMR designs.'
              : 'NRC limit for LWR sites is 0.30 g.'}
          />

          <SliderField
            label="Flood zone coverage"
            value={sfhaFilter}
            min={0} max={20} step={1}
            onChange={setSfhaFilter}
            format={(v) => v.toFixed(0) + '%'}
            hint="Percent of county in FEMA 100-yr SFHA."
          />

          <SliderField
            label="Max population density"
            value={popFilter}
            min={0} max={10000} step={50}
            onChange={setPopFilter}
            format={(v) => v.toLocaleString() + ' /km²'}
            hint="NRC requires low population around any reactor site."
          />
        </section>

        <Divider />

        {/* Pareto toggle */}
        {reactorMode === 'LWR' ? (
          <Toggle
            label="Pareto-optimal sites only"
            hint="111 counties non-dominated across all 6 criteria."
            checked={paretoOnly}
            onChange={setParetoOnly}
          />
        ) : (
          <p className="text-slate-500 text-[12px] leading-snug">
            Pareto filtering is only available in LWR mode. The Pareto front was computed under LWR criteria.
          </p>
        )}

        <Divider />

        {/* Coal overlay */}
        <Toggle
          label="Coal-to-Nuclear layer"
          hint="EIA Form 860 (2022). Adds +0.05 score bump and marks coal counties with a purple border."
          checked={showCoal}
          onChange={setShowCoal}
        />

        <Divider />

        {/* About */}
        <section className="space-y-2">
          <SectionLabel>About</SectionLabel>
          <p className="text-slate-500 text-[12px] leading-snug">
            County-level siting analysis built on NRC Regulatory Guide 4.7. NSGA-II was used to find the Pareto front across all six criteria.
          </p>
          <p className="text-slate-400 text-[11px] leading-snug pt-1">
            For planning and research use only. Not an NRC license application or official suitability determination.
          </p>
        </section>

      </div>
    </aside>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-[13px] font-semibold text-[#374151] mb-1">
      {children}
    </p>
  );
}

function Divider() {
  return <hr className="border-[#e5e7eb]" />;
}

function SliderField({ label, value, min, max, step, onChange, format, hint }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-[13px] font-medium text-slate-700">{label}</span>
        <span className="text-[12px] font-mono text-blue-700 font-semibold">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="prism-slider w-full cursor-pointer"
        style={{
          background: `linear-gradient(to right, #2563eb 0%, #2563eb ${pct}%, #e5e7eb ${pct}%, #e5e7eb 100%)`,
        }}
      />
      {hint && <p className="text-slate-400 text-[11px] leading-snug">{hint}</p>}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-9 h-5 rounded-full transition-colors duration-200 ${
            checked ? 'bg-blue-600' : 'bg-slate-300'
          }`}
        />
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </div>
      <div>
        <p className={`text-[13px] font-medium leading-tight ${checked ? 'text-slate-800' : 'text-slate-700'}`}>
          {label}
        </p>
        {hint && <p className="text-slate-400 text-[11px] mt-0.5 leading-snug">{hint}</p>}
      </div>
    </label>
  );
}
