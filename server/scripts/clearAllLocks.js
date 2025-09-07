#!/usr/bin/env node

/**
 * Script to forcibly clear all download locks
 * Run this if downloads are stuck
 */

const { 
  getAllActiveDownloads, 
  forceCleanupDownload,
  cleanupStaleDownloads 
} = require('../services/shared/globalDownloadManager');

console.log('=== Clearing All Download Locks ===\n');

// Get all active downloads
const activeDownloads = getAllActiveDownloads();

if (activeDownloads.length === 0) {
  console.log('No active download locks found.');
} else {
  console.log(`Found ${activeDownloads.length} active download lock(s):\n`);
  
  activeDownloads.forEach(download => {
    console.log(`Video ID: ${download.videoId}`);
    console.log(`  Route: ${download.route}`);
    console.log(`  Age: ${download.ageMinutes} minutes`);
    console.log(`  Forcing cleanup...`);
    
    const cleaned = forceCleanupDownload(download.videoId);
    if (cleaned) {
      console.log(`  ✓ Lock cleared successfully\n`);
    } else {
      console.log(`  ✗ Failed to clear lock\n`);
    }
  });
}

// Also run stale cleanup
console.log('Running stale download cleanup...');
const staleCleanups = cleanupStaleDownloads(0); // Clear all downloads immediately
if (staleCleanups.length > 0) {
  console.log(`Cleaned up ${staleCleanups.length} additional stale download(s).`);
}

console.log('\n=== All locks cleared ===');
process.exit(0);
