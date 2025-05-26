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

// Import WebSocket progress tracking
const { initializeProgressWebSocket } = require('./server/services/shared/progressWebSocket');

// Start the narration service only if running with dev:cuda
let narrationProcess;

// Check if we're running with npm run dev:cuda by looking at the environment variable
const isDevCuda = process.env.START_PYTHON_SERVER === 'true';

if (isDevCuda) {

  try {
    narrationProcess = startNarrationService();

    // Set the narration service as running in the app

    app.set('narrationServiceRunning', true);
    app.set('narrationActualPort', NARRATION_PORT);
  } catch (error) {
    console.error('Failed to start narration service:', error);


    // Set the narration service as not running in the app
    app.set('narrationServiceRunning', false);
    app.set('narrationActualPort', null);
  }
} else {



  // Set the narration service as not running in the app
  app.set('narrationServiceRunning', false);
  app.set('narrationActualPort', null);
}

// Start the server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Initialize WebSocket server for real-time progress tracking
  initializeProgressWebSocket(server);
});

// Handle server shutdown
process.on('SIGINT', () => {

  server.close(() => {


    // Kill the narration service process
    if (narrationProcess) {

      narrationProcess.kill();
    }

    process.exit(0);
  });
});
