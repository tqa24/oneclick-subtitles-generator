/**
 * Comprehensive startup script for all services
 * Handles port cleanup and process tracking
 */

const { spawn } = require('child_process');
const path = require('path');

// Import port management
const { killProcessesOnPorts, cleanupTrackingFile } = require('../server/utils/portManager');

async function startAllServices() {
  console.log('🚀 Starting One-Click Subtitles Generator...');
  
  try {
    // Clean up old processes and tracking
    console.log('🧹 Cleaning up previous processes...');
    cleanupTrackingFile();
    await killProcessesOnPorts();
    
    console.log('✅ Cleanup complete, starting services...');
    
    // Start all services using concurrently with proper command escaping
    const concurrentlyArgs = [
      'concurrently',
      '--names', 'FRONTEND,SERVER',
      '--prefix-colors', 'cyan,green',
      '--prefix', '[{name}]',
      'npm run start --silent',
      'npm run server:start'
    ];

    console.log('🚀 Starting services with command:', 'npx', concurrentlyArgs.join(' '));

    const concurrentlyProcess = spawn('npm', ['run', 'dev:cuda-legacy'], {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        START_PYTHON_SERVER: 'true'
      }
    });

    // Handle process events
    concurrentlyProcess.on('error', (error) => {
      console.error('❌ Failed to start services:', error);
      process.exit(1);
    });

    concurrentlyProcess.on('close', (code) => {
      console.log(`Services exited with code ${code}`);
      process.exit(code);
    });

    // Handle shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down all services...');
      concurrentlyProcess.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down all services...');
      concurrentlyProcess.kill('SIGTERM');
    });

  } catch (error) {
    console.error('❌ Error during startup:', error);
    process.exit(1);
  }
}

// Start all services
startAllServices();
