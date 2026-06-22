/**
 * Install the always-available "base" Python environment (.venv): flask + edge-tts + gtts + yt-dlp.
 * Light, no torch — runs at install time (replaces the old heavy setup-narration.js step). The heavy
 * voice-cloning / transcription engines (F5-TTS, Chatterbox, Parakeet) install ON DEMAND from inside
 * the app (Settings -> Voice & transcription engines), so a fresh install stays small and fast.
 */

const base = require('./server/engines/installers/base');

base.install({ onLog: (message) => console.log(message) })
  .then(() => { console.log('✅ Base Python environment ready (yt-dlp + edge-tts + gtts).'); })
  .catch((error) => {
    console.error(`❌ Base environment install failed: ${error && error.message ? error.message : error}`);
    process.exit(1);
  });
