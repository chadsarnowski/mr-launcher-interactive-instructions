/**
 * Docky public configuration.
 * This file is served to every visitor. NEVER put API keys or secrets here.
 * API keys live only in Netlify environment variables (see .env.example and README.md):
 *   GEMINI_API_KEY, GEMINI_MODEL, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID
 */

const DOCKY_CONFIG = {
  // Set to true if you want Docky to automatically read out answers
  AUTO_SPEAK_RESPONSES: false,

  // Hide the settings gear button from end users/installers
  HIDE_SETTINGS_FOR_INSTALLERS: true
};

const DOCKLY_CONFIG = DOCKY_CONFIG;
