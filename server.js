/**
 * Local server for downloading YouTube videos
 * This server handles downloading YouTube videos to a local 'videos' directory
 * Also handles caching of subtitles to avoid repeated Gemini API calls
 */

// Import configuration
const { PORT } = require('./server/config');
const { NARRATION_PORT } = require('./server/startNarrationService');

// Import Express app
const app = require('./app');

// Import narration service
const { startNarrationService } = require('./server/startNarrationService');

// Start the narration service only if running with dev:cuda
let narrationProcess;

// Check if we're running with npm run dev:cuda by looking at the environment variable
const isDevCuda = process.env.START_PYTHON_SERVER === 'true';

if (isDevCuda) {
  console.log('Running with npm run dev:cuda - starting Python narration service');
  try {
    narrationProcess = startNarrationService();

    // Set the narration service as running in the app
    console.log('Setting narration service as running');
    app.set('narrationServiceRunning', true);
    app.set('narrationActualPort', NARRATION_PORT);
  } catch (error) {
    console.error('Failed to start narration service:', error);
    console.log('Setting narration service as not available');

    // Set the narration service as not running in the app
    app.set('narrationServiceRunning', false);
    app.set('narrationActualPort', null);
  }
} else {
  console.log('Running with npm run dev - NOT starting Python narration service');
  console.log('To start with Python narration service, use: npm run dev:cuda');

  // Set the narration service as not running in the app
  app.set('narrationServiceRunning', false);
  app.set('narrationActualPort', null);
}

// Start the server
const server = app.listen(PORT, () => {
  console.log(`YouTube download server running on port ${PORT}`);
  console.log(`Narration service running on port ${NARRATION_PORT}`);
});

// Handle server shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server stopped');

    // Kill the narration service process
    if (narrationProcess) {
      console.log('Stopping narration service...');
      narrationProcess.kill();
    }

    process.exit(0);
  });
});
