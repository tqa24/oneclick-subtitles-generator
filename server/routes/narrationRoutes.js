/**
 * Routes for narration-related endpoints
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const narrationController = require('../controllers/narrationController');
const narrationServiceClient = require('../services/narrationServiceClient');

// Ensure narration directories exist
narrationController.ensureNarrationDirectories();

// Import narration directory from config
const { NARRATION_DIR } = require('../config');

// Set up multer for file uploads
const REFERENCE_AUDIO_DIR = path.join(NARRATION_DIR, 'reference');
const upload = multer({ dest: REFERENCE_AUDIO_DIR });

// Serve narration audio files - use * to capture all path segments
router.get('/audio/*', (req, res) => {
  // Extract the filename from the URL path
  const filename = req.path.replace('/audio/', '');

  // Call the controller with the extracted filename
  narrationController.serveAudioFile({ params: { filename } }, res);
});

// Download all narration audio files as a zip
router.post('/download-all', express.json(), narrationController.downloadAllAudio);

// Download aligned narration audio (one file)
router.post('/download-aligned', express.json(), narrationController.downloadAlignedAudio);

// Record reference audio
router.post('/record-reference', upload.single('audio_data'), narrationController.recordReference);

// Upload reference audio
router.post('/upload-reference', upload.single('file'), narrationController.uploadReference);

// Generate narration
router.post('/generate', narrationController.generateNarration);

// Get narration service status
router.get('/status', narrationController.getNarrationStatus);

// Clear narration output files
router.post('/clear-output', narrationController.clearOutput);

// Save Gemini audio data to disk
router.post('/save-gemini-audio', express.json({ limit: '10mb' }), narrationController.saveGeminiAudio);

// Save F5-TTS audio data to disk
router.post('/save-f5tts-audio', express.json({ limit: '10mb' }), narrationController.saveF5TTSAudio);

// Proxy all other narration requests to the Python service
router.use('/', async (req, res, next) => {
  // Skip endpoints we handle directly
  if (req.url === '/status' || req.url === '/download-all' || req.url === '/download-aligned' ||
      req.url === '/generate' || req.url === '/record-reference' || req.url === '/upload-reference' ||
      req.url === '/clear-output' || req.url === '/save-gemini-audio' ||
      req.url === '/save-f5tts-audio' || req.url.startsWith('/audio/')) {
    return next();
  }

  // Removed proxying log

  // Check if the narration service is available
  const serviceStatus = await narrationServiceClient.checkService();
  if (!serviceStatus.available) {
    // Removed service not available log
    return res.status(503).json({
      success: false,
      error: 'Narration service is not available. Please use npm run dev:cuda to start with Python narration service.'
    });
  }

  // Special handling for multipart form data (file uploads)
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    // Removed multipart form data logging

    // Create a proxy request
    const http = require('http');
    const narrationUrl = `http://localhost:${narrationServiceClient.getNarrationPort()}/api/narration${req.url}`;
    const proxyReq = http.request(narrationUrl, {
      method: req.method,
      headers: req.headers
    });

    // Handle proxy response
    proxyReq.on('response', (proxyRes) => {
      // Removed proxy response logging

      // Copy status and headers
      res.status(proxyRes.statusCode);
      Object.keys(proxyRes.headers).forEach(key => {
        res.setHeader(key, proxyRes.headers[key]);
      });

      // Collect response data
      let responseData = [];
      proxyRes.on('data', (chunk) => {
        // Removed chunk size logging
        responseData.push(chunk);
      });

      proxyRes.on('end', () => {
        const responseBody = Buffer.concat(responseData);
        // Removed response complete logging

        // No JSON parsing for logging
        res.end(responseBody);
      });
    });

    // Handle proxy errors
    proxyReq.on('error', (error) => {
      // Removed proxy error logging
      res.status(502).json({
        error: 'Failed to connect to narration service',
        message: error.message
      });
    });

    // Pipe the request to the proxy
    req.pipe(proxyReq);
    return;
  }

  // For other requests (JSON, GET, etc.)
  try {
    const options = {
      method: req.method,
      headers: {
        ...req.headers,
        'host': `localhost:${narrationServiceClient.getNarrationPort()}`
      }
    };

    // Forward the request body for POST/PUT requests with JSON data
    if (['POST', 'PUT'].includes(req.method) && req.headers['content-type']?.includes('application/json')) {
      options.body = JSON.stringify(req.body);
    }

    // Handle audio file requests (GET requests to /audio/...)
    if (req.method === 'GET' && req.url.startsWith('/audio/')) {
      try {
        const audioData = await narrationServiceClient.fetchAudioFile(req.url.replace('/audio/', ''));

        // Set content type if available
        if (audioData.contentType) {
          res.setHeader('Content-Type', audioData.contentType);
        }

        // Send the audio data
        res.send(audioData.buffer);
      } catch (error) {
        // Removed audio file error logging
        res.status(502).json({ error: 'Failed to fetch audio file' });
      }
      return;
    }

    // Forward the request to the narration service
    const data = await narrationServiceClient.proxyRequest(req.url, options);

    // Send the response
    if (typeof data === 'string') {
      res.send(data);
    } else {
      res.json(data);
    }
  } catch (error) {
    // Removed proxying error logging
    res.status(502).json({
      error: 'Failed to connect to narration service',
      message: error.message
    });
  }
});

module.exports = router;
