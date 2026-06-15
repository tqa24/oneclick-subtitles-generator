const fs = require('fs');
const { spawn } = require('child_process');
const { getYtDlpPath, getYtDlpArgs } = require('../services/shared/ytdlpUtils');
const {
  setDownloadProgress,
  getDownloadProgress,
  updateProgressFromYtdlpOutput
} = require('../services/shared/progressTracker');

// Track active downloads to prevent duplicates
const activeDownloads = new Map();

// Track active file operations to prevent race conditions
const activeFileOperations = new Set();

// Track active yt-dlp processes to prevent multiple spawns and enable cancellation
const activeYtdlpProcesses = new Map(); // processKey -> { videoId, process }

/**
 * Async function to download media (video or audio)
 */
async function downloadMediaAsync(url, outputPath, type, quality, videoId, useCookies = false, processKey) {
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
        ...getYtDlpArgs(useCookies),
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
        ...getYtDlpArgs(useCookies),
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

    // FINAL CHECK: Ensure no other process is writing to this exact file
    try {
      // Try to open the file exclusively to check if it's being written to
      const fd = fs.openSync(outputPath, 'wx');
      fs.closeSync(fd);
      fs.unlinkSync(outputPath); // Remove the test file
    } catch (error) {
      if (error.code === 'EEXIST') {
        console.log(`[DOWNLOAD-ONLY] CRITICAL: File is being written by another process: ${outputPath}`);
        const cleanupKey = `${url}_${type}_${quality || 'default'}`;
        activeDownloads.delete(cleanupKey);
        activeFileOperations.delete(outputPath);
        activeYtdlpProcesses.delete(processKey);
        setDownloadProgress(videoId, 0, 'error');
        return reject(new Error('File is being written by another process'));
      }
    }

    const ytdlpProcess = spawn(ytDlpPath, args);

    // Track the process for cancellation
    activeYtdlpProcesses.set(processKey, { videoId, process: ytdlpProcess });

    let stderr = '';
    let stdoutBuffer = ''; // Buffer for line-by-line processing

    ytdlpProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdoutBuffer += output;

      // Process complete lines only
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop(); // Keep the incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          // Update progress tracking
          updateProgressFromYtdlpOutput(videoId, line);
        }
      }
    });

    ytdlpProcess.stderr.on('data', (data) => {
      const errorOutput = data.toString();
      stderr += errorOutput;
      console.error(`[DOWNLOAD-ONLY] yt-dlp stderr:`, errorOutput);
      // Removed duplicate progress parsing from stderr to prevent conflicts
    });

    ytdlpProcess.on('close', (code, signal) => {
      // Clean up the active download tracking
      const cleanupKey = `${url}_${type}_${quality || 'default'}`;
      activeDownloads.delete(cleanupKey);

      console.log(`[DOWNLOAD-ONLY] Cleaned up download tracking for: ${cleanupKey}`);

      // Clean up the file operation lock
      activeFileOperations.delete(outputPath);
      console.log(`[DOWNLOAD-ONLY] Released file operation lock: ${outputPath}`);

      // Clean up the yt-dlp process lock
      activeYtdlpProcesses.delete(processKey);
      console.log(`[DOWNLOAD-ONLY] Released yt-dlp process lock: ${processKey}`);

      // Detect explicit cancellation (by signal) or via progress tracker state
      let wasCancelled = false;
      try {
        const state = getDownloadProgress(videoId);
        wasCancelled = state && state.status === 'cancelled';
      } catch (e) {
        // ignore
      }

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
      } else if (signal === 'SIGTERM' || wasCancelled) {
        console.log(`[DOWNLOAD-ONLY] Download cancelled for ${videoId} (signal: ${signal || 'none'})`);
        // Remove partial file if exists
        try {
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
            console.log(`[DOWNLOAD-ONLY] Removed partial file after cancel: ${outputPath}`);
          }
        } catch (e) {
          console.warn(`[DOWNLOAD-ONLY] Failed to remove partial file ${outputPath}:`, e?.message || e);
        }
        // Do not mark as error; cancel route already set status to 'cancelled' and broadcasted
        resolve(); // Resolve gracefully to avoid unhandled rejection on cancellation
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

    // Set timeout to prevent hanging (increased due to cookie extraction time)
    setTimeout(() => {
      ytdlpProcess.kill();
      setDownloadProgress(videoId, 0, 'error');
      reject(new Error('Download timeout'));
    }, 600000); // 10 minute timeout
  });
}

module.exports = {
  activeDownloads,
  activeFileOperations,
  activeYtdlpProcesses,
  downloadMediaAsync
};
