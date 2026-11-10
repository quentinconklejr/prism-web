import { useMemo, useState } from 'react';
import { DETAIL_FIELDS, formatIsoDate, looseDate, statusInfo, statusRank } from './rules';

const text = (k) => (r) => String(r[k] ?? '').toLowerCase();
const date = (k) => (r) => looseDate(r[k]);

const COLUMNS = [
  { key: 'jurisdiction',      label: 'Jurisdiction',    value: text('jurisdiction') },
  { key: 'county',            label: 'County',          value: text('county') },
  { key: 'status',            label: 'Status',          value: (r) => statusRank(r.status) },
  { key: 'action',            label: 'Action',          value: text('action') },
  { key: 'since',             label: 'Since',           value: date('since') },
  { key: 'ends_or_next_step', label: 'Ends / next step',value: date('ends_or_next_step') },
  { key: 'sources',           label: 'Sources',         value: null },
  { key: 'last_verified',     label: 'Last verified',   value: date('last_verified') },
];
const SORTABLE = COLUMNS.filter((c) => c.value);

// Empty values (no date, blank cell) always go to the bottom, whichever way
// the column is sorted, so flipping direction never buries the real rows.
function compare(a, b, col, dir) {
  const va = col.value(a), vb = col.value(b);
  const ea = va == null || va === '', eb = vb == null || vb === '';
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
  const c = typeof va === 'number' ? va - vb : va.localeCompare(vb);
  return dir === 'asc' ? c : -c;
}

export default function RulesTable({ rows }) {
  const [sort, setSort] = useState({ key: 'status', dir: 'asc' });

  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sort.key);
    const byName = COLUMNS[0];
    return [...rows].sort((a, b) =>
      compare(a, b, col, sort.dir) || compare(a, b, byName, 'asc')
    );
  }, [rows, sort]);

  const toggle = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-slate-200 bg-slate-50">
        <h2 className="text-[13px] font-semibold text-slate-600">
          Every tracked action <span className="font-normal text-slate-500">({rows.length})</span>
        </h2>

        {/* Phones get cards instead of columns, so sorting moves to a menu. */}
        <label className="md:hidden flex items-center gap-1.5 text-[12px] text-slate-600">
          Sort
          <select
            value={`${sort.key}:${sort.dir}`}
            onChange={(e) => { const [key, dir] = e.target.value.split(':'); setSort({ key, dir }); }}
            className="text-[12px] bg-white border border-slate-300 rounded-md px-1.5 py-1"
          >
            {SORTABLE.flatMap((c) => [
              <option key={`${c.key}:asc`} value={`${c.key}:asc`}>{c.label} ↑</option>,
              <option key={`${c.key}:desc`} value={`${c.key}:desc`}>{c.label} ↓</option>,
            ])}
          </select>
        </label>
      </div>

      {/* md and up: a real table. */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {COLUMNS.map((c) => {
                const active = sort.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className="px-3 py-2 text-left font-semibold whitespace-nowrap text-slate-600 align-bottom"
                  >
                    {c.value ? (
                      <button
                        type="button"
                        onClick={() => toggle(c.key)}
                        className={`inline-flex items-center gap-1 rounded hover:text-slate-900 ${active ? 'text-blue-700' : ''}`}
                      >
                        {c.label}
                        <span aria-hidden="true" className={active ? '' : 'text-slate-300'}>
                          {active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    ) : c.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.id} className={`border-b border-slate-100 align-top ${i % 2 ? 'bg-slate-50/60' : 'bg-white'}`}>
                <td className="px-3 py-2.5 min-w-[8rem]">
                  <div className="font-medium text-slate-800">{r.jurisdiction}</div>
                  <div className="text-slate-500">{r.jurisdiction_type}</div>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">{r.county}</td>
                <td className="px-3 py-2.5 whitespace-nowrap"><StatusPill status={r.status} /></td>
                <td className="px-3 py-2.5 min-w-[16rem] max-w-[26rem] text-slate-700 leading-snug">
                  {r.action}
                  <Details row={r} />
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">{r.since || '—'}</td>
                <td className="px-3 py-2.5 min-w-[9rem] max-w-[14rem] text-slate-700 leading-snug">{r.ends_or_next_step || '—'}</td>
                <td className="px-3 py-2.5 min-w-[7rem]"><Sources sources={r.sources} /></td>
                <td className="px-3 py-2.5 whitespace-nowrap text-slate-500 font-mono">{formatIsoDate(r.last_verified)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Below md: one card per row. */}
      <ul className="md:hidden divide-y divide-slate-100">
        {sorted.map((r) => (
          <li key={r.id} className="px-3 py-3 text-[13px]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-slate-800">{r.jurisdiction}</div>
                <div className="text-[12px] text-slate-500">
                  {r.jurisdiction_type}{r.jurisdiction_type && r.county ? ' · ' : ''}{r.county ? `${r.county} County` : ''}
                </div>
              </div>
              <StatusPill status={r.status} />
            </div>
            {r.action && <p className="mt-1.5 text-slate-700 leading-snug">{r.action}</p>}
            <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
              <dt className="text-slate-500">Since</dt>
              <dd className="text-slate-700">{r.since || '—'}</dd>
              <dt className="text-slate-500">Ends / next</dt>
              <dd className="text-slate-700">{r.ends_or_next_step || '—'}</dd>
              <dt className="text-slate-500">Verified</dt>
              <dd className="text-slate-700 font-mono">{formatIsoDate(r.last_verified)}</dd>
            </dl>
            <Details row={r} />
            <div className="mt-1.5"><Sources sources={r.sources} inline /></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StatusPill({ status }) {
  const s = statusInfo(status);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium text-slate-700 bg-white border border-slate-200 rounded-full pl-1.5 pr-2 py-0.5">
      <span className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-slate-900/20" style={{ background: s.color }} aria-hidden="true" />
      {s.label}
    </span>
  );
}

function Details({ row }) {
  const items = DETAIL_FIELDS.filter(([k]) => row[k]);
  if (!items.length) return null;
  return (
    <details className="mt-1.5 group">
      <summary className="cursor-pointer text-[12px] font-medium text-blue-700 hover:text-blue-900 select-none">
        Rule details ({items.length})
      </summary>
      <dl className="mt-1.5 space-y-1 text-[12px] border-l-2 border-slate-200 pl-2.5">
        {items.map(([k, label]) => (
          <div key={k}>
            <dt className="font-semibold text-slate-600">{label}</dt>
            <dd className="text-slate-700 leading-snug">{row[k]}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function Sources({ sources, inline }) {
  if (!sources.length) return <span className="text-slate-400">—</span>;
  return (
    <ul className={inline ? 'flex flex-wrap gap-x-3 gap-y-0.5 text-[12px]' : 'space-y-0.5'}>
      {sources.map((s) => (
        <li key={s.url}>
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 hover:text-blue-900 underline decoration-blue-200 underline-offset-2 hover:decoration-blue-500"
          >
            {s.label}<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
