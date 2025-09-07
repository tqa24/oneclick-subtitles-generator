/**
 * API routes for generic video URL operations using yt-dlp
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { VIDEOS_DIR } = require('../config');
const { downloadVideoWithRetry } = require('../services/allSites/downloader');
const { getDownloadProgress } = require('../services/shared/progressTracker');
const { normalizeVideo } = require('../services/video/universalVideoNormalizer');
const { lockDownload, unlockDownload, isDownloadActive, getDownloadInfo } = require('../services/shared/globalDownloadManager');

/**
 * POST /api/download-generic-video - Download a video from any supported site
 */
router.post('/download-generic-video', async (req, res) => {
  const { videoId, url, quality = '360p', useCookies = false } = req.body;

  if (!videoId || !url) {
    return res.status(400).json({ error: 'Video ID and URL are required' });
  }

  // Check if download is already in progress
  if (isDownloadActive(videoId)) {
    const downloadInfo = getDownloadInfo(videoId);
    console.log(`[ALL-SITES] Download blocked: ${videoId} is already being downloaded by ${downloadInfo.route}`);
    return res.status(409).json({
      error: 'Video is already being downloaded',
      activeRoute: downloadInfo.route,
      videoId: videoId
    });
  }

  const videoPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);

  // Check if video already exists
  if (fs.existsSync(videoPath)) {
    return res.json({
      success: true,
      message: 'Video already downloaded',
      url: `/videos/${videoId}.mp4`
    });
  }

  // Acquire download lock
  if (!lockDownload(videoId, 'all-sites')) {
    return res.status(409).json({
      error: 'Failed to acquire download lock',
      videoId: videoId
    });
  }

  try {
    // Download the video using yt-dlp with retry and fallback
    const result = await downloadVideoWithRetry(videoId, url, quality, useCookies);

    // Check if the file was created successfully
    if (fs.existsSync(videoPath)) {
      // Normalize the downloaded video if needed
      console.log('[ALL-SITES] Checking downloaded video for compatibility issues...');
      const normalizationResult = await normalizeVideo(videoPath);
      
      if (normalizationResult.normalized) {
        console.log(`[ALL-SITES] Video normalized using ${normalizationResult.method}`);
      }

      // Release the lock AFTER normalization completes
      unlockDownload(videoId, 'all-sites');
      console.log(`[ALL-SITES] Released download lock for ${videoId}`);

      return res.json({
        success: true,
        message: normalizationResult.normalized ? 
          'Video downloaded and normalized successfully' : 
          (result.message || 'Video downloaded successfully'),
        url: `/videos/${videoId}.mp4`,
        method: result.method,
        normalized: normalizationResult.normalized,
        normalizationMethod: normalizationResult.method || null
      });
    } else {
      throw new Error('Download completed but video file was not found');
    }
  } catch (error) {
    console.error('Error downloading video:', error);

    // Clean up any partial file
    try {
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
      const tempPath = path.join(VIDEOS_DIR, `${videoId}.temp.mp4`);
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch (e) {
      console.error('Error cleaning up incomplete file:', e);
    }

    // Release lock on error
    unlockDownload(videoId, 'all-sites');
    console.log(`[ALL-SITES] Released download lock for ${videoId} due to error`);

    return res.status(500).json({
      error: 'Failed to download video',
      details: error.message
    });
  }
});

/**
 * GET /api/generic-download-progress/:videoId - Get download progress for a generic video
 */
router.get('/generic-download-progress/:videoId', (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID is required' });
  }

  try {
    const progress = getDownloadProgress(videoId);
    res.json({
      success: true,
      videoId: videoId,
      progress: progress.progress,
      status: progress.status,
      timestamp: progress.timestamp
    });
  } catch (error) {
    console.error('Error getting generic download progress:', error);
    res.status(500).json({
      error: 'Failed to get download progress',
      details: error.message
    });
  }
});

/**
 * POST /api/cancel-generic-download/:videoId - Cancel an ongoing generic video download
 */
router.post('/cancel-generic-download/:videoId', (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID is required' });
  }



  // Currently, we don't have a way to cancel an ongoing yt-dlp process
  // But we can return success to let the client know we received the request
  return res.json({
    success: true,
    message: 'Cancel request received'
  });
});

module.exports = router;
