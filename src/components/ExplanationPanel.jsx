import { useEffect, useState } from 'react';

let cache = null;

export default function ExplanationPanel({ countyId }) {
  const [data, setData] = useState(cache);

  useEffect(() => {
    if (cache) return;
    fetch('/explanations.json')
      .then((r) => r.json())
      .then((d) => { cache = d; setData(d); })
      .catch(() => setData({}));
  }, []);

  if (!countyId) return null;
  if (!data) return null;

  const entry = data[countyId] ?? data[String(countyId)];
  if (!entry) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-slate-700">
          {entry.name}, {entry.state}
        </h3>
        <span className="shrink-0 text-[11px] text-slate-400">Rank {entry.rank}</span>
      </div>

      <p className="text-[13px] leading-relaxed text-slate-600">{entry.text}</p>

      <p className="mt-2 border-t border-slate-200 pt-2 text-[11px] leading-snug text-slate-400">
        Plain-language summary generated from the factor scores below.
        Scores are computed by the siting model and are authoritative.
      </p>
    </div>
  );
}