/**
 * Comprehensive startup script for all services
 * Handles port cleanup and process tracking
 */

const { spawn } = require('child_process');
const path = require('path');

// Import port management and CORS setup
const { killProcessesOnPorts, cleanupTrackingFile } = require('../server/utils/portManager');
const { setupEnvironmentVariables } = require('./setup-cors-env');
const pm = require('./process-manager');
const { PORTS } = require('../server/config');

async function startAllServices() {
  console.log('🚀 Starting One-Click Subtitles Generator...');

  // Setup CORS environment variables
  setupEnvironmentVariables();
  
  try {
    // Clean up old processes and tracking
    console.log('🧹 Cleaning up previous processes...');
    cleanupTrackingFile();
    await killProcessesOnPorts();
    
    console.log('✅ Cleanup complete, starting services...');
    
    // Start all services including the video renderer (same as dev but with CUDA support)
    console.log('🚀 Starting all services: FRONTEND, SERVER, RENDERER, MIDI, PARAKEET with CUDA support...');

    // Use the same cross-platform approach as dev-server.js
    const { spawn } = require('child_process');

    // Commands to run - cross-platform approach (same as dev-server.js)
    const commands = [
      { name: 'FRONTEND', cmd: 'npm', args: ['run', 'start'], cwd: '.' },
      { name: 'SERVER', cmd: 'npm', args: ['run', 'server:start'], cwd: '.' },
      { name: 'RENDERER', cmd: 'npm', args: ['run', 'video-renderer:start'], cwd: '.' },
      { name: 'MIDI', cmd: 'npm', args: ['run', 'dev', '--silent'], cwd: './promptdj-midi' },
      // Run Parakeet from project root so --python .venv resolves; pass absolute .venv for safety
      { name: 'PARAKEET', cmd: 'uv', args: ['run', '--python', path.join(process.cwd(), '.venv'), 'python', path.join('parakeet_wrapper', 'app.py')], cwd: '.' }
    ];

    // Colors for different services (same as dev-server.js)
    const colors = {
      FRONTEND: '\x1b[36m', // cyan
      SERVER: '\x1b[32m',   // green
      RENDERER: '\x1b[35m', // magenta
      MIDI: '\x1b[34m',     // blue
      PARAKEET: '\x1b[33m'   // yellow
    };

    // Function to prefix output with colored service name
    function prefixOutput(serviceName, data) {
      const color = colors[serviceName];
      const reset = '\x1b[0m';
      const lines = data.toString().split('\n');
      return lines
        .filter(line => line.trim() !== '')
        .map(line => `${color}[${serviceName}]${reset} ${line}`)
        .join('\n');
    }

    // Start all services with proper sequencing (same approach as dev-server.js)
    commands.forEach(({ name, cmd, args, cwd }) => {
      const childProcess = spawn(cmd, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true, // Use shell: true for cross-platform npm compatibility
        detached: process.platform !== 'win32', // own process group on POSIX so we can kill the whole tree
        cwd: cwd,
        env: {
          ...process.env,
          START_PYTHON_SERVER: 'true',
          DEV_SERVER_MANAGED: 'true',
          // Quiet HuggingFace download progress bars + telemetry in the shared console.
          HF_HUB_DISABLE_PROGRESS_BARS: '1',
          HF_HUB_DISABLE_TELEMETRY: '1',
          // Silence the Windows huggingface_hub symlink UserWarning (harmless on this setup).
          HF_HUB_DISABLE_SYMLINKS_WARNING: '1',
          // Silence the two known-noisy warnings without a blanket ignore: diffusers' FutureWarning
          // and pydub's "Couldn't find ffmpeg" RuntimeWarning. Real warnings/errors still show.
          PYTHONWARNINGS: process.env.PYTHONWARNINGS || 'ignore::FutureWarning,ignore:Couldn\'t find ffmpeg:RuntimeWarning,ignore:pkg_resources is deprecated:UserWarning'
        }
      });
      pm.trackChild(childProcess, name); // record PID so shutdown tree-kills it + its grandchildren

      childProcess.stdout.on('data', (data) => {
        console.log(prefixOutput(name, data));
      });

      childProcess.stderr.on('data', (data) => {
        console.log(prefixOutput(name, data));
      });

      childProcess.on('close', (code) => {
        const color = colors[name];
        const reset = '\x1b[0m';
        console.log(`${color}[${name}]${reset} Process exited with code ${code}`);
      });

      childProcess.on('error', (err) => {
        const color = colors[name];
        const reset = '\x1b[0m';
        console.log(`${color}[${name}]${reset} Error: ${err.message}`);
      });
    });

    // Tree-kill every spawned service (and its grandchildren) on Ctrl+C / window close, so ports
    // 3030-3038 and GPU VRAM are freed instead of orphaned.
    pm.installShutdown();

    // Only announce "ready" once each service's port actually answers (first CUDA model load is slow).
    const ready = await pm.waitForPorts([
      { name: 'SERVER', port: PORTS.BACKEND, path: '/api/health' },
      { name: 'FRONTEND', port: PORTS.FRONTEND },
      { name: 'RENDERER', port: PORTS.VIDEO_RENDERER },
      { name: 'MIDI', port: PORTS.PROMPTDJ_MIDI },
      { name: 'PARAKEET', port: PORTS.PARAKEET, path: '/' },
      { name: 'F5-TTS', port: PORTS.NARRATION, path: '/' },
      { name: 'CHATTERBOX', port: PORTS.CHATTERBOX, path: '/' }
    ], { timeoutMs: 180000 });
    if (ready) {
      console.log(`\n✅ All services ready — open http://localhost:${PORTS.FRONTEND}`);
    } else {
      console.log('\n⚠️  Some services were slow to start (see ⚠️ above); the app may still come up shortly.');
    }

  } catch (error) {
    console.error('❌ Error during startup:', error);
    process.exit(1);
  }
}

// Start all services
startAllServices();
