/**
 * Local server for downloading YouTube videos
 * This server handles downloading YouTube videos to a local 'videos' directory
 * Also handles caching of subtitles to avoid repeated Gemini API calls
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

// Import configuration
const { PORT, CORS_ORIGIN, VIDEOS_DIR, SUBTITLES_DIR, ensureDirectories } = require('./server/config');

// Import routes
const videoRoutes = require('./server/routes/videoRoutes');
const subtitleRoutes = require('./server/routes/subtitleRoutes');
const cacheRoutes = require('./server/routes/cacheRoutes');
const updateRoutes = require('./server/routes/updateRoutes');

// Initialize Express app
const app = express();

// Ensure directories exist
ensureDirectories();

// Configure CORS with all needed methods
app.use(cors({
  origin: CORS_ORIGIN,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Configure JSON body parser with increased limit for base64 encoded files
app.use(express.json({ limit: '500mb' }));

// Serve static directories
app.use('/videos', express.static(path.join(__dirname, 'videos')));
app.use('/subtitles', express.static(path.join(__dirname, 'subtitles')));

// Test endpoint to verify server is working
app.get('/api/test', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Register API routes
app.use('/api', videoRoutes);
app.use('/api', subtitleRoutes);
app.use('/api', cacheRoutes);
app.use('/api', updateRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`YouTube download server running on port ${PORT}`);
  console.log(`Videos directory: ${VIDEOS_DIR}`);
  console.log(`Subtitles directory: ${SUBTITLES_DIR}`);
});