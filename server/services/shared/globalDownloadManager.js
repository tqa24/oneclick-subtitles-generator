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
 * Clean up stale downloads (older than specified threshold)
 * @param {number} thresholdMinutes - Minutes after which a download is considered stale (default: 10)
 * @returns {Array} - Array of cleaned up video IDs
 */
function cleanupStaleDownloads(thresholdMinutes = 10) {
  const now = Date.now();
  const staleThreshold = thresholdMinutes * 60 * 1000;
  const cleanedUp = [];

  for (const [videoId, info] of globalActiveDownloads.entries()) {
    if (now - info.startTime > staleThreshold) {
      console.log(`[GlobalDownloadManager] CLEANUP: Removing stale download lock for ${videoId} (${info.route}, age: ${Math.round((now - info.startTime) / 60000)} minutes)`);
      globalActiveDownloads.delete(videoId);
      cleanedUp.push(videoId);
    }
  }
  
  if (cleanedUp.length > 0) {
    console.log(`[GlobalDownloadManager] Cleaned up ${cleanedUp.length} stale downloads`);
  }
  
  return cleanedUp;
}

/**
 * Force cleanup a specific download
 * @param {string} videoId - Video ID to force cleanup
 * @returns {boolean} - True if cleaned up, false if not found
 */
function forceCleanupDownload(videoId) {
  if (globalActiveDownloads.has(videoId)) {
    const info = globalActiveDownloads.get(videoId);
    console.log(`[GlobalDownloadManager] FORCE CLEANUP: Removing download lock for ${videoId} (${info.route})`);
    globalActiveDownloads.delete(videoId);
    return true;
  }
  return false;
}

/**
 * Check if a download is stale
 * @param {string} videoId - Video ID to check
 * @param {number} thresholdMinutes - Minutes after which a download is considered stale (default: 5)
 * @returns {boolean} - True if stale or not found
 */
function isDownloadStale(videoId, thresholdMinutes = 5) {
  const info = globalActiveDownloads.get(videoId);
  if (!info) return true; // Not found means it's not active
  
  const now = Date.now();
  const ageMinutes = (now - info.startTime) / 60000;
  const isStale = ageMinutes > thresholdMinutes;
  
  if (isStale) {
    console.log(`[GlobalDownloadManager] Download ${videoId} is stale (age: ${Math.round(ageMinutes)} minutes)`);
  }
  
  return isStale;
}

/**
 * Get all active downloads
 * @returns {Array} - Array of active download info
 */
function getAllActiveDownloads() {
  const downloads = [];
  const now = Date.now();
  
  for (const [videoId, info] of globalActiveDownloads.entries()) {
    downloads.push({
      videoId,
      route: info.route,
      startTime: info.startTime,
      ageMinutes: Math.round((now - info.startTime) / 60000),
      processId: info.processId
    });
  }
  
  return downloads;
}

// Run cleanup every 2 minutes (more frequently for better responsiveness)
setInterval(() => cleanupStaleDownloads(10), 2 * 60 * 1000);

module.exports = {
  isDownloadActive,
  lockDownload,
  unlockDownload,
  getDownloadInfo,
  cleanupStaleDownloads,
  forceCleanupDownload,
  isDownloadStale,
  getAllActiveDownloads
};
