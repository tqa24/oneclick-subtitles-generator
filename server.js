/**
 * Local server for downloading YouTube videos
 * This server handles downloading YouTube videos to a local 'videos' directory
 * Also handles caching of subtitles to avoid repeated Gemini API calls
 */

// Import configuration
const { PORTS, PORT } = require('./server/config');
const NARRATION_PORT = PORTS.NARRATION;
const CHATTERBOX_PORT = PORTS.CHATTERBOX;

// Import Express app
const mainApp = require('./app');

// Import WebSocket progress tracking
const { initializeProgressWebSocket } = require('./server/services/shared/progressWebSocket');

// Import port management
const { killProcessesOnPorts, trackProcess, cleanupTrackingFile, ensurePortFree } = require('./server/utils/portManager');


// Startup initialization
async function initializeServer() {
  console.log('🚀 Initializing server...');

  // Only do port cleanup if not already done by dev-server.js
  // Check if we're running standalone (not via dev-server.js)
  const isStandalone = !process.env.DEV_SERVER_MANAGED;

  if (isStandalone) {
    // Clean up old tracking file and kill processes on ports
    cleanupTrackingFile();
    await killProcessesOnPorts();
  } else {
    console.log('ℹ️  Port cleanup handled by dev-server, skipping...');
  }


  console.log('✅ Server initialization complete');
}

// Warm-start any heavy engines that are already installed (per-engine). This replaces the old
// Heavy-engine availability is reported per-engine via
// /api/engines/status, and the in-app engine UI installs/starts more on demand. Electron manages
// its own bundled Python (separate track).
const engineManager = require('./server/engines/engineManager');

if (process.env.ELECTRON_MANAGES_PYTHON === 'true') {
  console.log('ℹ️  Python services managed by Electron parent process.');
  mainApp.set('narrationServiceRunning', true);
  mainApp.set('narrationActualPort', NARRATION_PORT);
  mainApp.set('chatterboxServiceRunning', true);
  mainApp.set('chatterboxActualPort', CHATTERBOX_PORT);
} else {
  console.log('🚀 Warm-starting installed heavy engines...');
  engineManager.warmStart().catch((e) => console.error('❌ Engine warm-start failed:', e.message));
  mainApp.set('narrationActualPort', NARRATION_PORT);
  mainApp.set('chatterboxActualPort', CHATTERBOX_PORT);
}

// Start the server with initialization
async function startServer() {
  await initializeServer();
  return listenWithRetry();
}

// Bind PORT, and if it's held by a stale process (EADDRINUSE) — e.g. an orphaned server from a
// previous run on Windows whose listening socket wasn't reaped — free it via ensurePortFree (which
// kills the live socket-holder's whole tree and VERIFIES the port is bindable) and retry ONCE,
// instead of letting an unhandled 'error' event crash the process. Resolves with the successfully
// listening server so the shutdown handler closes the real instance.
function listenWithRetry(attempt = 0) {
  return new Promise((resolve) => {
    const server = mainApp.listen(PORT);

    server.once('listening', () => {
      console.log(`🌐 Server running on port ${PORT}${attempt ? ' (after freeing a stale process)' : ''}`);

      // Track the main server process
      trackProcess(PORT, process.pid, 'Express Server');

      // Initialize WebSocket server for real-time progress tracking
      initializeProgressWebSocket(server);
      resolve(server);
    });

    server.once('error', async (err) => {
      if (err.code === 'EADDRINUSE' && attempt < 1) {
        console.error(`⚠️  Port ${PORT} is already in use — a server from a previous run may still be holding it. Freeing it and retrying...`);
        let freed = false;
        try {
          freed = await ensurePortFree(PORT, { label: 'Express Server' });
        } catch (_) { /* ignore — handled by the !freed branch below */ }
        if (freed) {
          resolve(listenWithRetry(attempt + 1));
          return;
        }
        console.error(`❌ Could not free port ${PORT}. Stop the other process and restart:`);
        console.error(`     netstat -ano | findstr :${PORT}     then     taskkill /F /PID <pid>`);
        process.exit(1);
      } else {
        console.error(`❌ Server failed to start on port ${PORT}:`, err.code || err.message);
        process.exit(1);
      }
    });
  });
}

// Start the server
const serverPromise = startServer();

// Handle server shutdown (SIGINT for Ctrl+C, SIGTERM when a launcher forwards it)
let shuttingDownServer = false;
async function shutdownServer(signal) {
  if (shuttingDownServer) return;
  shuttingDownServer = true;
  console.log(`\n🛑 (${signal}) Shutting down server and services...`);

  try {
    const server = await serverPromise;
    await new Promise((resolve) => server.close(resolve));

    // Tree-kill the REAL python/uvicorn engine workers on every engine port. kill() on the `uv`
    // launcher alone would leave the worker holding the port + GPU VRAM (the zombie problem).
    console.log('🔄 Stopping heavy engine services...');
    try {
      await killProcessesOnPorts([NARRATION_PORT, CHATTERBOX_PORT, require('./server/config').PORTS.PARAKEET]);
    } catch (e) {
      console.warn('Could not fully stop engine services:', e.message);
    }

    console.log('✅ Server shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdownServer('SIGINT'));
process.on('SIGTERM', () => shutdownServer('SIGTERM'));
