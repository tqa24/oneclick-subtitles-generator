/**
 * BASE engine installer — the always-available light Python bits.
 *
 * Installs (into .venvs/base, its OWN venv):
 *   - the Flask narration server deps: flask, flask-cors, soundfile, numpy<1.26
 *   - edge-tts==7.2.7 and gtts==2.5.4 (pinned, like the source coreDeps block in setup-narration.js)
 *   - yt-dlp (intentionally NOT pinned — it must track YouTube changes)
 *
 * No torch. Commands/pins/constraints are reproduced verbatim from setup-narration.js (the core
 * dependencies block ~lines 806-864) and install-yt-dlp.js, swapping only the venv path to the
 * per-engine .venvs/base via `--python "${venv}"`.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getEngineVenvTarget, projectRoot } = require('../venvPaths');
const { executeWithRetry, runCommand } = require('./execHelpers');

const ID = 'base';

const NARRATION_CONSTRAINTS_FILE = path.join(projectRoot, 'narration-constraints.txt');
function getNarrationConstraintArgs() {
  return fs.existsSync(NARRATION_CONSTRAINTS_FILE) ? ['-c', NARRATION_CONSTRAINTS_FILE] : [];
}

async function install({ onLog = () => {} } = {}) {
  const log = (m) => onLog(String(m));
  const logger = {
    info: log, warning: log, progress: log, command: log, success: log,
    found: log, installing: log, subsection: log, step: () => {}, error: log,
  };

  const venv = getEngineVenvTarget(ID);

  // --- 1. Create the per-engine venv -------------------------------------------------------------
  logger.subsection(`Creating base venv at ${venv}`);
  await runCommand('uv', ['venv', venv, '-p', 'python3.11'], { label: 'base venv create', logger });

  // --- 2. Core light dependencies (from setup-narration.js coreDeps block) ------------------------
  // Only the base-relevant subset: Flask server + soundfile/numpy + edge-tts/gtts. Pins preserved.
  logger.progress('Installing core base dependencies (flask, soundfile, edge-tts, gtts)');
  const coreDeps = [
    // Flask server dependencies (for narrationApp.py)
    'flask',
    'flask-cors',

    // Audio I/O
    'soundfile',
    'numpy<1.26',

    // Additional TTS libraries (pinned for reproducible installs; bump deliberately like the
    // TTS engines. yt-dlp is intentionally NOT pinned -- it must track YouTube changes.)
    'edge-tts==7.2.7',  // Microsoft Edge TTS
    'gtts==2.5.4',      // Google Text-to-Speech
  ];

  await executeWithRetry(
    'uv',
    ['pip', 'install', '--python', venv, ...getNarrationConstraintArgs(), ...coreDeps],
    { label: 'core base dependencies', env: { UV_HTTP_TIMEOUT: '300' }, logger }
  );
  logger.success('Core base dependencies installed (including edge-tts and gtts)');

  // --- 3. yt-dlp (from install-yt-dlp.js) --------------------------------------------------------
  // Not pinned: yt-dlp must auto-update to keep up with YouTube changes.
  logger.installing('yt-dlp');
  await executeWithRetry(
    'uv',
    ['pip', 'install', '--python', venv, 'yt-dlp'],
    { label: 'yt-dlp', env: { UV_HTTP_TIMEOUT: '300' }, logger }
  );
  logger.success('yt-dlp installed successfully');

  // --- 4. Verify yt-dlp runs ---------------------------------------------------------------------
  const isWindows = os.platform() === 'win32';
  const venvBinDir = isWindows ? 'Scripts' : 'bin';
  const ytdlpPath = path.join(venv, venvBinDir, isWindows ? 'yt-dlp.exe' : 'yt-dlp');
  // Fatal: yt-dlp is the one thing the base venv must provide — every download depends on it. If it
  // can't run, the install FAILS (engine reads not-installed) instead of being marked done broken.
  logger.progress('Verifying yt-dlp installation');
  let stdout;
  try {
    ({ stdout } = await runCommand(ytdlpPath, ['--version'], { label: 'yt-dlp verify', logger }));
  } catch (error) {
    logger.error(`yt-dlp verification failed: ${error.message}`);
    throw new Error(`Base install verification failed: yt-dlp could not run (${error.message})`);
  }
  logger.success(`yt-dlp version ${stdout.trim()} is installed and working`);
}

module.exports = { id: ID, install };
