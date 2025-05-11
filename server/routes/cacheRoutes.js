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

// Define paths for narration directories
const NARRATION_DIR = path.join(path.dirname(path.dirname(__dirname)), 'narration');
const REFERENCE_AUDIO_DIR = path.join(NARRATION_DIR, 'reference');
const OUTPUT_AUDIO_DIR = path.join(NARRATION_DIR, 'output');
const TEMP_AUDIO_DIR = path.join(NARRATION_DIR, 'temp');

// Define paths for lyrics and album art
const LYRICS_DIR = path.join(VIDEOS_DIR, 'lyrics');
const ALBUM_ART_DIR = path.join(path.dirname(path.dirname(__dirname)), 'public', 'videos', 'album_art');

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
      const outputFiles = fs.readdirSync(OUTPUT_AUDIO_DIR);
      outputFiles.forEach(file => {
        const filePath = path.join(OUTPUT_AUDIO_DIR, file);
        const stats = fs.statSync(filePath);

        // Skip directories
        if (stats.isDirectory()) {

          return;
        }

        const fileSize = stats.size;
        details.narrationOutput.count++;
        details.narrationOutput.size += fileSize;
        details.narrationOutput.files.push({ name: file, size: fileSize });
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

    // Calculate totals
    details.totalCount = details.subtitles.count + details.videos.count +
                         details.userSubtitles.count + details.rules.count +
                         details.narrationReference.count + details.narrationOutput.count +
                         details.lyrics.count + details.albumArt.count;
    details.totalSize = details.subtitles.size + details.videos.size +
                        details.userSubtitles.size + details.rules.size +
                        details.narrationReference.size + details.narrationOutput.size +
                        details.lyrics.size + details.albumArt.size;

    // Format sizes for human readability
    details.subtitles.formattedSize = formatBytes(details.subtitles.size);
    details.videos.formattedSize = formatBytes(details.videos.size);
    details.userSubtitles.formattedSize = formatBytes(details.userSubtitles.size);
    details.rules.formattedSize = formatBytes(details.rules.size);
    details.narrationReference.formattedSize = formatBytes(details.narrationReference.size);
    details.narrationOutput.formattedSize = formatBytes(details.narrationOutput.size);
    details.lyrics.formattedSize = formatBytes(details.lyrics.size);
    details.albumArt.formattedSize = formatBytes(details.albumArt.size);
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
      narrationReference: { count: 0, size: 0, files: [] },
      narrationOutput: { count: 0, size: 0, files: [] },
      lyrics: { count: 0, size: 0, files: [] },
      albumArt: { count: 0, size: 0, files: [] },
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

    // Clear narration reference audio directory
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

        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error(`Error deleting file ${filePath}:`, error);
        }
      });
    }

    // Clear narration output audio directory
    if (fs.existsSync(OUTPUT_AUDIO_DIR)) {
      const outputFiles = fs.readdirSync(OUTPUT_AUDIO_DIR);
      outputFiles.forEach(file => {
        const filePath = path.join(OUTPUT_AUDIO_DIR, file);
        const stats = fs.statSync(filePath);

        // Skip directories
        if (stats.isDirectory()) {

          return;
        }

        const fileSize = stats.size;
        details.narrationOutput.count++;
        details.narrationOutput.size += fileSize;
        details.narrationOutput.files.push({ name: file, size: fileSize });

        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error(`Error deleting file ${filePath}:`, error);
        }
      });
    }

    // Clear narration temp directory
    if (fs.existsSync(TEMP_AUDIO_DIR)) {
      const tempFiles = fs.readdirSync(TEMP_AUDIO_DIR);
      tempFiles.forEach(file => {
        const filePath = path.join(TEMP_AUDIO_DIR, file);
        const stats = fs.statSync(filePath);

        // Skip directories
        if (stats.isDirectory()) {

          return;
        }

        // We don't count temp files in the details


        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error(`Error deleting file ${filePath}:`, error);
        }
      });

    }

    // Clear lyrics directory
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

        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error(`Error deleting file ${filePath}:`, error);
        }
      });
    }

    // Clear album art directory
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

        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error(`Error deleting file ${filePath}:`, error);
        }
      });
    }

    // Calculate totals
    details.totalCount = details.subtitles.count + details.videos.count +
                         details.userSubtitles.count + details.rules.count +
                         details.narrationReference.count + details.narrationOutput.count +
                         details.lyrics.count + details.albumArt.count;
    details.totalSize = details.subtitles.size + details.videos.size +
                        details.userSubtitles.size + details.rules.size +
                        details.narrationReference.size + details.narrationOutput.size +
                        details.lyrics.size + details.albumArt.size;

    // Format sizes for human readability
    details.subtitles.formattedSize = formatBytes(details.subtitles.size);
    details.videos.formattedSize = formatBytes(details.videos.size);
    details.userSubtitles.formattedSize = formatBytes(details.userSubtitles.size);
    details.rules.formattedSize = formatBytes(details.rules.size);
    details.narrationReference.formattedSize = formatBytes(details.narrationReference.size);
    details.narrationOutput.formattedSize = formatBytes(details.narrationOutput.size);
    details.lyrics.formattedSize = formatBytes(details.lyrics.size);
    details.albumArt.formattedSize = formatBytes(details.albumArt.size);
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
