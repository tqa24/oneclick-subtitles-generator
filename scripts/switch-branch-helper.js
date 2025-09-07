#!/usr/bin/env node

const { exec } = require('child_process');
const path = require('path');

const branch = process.argv[2];

if (!branch) {
  console.error('Branch name required');
  process.exit(1);
}

console.log(`Helper: Switching to branch ${branch}...`);

// Clear caches first
exec('node scripts/clear-cache.js', (err, stdout) => {
  if (stdout) console.log(stdout);
  
  // Add a small delay to ensure files are released
  setTimeout(() => {
    console.log('Helper: Cache cleared, ready for restart');
    process.exit(0);
  }, 500);
});
