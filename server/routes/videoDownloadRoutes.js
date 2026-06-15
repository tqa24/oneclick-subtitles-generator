/**
 * Routes for downloading YouTube videos and tracking/cancelling download progress.
 * Registered onto the shared media router by videoRoutes.js.
 */

const fs = require('fs');
const path = require('path');
const { VIDEOS_DIR } = require('../config');
const { downloadYouTubeVideo } = require('../services/youtube');
const { getDownloadProgress, setDownloadProgress, clearDownloadProgress } = require('../services/shared/progressTracker');
const { lockDownload, unlockDownload, isDownloadActive, getDownloadInfo } = require('../services/shared/globalDownloadManager');
const { normalizeVideo } = require('../services/video/universalVideoNormalizer');
const { cancelYtdlpProcess } = require('../services/youtube/ytdlpDownloader');

/**
 * Registers download-related routes onto the provided router.
 * @param {import('express').Router} router
 */
function registerVideoDownloadRoutes(router) {
  /**
   * POST /api/download-video - Download a YouTube video
   */
  router.post('/download-video', async (req, res) => {
    const { videoId, useCookies = false, forceRetry = false } = req.body;

    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    // Check global download lock first
    if (isDownloadActive(videoId)) {
      const downloadInfo = getDownloadInfo(videoId);
      console.log(`[VIDEO-ROUTE] Download blocked: ${videoId} is already being downloaded by ${downloadInfo.route}`);

      // If forceRetry is true, clean up the stuck download and proceed
      if (forceRetry) {
        console.log(`[VIDEO-ROUTE] Force retry requested - cleaning up stuck download for ${videoId}`);
        unlockDownload(videoId, downloadInfo.route);
        // Clear any progress tracking
        clearDownloadProgress(videoId);
        console.log(`[VIDEO-ROUTE] Cleaned up stuck download, proceeding with retry`);
      } else {
        return res.status(409).json({
          error: 'Video is already being downloaded',
          activeRoute: downloadInfo.route,
          videoId: videoId,
          canRetry: true
        });
      }
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

    // Acquire global download lock
    if (!lockDownload(videoId, 'video-route')) {
      return res.status(409).json({
        error: 'Failed to acquire download lock',
        videoId: videoId
      });
    }

    let lockReleased = false;
    try {
      // Download the video using JavaScript libraries with audio prioritized
      const result = await downloadYouTubeVideo(videoId, useCookies);

      // Check if download was cancelled
      if (result.cancelled) {
        // Release lock for cancelled downloads
        unlockDownload(videoId, 'video-route');
        lockReleased = true;
        console.log(`[VIDEO-ROUTE] Released download lock for cancelled download: ${videoId}`);

        return res.json({
          success: false,
          cancelled: true,
          message: result.message || 'Download was cancelled',
          url: null // Explicitly set url to null for cancelled downloads
        });
      }

      // Check if the file was created successfully
      if (fs.existsSync(videoPath)) {
        // Normalize the downloaded video if needed
        console.log('[DOWNLOAD] Checking downloaded video for compatibility issues...');

        // Update progress to show normalization is happening
        setDownloadProgress(videoId, 99, 'normalizing');

        const normalizationResult = await normalizeVideo(videoPath);

        if (normalizationResult.normalized) {
          console.log(`[DOWNLOAD] Video normalized using ${normalizationResult.method}`);

          // Add a small delay to ensure file is fully written and handles are released
          await new Promise(resolve => setTimeout(resolve, 500));

          // Verify the file is accessible and not corrupted
          try {
            const stats = fs.statSync(videoPath);
            if (stats.size < 100 * 1024) { // Less than 100KB
              throw new Error(`Video file is too small (${stats.size} bytes)`);
            }
            console.log(`[DOWNLOAD] Verified normalized video: ${Math.round(stats.size / 1024 / 1024 * 100) / 100} MB`);
          } catch (verifyError) {
            console.error('[DOWNLOAD] File verification failed:', verifyError);
            throw new Error('Video file verification failed after normalization');
          }
        }

        // NOW set progress to 100% after everything is done
        setDownloadProgress(videoId, 100, 'completed');

        // Release the lock AFTER normalization completes and file is verified
        unlockDownload(videoId, 'video-route');
        lockReleased = true;
        console.log(`[VIDEO-ROUTE] Released download lock for ${videoId}`);

        return res.json({
          success: true,
          message: normalizationResult.normalized ?
            'Video downloaded and normalized successfully' :
            (result.message || 'Video downloaded successfully'),
          url: `/videos/${videoId}.mp4`,
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
          console.log(`[VIDEO-ROUTE] Cleaned up partial file: ${videoPath}`);
        }
      } catch (e) {
        console.error('Error cleaning up incomplete file:', e);
      }

      // Clear progress tracking
      clearDownloadProgress(videoId);

      // Provide more user-friendly error message with retry option
      let errorMessage = 'Failed to download video';
      let canRetry = true;

      if (error.message.includes('Video unavailable')) {
        errorMessage = 'This video is unavailable or has been removed.';
        canRetry = false;
      } else if (error.message.includes('Private video')) {
        errorMessage = 'This video is private and cannot be downloaded.';
        canRetry = false;
      } else if (error.message.includes('Sign in to confirm')) {
        errorMessage = 'This video requires age verification and cannot be downloaded.';
        canRetry = false;
      }

      // Release lock on error (if not already released)
      if (!lockReleased) {
        unlockDownload(videoId, 'video-route');
        console.log(`[VIDEO-ROUTE] Released download lock for ${videoId} due to error`);
      }

      return res.status(500).json({
        error: errorMessage,
        details: error.message,
        videoId: videoId,
        canRetry: canRetry
      });
    }
  });

  /**
   * GET /api/download-progress/:videoId - Get download progress for a video
   */
  router.get('/download-progress/:videoId', (req, res) => {
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
      console.error('Error getting download progress:', error);
      res.status(500).json({
        error: 'Failed to get download progress',
        details: error.message
      });
    }
  });

  /**
   * POST /api/cancel-download/:videoId - Cancel an ongoing video download
   */
  router.post('/cancel-download/:videoId', (req, res) => {
    const { videoId } = req.params;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'Video ID is required'
      });
    }

    try {
      // Try to kill the yt-dlp process
      const processKilled = cancelYtdlpProcess(videoId);

      // Release global download lock
      unlockDownload(videoId, 'video-route');

      // Update progress to cancelled
      setDownloadProgress(videoId, 0, 'cancelled');

      // Broadcast cancellation
      try {
        const { broadcastProgress } = require('../services/shared/progressWebSocket');
        broadcastProgress(videoId, 0, 'cancelled');
      } catch (error) {
        // WebSocket module might not be initialized yet
      }

      res.json({
        success: true,
        message: processKilled ?
          `Download cancelled and process killed for ${videoId}` :
          `Download cancellation requested for ${videoId} (no active process found)`
      });
    } catch (error) {
      console.error('[VIDEO-ROUTE] Error cancelling download:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel download'
      });
    }
  });
}

module.exports = registerVideoDownloadRoutes;
