// Vercel function: POST /api/subscribe adds an email to the Kit form named by
// KIT_FORM_ID. GET /api/subscribe tells the page whether signups are switched on,
// so the form can say "Signups open soon" instead of taking addresses it would
// drop when KIT_API_KEY / KIT_FORM_ID are not set for this environment.
//
// Kit v4 only adds an existing subscriber to a form, so this is two calls:
// create (an upsert) the subscriber, then add them to the form.
// https://developers.kit.com/api-reference/forms/add-subscriber-to-form-by-email-address

const KIT = 'https://api.kit.com/v4';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store' },
});

function config() {
  const apiKey = process.env.KIT_API_KEY?.trim();
  const formId = process.env.KIT_FORM_ID?.trim();
  return apiKey && /^\d+$/.test(formId ?? '') ? { apiKey, formId } : null;
}

async function kit(path, apiKey, body) {
  return fetch(`${KIT}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Kit-Api-Key': apiKey,
    },
    body: JSON.stringify(body),
  });
}

export function GET() {
  return json({ enabled: config() !== null });
}

export async function POST(request) {
  const cfg = config();
  if (!cfg) return json({ error: 'not_configured' }, 503);

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  // Honeypot. Real people never see this field; bots fill everything. Answer
  // as if it worked so a bot learns nothing.
  if (typeof data?.company === 'string' && data.company.trim()) return json({ ok: true });

  const email = typeof data?.email === 'string' ? data.email.trim() : '';
  if (email.length > 254 || !EMAIL_RE.test(email)) return json({ error: 'invalid_email' }, 400);

  // Where the signup came from, kept on the subscriber in Kit. Only an http(s)
  // page URL; anything else is dropped rather than stored.
  const ref = request.headers.get('referer') ?? '';
  const referrer = /^https?:\/\//i.test(ref) ? ref.slice(0, 500) : undefined;

  try {
    const created = await kit('/subscribers', cfg.apiKey, { email_address: email });
    if (created.status === 422) return json({ error: 'invalid_email' }, 400);
    if (!created.ok) {
      console.error('[subscribe] Kit create subscriber failed', created.status);
      return json({ error: 'upstream' }, 502);
    }

    const added = await kit(`/forms/${cfg.formId}/subscribers`, cfg.apiKey, { email_address: email, referrer });
    if (!added.ok) {
      console.error('[subscribe] Kit add to form failed', added.status);
      return json({ error: 'upstream' }, 502);
    }
    return json({ ok: true });
  } catch (err) {
    console.error('[subscribe] Kit request error', err?.message);
    return json({ error: 'upstream' }, 502);
  }
}
