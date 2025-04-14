/**
 * API routes for cache management
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { VIDEOS_DIR, SUBTITLES_DIR } = require('../config');

// Define paths for user-provided subtitles and transcription rules
const USER_SUBTITLES_DIR = path.join(SUBTITLES_DIR, 'user-provided');
const RULES_DIR = path.join(SUBTITLES_DIR, 'rules');
const { getFileSize, formatBytes } = require('../utils/fileUtils');

/**
 * GET /api/cache-info - Get information about the cache without clearing it
 */
router.get('/cache-info', (req, res) => {
  try {
    const details = {
      subtitles: { count: 0, size: 0, files: [] },
      videos: { count: 0, size: 0, files: [] },
      userSubtitles: { count: 0, size: 0, files: [] },
      rules: { count: 0, size: 0, files: [] },
      totalCount: 0,
      totalSize: 0
    };

    // Get subtitles directory info
    if (fs.existsSync(SUBTITLES_DIR)) {
      const subtitleFiles = fs.readdirSync(SUBTITLES_DIR);
      subtitleFiles.forEach(file => {
        const filePath = path.join(SUBTITLES_DIR, file);
        const stats = fs.statSync(filePath);

        // Skip directories
        if (stats.isDirectory()) {
          console.log(`Skipping directory in cache info: ${filePath}`);
          return;
        }

        const fileSize = stats.size;
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
        const stats = fs.statSync(filePath);

        // Skip directories
        if (stats.isDirectory()) {
          console.log(`Skipping directory in cache info: ${filePath}`);
          return;
        }

        const fileSize = stats.size;
        details.videos.count++;
        details.videos.size += fileSize;
        details.videos.files.push({ name: file, size: fileSize });
      });
    }



    // Get user-provided subtitles directory info
    if (fs.existsSync(USER_SUBTITLES_DIR)) {
      const userSubtitleFiles = fs.readdirSync(USER_SUBTITLES_DIR);
      userSubtitleFiles.forEach(file => {
        const filePath = path.join(USER_SUBTITLES_DIR, file);
        const stats = fs.statSync(filePath);

        // Skip directories
        if (stats.isDirectory()) {
          console.log(`Skipping directory in cache info: ${filePath}`);
          return;
        }

        const fileSize = stats.size;
        details.userSubtitles.count++;
        details.userSubtitles.size += fileSize;
        details.userSubtitles.files.push({ name: file, size: fileSize });
      });
    }

    // Get rules directory info
    if (fs.existsSync(RULES_DIR)) {
      const rulesFiles = fs.readdirSync(RULES_DIR);
      rulesFiles.forEach(file => {
        const filePath = path.join(RULES_DIR, file);
        const stats = fs.statSync(filePath);

        // Skip directories
        if (stats.isDirectory()) {
          console.log(`Skipping directory in cache info: ${filePath}`);
          return;
        }

        const fileSize = stats.size;
        details.rules.count++;
        details.rules.size += fileSize;
        details.rules.files.push({ name: file, size: fileSize });
      });
    }

    // Calculate totals
    details.totalCount = details.subtitles.count + details.videos.count + details.userSubtitles.count + details.rules.count;
    details.totalSize = details.subtitles.size + details.videos.size + details.userSubtitles.size + details.rules.size;

    // Format sizes for human readability
    details.subtitles.formattedSize = formatBytes(details.subtitles.size);
    details.videos.formattedSize = formatBytes(details.videos.size);
    details.userSubtitles.formattedSize = formatBytes(details.userSubtitles.size);
    details.rules.formattedSize = formatBytes(details.rules.size);
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
      userSubtitles: { count: 0, size: 0, files: [] },
      rules: { count: 0, size: 0, files: [] },
      totalCount: 0,
      totalSize: 0
    };

    // Clear subtitles directory
    if (fs.existsSync(SUBTITLES_DIR)) {
      const subtitleFiles = fs.readdirSync(SUBTITLES_DIR);
      subtitleFiles.forEach(file => {
        const filePath = path.join(SUBTITLES_DIR, file);
        const stats = fs.statSync(filePath);

        // Skip directories
        if (stats.isDirectory()) {
          console.log(`Skipping directory: ${filePath}`);
          return;
        }

        const fileSize = stats.size;
        details.subtitles.count++;
        details.subtitles.size += fileSize;
        details.subtitles.files.push({ name: file, size: fileSize });

        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error(`Error deleting file ${filePath}:`, error);
        }
      });
    }

    // Clear videos directory
    if (fs.existsSync(VIDEOS_DIR)) {
      const videoFiles = fs.readdirSync(VIDEOS_DIR);
      videoFiles.forEach(file => {
        const filePath = path.join(VIDEOS_DIR, file);
        const stats = fs.statSync(filePath);

        // Skip directories
        if (stats.isDirectory()) {
          console.log(`Skipping directory: ${filePath}`);
          return;
        }

        const fileSize = stats.size;
        details.videos.count++;
        details.videos.size += fileSize;
        details.videos.files.push({ name: file, size: fileSize });

        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error(`Error deleting file ${filePath}:`, error);
        }
      });
    }



    // Clear user-provided subtitles directory
    if (fs.existsSync(USER_SUBTITLES_DIR)) {
      const userSubtitleFiles = fs.readdirSync(USER_SUBTITLES_DIR);
      userSubtitleFiles.forEach(file => {
        const filePath = path.join(USER_SUBTITLES_DIR, file);
        const stats = fs.statSync(filePath);

        // Skip directories
        if (stats.isDirectory()) {
          console.log(`Skipping directory: ${filePath}`);
          return;
        }

        const fileSize = stats.size;
        details.userSubtitles.count++;
        details.userSubtitles.size += fileSize;
        details.userSubtitles.files.push({ name: file, size: fileSize });

        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error(`Error deleting file ${filePath}:`, error);
        }
      });
    }

    // Clear rules directory
    if (fs.existsSync(RULES_DIR)) {
      const rulesFiles = fs.readdirSync(RULES_DIR);
      rulesFiles.forEach(file => {
        const filePath = path.join(RULES_DIR, file);
        const stats = fs.statSync(filePath);

        // Skip directories
        if (stats.isDirectory()) {
          console.log(`Skipping directory: ${filePath}`);
          return;
        }

        const fileSize = stats.size;
        details.rules.count++;
        details.rules.size += fileSize;
        details.rules.files.push({ name: file, size: fileSize });

        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error(`Error deleting file ${filePath}:`, error);
        }
      });
    }

    // Calculate totals
    details.totalCount = details.subtitles.count + details.videos.count + details.userSubtitles.count + details.rules.count;
    details.totalSize = details.subtitles.size + details.videos.size + details.userSubtitles.size + details.rules.size;

    // Format sizes for human readability
    details.subtitles.formattedSize = formatBytes(details.subtitles.size);
    details.videos.formattedSize = formatBytes(details.videos.size);
    details.userSubtitles.formattedSize = formatBytes(details.userSubtitles.size);
    details.rules.formattedSize = formatBytes(details.rules.size);
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
