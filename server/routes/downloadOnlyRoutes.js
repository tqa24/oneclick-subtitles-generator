const express = require('express');
const router = express.Router();
const { validateVideoIdParam } = require('../utils/validateVideoId');
// Reject path-traversal / malformed ids before any :videoId route builds a filesystem path.
router.param('videoId', validateVideoIdParam);
const path = require('path');
const fs = require('fs');
const { VIDEOS_DIR } = require('../config');
const { setDownloadProgress, getDownloadProgress } = require('../services/shared/progressTracker');
const { lockDownload, unlockDownload, isDownloadActive, getDownloadInfo } = require('../services/shared/globalDownloadManager');
// Shared mutable tracking maps + the background download worker live in the service module
// so route handlers and downloadMediaAsync mutate the SAME Map/Set instances.
const {
  activeDownloads,
  activeFileOperations,
  activeYtdlpProcesses,
  downloadMediaAsync
} = require('./downloadOnlyService');

/**
 * POST /api/download-only - Download video or audio only
 */
router.post('/download-only', async (req, res) => {
  const { url, type, quality, source, useCookies = false, forceRetry = false } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'Video URL is required'
    });
  }

  if (!type || !['video', 'audio'].includes(type)) {
    return res.status(400).json({
      success: false,
      error: 'Type must be either "video" or "audio"'
    });
  }

  // Generate unique video ID for progress tracking (outside try block for finally access)
  const timestamp = Date.now();
  const videoId = `${type}_${timestamp}_${Math.random().toString(36).substring(2, 9)}`;

  try {
    console.log(`[DOWNLOAD-ONLY] Starting ${type} download:`, { url, type, quality, source });

    // Check global download lock first
    if (isDownloadActive(videoId)) {
      const downloadInfo = getDownloadInfo(videoId);
      console.log(`[DOWNLOAD-ONLY] Download blocked: ${videoId} is already being downloaded by ${downloadInfo.route}`);

      // If forceRetry is true, clean up the stuck download and proceed
      if (forceRetry) {
        console.log(`[DOWNLOAD-ONLY] Force retry requested - cleaning up stuck download for ${videoId}`);
        unlockDownload(videoId, downloadInfo.route);
        // Clear any progress tracking
        const { clearDownloadProgress } = require('../services/shared/progressTracker');
        clearDownloadProgress(videoId);

        // Clean up any active download tracking
        for (const [key, vid] of activeDownloads.entries()) {
          if (vid === videoId) {
            activeDownloads.delete(key);
            console.log(`[DOWNLOAD-ONLY] Cleaned up active download tracking for: ${key}`);
            break;
          }
        }

        // Clean up any active yt-dlp processes
        for (const [processKey, processInfo] of activeYtdlpProcesses.entries()) {
          if (processInfo.videoId === videoId) {
            try {
              processInfo.process.kill('SIGTERM');
              console.log(`[DOWNLOAD-ONLY] Killed stuck yt-dlp process for: ${videoId}`);
            } catch (killErr) {
              console.error(`[DOWNLOAD-ONLY] Error killing process: ${killErr.message}`);
            }
            activeYtdlpProcesses.delete(processKey);
            break;
          }
        }

        console.log(`[DOWNLOAD-ONLY] Cleaned up stuck download, proceeding with retry`);
      } else {
        return res.status(409).json({
          success: false,
          error: 'Video is already being downloaded',
          activeRoute: downloadInfo.route,
          videoId: videoId,
          canRetry: true
        });
      }
    }

    // Create a unique key for this download request
    const downloadKey = `${url}_${type}_${quality || 'default'}`;

    // Check if this exact download is already in progress
    if (activeDownloads.has(downloadKey)) {
      const existingVideoId = activeDownloads.get(downloadKey);
      console.log(`[DOWNLOAD-ONLY] DUPLICATE DOWNLOAD DETECTED! Returning existing videoId: ${existingVideoId}`);
      return res.json({
        success: true,
        videoId: existingVideoId,
        message: 'Download already in progress',
        isDuplicate: true
      });
    }

    // Acquire global download lock
    if (!lockDownload(videoId, 'download-only-route')) {
      return res.status(409).json({
        success: false,
        error: 'Failed to acquire download lock',
        videoId: videoId
      });
    }

    // Register this download to prevent duplicates
    activeDownloads.set(downloadKey, videoId);
    console.log(`[DOWNLOAD-ONLY] Registered download: ${downloadKey} -> ${videoId}`);

    // Generate output filename
    const extension = type === 'video' ? 'mp4' : 'mp3';
    const outputFilename = `${videoId}.${extension}`;
    const outputPath = path.join(VIDEOS_DIR, outputFilename);

    // Check if this exact file is already being created (race condition protection)
    if (activeFileOperations.has(outputPath)) {
      console.log(`[DOWNLOAD-ONLY] File operation already in progress: ${outputPath}`);
      return res.json({
        success: false,
        error: 'File operation already in progress',
        videoId: videoId
      });
    }

    // Check if file already exists
    if (fs.existsSync(outputPath)) {
      console.log(`[DOWNLOAD-ONLY] File already exists: ${outputPath}`);
      return res.json({
        success: true,
        videoId: videoId,
        message: 'File already exists',
        filename: outputFilename,
        isExisting: true
      });
    }

    // Lock this file operation
    activeFileOperations.add(outputPath);
    console.log(`[DOWNLOAD-ONLY] Locked file operation: ${outputPath}`);

    // Check if yt-dlp process is already running for this exact command
    const processKey = `${url}_${type}_${quality || 'default'}`;
    if (activeYtdlpProcesses.has(processKey)) {
      console.log(`[DOWNLOAD-ONLY] yt-dlp process already running for: ${processKey}`);
      activeFileOperations.delete(outputPath);
      return res.json({
        success: false,
        error: 'Download process already running',
        videoId: videoId
      });
    }

    // Lock the yt-dlp process
    activeYtdlpProcesses.set(processKey, videoId);
    console.log(`[DOWNLOAD-ONLY] Locked yt-dlp process: ${processKey} -> ${videoId}`);

    // Ensure videos directory exists
    if (!fs.existsSync(VIDEOS_DIR)) {
      fs.mkdirSync(VIDEOS_DIR, { recursive: true });
    }

    // Remove existing file if it exists
    if (fs.existsSync(outputPath)) {
      console.log(`[DOWNLOAD-ONLY] Removing existing file: ${outputPath}`);
      fs.unlinkSync(outputPath);
    }

    // Start download process asynchronously; swallow rejections to avoid unhandled promise rejection crashing the server
    downloadMediaAsync(url, outputPath, type, quality, videoId, useCookies, processKey)
      .catch((err) => {
        console.error(`[DOWNLOAD-ONLY] Background download error for ${videoId}:`, err?.message || err);
      });

    res.json({
      success: true,
      videoId: videoId,
      message: `${type} download started`,
      downloadUrl: `/videos/${outputFilename}`,
      filename: outputFilename
    });

  } catch (error) {
    console.error('[DOWNLOAD-ONLY] Error starting download:', error);

    // Clear progress tracking
    const { clearDownloadProgress } = require('../services/shared/progressTracker');
    clearDownloadProgress(videoId);

    // Clean up any partial files
    const extension = type === 'video' ? 'mp4' : 'mp3';
    const outputFilename = `${videoId}.${extension}`;
    const outputPath = path.join(VIDEOS_DIR, outputFilename);
    try {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
        console.log(`[DOWNLOAD-ONLY] Cleaned up partial file: ${outputPath}`);
      }
    } catch (cleanupErr) {
      console.error(`[DOWNLOAD-ONLY] Error cleaning up partial file: ${cleanupErr.message}`);
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start download',
      videoId: videoId,
      canRetry: true
    });
  } finally {
    // Always release the global download lock
    unlockDownload(videoId, 'download-only-route');
  }
});

/**
 * GET /api/download-only-progress/:videoId - Get download progress
 */
router.get('/download-only-progress/:videoId', async (req, res) => {
  const { videoId } = req.params;

  try {
    const progress = getDownloadProgress(videoId);

    res.json({
      success: true,
      progress: progress.progress || 0,
      status: progress.status || 'unknown'
    });
  } catch (error) {
    console.error('[DOWNLOAD-ONLY] Error getting progress:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get download progress'
    });
  }
});

/**
 * GET /api/download-only-file/:videoId - Download the completed file
 */
router.get('/download-only-file/:videoId', (req, res) => {
  const { videoId } = req.params;

  try {
    // Determine file by existence; support multiple audio/video extensions produced by yt-dlp
    const candidates = [
      { ext: 'mp3', mime: 'audio/mpeg' },
      { ext: 'm4a', mime: 'audio/mp4' },
      { ext: 'webm', mime: 'audio/webm' },
      { ext: 'opus', mime: 'audio/ogg' },
      { ext: 'mp4', mime: 'video/mp4' }
    ];

    let filePath = null;
    let filename = null;
    let mimeType = null;

    for (const c of candidates) {
      const p = path.join(VIDEOS_DIR, `${videoId}.${c.ext}`);
      if (fs.existsSync(p)) {
        filePath = p;
        filename = `${videoId}.${c.ext}`;
        mimeType = c.mime;
        break;
      }
    }

    if (!filePath) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Set headers for file download
    const stats = fs.statSync(filePath);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('[DOWNLOAD-ONLY] Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Error streaming file'
        });
      }
    });

  } catch (error) {
    console.error('[DOWNLOAD-ONLY] Error serving download:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to serve download'
    });
  }
});

/**
 * POST /api/cancel-download-only/:videoId - Cancel an ongoing download-only process
 */
router.post('/cancel-download-only/:videoId', (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    return res.status(400).json({
      success: false,
      error: 'Video ID is required'
    });
  }

  try {
    let processFound = false;

    // Find and kill the yt-dlp process for this video
    for (const [processKey, processInfo] of activeYtdlpProcesses.entries()) {
      if (processInfo.videoId === videoId) {
        console.log(`[DOWNLOAD-ONLY] Cancelling download for ${videoId}, killing process`);

        // Kill the yt-dlp process
        processInfo.process.kill('SIGTERM');

        // Clean up tracking
        activeYtdlpProcesses.delete(processKey);

        // Update progress to cancelled
        setDownloadProgress(videoId, 0, 'cancelled');

        // Broadcast cancellation
        try {
          const { broadcastProgress } = require('../services/shared/progressWebSocket');
          broadcastProgress(videoId, 0, 'cancelled', 'download');
        } catch (error) {
          // WebSocket module might not be initialized yet
        }

        processFound = true;
        break;
      }
    }

    // Also clean up from activeDownloads map
    for (const [downloadKey, downloadVideoId] of activeDownloads.entries()) {
      if (downloadVideoId === videoId) {
        activeDownloads.delete(downloadKey);
        break;
      }
    }

    // Release global download lock
    unlockDownload(videoId, 'download-only-route');

    if (processFound) {
      res.json({
        success: true,
        message: `Download cancelled for ${videoId}`
      });
    } else {
      res.status(404).json({
        success: false,
        error: `No active download found for ${videoId}`
      });
    }
  } catch (error) {
    console.error('[DOWNLOAD-ONLY] Error cancelling download:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel download'
    });
  }
});

module.exports = router;
