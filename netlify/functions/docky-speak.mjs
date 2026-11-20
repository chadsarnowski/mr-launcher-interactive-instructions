// POST /api/docky-speak
// Body: { text: string }
// Returns: audio/mpeg stream, or JSON error (browser then falls back to built-in speech)
import { env, json, originAllowed, rateLimited, readJson } from './lib/guard.mjs';

const MAX_TEXT_CHARS = 2500;

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!originAllowed(req)) return json(403, { error: 'origin_not_allowed' });

  const apiKey = env('ELEVENLABS_API_KEY');
  if (!apiKey) return json(503, { error: 'voice_not_configured' });

  if (rateLimited(req, context, 'speak', Number(env('DOCKY_SPEAK_LIMIT_PER_10_MIN', '20')))) {
    return json(429, { error: 'rate_limited' });
  }

  const { data, error } = await readJson(req, 64 * 1024);
  if (error) return json(400, { error: 'bad_request' });

  const text = typeof data.text === 'string' ? data.text.trim().slice(0, MAX_TEXT_CHARS) : '';
  if (!text) return json(400, { error: 'empty_text' });

  const voiceId = env('ELEVENLABS_VOICE_ID', 'nPczCjzI2devNBz1zQrb');
  if (!/^[A-Za-z0-9]+$/.test(voiceId)) return json(500, { error: 'bad_voice_config' });

  const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey, Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: env('ELEVENLABS_MODEL_ID', 'eleven_turbo_v2_5'),
      voice_settings: { stability: 0.5, similarity_boost: 0.8 }
    })
  }).catch((err) => {
    console.warn(`ElevenLabs request error: ${err.message}`);
    return null;
  });

  if (!upstream || !upstream.ok) {
    if (upstream) console.warn(`ElevenLabs HTTP ${upstream.status}: ${(await upstream.text().catch(() => '')).slice(0, 300)}`);
    return json(502, { error: 'voice_unavailable' });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' }
  });
};

export const config = { path: '/api/docky-speak' };
