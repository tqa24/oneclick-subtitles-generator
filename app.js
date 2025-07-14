/**
 * Express application configuration
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Import configuration
const { CORS_ORIGIN, VIDEOS_DIR, SUBTITLES_DIR, NARRATION_DIR, ensureDirectories } = require('./server/config');

// Import routes
const videoRoutes = require('./server/routes/videoRoutes');
const subtitleRoutes = require('./server/routes/subtitleRoutes');
const cacheRoutes = require('./server/routes/cacheRoutes');
const updateRoutes = require('./server/routes/updateRoutes');
const lyricsRoutes = require('./server/routes/lyricsRoutes');
const geminiImageRoutes = require('./server/routes/geminiImageRoutes');
const settingsRoutes = require('./server/routes/settingsRoutes');
const douyinRoutes = require('./server/routes/douyinRoutes');
const allSitesRoutes = require('./server/routes/allSitesRoutes');
const narrationRoutes = require('./server/routes/narrationRoutes');
const testAudioRoute = require('./server/routes/testAudioRoute');
const qualityScanRoutes = require('./server/routes/qualityScanRoutes');
const videoCompatibilityRoutes = require('./server/routes/videoCompatibilityRoutes');
const downloadOnlyRoutes = require('./server/routes/downloadOnlyRoutes');
const diagnosticsRoutes = require('./server/routes/diagnostics');
const { scanModels } = require('./server/utils/scan-models');

// Initialize Express app
const app = express();

// Ensure directories exist
ensureDirectories();

// Configure CORS with all needed methods
app.use(cors({
  origin: CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Expires'],
  credentials: true
}));

// Add CORS headers to all responses for health endpoint
app.use('/api/health', (req, res, next) => {
  const origin = req.headers.origin;
  // If CORS_ORIGIN is an array, check if the request origin is in the allowed list
  if (Array.isArray(CORS_ORIGIN) && origin) {
    if (CORS_ORIGIN.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    } else {
      // Default to the first origin in the list
      res.header('Access-Control-Allow-Origin', CORS_ORIGIN[0]);
    }
  } else {
    // If CORS_ORIGIN is a string, use it directly
    res.header('Access-Control-Allow-Origin', CORS_ORIGIN);
  }
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma, Expires');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Configure JSON body parser with increased limit for base64 encoded files
app.use(express.json({ limit: '500mb' }));

// Serve static directories with CORS headers
const staticOptions = {
  setHeaders: (res, path, stat) => {
    // Get the request origin from the request object
    const req = res.req;
    const origin = req.headers.origin;

    // If CORS_ORIGIN is an array, check if the request origin is in the allowed list
    if (Array.isArray(CORS_ORIGIN) && origin) {
      if (CORS_ORIGIN.includes(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
      } else {
        // Default to the first origin in the list
        res.set('Access-Control-Allow-Origin', CORS_ORIGIN[0]);
      }
    } else {
      // If CORS_ORIGIN is a string, use it directly
      res.set('Access-Control-Allow-Origin', CORS_ORIGIN);
    }

    res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma, Expires');
    res.set('Access-Control-Allow-Credentials', 'true');
  }
};

app.use('/videos', express.static(VIDEOS_DIR, staticOptions));
app.use('/videos/album_art', express.static(path.join(VIDEOS_DIR, 'album_art'), staticOptions));
app.use('/subtitles', express.static(SUBTITLES_DIR, staticOptions));
app.use('/narration', express.static(NARRATION_DIR, staticOptions));
app.use('/public', express.static(path.join(__dirname, 'public'), staticOptions));
app.use('/public/videos/album_art', express.static(path.join(__dirname, 'public', 'videos', 'album_art'), staticOptions));

// Add CORS headers to all responses
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // If CORS_ORIGIN is an array, check if the request origin is in the allowed list
  if (Array.isArray(CORS_ORIGIN) && origin) {
    if (CORS_ORIGIN.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    } else {
      // Default to the first origin in the list
      res.header('Access-Control-Allow-Origin', CORS_ORIGIN[0]);
    }
  } else {
    // If CORS_ORIGIN is a string, use it directly
    res.header('Access-Control-Allow-Origin', CORS_ORIGIN);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, Pragma, Expires');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// Test endpoint to verify server is working
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Health check endpoint for frontend to verify server connection
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is healthy', timestamp: new Date().toISOString() });
});

// Endpoint to save localStorage data for server-side use
app.post('/api/save-local-storage', express.json(), (req, res) => {
  try {
    const localStorageData = req.body;


    // Save to a file
    const localStoragePath = path.join(__dirname, 'localStorage.json');
    fs.writeFileSync(localStoragePath, JSON.stringify(localStorageData, null, 2));


    res.json({ success: true, message: 'localStorage data saved successfully' });
  } catch (error) {
    console.error('Error saving localStorage data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Register API routes
app.use('/api', videoRoutes);
app.use('/api', subtitleRoutes);
app.use('/api', cacheRoutes);
app.use('/api', updateRoutes);
app.use('/api', lyricsRoutes);
app.use('/api', settingsRoutes);
app.use('/api', douyinRoutes);
app.use('/api', allSitesRoutes);
app.use('/api', qualityScanRoutes);
app.use('/api', downloadOnlyRoutes);
app.use('/api/video', videoCompatibilityRoutes);
app.use('/api/gemini', geminiImageRoutes);
app.use('/api/narration', narrationRoutes);
app.use('/api/test', testAudioRoute);
app.use('/api/diagnostics', diagnosticsRoutes);

// Simple model scanning endpoint - no Python bullshit!
app.post('/api/scan-models', async (req, res) => {
  try {
    console.log('🔍 Model scan requested');
    const success = scanModels();

    if (success) {
      res.json({
        success: true,
        message: 'Models scanned successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to scan models'
      });
    }
  } catch (error) {
    console.error('Error scanning models:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = app;
