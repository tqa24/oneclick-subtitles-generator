/**
 * Shared utilities for FFmpeg operations
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// --- Binary resolution: prefer binaries BUNDLED with the app over a system install ---
// Every install ships working ffmpeg AND ffprobe inside node_modules (Remotion's per-platform
// compositor package, plus @ffmpeg-installer for ffmpeg), so the app never depends on the customer
// having ffmpeg/ffprobe on PATH. Resolution is computed once and cached.
let _ffmpegPathCache = null;
let _ffprobePathCache = null;

// Locate a bundled binary ('ffmpeg' | 'ffprobe') inside Remotion's per-platform compositor package.
function findRemotionBinary(name) {
  try {
    const remotionScope = path.dirname(path.dirname(require.resolve('@remotion/renderer/package.json')));
    const exe = process.platform === 'win32' ? `${name}.exe` : name;
    for (const entry of fs.readdirSync(remotionScope)) {
      if (entry.startsWith('compositor-')) {
        const candidate = path.join(remotionScope, entry, exe);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  } catch (e) { /* Remotion not installed / not resolvable */ }
  return null;
}

// Resolve a bundled path for 'ffmpeg' or 'ffprobe', or null if none is bundled.
function findBundledBinary(name) {
  if (name === 'ffmpeg') {
    try {
      const installerPath = require('@ffmpeg-installer/ffmpeg').path;
      if (installerPath && fs.existsSync(installerPath)) return installerPath;
    } catch (e) { /* @ffmpeg-installer not present */ }
  }
  return findRemotionBinary(name);
}

// Shared resolution: bundled binary first (guaranteed present for every install), then known
// system install locations, then the bare name on PATH as a last resort.
function resolveBinaryPath(name) {
  const bundled = findBundledBinary(name);
  if (bundled) return bundled;

  if (process.platform === 'win32') {
    const exe = `${name}.exe`;
    const candidates = [
      `C:\\ffmpeg\\bin\\${exe}`,
      `C:\\Program Files\\ffmpeg\\bin\\${exe}`,
      `C:\\Program Files (x86)\\ffmpeg\\bin\\${exe}`,
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps', exe),
      path.join(process.env.USERPROFILE || '', 'ffmpeg', 'bin', exe),
      path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'chocolatey', 'bin', exe),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return exe; // last resort: rely on PATH
  }
  return name; // non-Windows: rely on PATH
}

/**
 * Get the path to the ffmpeg executable (bundled binary preferred, then system, then PATH).
 * @returns {string} - Path to ffmpeg executable
 */
function getFfmpegPath() {
  if (!_ffmpegPathCache) _ffmpegPathCache = resolveBinaryPath('ffmpeg');
  return _ffmpegPathCache;
}

/**
 * Get the path to the ffprobe executable (bundled binary preferred, then system, then PATH).
 * @returns {string} - Path to ffprobe executable
 */
function getFfprobePath() {
  if (!_ffprobePathCache) _ffprobePathCache = resolveBinaryPath('ffprobe');
  return _ffprobePathCache;
}

/**
 * Test if ffmpeg is available and working
 * @returns {Promise<boolean>} - True if ffmpeg is available
 */
async function testFfmpegAvailability() {
  return new Promise((resolve) => {
    const ffmpegPath = getFfmpegPath();
    const testProcess = spawn(ffmpegPath, ['-version']);
    
    testProcess.on('close', (code) => {
      resolve(code === 0);
    });
    
    testProcess.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Test if ffprobe is available and working
 * @returns {Promise<boolean>} - True if ffprobe is available
 */
async function testFfprobeAvailability() {
  return new Promise((resolve) => {
    const ffprobePath = getFfprobePath();
    const testProcess = spawn(ffprobePath, ['-version']);
    
    testProcess.on('close', (code) => {
      resolve(code === 0);
    });
    
    testProcess.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Get diagnostic information about ffmpeg/ffprobe availability
 * @returns {Promise<Object>} - Diagnostic information
 */
async function getDiagnosticInfo() {
  const ffmpegPath = getFfmpegPath();
  const ffprobePath = getFfprobePath();
  
  const [ffmpegAvailable, ffprobeAvailable] = await Promise.all([
    testFfmpegAvailability(),
    testFfprobeAvailability()
  ]);

  return {
    ffmpegPath,
    ffprobePath,
    ffmpegAvailable,
    ffprobeAvailable,
    platform: process.platform,
    pathEnv: process.env.PATH
  };
}

module.exports = {
  getFfmpegPath,
  getFfprobePath,
  testFfmpegAvailability,
  testFfprobeAvailability,
  getDiagnosticInfo
};
