import { useState } from 'react';

// The site had no form or email service when this page was added, so the
// form posts to whatever endpoint VITE_SIGNUP_ENDPOINT names (a Formspree,
// Basin, Getform, or similar form URL that accepts a POST with an `email`
// field and answers JSON). Until that is set, the form shows as not yet open
// rather than pretending to take addresses it would drop.
const ENDPOINT = import.meta.env.VITE_SIGNUP_ENDPOINT;

export default function SignupForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const connected = Boolean(ENDPOINT);

  const submit = async (e) => {
    e.preventDefault();
    if (!connected || state === 'sending') return;
    const form = new FormData(e.currentTarget);
    if (form.get('company')) return; // honeypot: bots fill every field
    form.delete('company');
    setState('sending');
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        body: form,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(String(res.status));
      setState('done');
      setEmail('');
    } catch {
      setState('error');
    }
  };

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
          <input type="hidden" name="list" value="illinois-weekly" />
          <input type="hidden" name="_subject" value="Illinois data center rules: weekly signup" />
          {/* Honeypot. Hidden from people and screen readers. */}
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
              disabled={!connected}
              className="min-w-0 flex-1 text-[14px] bg-white border border-slate-300 rounded-md px-2.5 py-1.5 placeholder:text-slate-400 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
            <button
              type="submit"
              disabled={!connected || state === 'sending'}
              className="shrink-0 text-[13px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md px-3 py-1.5 shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {state === 'sending' ? 'Sending…' : 'Sign up'}
            </button>
          </div>
          {!connected && (
            <p className="text-[12px] text-slate-500">Signups open soon.</p>
          )}
          {state === 'error' && (
            <p role="alert" className="text-[12px] text-red-700">
              That didn't go through. Check the address and try again.
            </p>
          )}
        </form>
      )}
    </section>
  );
}
