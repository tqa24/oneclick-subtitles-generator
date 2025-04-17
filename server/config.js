/**
 * Server configuration and directory setup
 */

const path = require('path');
const fs = require('fs');

// Server configuration
const PORT = process.env.PORT || 3007; // Changed from 3004 to avoid port conflicts
const SERVER_URL = 'http://localhost:3007'; // Changed from 3004 to match PORT
const CORS_ORIGIN = process.env.NODE_ENV === 'production' ? '*' : 'http://localhost:3008';

// Directory paths
let VIDEOS_DIR, SUBTITLES_DIR, NARRATION_DIR;

// Check for environment variables first
if (process.env.VIDEOS_DIR && process.env.SUBTITLES_DIR) {
  VIDEOS_DIR = process.env.VIDEOS_DIR;
  SUBTITLES_DIR = process.env.SUBTITLES_DIR;
  NARRATION_DIR = process.env.NARRATION_DIR || path.join(__dirname, '..', 'narration');
  console.log(`Using environment paths: VIDEOS_DIR=${VIDEOS_DIR}, SUBTITLES_DIR=${SUBTITLES_DIR}, NARRATION_DIR=${NARRATION_DIR}`);
} else {
  // Use relative paths
  VIDEOS_DIR = path.join(__dirname, '..', 'videos');
  SUBTITLES_DIR = path.join(__dirname, '..', 'subtitles');
  NARRATION_DIR = path.join(__dirname, '..', 'narration');
  console.log(`Using relative paths: VIDEOS_DIR=${VIDEOS_DIR}, SUBTITLES_DIR=${SUBTITLES_DIR}, NARRATION_DIR=${NARRATION_DIR}`);
}

// Ensure directories exist
const ensureDirectories = () => {
  // Ensure videos directory exists
  if (!fs.existsSync(VIDEOS_DIR)) {
    fs.mkdirSync(VIDEOS_DIR, { recursive: true });
    console.log(`Created videos directory at ${VIDEOS_DIR}`);
  }

  // Ensure subtitles directory exists
  if (!fs.existsSync(SUBTITLES_DIR)) {
    fs.mkdirSync(SUBTITLES_DIR, { recursive: true });
    console.log(`Created subtitles directory at ${SUBTITLES_DIR}`);
  }

  // Ensure narration directory exists
  if (!fs.existsSync(NARRATION_DIR)) {
    fs.mkdirSync(NARRATION_DIR, { recursive: true });
    console.log(`Created narration directory at ${NARRATION_DIR}`);
  }

  // Ensure narration subdirectories exist
  const REFERENCE_AUDIO_DIR = path.join(NARRATION_DIR, 'reference');
  const OUTPUT_AUDIO_DIR = path.join(NARRATION_DIR, 'output');

  if (!fs.existsSync(REFERENCE_AUDIO_DIR)) {
    fs.mkdirSync(REFERENCE_AUDIO_DIR, { recursive: true });
    console.log(`Created reference audio directory at ${REFERENCE_AUDIO_DIR}`);
  }

  if (!fs.existsSync(OUTPUT_AUDIO_DIR)) {
    fs.mkdirSync(OUTPUT_AUDIO_DIR, { recursive: true });
    console.log(`Created output audio directory at ${OUTPUT_AUDIO_DIR}`);
  }
};

module.exports = {
  PORT,
  SERVER_URL,
  CORS_ORIGIN,
  VIDEOS_DIR,
  SUBTITLES_DIR,
  NARRATION_DIR,
  ensureDirectories
};
