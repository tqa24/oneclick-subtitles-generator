/**
 * Shared progress tracking system for all video downloads - CLEANED VERSION
 */

// Global progress tracking for downloads
const downloadProgress = new Map();

/**
 * Get download progress for a video
 * @param {string} videoId - Video ID
 * @returns {Object} - Progress information
 */
function getDownloadProgress(videoId) {
  return downloadProgress.get(videoId) || { progress: 0, status: 'unknown' };
}

/**
 * Set download progress for a video
 * @param {string} videoId - Video ID
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} status - Download status
 */
function setDownloadProgress(videoId, progress, status = 'downloading') {
  downloadProgress.set(videoId, { progress, status, timestamp: Date.now() });
}

/**
 * Clear download progress for a video
 * @param {string} videoId - Video ID
 */
function clearDownloadProgress(videoId) {
  downloadProgress.delete(videoId);
}

/**
 * Parse yt-dlp progress output - CLEAN VERSION
 * @param {string} output - Raw output from yt-dlp
 * @returns {Object|null} - Parsed progress info or null
 */
function parseYtdlpProgress(output) {
  // yt-dlp progress format: [download]  45.2% of 123.45MiB at 1.23MiB/s ETA 00:30
  const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
  if (progressMatch) {
    const progress = parseFloat(progressMatch[1]);

    // Only return valid progress values
    if (progress >= 0 && progress <= 100) {
      return {
        progress: progress,
        status: 'downloading'
      };
    }
  }

  // Check for completion
  if (output.includes('[download] 100%') ||
      output.includes('has already been downloaded')) {
    return {
      progress: 100,
      status: 'completed'
    };
  }

  return null;
}

/**
 * Update progress from yt-dlp output - RAW PROGRESS, NO VALIDATION
 * @param {string} videoId - Video ID
 * @param {string} output - Raw output from yt-dlp
 */
function updateProgressFromYtdlpOutput(videoId, output) {
  if (!videoId) return;

  const progressInfo = parseYtdlpProgress(output);
  if (progressInfo) {
    setDownloadProgress(videoId, progressInfo.progress, progressInfo.status);

    // Broadcast to WebSocket clients
    try {
      const { broadcastProgress } = require('./progressWebSocket');
      broadcastProgress(videoId, progressInfo.progress, progressInfo.status);
    } catch (error) {
      // WebSocket module might not be initialized yet, that's okay
    }
  }
}

module.exports = {
  getDownloadProgress,
  setDownloadProgress,
  clearDownloadProgress,
  parseYtdlpProgress,
  updateProgressFromYtdlpOutput
};
