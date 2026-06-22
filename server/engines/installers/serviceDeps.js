/**
 * Web-server / IO dependencies the engine SERVICES import at runtime — Flask for the F5-TTS narration
 * server (server/narrationApp.py), FastAPI+uvicorn for the Chatterbox and Parakeet services
 * (chatterbox-fastapi/*.py, parakeet_wrapper/app.py).
 *
 * In the old single shared `.venv` these came once from setup-narration.js's coreDeps block, so every
 * engine had them. With per-engine venvs each engine must install them itself: the AI packages
 * (torch / f5-tts / chatterbox / onnx-asr) do NOT pull a web framework, so without this an engine
 * installs + verifies fine but dies at startup with `ModuleNotFoundError: No module named 'uvicorn'`.
 * Centralized here so the list has one home (CLAUDE.md: a single way to do each thing).
 */

const path = require('path');
const fs = require('fs');
const { executeWithRetry } = require('./execHelpers');
const { projectRoot } = require('../venvPaths');

const NARRATION_CONSTRAINTS_FILE = path.join(projectRoot, 'narration-constraints.txt');
const constraintArgs = () => (fs.existsSync(NARRATION_CONSTRAINTS_FILE) ? ['-c', NARRATION_CONSTRAINTS_FILE] : []);

// Mirrors the service-relevant subset of setup-narration.js coreDeps (the engine packages already
// pull numpy/soundfile/huggingface_hub transitively, so only the web layer is listed here).
const SERVICE_DEPS = [
  'flask', 'flask-cors', 'requests',                 // F5-TTS narration server (narrationApp.py)
  'fastapi>=0.104.0', 'uvicorn[standard]>=0.24.0',   // Chatterbox + Parakeet FastAPI services
  'python-multipart>=0.0.6', 'pydantic>=2.0.0', 'click', // FastAPI form uploads / uvicorn CLI
  'pydub',                                           // Parakeet audio IO (app.py: AudioSegment)
  'huggingface_hub',                                 // model downloads — onnx_asr (Parakeet) + F5-TTS
  'python-dateutil',                                 // required by transformers / various utilities
  // Build backend for the source installs (F5-TTS, Chatterbox use --no-build-isolation, and `uv venv`
  // ships no setuptools). Pinned <81 because >=81 dropped pkg_resources, which resemble-perth imports.
  'setuptools<81', 'wheel',
];

async function installServiceDeps(venv, { logger } = {}) {
  if (logger && logger.progress) logger.progress('Installing engine service dependencies (flask / fastapi / uvicorn)');
  await executeWithRetry(
    'uv',
    ['pip', 'install', '--python', venv, ...constraintArgs(), ...SERVICE_DEPS],
    { label: 'engine service dependencies', env: { UV_HTTP_TIMEOUT: '300' }, logger }
  );
}

module.exports = { installServiceDeps, SERVICE_DEPS };
