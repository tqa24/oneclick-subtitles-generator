/**
 * API routes for cache management
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { VIDEOS_DIR, SUBTITLES_DIR } = require('../config');
const { getFileSize, formatBytes } = require('../utils/fileUtils');

/**
 * GET /api/cache-info - Get information about the cache without clearing it
 */
router.get('/cache-info', (req, res) => {
  try {
    const details = {
      subtitles: { count: 0, size: 0, files: [] },
      videos: { count: 0, size: 0, files: [] },
      totalCount: 0,
      totalSize: 0
    };

    // Get subtitles directory info
    if (fs.existsSync(SUBTITLES_DIR)) {
      const subtitleFiles = fs.readdirSync(SUBTITLES_DIR);
      subtitleFiles.forEach(file => {
        const filePath = path.join(SUBTITLES_DIR, file);
        const fileSize = getFileSize(filePath);
        details.subtitles.count++;
        details.subtitles.size += fileSize;
        details.subtitles.files.push({ name: file, size: fileSize });
      });
    }

    // Get videos directory info
    if (fs.existsSync(VIDEOS_DIR)) {
      const videoFiles = fs.readdirSync(VIDEOS_DIR);
      videoFiles.forEach(file => {
        const filePath = path.join(VIDEOS_DIR, file);
        const fileSize = getFileSize(filePath);
        details.videos.count++;
        details.videos.size += fileSize;
        details.videos.files.push({ name: file, size: fileSize });
      });
    }



    // Calculate totals
    details.totalCount = details.subtitles.count + details.videos.count;
    details.totalSize = details.subtitles.size + details.videos.size;

    // Format sizes for human readability
    details.subtitles.formattedSize = formatBytes(details.subtitles.size);
    details.videos.formattedSize = formatBytes(details.videos.size);
    details.formattedTotalSize = formatBytes(details.totalSize);

    res.json({
      success: true,
      details: details
    });
  } catch (error) {
    console.error('Error getting cache info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache information'
    });
  }
});

/**
 * DELETE /api/clear-cache - Clear all cached files
 */
router.delete('/clear-cache', (req, res) => {
  try {
    const details = {
      subtitles: { count: 0, size: 0, files: [] },
      videos: { count: 0, size: 0, files: [] },
      totalCount: 0,
      totalSize: 0
    };

    // Clear subtitles directory
    const subtitleFiles = fs.readdirSync(SUBTITLES_DIR);
    subtitleFiles.forEach(file => {
      const filePath = path.join(SUBTITLES_DIR, file);
      const fileSize = getFileSize(filePath);
      details.subtitles.count++;
      details.subtitles.size += fileSize;
      details.subtitles.files.push({ name: file, size: fileSize });
      fs.unlinkSync(filePath);
    });

    // Clear videos directory
    const videoFiles = fs.readdirSync(VIDEOS_DIR);
    videoFiles.forEach(file => {
      const filePath = path.join(VIDEOS_DIR, file);
      const fileSize = getFileSize(filePath);
      details.videos.count++;
      details.videos.size += fileSize;
      details.videos.files.push({ name: file, size: fileSize });
      fs.unlinkSync(filePath);
    });



    // Calculate totals
    details.totalCount = details.subtitles.count + details.videos.count;
    details.totalSize = details.subtitles.size + details.videos.size;

    // Format sizes for human readability
    details.subtitles.formattedSize = formatBytes(details.subtitles.size);
    details.videos.formattedSize = formatBytes(details.videos.size);
    details.formattedTotalSize = formatBytes(details.totalSize);

    res.json({
      success: true,
      message: 'Cache cleared successfully',
      details: details
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

module.exports = router;
