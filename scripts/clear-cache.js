#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function deleteFolderRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    try {
      fs.readdirSync(dirPath).forEach((file) => {
        const curPath = path.join(dirPath, file);
        try {
          if (fs.lstatSync(curPath).isDirectory()) {
            deleteFolderRecursive(curPath);
          } else {
            fs.unlinkSync(curPath);
          }
        } catch (err) {
          console.log(`Warning: Could not remove ${curPath}: ${err.message}`);
        }
      });
      fs.rmdirSync(dirPath);
      return true;
    } catch (err) {
      console.log(`Warning: Could not clean ${dirPath}: ${err.message}`);
      return false;
    }
  }
  return false;
}

console.log('Clearing build caches...');

const cacheDirectories = [
  path.join(__dirname, '..', 'node_modules', '.cache'),
  path.join(__dirname, '..', 'build'),
  path.join(__dirname, '..', '.eslintcache')
];

let cleared = false;

cacheDirectories.forEach(dir => {
  if (deleteFolderRecursive(dir)) {
    console.log(`✓ Cleared: ${path.basename(dir)}`);
    cleared = true;
  }
});

if (!cleared) {
  console.log('No cache directories found to clear.');
} else {
  console.log('Cache clearing complete!');
}
