import { useEffect, useMemo, useState } from 'react';
import RulesMap from './RulesMap';
import RulesTable from './RulesTable';
import SignupForm from './SignupForm';
import {
  COUNTIES_GEOJSON, centroid, countyKey, formatIsoDate,
  loadRules, locateCities, statusInfo, statusRank,
} from './rules';

export default function IllinoisPage() {
  const [rows, setRows] = useState(null);
  const [counties, setCounties] = useState(null);
  const [cityLocations, setCityLocations] = useState(() => new Map());
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      loadRules(),
      fetch(COUNTIES_GEOJSON).then((r) => {
        if (!r.ok) throw new Error(`Could not load county shapes (${r.status})`);
        return r.json();
      }),
    ])
      .then(([rs, geo]) => {
        setRows(rs);
        setCounties(geo.features.map((f) => ({
          geoid: f.properties.GEOID,
          name: f.properties.NAME,
          key: countyKey(f.properties.NAME),
          geometry: f.geometry,
          center: centroid(f.geometry),
        })));
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  // City dots fill in once geocoding answers; the map and table do not wait.
  useEffect(() => {
    if (!rows || !counties) return;
    const ctrl = new AbortController();
    const byKey = new Map(counties.map((c) => [c.key, c]));
    locateCities(rows, byKey, import.meta.env.VITE_MAPBOX_TOKEN, ctrl.signal)
      .then(setCityLocations)
      .catch((e) => { if (e.name !== 'AbortError') console.error('[PRISM] city lookup failed', e); });
    return () => ctrl.abort();
  }, [rows, counties]);

  const summary = useMemo(() => {
    if (!rows) return null;
    const counts = new Map();
    rows.forEach((r) => counts.set(r.status, (counts.get(r.status) ?? 0) + 1));
    const statuses = [...counts.keys()].sort((a, b) => statusRank(a) - statusRank(b));
    const verified = rows.map((r) => r.last_verified).filter(Boolean).sort().at(-1);
    const unmatched = counties
      ? [...new Set(rows.filter((r) => !counties.some((c) => c.key === r.countyKey)).map((r) => r.county))]
      : [];
    return { counts, statuses, verified, unmatched };
  }, [rows, counties]);

  // Legend always shows the three headline statuses, plus anything else the
  // CSV actually uses.
  const legendStatuses = useMemo(() => {
    const base = ['pause_in_effect', 'rules_adopted', 'pause_proposed'];
    const extra = (summary?.statuses ?? []).filter((s) => !base.includes(s));
    return [...base, ...extra];
  }, [summary]);

  return (
    <div className="min-h-[100dvh] bg-[#f1f5f9]">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-5 sm:py-6 space-y-5">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-semibold text-slate-900 leading-tight">
            Illinois data center rules
          </h1>
          <p className="mt-1.5 text-[14px] text-slate-600 max-w-3xl leading-snug">
            Where Illinois counties and cities have paused data center projects or written rules for them.
            {summary?.verified && <> Last verified {formatIsoDate(summary.verified)}.</>}
          </p>
          {summary && (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Counts by status">
              {summary.statuses.map((s) => (
                <li key={s} className="inline-flex items-center gap-1.5 text-[12px] text-slate-700 bg-white border border-slate-200 rounded-full pl-2 pr-2.5 py-1 shadow-sm">
                  <span className="w-2.5 h-2.5 rounded-full ring-1 ring-slate-900/20" style={{ background: statusInfo(s).color }} aria-hidden="true" />
                  <span className="font-semibold tabular-nums">{summary.counts.get(s)}</span> {statusInfo(s).label.toLowerCase()}
                </li>
              ))}
            </ul>
          )}
        </div>

        {error ? (
          <div className="bg-white border border-red-200 rounded-lg px-4 py-3 text-[13px]">
            <p className="font-semibold text-red-700">Couldn't load the Illinois data</p>
            <p className="text-slate-500">{error}</p>
          </div>
        ) : !rows || !counties ? (
          <div className="flex items-center justify-center gap-3 py-24 text-slate-500 text-sm">
            <div className="prism-spinner w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            Loading…
          </div>
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
              <section aria-label="Map of Illinois by status" className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <div className="relative [height:clamp(420px,78svh,760px)]">
                  <RulesMap counties={counties} rows={rows} cityLocations={cityLocations} />
                  {/* Overlay from sm up; on a phone it would sit on top of northern Illinois. */}
                  <Legend statuses={legendStatuses} className="hidden sm:block absolute top-3 left-3 bg-white/95 border border-slate-200 rounded-lg px-2.5 py-2 pointer-events-none shadow-sm space-y-1" />
                </div>
                <Legend statuses={legendStatuses} className="sm:hidden flex flex-wrap gap-x-3 gap-y-1 px-3 py-2 border-t border-slate-200" />
              </section>

              <aside className="space-y-5">
                <SignupForm />
                <section className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 text-[13px] text-slate-600 leading-snug space-y-2">
                  <h2 className="text-[14px] font-semibold text-slate-800">Reading the map</h2>
                  <p>
                    A shaded county means the <em>county board</em> acted. A dot is a city, village or town;
                    its pause covers that municipality, not the whole county.
                  </p>
                  <p>Tap or hover a county or dot for details. Every row links to its source below.</p>
                  {summary.unmatched.length > 0 && (
                    <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                      Not on the map (county name not recognized): {summary.unmatched.join(', ')}
                    </p>
                  )}
                </section>
              </aside>
            </div>

            <RulesTable rows={rows} />
          </>
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-4 pb-8 text-[12px] text-slate-500">
        Compiled from the local news and government sources linked in each row.
      </footer>
    </div>
  );
}

function Legend({ statuses, className }) {
  return (
    <div className={`text-[11px] text-slate-600 ${className}`}>
      {statuses.map((s) => (
        <div key={s} className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm shrink-0 ring-1 ring-slate-900/15" style={{ background: statusInfo(s).color, opacity: 0.85 }} />
          <span>{statusInfo(s).label}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 sm:pt-1 sm:mt-1 sm:border-t sm:border-slate-200">
        <span className="inline-block w-3 h-3 rounded-full shrink-0 bg-white border-[1.5px] border-slate-800" />
        <span>City, village or town</span>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <a href="/" className="flex items-center gap-2 min-w-0 rounded" aria-label="PRISM home">
          <svg width="26" height="18" viewBox="0 0 38 26" fill="none" aria-hidden="true" className="shrink-0">
            <polygon points="2,2 2,24 20,13" stroke="#2563eb" strokeWidth="1.5" strokeLinejoin="round" fill="rgba(37,99,235,0.07)" />
            <line x1="20" y1="13" x2="37" y2="4"  stroke="#1e3a8a" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="20" y1="13" x2="37" y2="9"  stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="20" y1="13" x2="37" y2="17" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="20" y1="13" x2="37" y2="22" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span
            style={{
              fontFamily: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
              fontWeight: 700, fontSize: '1.05rem', letterSpacing: '0.12em',
              background: 'linear-gradient(90deg, #1e293b 0%, #2563eb 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}
          >
            PRISM
          </span>
        </a>
        <a
          href="/"
          className="text-[12px] font-medium text-slate-700 bg-white border border-slate-300 rounded-md px-2.5 py-1.5 shadow-sm hover:bg-slate-50 whitespace-nowrap"
        >
          National siting map
        </a>
      </div>
    </header>
  );
}

