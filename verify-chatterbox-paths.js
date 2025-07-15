#!/usr/bin/env node
/**
 * Script to verify that all Chatterbox paths are correct before attempting to start the service
 */

const path = require('path');
const fs = require('fs');

console.log('🔍 Verifying Chatterbox paths...');
console.log('─'.repeat(50));

// Define paths
const projectRoot = process.cwd();
const chatterboxDir = path.join(projectRoot, 'chatterbox');
const venvDir = path.join(projectRoot, '.venv');
const chatterboxApiPath = path.join(chatterboxDir, 'api.py');
const chatterboxStartPath = path.join(chatterboxDir, 'start_api.py');
const chatterboxLibDir = path.join(chatterboxDir, 'chatterbox');

console.log(`📁 Project root: ${projectRoot}`);
console.log(`📁 Chatterbox directory: ${chatterboxDir}`);
console.log(`📁 Virtual environment: ${venvDir}`);
console.log(`📁 Chatterbox library: ${chatterboxLibDir}`);
console.log('');

// Check paths
const checks = [
  { name: 'Chatterbox directory', path: chatterboxDir },
  { name: 'Virtual environment', path: venvDir },
  { name: 'Chatterbox api.py', path: chatterboxApiPath },
  { name: 'Chatterbox start_api.py', path: chatterboxStartPath },
  { name: 'Chatterbox library', path: chatterboxLibDir }
];

let allGood = true;

checks.forEach(check => {
  const exists = fs.existsSync(check.path);
  const status = exists ? '✅' : '❌';
  console.log(`${status} ${check.name}: ${check.path}`);
  if (!exists) allGood = false;
});

console.log('');

if (allGood) {
  console.log('✅ All paths verified! Chatterbox should be able to start.');
  
  // Test relative path from chatterbox directory
  const relativeVenvPath = path.relative(chatterboxDir, venvDir);
  console.log(`📍 Relative venv path from chatterbox dir: ${relativeVenvPath}`);
  
  // Verify the relative path resolves correctly
  const resolvedVenvPath = path.resolve(chatterboxDir, relativeVenvPath);
  const venvMatches = resolvedVenvPath === venvDir;
  console.log(`${venvMatches ? '✅' : '❌'} Relative path resolution: ${resolvedVenvPath}`);
  
} else {
  console.log('❌ Some paths are missing. Please run the setup script:');
  console.log('   npm run setup:narration');
}

console.log('');
console.log('🧪 Testing spawn command simulation...');

// Simulate the spawn command that will be used (updated to match F5-TTS pattern)
const UV_EXECUTABLE = 'uv';
const CHATTERBOX_PORT = 3011;
const chatterboxStartPath = path.join(chatterboxDir, 'start_api.py');

const spawnArgs = [
  'run',
  chatterboxStartPath,
  '--host', '0.0.0.0',
  '--port', CHATTERBOX_PORT.toString(),
  '--reload'
];

console.log(`Command: ${UV_EXECUTABLE} ${spawnArgs.join(' ')}`);
console.log(`Working directory: ${projectRoot} (same as F5-TTS)`);
console.log('');

// Check if we can find the Python executable in the venv
const pythonPaths = [
  path.join(venvDir, 'Scripts', 'python.exe'), // Windows
  path.join(venvDir, 'bin', 'python')          // Unix/Linux/macOS
];

const pythonPath = pythonPaths.find(p => fs.existsSync(p));
if (pythonPath) {
  console.log(`✅ Python executable found: ${pythonPath}`);
} else {
  console.log(`❌ Python executable not found in venv. Checked:`);
  pythonPaths.forEach(p => console.log(`   - ${p}`));
}

console.log('');
console.log('📋 Summary:');
console.log(`   - Chatterbox files: ${allGood ? 'Ready' : 'Missing'}`);
console.log(`   - Python environment: ${pythonPath ? 'Ready' : 'Missing'}`);
console.log(`   - Expected service URL: http://localhost:${CHATTERBOX_PORT}`);
console.log(`   - Expected docs URL: http://localhost:${CHATTERBOX_PORT}/docs`);
