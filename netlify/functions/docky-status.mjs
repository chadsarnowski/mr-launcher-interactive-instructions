// GET /api/docky-status
// Tells the browser which optional services are configured. Never returns key values.
import { env, json } from './lib/guard.mjs';

export default async () =>
  json(200, {
    ai: Boolean(env('GEMINI_API_KEY')),
    voice: Boolean(env('ELEVENLABS_API_KEY')),
    autoSpeak: env('DOCKY_AUTO_SPEAK', 'false') === 'true'
  });

export const config = { path: '/api/docky-status' };
