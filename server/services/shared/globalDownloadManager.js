/**
 * Global Download Manager - Prevents multiple yt-dlp processes for the same video
 */

// Global locks across all routes
const globalActiveDownloads = new Map(); // videoId -> { route, startTime, processId }

/**
 * Check if a video is currently being downloaded
 * @param {string} videoId - Video ID to check
 * @returns {boolean} - True if download is active
 */
function isDownloadActive(videoId) {
  return globalActiveDownloads.has(videoId);
}

/**
 * Lock a video download
 * @param {string} videoId - Video ID to lock
 * @param {string} route - Route name (e.g., 'video', 'quality-scan', 'download-only')
 * @param {number} processId - Process ID (optional)
 * @returns {boolean} - True if lock was acquired, false if already locked
 */
function lockDownload(videoId, route, processId = null) {
  if (globalActiveDownloads.has(videoId)) {
    const existing = globalActiveDownloads.get(videoId);
    console.log(`[GlobalDownloadManager] BLOCKED: ${route} tried to download ${videoId}, but ${existing.route} is already downloading it`);
    return false;
  }

  globalActiveDownloads.set(videoId, {
    route,
    startTime: Date.now(),
    processId
  });

  console.log(`[GlobalDownloadManager] LOCKED: ${route} acquired lock for ${videoId}`);
  return true;
}

/**
 * Unlock a video download
 * @param {string} videoId - Video ID to unlock
 * @param {string} route - Route name (for logging)
 */
function unlockDownload(videoId, route) {
  if (globalActiveDownloads.has(videoId)) {
    globalActiveDownloads.delete(videoId);
    console.log(`[GlobalDownloadManager] UNLOCKED: ${route} released lock for ${videoId}`);
  }
}

/**
 * Get info about who is downloading a video
 * @param {string} videoId - Video ID to check
 * @returns {Object|null} - Download info or null if not active
 */
function getDownloadInfo(videoId) {
  return globalActiveDownloads.get(videoId) || null;
}

/**
 * Clean up stale downloads (older than 10 minutes)
 */
function cleanupStaleDownloads() {
  const now = Date.now();
  const staleThreshold = 10 * 60 * 1000; // 10 minutes

  for (const [videoId, info] of globalActiveDownloads.entries()) {
    if (now - info.startTime > staleThreshold) {
      console.log(`[GlobalDownloadManager] CLEANUP: Removing stale download lock for ${videoId} (${info.route})`);
      globalActiveDownloads.delete(videoId);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupStaleDownloads, 5 * 60 * 1000);

module.exports = {
  isDownloadActive,
  lockDownload,
  unlockDownload,
  getDownloadInfo,
  cleanupStaleDownloads
};
