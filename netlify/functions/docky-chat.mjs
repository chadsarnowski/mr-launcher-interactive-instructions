// POST /api/docky-chat
// Body: { query: string, attachment?: { mimeType: string, base64: string } }
// Returns: { reply: string } or { error: string }
import { DOCKY_SYSTEM_PROMPT } from './lib/docky-system-prompt.mjs';
import { env, json, originAllowed, rateLimited, readJson } from './lib/guard.mjs';

const MAX_BODY_BYTES = 5 * 1024 * 1024; // Netlify caps synchronous function payloads near 6 MB
const MAX_QUERY_CHARS = 2000;
const ALLOWED_MIME = /^(image\/(jpeg|png|webp|heic|heif)|video\/(mp4|quicktime|webm|3gpp))$/;
const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.1-flash-lite'];

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!originAllowed(req)) return json(403, { error: 'origin_not_allowed' });

  const apiKey = env('GEMINI_API_KEY');
  if (!apiKey) return json(503, { error: 'ai_not_configured' });

  if (rateLimited(req, context, 'chat', Number(env('DOCKY_CHAT_LIMIT_PER_10_MIN', '30')))) {
    return json(429, { error: 'rate_limited' });
  }

  const { data, error } = await readJson(req, MAX_BODY_BYTES);
  if (error === 'too_large') return json(413, { error: 'attachment_too_large' });
  if (error) return json(400, { error: 'bad_request' });

  const query = typeof data.query === 'string' ? data.query.slice(0, MAX_QUERY_CHARS) : '';
  const LANGUAGES = { en: 'English', es: 'Spanish', zh: 'Simplified Chinese', tl: 'Tagalog', vi: 'Vietnamese' };
  const language = LANGUAGES[typeof data.lang === 'string' ? data.lang : 'en'] || 'English';
  const attachment = data.attachment && typeof data.attachment === 'object' ? data.attachment : null;

  if (attachment) {
    if (typeof attachment.mimeType !== 'string' || !ALLOWED_MIME.test(attachment.mimeType)) {
      return json(415, { error: 'unsupported_media' });
    }
    if (typeof attachment.base64 !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(attachment.base64)) {
      return json(400, { error: 'bad_attachment' });
    }
  }
  if (!query && !attachment) return json(400, { error: 'empty_request' });

  const userText =
    query ||
    'Please review this installation photo/video and provide your assessment against the manual: identify visible parts, plumbness, framing, and cable winding, and cite manual pages.';

  const parts = [
    {
      text: `READER'S MANUAL LANGUAGE: ${language}. Reply in the language the user writes in; if unclear, reply in ${language}. Keep page link syntax, item numbers, measurements, and wire colors exact.\n\nUSER QUESTION: ${userText}`
    }
  ];
  if (attachment) {
    parts.push({ inline_data: { mime_type: attachment.mimeType, data: attachment.base64 } });
  }

  const requestBody = {
    system_instruction: { parts: [{ text: DOCKY_SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
  };

  const models = [env('GEMINI_MODEL'), ...env('GEMINI_FALLBACK_MODELS').split(','), ...DEFAULT_MODELS]
    .map((m) => m.trim())
    .filter((m, i, arr) => m && /^[a-z0-9.\-]+$/.test(m) && arr.indexOf(m) === i);

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(requestBody)
        }
      );
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.warn(`Gemini model ${model} failed with HTTP ${response.status}: ${detail.slice(0, 300)}`);
        // Auth and quota failures will not succeed on another model
        if (response.status === 401 || response.status === 403 || response.status === 429) break;
        continue;
      }
      const result = await response.json();
      const reply = (result.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text || '')
        .join('')
        .trim();
      if (reply) return json(200, { reply, model });
    } catch (err) {
      console.warn(`Gemini model ${model} request error: ${err.message}`);
    }
  }

  return json(502, { error: 'ai_unavailable' });
};

export const config = { path: '/api/docky-chat' };
