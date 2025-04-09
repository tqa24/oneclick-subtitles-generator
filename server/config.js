/**
 * Server configuration and directory setup
 */

const path = require('path');
const fs = require('fs');

// Check if we're running in Electron
const isElectron = process.versions && process.versions.electron;
let app;

// Only try to require Electron if we're running in Electron
if (isElectron) {
  try {
    // First try to get app from electron
    try {
      app = require('electron').app;
      console.log('Successfully loaded electron module');
    } catch (electronError) {
      console.log('Failed to load electron module:', electronError.message);

      // If that fails, try to get it from @electron/remote
      try {
        app = require('@electron/remote').app;
        console.log('Successfully loaded @electron/remote module');
      } catch (remoteError) {
        console.log('Failed to load @electron/remote module:', remoteError.message);
      }
    }
  } catch (error) {
    console.log('Not running in Electron or Electron modules not available');
  }
}

// If we couldn't get the app object, create a mock one for fallback
if (!app && isElectron) {
  console.log('Creating mock app object for fallback');
  app = {
    getPath: (name) => {
      // In case we can't get the real app object, use environment variables or defaults
      if (name === 'userData') {
        return process.env.APPDATA ||
               (process.platform === 'darwin' ?
                 process.env.HOME + '/Library/Application Support' :
                 process.env.HOME + '/.local/share');
      }
      return process.cwd();
    }
  };
}

// Server configuration
const PORT = process.env.PORT || 3004;
const SERVER_URL = 'http://localhost:3004';
const CORS_ORIGIN = process.env.NODE_ENV === 'production' ? '*' : 'http://localhost:3005';

// Directory paths - use app.getPath('userData') in Electron for proper data storage
let VIDEOS_DIR, SUBTITLES_DIR;

// Check for environment variables first (set by Electron main process)
if (process.env.VIDEOS_DIR && process.env.SUBTITLES_DIR) {
  VIDEOS_DIR = process.env.VIDEOS_DIR;
  SUBTITLES_DIR = process.env.SUBTITLES_DIR;
  console.log(`Using environment paths: VIDEOS_DIR=${VIDEOS_DIR}, SUBTITLES_DIR=${SUBTITLES_DIR}`);
} else if (isElectron && app) {
  // In Electron, store in user data directory
  const userDataPath = app.getPath('userData');
  VIDEOS_DIR = path.join(userDataPath, 'videos');
  SUBTITLES_DIR = path.join(userDataPath, 'subtitles');
  console.log(`Using Electron paths: VIDEOS_DIR=${VIDEOS_DIR}, SUBTITLES_DIR=${SUBTITLES_DIR}`);
} else {
  // In standalone mode, use relative paths
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
