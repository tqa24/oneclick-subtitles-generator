/**
 * Frontend startup script with process tracking
 */

const { spawn } = require('child_process');
const path = require('path');

// Import port management
const { trackProcess } = require('../server/utils/portManager');
const { PORTS } = require('../server/config');

console.log('🚀 Starting React frontend...');

// Set the port environment variable
process.env.PORT = PORTS.FRONTEND.toString();

// Start the React development server
const reactProcess = spawn('npm', ['run', 'start-react'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    PORT: PORTS.FRONTEND.toString()
  }
});

// Track the React process
if (reactProcess.pid) {
  trackProcess(PORTS.FRONTEND, reactProcess.pid, 'React Frontend');
}

// Handle process events
reactProcess.on('error', (error) => {
  console.error('❌ Failed to start React frontend:', error);
  process.exit(1);
});

reactProcess.on('close', (code) => {
  console.log(`React frontend exited with code ${code}`);
  process.exit(code);
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down React frontend...');
  reactProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down React frontend...');
  reactProcess.kill('SIGTERM');
});
