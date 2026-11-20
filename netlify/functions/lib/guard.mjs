// Shared request guards for the Docky relay functions.
// Keys live only in Netlify environment variables. Nothing here is sent to the browser.

const WINDOW_MS = 10 * 60 * 1000;
const buckets = new Map();

export function env(name, fallback = '') {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders }
  });
}

// Same-origin check. Browsers always send Origin on cross-origin POST requests.
// ALLOWED_ORIGINS (comma separated) can add extra origins, e.g. a custom domain or local dev.
export function originAllowed(req) {
  const origin = req.headers.get('origin');
  if (!origin) return true; // same-origin navigation or non-browser client; rate limit still applies
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const requestHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || new URL(req.url).host;
  if (originHost === requestHost) return true;
  const extra = env('ALLOWED_ORIGINS')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return extra.includes(origin);
}

// Best-effort per-IP limit. Resets when a function instance is recycled, so it slows abuse
// rather than guaranteeing a hard cap. Pair with spend limits in the Google and ElevenLabs dashboards.
export function rateLimited(req, context, bucketName, maxRequests) {
  const ip =
    (context && context.ip) ||
    req.headers.get('x-nf-client-connection-ip') ||
    req.headers.get('x-forwarded-for') ||
    'unknown';
  const key = `${bucketName}:${ip}`;
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= maxRequests) {
    buckets.set(key, hits);
    return true;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) buckets.clear();
  return false;
}

export async function readJson(req, maxBytes) {
  const lengthHeader = Number(req.headers.get('content-length') || 0);
  if (lengthHeader && lengthHeader > maxBytes) return { error: 'too_large' };
  const raw = await req.text();
  if (raw.length > maxBytes) return { error: 'too_large' };
  try {
    return { data: JSON.parse(raw) };
  } catch {
    return { error: 'bad_json' };
  }
}
