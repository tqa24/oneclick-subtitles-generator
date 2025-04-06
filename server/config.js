/**
 * Server configuration and directory setup
 */

const path = require('path');
const fs = require('fs');

// Server configuration
const PORT = process.env.PORT || 3004;
const SERVER_URL = 'http://localhost:3004';
const CORS_ORIGIN = 'http://localhost:3005';

// Directory paths
const VIDEOS_DIR = path.join(__dirname, '..', 'videos');
const SEGMENTS_DIR = path.join(__dirname, '..', 'segments');
const SUBTITLES_DIR = path.join(__dirname, '..', 'subtitles');

// Ensure directories exist
const ensureDirectories = () => {
  // Ensure videos directory exists
  if (!fs.existsSync(VIDEOS_DIR)) {
    fs.mkdirSync(VIDEOS_DIR, { recursive: true });
    console.log(`Created videos directory at ${VIDEOS_DIR}`);
  }

  // Ensure segments directory exists
  if (!fs.existsSync(SEGMENTS_DIR)) {
    fs.mkdirSync(SEGMENTS_DIR, { recursive: true });
    console.log(`Created segments directory at ${SEGMENTS_DIR}`);
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
  SEGMENTS_DIR,
  SUBTITLES_DIR,
  ensureDirectories
};
