/**
 * API routes for cache management
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { VIDEOS_DIR, SUBTITLES_DIR } = require('../config');
const { safeDeleteFile, safeDeleteMultipleFiles } = require('../utils/windowsSafeFileOperations');

// Define paths for user-provided subtitles and transcription rules
const USER_SUBTITLES_DIR = path.join(SUBTITLES_DIR, 'user-provided');
const RULES_DIR = path.join(SUBTITLES_DIR, 'rules');

// Define paths for narration directories
const NARRATION_DIR = path.join(path.dirname(path.dirname(__dirname)), 'narration');
const REFERENCE_AUDIO_DIR = path.join(NARRATION_DIR, 'reference');
const OUTPUT_AUDIO_DIR = path.join(NARRATION_DIR, 'output');
const TEMP_AUDIO_DIR = path.join(NARRATION_DIR, 'temp');

// Define paths for lyrics and album art
const LYRICS_DIR = path.join(VIDEOS_DIR, 'lyrics');
const ALBUM_ART_DIR = path.join(path.dirname(path.dirname(__dirname)), 'public', 'videos', 'album_art');

// Define additional cache directories that are currently missing
const UPLOADS_DIR = path.join(path.dirname(path.dirname(__dirname)), 'uploads');
const OUTPUT_DIR = path.join(path.dirname(path.dirname(__dirname)), 'output');
const VIDEO_RENDERED_DIR = path.join(VIDEOS_DIR, 'rendered');
const VIDEO_TEMP_DIR = path.join(VIDEOS_DIR, 'temp');
const VIDEO_ALBUM_ART_DIR = path.join(VIDEOS_DIR, 'album_art');
const VIDEO_RENDERER_UPLOADS_DIR = path.join(path.dirname(path.dirname(__dirname)), 'video-renderer', 'server', 'uploads');
const VIDEO_RENDERER_OUTPUT_DIR = path.join(path.dirname(path.dirname(__dirname)), 'video-renderer', 'server', 'output');

const { formatBytes } = require('../utils/fileUtils');
const { scanFlatDir, scanRecursiveDir, clearFlatDir, clearRecursiveDir, finalizeCacheDetails } = require('../utils/cacheScanner');

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
      narrationReference: { count: 0, size: 0, files: [] },
      narrationOutput: { count: 0, size: 0, files: [] },
      lyrics: { count: 0, size: 0, files: [] },
      albumArt: { count: 0, size: 0, files: [] },
      uploads: { count: 0, size: 0, files: [] },
      output: { count: 0, size: 0, files: [] },
      videoRendered: { count: 0, size: 0, files: [] },
      videoTemp: { count: 0, size: 0, files: [] },
      videoAlbumArt: { count: 0, size: 0, files: [] },
      videoRendererUploads: { count: 0, size: 0, files: [] },
      videoRendererOutput: { count: 0, size: 0, files: [] },
      totalCount: 0,
      totalSize: 0
    };

    scanFlatDir(SUBTITLES_DIR, details.subtitles);
    scanFlatDir(VIDEOS_DIR, details.videos);
    scanFlatDir(USER_SUBTITLES_DIR, details.userSubtitles);
    scanFlatDir(RULES_DIR, details.rules);
    scanFlatDir(REFERENCE_AUDIO_DIR, details.narrationReference);

    // Get narration output audio directory info
    if (fs.existsSync(OUTPUT_AUDIO_DIR)) {
      const outputItems = fs.readdirSync(OUTPUT_AUDIO_DIR);
      outputItems.forEach(item => {
        const itemPath = path.join(OUTPUT_AUDIO_DIR, item);
        try {
          const stats = fs.statSync(itemPath);

          if (stats.isDirectory()) {
            // For directories (subtitle folders), calculate size and count files
            const subtitleFiles = fs.readdirSync(itemPath);
            let directorySize = 0;

            // Process each file in the subtitle directory
            subtitleFiles.forEach(file => {
              const filePath = path.join(itemPath, file);
              try {
                const fileStats = fs.statSync(filePath);
                const fileSize = fileStats.size;
                directorySize += fileSize;
                details.narrationOutput.count++;
                details.narrationOutput.files.push({ name: `${item}/${file}`, size: fileSize });
              } catch (fileError) {
                console.error(`Error processing file ${filePath}:`, fileError);
              }
            });

            // Add directory size to total
            details.narrationOutput.size += directorySize;
          } else {
            // For files in the root output directory (legacy files)
            const fileSize = stats.size;
            details.narrationOutput.count++;
            details.narrationOutput.size += fileSize;
            details.narrationOutput.files.push({ name: item, size: fileSize });
          }
        } catch (error) {
          console.error(`Error processing item ${itemPath}:`, error);
        }
      });
    }

    scanFlatDir(LYRICS_DIR, details.lyrics);
    scanFlatDir(ALBUM_ART_DIR, details.albumArt);
    scanRecursiveDir(UPLOADS_DIR, details.uploads);
    scanFlatDir(OUTPUT_DIR, details.output);
    scanFlatDir(VIDEO_RENDERED_DIR, details.videoRendered);
    scanFlatDir(VIDEO_TEMP_DIR, details.videoTemp);
    scanFlatDir(VIDEO_ALBUM_ART_DIR, details.videoAlbumArt);
    scanRecursiveDir(VIDEO_RENDERER_UPLOADS_DIR, details.videoRendererUploads);
    scanFlatDir(VIDEO_RENDERER_OUTPUT_DIR, details.videoRendererOutput);

    finalizeCacheDetails(details);

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
 * DELETE /api/clear-cache/:type - Clear specific type of cached files
 */
router.delete('/clear-cache/:type', async (req, res) => {
  const { type } = req.params;

  // Define valid cache types and their corresponding directories/logic
  const cacheTypes = {
    'videos': { dir: VIDEOS_DIR, key: 'videos' },
    'subtitles': { dir: SUBTITLES_DIR, key: 'subtitles' },
    'userSubtitles': { dir: USER_SUBTITLES_DIR, key: 'userSubtitles' },
    'rules': { dir: RULES_DIR, key: 'rules' },
    'narrationReference': { dir: REFERENCE_AUDIO_DIR, key: 'narrationReference' },
    'narrationOutput': { dir: OUTPUT_AUDIO_DIR, key: 'narrationOutput' },
    'lyrics': { dir: LYRICS_DIR, key: 'lyrics' },
    'albumArt': { dir: ALBUM_ART_DIR, key: 'albumArt' },
    'uploads': { dir: UPLOADS_DIR, key: 'uploads' },
    'output': { dir: OUTPUT_DIR, key: 'output' },
    'videoRendered': { dir: VIDEO_RENDERED_DIR, key: 'videoRendered' },
    'videoTemp': { dir: VIDEO_TEMP_DIR, key: 'videoTemp' },
    'videoAlbumArt': { dir: VIDEO_ALBUM_ART_DIR, key: 'videoAlbumArt' },
    'videoRendererUploads': { dir: VIDEO_RENDERER_UPLOADS_DIR, key: 'videoRendererUploads' },
    'videoRendererOutput': { dir: VIDEO_RENDERER_OUTPUT_DIR, key: 'videoRendererOutput' }
  };

  if (!cacheTypes[type]) {
    return res.status(400).json({
      success: false,
      error: `Invalid cache type: ${type}. Valid types are: ${Object.keys(cacheTypes).join(', ')}`
    });
  }

  try {
    const cacheType = cacheTypes[type];
    const details = {
      [cacheType.key]: { count: 0, size: 0, files: [] }
    };

    // Clear the specific cache type
    await clearSpecificCacheType(cacheType.dir, cacheType.key, details, type);

    // Format the size
    details[cacheType.key].formattedSize = formatBytes(details[cacheType.key].size);

    res.json({
      success: true,
      message: `${type} cache cleared successfully`,
      details: details
    });
  } catch (error) {
    console.error(`Error clearing ${type} cache:`, error);
    res.status(500).json({
      success: false,
      error: `Failed to clear ${type} cache`
    });
  }
});

/**
 * Helper function to clear specific cache type
 */
async function clearSpecificCacheType(directory, key, details, type) {
  if (!fs.existsSync(directory)) {
    return;
  }

  // Handle special cases for recursive directories
  if (type === 'uploads' || type === 'videoRendererUploads' || type === 'narrationOutput') {
    const clearDirectory = async (dirPath, prefix = '') => {
      const items = fs.readdirSync(dirPath);
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        try {
          const stats = fs.statSync(itemPath);
          if (stats.isDirectory()) {
            await clearDirectory(itemPath, prefix ? `${prefix}/${item}` : item);
            // Remove empty directory
            try {
              fs.rmdirSync(itemPath);
              console.log(`Removed directory: ${itemPath}`);
            } catch (rmError) {
              console.error(`Error removing directory ${itemPath}:`, rmError);
            }
          } else {
            const fileSize = stats.size;
            details[key].count++;
            details[key].size += fileSize;
            details[key].files.push({ name: prefix ? `${prefix}/${item}` : item, size: fileSize });
            await safeDeleteFile(itemPath);
          }
        } catch (error) {
          console.error(`Error processing item ${itemPath}:`, error);
        }
      }
    };
    await clearDirectory(directory);
  } else if (type === 'videos') {
    // Special handling for videos with safe batch deletion
    const videoFiles = fs.readdirSync(directory);
    const videoFilePaths = [];

    for (const file of videoFiles) {
      const filePath = path.join(directory, file);
      try {
        const stats = fs.statSync(filePath);
        if (!stats.isDirectory()) {
          const fileSize = stats.size;
          details[key].count++;
          details[key].size += fileSize;
          details[key].files.push({ name: file, size: fileSize });
          videoFilePaths.push(filePath);
        }
      } catch (error) {
        console.error(`Error processing video file ${filePath}:`, error);
      }
    }

    // Safely delete all video files
    if (videoFilePaths.length > 0) {
      console.log(`Safely deleting ${videoFilePaths.length} video files...`);
      const deleteResults = await safeDeleteMultipleFiles(videoFilePaths, (deleted, total, currentFile) => {
        if (currentFile) {
          console.log(`Deleting video file ${deleted + 1}/${total}: ${path.basename(currentFile)}`);
        }
      });
      console.log(`Video deletion results: ${deleteResults.deleted} deleted, ${deleteResults.failed} failed`);
    }
  } else {
    // Standard file deletion for other types
    const files = fs.readdirSync(directory);
    for (const file of files) {
      const filePath = path.join(directory, file);
      try {
        const stats = fs.statSync(filePath);
        if (!stats.isDirectory()) {
          const fileSize = stats.size;
          details[key].count++;
          details[key].size += fileSize;
          details[key].files.push({ name: file, size: fileSize });
          await safeDeleteFile(filePath);
        }
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
      }
    }
  }

  // Handle temp directory cleanup for narration
  if (type === 'narrationOutput') {
    if (fs.existsSync(TEMP_AUDIO_DIR)) {
      const tempFiles = fs.readdirSync(TEMP_AUDIO_DIR);
      for (const file of tempFiles) {
        const filePath = path.join(TEMP_AUDIO_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          if (!stats.isDirectory()) {
            await safeDeleteFile(filePath);
          }
        } catch (error) {
          console.error(`Error processing temp file ${filePath}:`, error);
        }
      }
    }
  }
}

/**
 * DELETE /api/clear-cache - Clear all cached files
 */
router.delete('/clear-cache', async (req, res) => {
  try {
    const details = {
      subtitles: { count: 0, size: 0, files: [] },
      videos: { count: 0, size: 0, files: [] },
      userSubtitles: { count: 0, size: 0, files: [] },
      rules: { count: 0, size: 0, files: [] },
      narrationReference: { count: 0, size: 0, files: [] },
      narrationOutput: { count: 0, size: 0, files: [] },
      lyrics: { count: 0, size: 0, files: [] },
      albumArt: { count: 0, size: 0, files: [] },
      uploads: { count: 0, size: 0, files: [] },
      output: { count: 0, size: 0, files: [] },
      videoRendered: { count: 0, size: 0, files: [] },
      videoTemp: { count: 0, size: 0, files: [] },
      videoAlbumArt: { count: 0, size: 0, files: [] },
      videoRendererUploads: { count: 0, size: 0, files: [] },
      videoRendererOutput: { count: 0, size: 0, files: [] },
      totalCount: 0,
      totalSize: 0
    };

    await clearFlatDir(SUBTITLES_DIR, details.subtitles);

    // Clear videos directory
    if (fs.existsSync(VIDEOS_DIR)) {
      const videoFiles = fs.readdirSync(VIDEOS_DIR);
      const videoFilePaths = [];

      // First, collect file info and paths
      videoFiles.forEach(file => {
        const filePath = path.join(VIDEOS_DIR, file);
        try {
          const stats = fs.statSync(filePath);

          // Skip directories
          if (stats.isDirectory()) {
            return;
          }

          const fileSize = stats.size;
          details.videos.count++;
          details.videos.size += fileSize;
          details.videos.files.push({ name: file, size: fileSize });
          videoFilePaths.push(filePath);
        } catch (error) {
          console.error(`Error getting stats for ${filePath}:`, error);
        }
      });

      // Then safely delete all video files
      if (videoFilePaths.length > 0) {
        console.log(`Safely deleting ${videoFilePaths.length} video files...`);
        const deleteResults = await safeDeleteMultipleFiles(videoFilePaths, (deleted, total, currentFile) => {
          if (currentFile) {
            console.log(`Deleting video file ${deleted + 1}/${total}: ${path.basename(currentFile)}`);
          }
        });
        console.log(`Video deletion results: ${deleteResults.deleted} deleted, ${deleteResults.failed} failed`);
        if (deleteResults.failed > 0) {
          console.log('Failed to delete video files:', deleteResults.failedFiles.map(f => path.basename(f)));
        }
      }
    }

    await clearFlatDir(USER_SUBTITLES_DIR, details.userSubtitles);
    await clearFlatDir(RULES_DIR, details.rules);
    await clearFlatDir(REFERENCE_AUDIO_DIR, details.narrationReference);

    // Clear narration output audio directory
    if (fs.existsSync(OUTPUT_AUDIO_DIR)) {
      const outputItems = fs.readdirSync(OUTPUT_AUDIO_DIR);
      for (const item of outputItems) {
        const itemPath = path.join(OUTPUT_AUDIO_DIR, item);
        try {
          const stats = fs.statSync(itemPath);

          if (stats.isDirectory()) {
            // For directories (subtitle folders), calculate size and count files
            const subtitleFiles = fs.readdirSync(itemPath);
            let directorySize = 0;

            // Process each file in the subtitle directory
            for (const file of subtitleFiles) {
              const filePath = path.join(itemPath, file);
              try {
                const fileStats = fs.statSync(filePath);
                const fileSize = fileStats.size;
                directorySize += fileSize;
                details.narrationOutput.count++;
                details.narrationOutput.files.push({ name: `${item}/${file}`, size: fileSize });

                // Delete the file safely
                await safeDeleteFile(filePath);
              } catch (fileError) {
                console.error(`Error processing file ${filePath}:`, fileError);
              }
            }

            // Add directory size to total
            details.narrationOutput.size += directorySize;

            // Remove the now-empty directory
            try {
              fs.rmdirSync(itemPath);
              console.log(`Removed subtitle directory: ${itemPath}`);
            } catch (rmError) {
              console.error(`Error removing directory ${itemPath}:`, rmError);
            }
          } else {
            // For files in the root output directory (legacy files)
            const fileSize = stats.size;
            details.narrationOutput.count++;
            details.narrationOutput.size += fileSize;
            details.narrationOutput.files.push({ name: item, size: fileSize });

            // Delete the file safely
            await safeDeleteFile(itemPath);
          }
        } catch (error) {
          console.error(`Error processing item ${itemPath}:`, error);
        }
      }
    }

    // Clear narration temp directory
    if (fs.existsSync(TEMP_AUDIO_DIR)) {
      const tempFiles = fs.readdirSync(TEMP_AUDIO_DIR);
      for (const file of tempFiles) {
        const filePath = path.join(TEMP_AUDIO_DIR, file);
        try {
          const stats = fs.statSync(filePath);

          // Skip directories
          if (stats.isDirectory()) {
            continue;
          }

          // We don't count temp files in the details

          // Delete temp file safely
          await safeDeleteFile(filePath);
        } catch (error) {
          console.error(`Error processing temp file ${filePath}:`, error);
        }
      }
    }

    await clearFlatDir(LYRICS_DIR, details.lyrics);
    await clearFlatDir(ALBUM_ART_DIR, details.albumArt);
    await clearRecursiveDir(UPLOADS_DIR, details.uploads);
    await clearFlatDir(OUTPUT_DIR, details.output);
    await clearFlatDir(VIDEO_RENDERED_DIR, details.videoRendered);
    await clearFlatDir(VIDEO_TEMP_DIR, details.videoTemp);
    await clearFlatDir(VIDEO_ALBUM_ART_DIR, details.videoAlbumArt);
    await clearRecursiveDir(VIDEO_RENDERER_UPLOADS_DIR, details.videoRendererUploads);
    await clearFlatDir(VIDEO_RENDERER_OUTPUT_DIR, details.videoRendererOutput);

    finalizeCacheDetails(details);

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
