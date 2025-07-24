/**
 * Video Renderer Frontend startup script with process tracking
 */

const { spawn } = require('child_process');
const path = require('path');

// Import port management from main server
const { trackProcess } = require('../../server/utils/portManager');

// Video renderer frontend port (from unified config)
const FRONTEND_PORT = 3034;

console.log('🎬 Starting Video Renderer React frontend...');

// Set the port environment variable
process.env.PORT = FRONTEND_PORT.toString();

// Start the React development server
const reactProcess = spawn('npm', ['run', 'start-react'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    PORT: FRONTEND_PORT.toString()
  }
});

// Track the React process
if (reactProcess.pid) {
  trackProcess(FRONTEND_PORT, reactProcess.pid, 'Video Renderer Frontend');
}

// Handle process events
reactProcess.on('error', (error) => {
  console.error('❌ Failed to start Video Renderer frontend:', error);
  process.exit(1);
});

reactProcess.on('close', (code) => {
  console.log(`Video Renderer frontend exited with code ${code}`);
  process.exit(code);
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Video Renderer frontend...');
  reactProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down Video Renderer frontend...');
  reactProcess.kill('SIGTERM');
});
