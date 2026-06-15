/**
 * Douyin video downloader module
 */

const path = require('path');
const fs = require('fs');
const { VIDEOS_DIR } = require('../../config');
const douyinPuppeteer = require('./douyin_puppeteer');
const { normalizeDouyinUrl } = require('./urlNormalizer');
const { downloadFileWithProgress } = require('./fileDownloader');
const { setDownloadProgress } = require('../shared/progressTracker');
const {
  lockDownload,
  unlockDownload,
  updateProcessRef
} = require('../shared/globalDownloadManager');

/**
 * Puppeteer-based Douyin video downloader with cancellation support
 * @param {string} videoId - Douyin video ID
 * @param {string} videoURL - Douyin video URL
 * @param {Object} processRef - Process reference for cancellation
 * @returns {Promise<Object>} - Result object with success status and path
 */
async function downloadDouyinVideoPuppeteer(videoId, videoURL, processRef = {}) {
  const outputPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);

  // Normalize the URL
  const normalizedUrl = normalizeDouyinUrl(videoURL);

  try {
    // Create abort controller for HTTP download cancellation
    const abortController = new AbortController();
    processRef.abortController = abortController;

    // Extract video URL first (this will set processRef.browser)
    const videoUrl = await douyinPuppeteer.extractVideoUrl(normalizedUrl, processRef);

    // Check if cancelled after URL extraction
    if (processRef.cancelled) {
      throw new Error('Download was cancelled');
    }

    // Download the file with progress tracking and cancellation support
    await downloadFileWithProgress(videoUrl, outputPath, videoId, abortController);

    // Close browser after successful download
    if (processRef.browser) {
      await processRef.browser.close();
      processRef.browser = null;
    }

    // Check if the file was created successfully
    if (fs.existsSync(outputPath)) {
      return {
        success: true,
        path: outputPath,
        message: 'Video downloaded successfully with Puppeteer',
        method: 'puppeteer'
      };
    } else {
      throw new Error('Puppeteer download completed but video file was not found');
    }
  } catch (error) {
    console.error(`Puppeteer download failed: ${error.message}`);

    // Clean up browser on error
    if (processRef.browser) {
      try {
        await processRef.browser.close();
      } catch (e) {
        console.error('Error closing browser on failure:', e);
      }
      processRef.browser = null;
    }

    throw error;
  }
}

/**
 * Download Douyin video using Puppeteer method with cancellation support
 * @param {string} videoId - Douyin video ID
 * @param {string} videoURL - Douyin video URL
 * @param {string} quality - Desired video quality (e.g., '144p', '360p', '720p')
 * @param {boolean} useCookies - Whether to use browser cookies for authentication
 * @returns {Promise<Object>} - Result object with success status and path
 */
async function downloadDouyinVideoWithRetry(videoId, videoURL, quality = '360p', useCookies = false) {
  // Lock the download to prevent duplicates
  const lockAcquired = lockDownload(videoId, 'douyin-download');
  if (!lockAcquired) {
    throw new Error('Another download for this video is already in progress');
  }

  // Initialize progress
  setDownloadProgress(videoId, 0, 'downloading');

  // Create process reference for cancellation
  const processRef = {};

  try {
    console.log('[douyin] Using Puppeteer method...');

    // Update the process reference in the global manager
    updateProcessRef(videoId, processRef);

    // Update progress to indicate starting
    setDownloadProgress(videoId, 10, 'downloading');

    // Use the Puppeteer-based downloader with cancellation support
    const result = await downloadDouyinVideoPuppeteer(videoId, videoURL, processRef);

    // Mark as completed and set final progress
    setDownloadProgress(videoId, 100, 'completed');

    // Unlock the download
    unlockDownload(videoId, 'douyin-download', { cleanup: false });

    return result;
  } catch (error) {
    console.error(`Puppeteer download failed: ${error.message}`);

    // Unlock the download
    unlockDownload(videoId, 'douyin-download');

    // Handle cancellation gracefully - don't mark as error if cancelled
    if (error.message.includes('cancelled') ||
        error.message.includes('aborted') ||
        error.message.includes('Navigating frame was detached')) {
      console.log(`[DOUYIN] Download was cancelled for ${videoId}`);
      throw new Error('Download was cancelled by user');
    }

    // Mark as error only if not cancelled
    setDownloadProgress(videoId, 0, 'error');

    // Provide more specific error messages based on the error
    if (error.message.includes('No video URLs found')) {
      throw new Error('Could not find video on the Douyin page. The video might be private or deleted.');
    } else if (error.message.includes('Navigation timeout')) {
      throw new Error('Timed out while loading the Douyin page. Please try again later.');
    } else if (error.message.includes('net::ERR_CONNECTION_RESET') ||
               error.message.includes('net::ERR_CONNECTION_CLOSED')) {
      throw new Error('Connection was reset while accessing Douyin. This might be due to regional restrictions.');
    }

    throw new Error(`Douyin video download failed: ${error.message}`);
  }
}

module.exports = {
  downloadDouyinVideoPuppeteer,
  downloadDouyinVideoWithRetry,
  normalizeDouyinUrl
};
