/**
 * API routes for managing and cleaning up stuck downloads
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { VIDEOS_DIR } = require('../config');
const { 
  getAllActiveDownloads, 
  forceCleanupDownload, 
  cleanupStaleDownloads,
  isDownloadStale 
} = require('../services/shared/globalDownloadManager');
const { clearDownloadProgress } = require('../services/shared/progressTracker');

/**
 * GET /api/download-management/active-downloads - Get all active downloads
 */
router.get('/active-downloads', (req, res) => {
  try {
    const activeDownloads = getAllActiveDownloads();
    
    // Add staleness check to each download
    const downloadsWithStatus = activeDownloads.map(download => ({
      ...download,
      isStale: download.ageMinutes > 5,
      isVeryStale: download.ageMinutes > 10
    }));
    
    res.json({
      success: true,
      downloads: downloadsWithStatus,
      totalActive: activeDownloads.length,
      staleCount: downloadsWithStatus.filter(d => d.isStale).length
    });
  } catch (error) {
    console.error('[DOWNLOAD-MANAGEMENT] Error getting active downloads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active downloads'
    });
  }
});

/**
 * POST /api/download-management/cleanup-stale - Clean up all stale downloads
 */
router.post('/cleanup-stale', (req, res) => {
  const { thresholdMinutes = 10 } = req.body;
  
  try {
    console.log(`[DOWNLOAD-MANAGEMENT] Cleaning up downloads older than ${thresholdMinutes} minutes`);
    
    // Get list before cleanup for reporting
    const beforeCleanup = getAllActiveDownloads();
    
    // Perform cleanup
    const cleanedUp = cleanupStaleDownloads(thresholdMinutes);
    
    // Clear progress tracking for cleaned up downloads
    cleanedUp.forEach(videoId => {
      clearDownloadProgress(videoId);
      
      // Try to clean up any partial files
      const possibleFiles = [
        path.join(VIDEOS_DIR, `${videoId}.mp4`),
        path.join(VIDEOS_DIR, `${videoId}.mp3`),
        path.join(VIDEOS_DIR, `${videoId}_*.mp4`), // Pattern for quality downloads
      ];
      
      possibleFiles.forEach(filePath => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[DOWNLOAD-MANAGEMENT] Cleaned up partial file: ${filePath}`);
          }
        } catch (err) {
          // File might not exist or pattern might not match
        }
      });
    });
    
    res.json({
      success: true,
      message: `Cleaned up ${cleanedUp.length} stale downloads`,
      cleanedUpVideoIds: cleanedUp,
      beforeCount: beforeCleanup.length,
      afterCount: getAllActiveDownloads().length
    });
  } catch (error) {
    console.error('[DOWNLOAD-MANAGEMENT] Error cleaning up stale downloads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean up stale downloads'
    });
  }
});

/**
 * DELETE /api/download-management/force-cleanup/:videoId - Force cleanup a specific download
 */
router.delete('/force-cleanup/:videoId', (req, res) => {
  const { videoId } = req.params;
  
  if (!videoId) {
    return res.status(400).json({
      success: false,
      error: 'Video ID is required'
    });
  }
  
  try {
    console.log(`[DOWNLOAD-MANAGEMENT] Force cleanup requested for: ${videoId}`);
    
    // Force cleanup the download lock
    const wasActive = forceCleanupDownload(videoId);
    
    // Clear progress tracking
    clearDownloadProgress(videoId);
    
    // Try to clean up any partial files
    const possibleExtensions = ['.mp4', '.mp3', '.webm', '.mkv'];
    let filesDeleted = 0;
    
    possibleExtensions.forEach(ext => {
      const filePath = path.join(VIDEOS_DIR, `${videoId}${ext}`);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`[DOWNLOAD-MANAGEMENT] Deleted partial file: ${filePath}`);
          filesDeleted++;
        }
      } catch (err) {
        console.error(`[DOWNLOAD-MANAGEMENT] Error deleting file ${filePath}:`, err.message);
      }
    });
    
    // Also check for quality-suffixed files
    try {
      const files = fs.readdirSync(VIDEOS_DIR);
      files.forEach(file => {
        if (file.startsWith(`${videoId}_`) || file.includes(videoId)) {
          const filePath = path.join(VIDEOS_DIR, file);
          try {
            fs.unlinkSync(filePath);
            console.log(`[DOWNLOAD-MANAGEMENT] Deleted related file: ${filePath}`);
            filesDeleted++;
          } catch (err) {
            console.error(`[DOWNLOAD-MANAGEMENT] Error deleting file ${filePath}:`, err.message);
          }
        }
      });
    } catch (err) {
      console.error('[DOWNLOAD-MANAGEMENT] Error scanning for related files:', err.message);
    }
    
    res.json({
      success: true,
      message: `Force cleanup completed for ${videoId}`,
      wasActive: wasActive,
      filesDeleted: filesDeleted
    });
  } catch (error) {
    console.error('[DOWNLOAD-MANAGEMENT] Error during force cleanup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to force cleanup download'
    });
  }
});

/**
 * POST /api/download-management/cleanup-all - Clean up all downloads and reset state
 */
router.post('/cleanup-all', (req, res) => {
  try {
    console.log('[DOWNLOAD-MANAGEMENT] Cleaning up ALL downloads');
    
    // Get all active downloads
    const allDownloads = getAllActiveDownloads();
    
    // Force cleanup each one
    let cleanedCount = 0;
    allDownloads.forEach(download => {
      if (forceCleanupDownload(download.videoId)) {
        clearDownloadProgress(download.videoId);
        cleanedCount++;
      }
    });
    
    res.json({
      success: true,
      message: `Cleaned up all ${cleanedCount} active downloads`,
      cleanedCount: cleanedCount
    });
  } catch (error) {
    console.error('[DOWNLOAD-MANAGEMENT] Error cleaning up all downloads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean up all downloads'
    });
  }
});

/**
 * GET /api/download-management/check-health - Check download system health
 */
router.get('/check-health', (req, res) => {
  try {
    const activeDownloads = getAllActiveDownloads();
    const staleCount = activeDownloads.filter(d => d.ageMinutes > 5).length;
    const veryStaleCount = activeDownloads.filter(d => d.ageMinutes > 10).length;
    
    const health = {
      status: 'healthy',
      message: 'Download system is operating normally'
    };
    
    if (veryStaleCount > 0) {
      health.status = 'unhealthy';
      health.message = `${veryStaleCount} downloads are stuck (>10 minutes old)`;
    } else if (staleCount > 2) {
      health.status = 'warning';
      health.message = `${staleCount} downloads may be stuck (>5 minutes old)`;
    }
    
    res.json({
      success: true,
      health: health,
      metrics: {
        totalActive: activeDownloads.length,
        stale: staleCount,
        veryStale: veryStaleCount,
        healthy: activeDownloads.filter(d => d.ageMinutes <= 5).length
      },
      downloads: activeDownloads
    });
  } catch (error) {
    console.error('[DOWNLOAD-MANAGEMENT] Error checking health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check download system health'
    });
  }
});

module.exports = router;
