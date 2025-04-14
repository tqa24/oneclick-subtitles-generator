/**
 * Server configuration and directory setup
 */

const path = require('path');
const fs = require('fs');

// Server configuration
const PORT = process.env.PORT || 3004;
const SERVER_URL = 'http://localhost:3004';
const CORS_ORIGIN = process.env.NODE_ENV === 'production' ? '*' : 'http://localhost:3005';

// Directory paths
let VIDEOS_DIR, SUBTITLES_DIR;

// Check for environment variables first
if (process.env.VIDEOS_DIR && process.env.SUBTITLES_DIR) {
  VIDEOS_DIR = process.env.VIDEOS_DIR;
  SUBTITLES_DIR = process.env.SUBTITLES_DIR;
  console.log(`Using environment paths: VIDEOS_DIR=${VIDEOS_DIR}, SUBTITLES_DIR=${SUBTITLES_DIR}`);
} else {
  // Use relative paths
  VIDEOS_DIR = path.join(__dirname, '..', 'videos');
  SUBTITLES_DIR = path.join(__dirname, '..', 'subtitles');
  console.log(`Using relative paths: VIDEOS_DIR=${VIDEOS_DIR}, SUBTITLES_DIR=${SUBTITLES_DIR}`);
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
};

module.exports = {
  PORT,
  SERVER_URL,
  CORS_ORIGIN,
  VIDEOS_DIR,
  SUBTITLES_DIR,
  ensureDirectories
};
