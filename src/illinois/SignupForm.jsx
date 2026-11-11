import { useEffect, useState } from 'react';

// Posts to the /api/subscribe Vercel function, which adds the address to Kit.
// The page asks that function first whether Kit is configured for this
// deployment; if it is not (or the function is missing, as under `vite dev`),
// the form stays off and says "Signups open soon".
const ENDPOINT = '/api/subscribe';

const ERRORS = {
  invalid_email: 'That address doesn’t look right. Check it and try again.',
  default: 'That didn’t go through. Try again in a minute.',
};

export default function SignupForm() {
  const [enabled, setEnabled] = useState(null); // null while checking
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    fetch(ENDPOINT, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d) => { if (live) setEnabled(d?.enabled === true); })
      .catch(() => { if (live) setEnabled(false); });
    return () => { live = false; };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!enabled || state === 'sending') return;
    const form = new FormData(e.currentTarget);
    setState('sending');
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: form.get('email'), company: form.get('company') }),
      });
      if (res.ok) { setState('done'); setEmail(''); return; }
      const body = await res.json().catch(() => ({}));
      if (body.error === 'not_configured') setEnabled(false);
      setError(ERRORS[body.error] ?? ERRORS.default);
      setState('error');
    } catch {
      setError(ERRORS.default);
      setState('error');
    }
  };

  const off = enabled !== true;

  return (
    <section aria-labelledby="signup-heading" className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
      <h2 id="signup-heading" className="text-[14px] font-semibold text-slate-800">Weekly updates</h2>
      <p className="mt-1 text-[13px] text-slate-600 leading-snug">
        One email a week with new pauses, votes and rule changes across Illinois.
      </p>

      {state === 'done' ? (
        <p role="status" className="mt-3 text-[13px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
          You're signed up. Watch for the next weekly update.
        </p>
      ) : (
        <form onSubmit={submit} className="relative mt-3 space-y-2">
          {/* Honeypot. Hidden from people and screen readers; checked again on the server. */}
          <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
            <label>Company <input type="text" name="company" tabIndex={-1} autoComplete="off" /></label>
          </div>

          <label htmlFor="signup-email" className="block text-[12px] font-medium text-slate-600">Email</label>
          <div className="flex gap-2">
            <input
              id="signup-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
              disabled={off}
              className="min-w-0 flex-1 text-[14px] bg-white border border-slate-300 rounded-md px-2.5 py-1.5 placeholder:text-slate-400 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
            <button
              type="submit"
              disabled={off || state === 'sending'}
              className="shrink-0 text-[13px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md px-3 py-1.5 shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {state === 'sending' ? 'Sending…' : 'Sign up'}
            </button>
          </div>
          {enabled === false && (
            <p className="text-[12px] text-slate-500">Signups open soon.</p>
          )}
          {state === 'error' && (
            <p role="alert" className="text-[12px] text-red-700">{error}</p>
          )}
        </form>
      )}
    </section>
  );
}
