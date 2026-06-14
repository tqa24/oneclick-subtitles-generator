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

// Start the React development server.
// This is an end-user run, not a linting session: react-scripts otherwise reprints the entire
// accumulated ESLint warning list (hundreds of lines) on every recompile, which reads as "errors"
// to people just running the app. Disable the dev-server ESLint plugin (compile errors still show)
// and silence non-actionable Node/webpack deprecation warnings to keep the console readable.
// Set DEBUG_LINT=true to get the warnings back. `npm run build`/CI linting are unaffected.
const showLint = process.env.DEBUG_LINT === 'true';
const reactProcess = spawn('npm', ['run', 'start-react'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    PORT: PORTS.FRONTEND.toString(),
    ...(showLint ? {} : { DISABLE_ESLINT_PLUGIN: 'true' }),
    NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --no-deprecation`.trim()
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
