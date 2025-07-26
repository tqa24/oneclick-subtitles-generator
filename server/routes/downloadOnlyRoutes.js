const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { VIDEOS_DIR } = require('../config');
const { getYtDlpPath, getCommonYtDlpArgs } = require('../services/shared/ytdlpUtils');
const { setDownloadProgress, getDownloadProgress } = require('../services/shared/progressTracker');
const { updateProgressFromYtdlpOutput } = require('../services/shared/progressTracker');

/**
 * POST /api/download-only - Download video or audio only
 */
router.post('/download-only', async (req, res) => {
  const { url, type, quality, source } = req.body;

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

  try {
    console.log(`[DOWNLOAD-ONLY] Starting ${type} download:`, { url, type, quality, source });

    // Generate unique video ID for progress tracking
    const timestamp = Date.now();
    const videoId = `download_${type}_${timestamp}`;

    // Generate output filename
    const extension = type === 'video' ? 'mp4' : 'mp3';
    const outputFilename = `${videoId}.${extension}`;
    const outputPath = path.join(VIDEOS_DIR, outputFilename);

    // Ensure videos directory exists
    if (!fs.existsSync(VIDEOS_DIR)) {
      fs.mkdirSync(VIDEOS_DIR, { recursive: true });
    }

    // Remove existing file if it exists
    if (fs.existsSync(outputPath)) {
      console.log(`[DOWNLOAD-ONLY] Removing existing file: ${outputPath}`);
      fs.unlinkSync(outputPath);
    }

    // Start download process asynchronously
    downloadMediaAsync(url, outputPath, type, quality, videoId);

    res.json({
      success: true,
      videoId: videoId,
      message: `${type} download started`,
      downloadUrl: `/videos/${outputFilename}`,
      filename: outputFilename
    });

  } catch (error) {
    console.error('[DOWNLOAD-ONLY] Error starting download:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start download'
    });
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
    // Determine file extension based on videoId
    const isAudio = videoId.includes('download_audio_');
    const extension = isAudio ? 'mp3' : 'mp4';
    const filename = `${videoId}.${extension}`;
    const filePath = path.join(VIDEOS_DIR, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Set headers for file download
    const stats = fs.statSync(filePath);
    const mimeType = isAudio ? 'audio/mpeg' : 'video/mp4';

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
 * Async function to download media (video or audio)
 */
async function downloadMediaAsync(url, outputPath, type, quality, videoId) {
  return new Promise((resolve, reject) => {
    const ytDlpPath = getYtDlpPath();
    
    // Initialize progress tracking
    setDownloadProgress(videoId, 0, 'downloading');

    let args;
    if (type === 'video') {
      // Video download with quality - use the same logic as qualityScanner.js
      let formatSelector;
      if (quality) {
        const height = quality.replace('p', '');

        // Use the same format selection logic as the working qualityScanner
        if (url.includes('tiktok.com') || url.includes('douyin.com')) {
          // For TikTok/Douyin, use simple format to avoid compatibility issues
          formatSelector = `best[height<=${height}]`;
        } else {
          // For other sites (YouTube, etc.), use complex format for better quality
          formatSelector = `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;
        }
      } else {
        // Default to best quality if no specific quality requested
        formatSelector = 'best[ext=mp4]/best';
      }

      args = [
        ...getCommonYtDlpArgs(),
        '--format', formatSelector,
        '--merge-output-format', 'mp4',
        '--output', outputPath,
        '--no-playlist',
        '--progress',
        '--newline',
        '--force-overwrites',
        url
      ];
    } else {
      // Audio download
      args = [
        ...getCommonYtDlpArgs(),
        '--format', 'bestaudio/best',
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '192K',
        '--output', outputPath.replace('.mp3', '.%(ext)s'),
        '--no-playlist',
        '--progress',
        '--newline',
        '--force-overwrites',
        url
      ];
    }

    console.log(`[DOWNLOAD-ONLY] Starting yt-dlp with args:`, args);

    const ytdlpProcess = spawn(ytDlpPath, args);
    let stderr = '';

    ytdlpProcess.stdout.on('data', (data) => {
      const output = data.toString();
      
      // Update progress tracking
      updateProgressFromYtdlpOutput(videoId, output);
      
      // Log progress lines
      if (output.includes('%') || output.includes('download')) {
        console.log(`[DOWNLOAD-ONLY] Progress for ${videoId}:`, output.trim());
      }
    });

    ytdlpProcess.stderr.on('data', (data) => {
      const errorOutput = data.toString();
      stderr += errorOutput;
      console.error(`[DOWNLOAD-ONLY] yt-dlp stderr:`, errorOutput);

      // Try to extract progress from stderr as well
      const progressMatch = errorOutput.match(/\[download\]\s+(\d+\.?\d*)%/);
      if (progressMatch) {
        const progress = parseFloat(progressMatch[1]);
        if (progress >= 0 && progress <= 100) {
          setDownloadProgress(videoId, progress, 'downloading');
          
          try {
            const { broadcastProgress } = require('../services/shared/progressWebSocket');
            broadcastProgress(videoId, progress, 'downloading', 'download');
          } catch (error) {
            // WebSocket module might not be initialized yet
          }
        }
      }
    });

    ytdlpProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`[DOWNLOAD-ONLY] Download completed successfully for ${videoId}`);
        setDownloadProgress(videoId, 100, 'completed');

        try {
          const { broadcastProgress } = require('../services/shared/progressWebSocket');
          broadcastProgress(videoId, 100, 'completed', 'download');
        } catch (error) {
          // WebSocket module might not be initialized yet
        }

        resolve();
      } else {
        console.error(`[DOWNLOAD-ONLY] Download failed for ${videoId} with code ${code}:`, stderr);
        setDownloadProgress(videoId, 0, 'error');

        try {
          const { broadcastProgress } = require('../services/shared/progressWebSocket');
          broadcastProgress(videoId, 0, 'error', 'download');
        } catch (error) {
          // WebSocket module might not be initialized yet
        }

        // Provide more user-friendly error messages
        let errorMessage = stderr;
        if (stderr.includes('Requested format is not available')) {
          errorMessage = `The requested quality (${quality || 'default'}) is not available for this video. Please try a different quality.`;
        } else if (stderr.includes('Video unavailable')) {
          errorMessage = 'This video is unavailable or has been removed.';
        } else if (stderr.includes('Private video')) {
          errorMessage = 'This video is private and cannot be downloaded.';
        } else if (stderr.includes('Sign in to confirm your age')) {
          errorMessage = 'This video requires age verification and cannot be downloaded.';
        }

        reject(new Error(errorMessage));
      }
    });

    ytdlpProcess.on('error', (error) => {
      console.error(`[DOWNLOAD-ONLY] Process error for ${videoId}:`, error);
      setDownloadProgress(videoId, 0, 'error');
      
      try {
        const { broadcastProgress } = require('../services/shared/progressWebSocket');
        broadcastProgress(videoId, 0, 'error', 'download');
      } catch (wsError) {
        // WebSocket module might not be initialized yet
      }
      
      reject(error);
    });

    // Set timeout to prevent hanging
    setTimeout(() => {
      ytdlpProcess.kill();
      setDownloadProgress(videoId, 0, 'error');
      reject(new Error('Download timeout'));
    }, 300000); // 5 minute timeout
  });
}

module.exports = router;
