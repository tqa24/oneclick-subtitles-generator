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

    // Get subtitles directory info
    if (fs.existsSync(SUBTITLES_DIR)) {
      const subtitleFiles = fs.readdirSync(SUBTITLES_DIR);
      subtitleFiles.forEach(file => {
        const filePath = path.join(SUBTITLES_DIR, file);
        const stats = fs.statSync(filePath);

        // Skip directories
        if (stats.isDirectory()) {

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

          return;
        }

        const fileSize = stats.size;
        details.rules.count++;
        details.rules.size += fileSize;
        details.rules.files.push({ name: file, size: fileSize });
      });
    }

    // Get narration reference audio directory info
    if (fs.existsSync(REFERENCE_AUDIO_DIR)) {
      const referenceFiles = fs.readdirSync(REFERENCE_AUDIO_DIR);
      referenceFiles.forEach(file => {
        const filePath = path.join(REFERENCE_AUDIO_DIR, file);
        const stats = fs.statSync(filePath);

        // Skip directories
        if (stats.isDirectory()) {

          return;
        }

        const fileSize = stats.size;
        details.narrationReference.count++;
        details.narrationReference.size += fileSize;
        details.narrationReference.files.push({ name: file, size: fileSize });
      });
    }

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

    // Get narration temp directory info (we don't include it in the totals)
    if (fs.existsSync(TEMP_AUDIO_DIR)) {
      const tempFiles = fs.readdirSync(TEMP_AUDIO_DIR);

    }

    // Get lyrics directory info
    if (fs.existsSync(LYRICS_DIR)) {
      const lyricsFiles = fs.readdirSync(LYRICS_DIR);
      lyricsFiles.forEach(file => {
        const filePath = path.join(LYRICS_DIR, file);
        const stats = fs.statSync(filePath);

        // Skip directories
        if (stats.isDirectory()) {

          return;
        }

        const fileSize = stats.size;
        details.lyrics.count++;
        details.lyrics.size += fileSize;
        details.lyrics.files.push({ name: file, size: fileSize });
      });
    }

    // Get album art directory info
    if (fs.existsSync(ALBUM_ART_DIR)) {
      const albumArtFiles = fs.readdirSync(ALBUM_ART_DIR);
      albumArtFiles.forEach(file => {
        const filePath = path.join(ALBUM_ART_DIR, file);
        const stats = fs.statSync(filePath);

        // Skip directories
        if (stats.isDirectory()) {

          return;
        }

        const fileSize = stats.size;
        details.albumArt.count++;
        details.albumArt.size += fileSize;
        details.albumArt.files.push({ name: file, size: fileSize });
      });
    }

    // Get uploads directory info (recursively scan subdirectories)
    if (fs.existsSync(UPLOADS_DIR)) {
      const scanDirectory = (dirPath, prefix = '') => {
        const items = fs.readdirSync(dirPath);
        items.forEach(item => {
          const itemPath = path.join(dirPath, item);
          try {
            const stats = fs.statSync(itemPath);
            if (stats.isDirectory()) {
              scanDirectory(itemPath, prefix ? `${prefix}/${item}` : item);
            } else {
              const fileSize = stats.size;
              details.uploads.count++;
              details.uploads.size += fileSize;
              details.uploads.files.push({ name: prefix ? `${prefix}/${item}` : item, size: fileSize });
            }
          } catch (error) {
            console.error(`Error processing upload item ${itemPath}:`, error);
          }
        });
      };
      scanDirectory(UPLOADS_DIR);
    }

    // Get output directory info
    if (fs.existsSync(OUTPUT_DIR)) {
      const outputFiles = fs.readdirSync(OUTPUT_DIR);
      outputFiles.forEach(file => {
        const filePath = path.join(OUTPUT_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          if (!stats.isDirectory()) {
            const fileSize = stats.size;
            details.output.count++;
            details.output.size += fileSize;
            details.output.files.push({ name: file, size: fileSize });
          }
        } catch (error) {
          console.error(`Error processing output file ${filePath}:`, error);
        }
      });
    }

    // Get video rendered directory info
    if (fs.existsSync(VIDEO_RENDERED_DIR)) {
      const renderedFiles = fs.readdirSync(VIDEO_RENDERED_DIR);
      renderedFiles.forEach(file => {
        const filePath = path.join(VIDEO_RENDERED_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          if (!stats.isDirectory()) {
            const fileSize = stats.size;
            details.videoRendered.count++;
            details.videoRendered.size += fileSize;
            details.videoRendered.files.push({ name: file, size: fileSize });
          }
        } catch (error) {
          console.error(`Error processing video rendered file ${filePath}:`, error);
        }
      });
    }

    // Get video temp directory info
    if (fs.existsSync(VIDEO_TEMP_DIR)) {
      const tempFiles = fs.readdirSync(VIDEO_TEMP_DIR);
      tempFiles.forEach(file => {
        const filePath = path.join(VIDEO_TEMP_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          if (!stats.isDirectory()) {
            const fileSize = stats.size;
            details.videoTemp.count++;
            details.videoTemp.size += fileSize;
            details.videoTemp.files.push({ name: file, size: fileSize });
          }
        } catch (error) {
          console.error(`Error processing video temp file ${filePath}:`, error);
        }
      });
    }

    // Get video album art directory info
    if (fs.existsSync(VIDEO_ALBUM_ART_DIR)) {
      const albumArtFiles = fs.readdirSync(VIDEO_ALBUM_ART_DIR);
      albumArtFiles.forEach(file => {
        const filePath = path.join(VIDEO_ALBUM_ART_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          if (!stats.isDirectory()) {
            const fileSize = stats.size;
            details.videoAlbumArt.count++;
            details.videoAlbumArt.size += fileSize;
            details.videoAlbumArt.files.push({ name: file, size: fileSize });
          }
        } catch (error) {
          console.error(`Error processing video album art file ${filePath}:`, error);
        }
      });
    }

    // Get video renderer uploads directory info (recursively scan subdirectories)
    if (fs.existsSync(VIDEO_RENDERER_UPLOADS_DIR)) {
      const scanDirectory = (dirPath, prefix = '') => {
        const items = fs.readdirSync(dirPath);
        items.forEach(item => {
          const itemPath = path.join(dirPath, item);
          try {
            const stats = fs.statSync(itemPath);
            if (stats.isDirectory()) {
              scanDirectory(itemPath, prefix ? `${prefix}/${item}` : item);
            } else {
              const fileSize = stats.size;
              details.videoRendererUploads.count++;
              details.videoRendererUploads.size += fileSize;
              details.videoRendererUploads.files.push({ name: prefix ? `${prefix}/${item}` : item, size: fileSize });
            }
          } catch (error) {
            console.error(`Error processing video renderer upload item ${itemPath}:`, error);
          }
        });
      };
      scanDirectory(VIDEO_RENDERER_UPLOADS_DIR);
    }

    // Get video renderer output directory info
    if (fs.existsSync(VIDEO_RENDERER_OUTPUT_DIR)) {
      const outputFiles = fs.readdirSync(VIDEO_RENDERER_OUTPUT_DIR);
      outputFiles.forEach(file => {
        const filePath = path.join(VIDEO_RENDERER_OUTPUT_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          if (!stats.isDirectory()) {
            const fileSize = stats.size;
            details.videoRendererOutput.count++;
            details.videoRendererOutput.size += fileSize;
            details.videoRendererOutput.files.push({ name: file, size: fileSize });
          }
        } catch (error) {
          console.error(`Error processing video renderer output file ${filePath}:`, error);
        }
      });
    }

    // Calculate totals
    details.totalCount = details.subtitles.count + details.videos.count +
                         details.userSubtitles.count + details.rules.count +
                         details.narrationReference.count + details.narrationOutput.count +
                         details.lyrics.count + details.albumArt.count +
                         details.uploads.count + details.output.count +
                         details.videoRendered.count + details.videoTemp.count +
                         details.videoAlbumArt.count + details.videoRendererUploads.count +
                         details.videoRendererOutput.count;
    details.totalSize = details.subtitles.size + details.videos.size +
                        details.userSubtitles.size + details.rules.size +
                        details.narrationReference.size + details.narrationOutput.size +
                        details.lyrics.size + details.albumArt.size +
                        details.uploads.size + details.output.size +
                        details.videoRendered.size + details.videoTemp.size +
                        details.videoAlbumArt.size + details.videoRendererUploads.size +
                        details.videoRendererOutput.size;

    // Format sizes for human readability
    details.subtitles.formattedSize = formatBytes(details.subtitles.size);
    details.videos.formattedSize = formatBytes(details.videos.size);
    details.userSubtitles.formattedSize = formatBytes(details.userSubtitles.size);
    details.rules.formattedSize = formatBytes(details.rules.size);
    details.narrationReference.formattedSize = formatBytes(details.narrationReference.size);
    details.narrationOutput.formattedSize = formatBytes(details.narrationOutput.size);
    details.lyrics.formattedSize = formatBytes(details.lyrics.size);
    details.albumArt.formattedSize = formatBytes(details.albumArt.size);
    details.uploads.formattedSize = formatBytes(details.uploads.size);
    details.output.formattedSize = formatBytes(details.output.size);
    details.videoRendered.formattedSize = formatBytes(details.videoRendered.size);
    details.videoTemp.formattedSize = formatBytes(details.videoTemp.size);
    details.videoAlbumArt.formattedSize = formatBytes(details.videoAlbumArt.size);
    details.videoRendererUploads.formattedSize = formatBytes(details.videoRendererUploads.size);
    details.videoRendererOutput.formattedSize = formatBytes(details.videoRendererOutput.size);
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

    // Clear subtitles directory
    if (fs.existsSync(SUBTITLES_DIR)) {
      const subtitleFiles = fs.readdirSync(SUBTITLES_DIR);
      for (const file of subtitleFiles) {
        const filePath = path.join(SUBTITLES_DIR, file);
        try {
          const stats = fs.statSync(filePath);

          // Skip directories
          if (stats.isDirectory()) {
            continue;
          }

          const fileSize = stats.size;
          details.subtitles.count++;
          details.subtitles.size += fileSize;
          details.subtitles.files.push({ name: file, size: fileSize });

          // Delete subtitle file safely
          await safeDeleteFile(filePath);
        } catch (error) {
          console.error(`Error processing subtitle file ${filePath}:`, error);
        }
      }
    }

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



    // Clear user-provided subtitles directory
    if (fs.existsSync(USER_SUBTITLES_DIR)) {
      const userSubtitleFiles = fs.readdirSync(USER_SUBTITLES_DIR);
      for (const file of userSubtitleFiles) {
        const filePath = path.join(USER_SUBTITLES_DIR, file);
        try {
          const stats = fs.statSync(filePath);

          // Skip directories
          if (stats.isDirectory()) {
            continue;
          }

          const fileSize = stats.size;
          details.userSubtitles.count++;
          details.userSubtitles.size += fileSize;
          details.userSubtitles.files.push({ name: file, size: fileSize });

          // Delete user subtitle file safely
          await safeDeleteFile(filePath);
        } catch (error) {
          console.error(`Error processing user subtitle file ${filePath}:`, error);
        }
      }
    }

    // Clear rules directory
    if (fs.existsSync(RULES_DIR)) {
      const rulesFiles = fs.readdirSync(RULES_DIR);
      for (const file of rulesFiles) {
        const filePath = path.join(RULES_DIR, file);
        try {
          const stats = fs.statSync(filePath);

          // Skip directories
          if (stats.isDirectory()) {
            continue;
          }

          const fileSize = stats.size;
          details.rules.count++;
          details.rules.size += fileSize;
          details.rules.files.push({ name: file, size: fileSize });

          // Delete rules file safely
          await safeDeleteFile(filePath);
        } catch (error) {
          console.error(`Error processing rules file ${filePath}:`, error);
        }
      }
    }

    // Clear narration reference audio directory
    if (fs.existsSync(REFERENCE_AUDIO_DIR)) {
      const referenceFiles = fs.readdirSync(REFERENCE_AUDIO_DIR);
      for (const file of referenceFiles) {
        const filePath = path.join(REFERENCE_AUDIO_DIR, file);
        try {
          const stats = fs.statSync(filePath);

          // Skip directories
          if (stats.isDirectory()) {
            continue;
          }

          const fileSize = stats.size;
          details.narrationReference.count++;
          details.narrationReference.size += fileSize;
          details.narrationReference.files.push({ name: file, size: fileSize });

          // Delete reference audio file safely
          await safeDeleteFile(filePath);
        } catch (error) {
          console.error(`Error processing reference audio file ${filePath}:`, error);
        }
      }
    }

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

    // Clear lyrics directory
    if (fs.existsSync(LYRICS_DIR)) {
      const lyricsFiles = fs.readdirSync(LYRICS_DIR);
      for (const file of lyricsFiles) {
        const filePath = path.join(LYRICS_DIR, file);
        try {
          const stats = fs.statSync(filePath);

          // Skip directories
          if (stats.isDirectory()) {
            continue;
          }

          const fileSize = stats.size;
          details.lyrics.count++;
          details.lyrics.size += fileSize;
          details.lyrics.files.push({ name: file, size: fileSize });

          // Delete lyrics file safely
          await safeDeleteFile(filePath);
        } catch (error) {
          console.error(`Error processing lyrics file ${filePath}:`, error);
        }
      }
    }

    // Clear album art directory
    if (fs.existsSync(ALBUM_ART_DIR)) {
      const albumArtFiles = fs.readdirSync(ALBUM_ART_DIR);
      for (const file of albumArtFiles) {
        const filePath = path.join(ALBUM_ART_DIR, file);
        try {
          const stats = fs.statSync(filePath);

          // Skip directories
          if (stats.isDirectory()) {
            continue;
          }

          const fileSize = stats.size;
          details.albumArt.count++;
          details.albumArt.size += fileSize;
          details.albumArt.files.push({ name: file, size: fileSize });

          // Delete album art file safely
          await safeDeleteFile(filePath);
        } catch (error) {
          console.error(`Error processing album art file ${filePath}:`, error);
        }
      }
    }

    // Clear uploads directory (recursively)
    if (fs.existsSync(UPLOADS_DIR)) {
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
                console.log(`Removed upload directory: ${itemPath}`);
              } catch (rmError) {
                console.error(`Error removing upload directory ${itemPath}:`, rmError);
              }
            } else {
              const fileSize = stats.size;
              details.uploads.count++;
              details.uploads.size += fileSize;
              details.uploads.files.push({ name: prefix ? `${prefix}/${item}` : item, size: fileSize });
              await safeDeleteFile(itemPath);
            }
          } catch (error) {
            console.error(`Error processing upload item ${itemPath}:`, error);
          }
        }
      };
      await clearDirectory(UPLOADS_DIR);
    }

    // Clear output directory
    if (fs.existsSync(OUTPUT_DIR)) {
      const outputFiles = fs.readdirSync(OUTPUT_DIR);
      for (const file of outputFiles) {
        const filePath = path.join(OUTPUT_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          if (!stats.isDirectory()) {
            const fileSize = stats.size;
            details.output.count++;
            details.output.size += fileSize;
            details.output.files.push({ name: file, size: fileSize });
            await safeDeleteFile(filePath);
          }
        } catch (error) {
          console.error(`Error processing output file ${filePath}:`, error);
        }
      }
    }

    // Clear video rendered directory
    if (fs.existsSync(VIDEO_RENDERED_DIR)) {
      const renderedFiles = fs.readdirSync(VIDEO_RENDERED_DIR);
      for (const file of renderedFiles) {
        const filePath = path.join(VIDEO_RENDERED_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          if (!stats.isDirectory()) {
            const fileSize = stats.size;
            details.videoRendered.count++;
            details.videoRendered.size += fileSize;
            details.videoRendered.files.push({ name: file, size: fileSize });
            await safeDeleteFile(filePath);
          }
        } catch (error) {
          console.error(`Error processing video rendered file ${filePath}:`, error);
        }
      }
    }

    // Clear video temp directory
    if (fs.existsSync(VIDEO_TEMP_DIR)) {
      const tempFiles = fs.readdirSync(VIDEO_TEMP_DIR);
      for (const file of tempFiles) {
        const filePath = path.join(VIDEO_TEMP_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          if (!stats.isDirectory()) {
            const fileSize = stats.size;
            details.videoTemp.count++;
            details.videoTemp.size += fileSize;
            details.videoTemp.files.push({ name: file, size: fileSize });
            await safeDeleteFile(filePath);
          }
        } catch (error) {
          console.error(`Error processing video temp file ${filePath}:`, error);
        }
      }
    }

    // Clear video album art directory
    if (fs.existsSync(VIDEO_ALBUM_ART_DIR)) {
      const albumArtFiles = fs.readdirSync(VIDEO_ALBUM_ART_DIR);
      for (const file of albumArtFiles) {
        const filePath = path.join(VIDEO_ALBUM_ART_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          if (!stats.isDirectory()) {
            const fileSize = stats.size;
            details.videoAlbumArt.count++;
            details.videoAlbumArt.size += fileSize;
            details.videoAlbumArt.files.push({ name: file, size: fileSize });
            await safeDeleteFile(filePath);
          }
        } catch (error) {
          console.error(`Error processing video album art file ${filePath}:`, error);
        }
      }
    }

    // Clear video renderer uploads directory (recursively)
    if (fs.existsSync(VIDEO_RENDERER_UPLOADS_DIR)) {
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
                console.log(`Removed video renderer upload directory: ${itemPath}`);
              } catch (rmError) {
                console.error(`Error removing video renderer upload directory ${itemPath}:`, rmError);
              }
            } else {
              const fileSize = stats.size;
              details.videoRendererUploads.count++;
              details.videoRendererUploads.size += fileSize;
              details.videoRendererUploads.files.push({ name: prefix ? `${prefix}/${item}` : item, size: fileSize });
              await safeDeleteFile(itemPath);
            }
          } catch (error) {
            console.error(`Error processing video renderer upload item ${itemPath}:`, error);
          }
        }
      };
      await clearDirectory(VIDEO_RENDERER_UPLOADS_DIR);
    }

    // Clear video renderer output directory
    if (fs.existsSync(VIDEO_RENDERER_OUTPUT_DIR)) {
      const outputFiles = fs.readdirSync(VIDEO_RENDERER_OUTPUT_DIR);
      for (const file of outputFiles) {
        const filePath = path.join(VIDEO_RENDERER_OUTPUT_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          if (!stats.isDirectory()) {
            const fileSize = stats.size;
            details.videoRendererOutput.count++;
            details.videoRendererOutput.size += fileSize;
            details.videoRendererOutput.files.push({ name: file, size: fileSize });
            await safeDeleteFile(filePath);
          }
        } catch (error) {
          console.error(`Error processing video renderer output file ${filePath}:`, error);
        }
      }
    }

    // Calculate totals
    details.totalCount = details.subtitles.count + details.videos.count +
                         details.userSubtitles.count + details.rules.count +
                         details.narrationReference.count + details.narrationOutput.count +
                         details.lyrics.count + details.albumArt.count +
                         details.uploads.count + details.output.count +
                         details.videoRendered.count + details.videoTemp.count +
                         details.videoAlbumArt.count + details.videoRendererUploads.count +
                         details.videoRendererOutput.count;
    details.totalSize = details.subtitles.size + details.videos.size +
                        details.userSubtitles.size + details.rules.size +
                        details.narrationReference.size + details.narrationOutput.size +
                        details.lyrics.size + details.albumArt.size +
                        details.uploads.size + details.output.size +
                        details.videoRendered.size + details.videoTemp.size +
                        details.videoAlbumArt.size + details.videoRendererUploads.size +
                        details.videoRendererOutput.size;

    // Format sizes for human readability
    details.subtitles.formattedSize = formatBytes(details.subtitles.size);
    details.videos.formattedSize = formatBytes(details.videos.size);
    details.userSubtitles.formattedSize = formatBytes(details.userSubtitles.size);
    details.rules.formattedSize = formatBytes(details.rules.size);
    details.narrationReference.formattedSize = formatBytes(details.narrationReference.size);
    details.narrationOutput.formattedSize = formatBytes(details.narrationOutput.size);
    details.lyrics.formattedSize = formatBytes(details.lyrics.size);
    details.albumArt.formattedSize = formatBytes(details.albumArt.size);
    details.uploads.formattedSize = formatBytes(details.uploads.size);
    details.output.formattedSize = formatBytes(details.output.size);
    details.videoRendered.formattedSize = formatBytes(details.videoRendered.size);
    details.videoTemp.formattedSize = formatBytes(details.videoTemp.size);
    details.videoAlbumArt.formattedSize = formatBytes(details.videoAlbumArt.size);
    details.videoRendererUploads.formattedSize = formatBytes(details.videoRendererUploads.size);
    details.videoRendererOutput.formattedSize = formatBytes(details.videoRendererOutput.size);
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
