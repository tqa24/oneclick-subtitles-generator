/**
 * YouTube downloader using yt-dlp command line tool
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { safeMoveFile } = require('../../utils/fileOperations');
const { getYtDlpPath, getYtDlpArgs } = require('../shared/ytdlpUtils');
const {
  getDownloadProgress,
  setDownloadProgress,
  updateProgressFromYtdlpOutput
} = require('../shared/progressTracker');

// Global process tracking for cancellation
const activeYtdlpProcesses = new Map(); // videoId -> { process, cancelled }



/**
 * Download YouTube video using yt-dlp command line tool
 * @param {string} videoURL - YouTube video URL
 * @param {string} outputPath - Path to save the video
 * @param {string} quality - Desired video quality (e.g., '144p', '360p', '720p')
 * @param {string} videoId - Video ID for progress tracking (optional)
 * @param {boolean} useCookies - Whether to use browser cookies for authentication
 * @returns {Promise<boolean>} - Success status
 */
async function downloadWithYtdlp(videoURL, outputPath, quality = '360p', videoId = null, useCookies = true) {
  return new Promise((resolve, reject) => {
    // Declare timeout variable for cleanup
    let downloadTimeout;

    // Convert quality string to resolution for yt-dlp
    let resolution;
    switch (quality) {
      case '144p': resolution = '144'; break;
      case '240p': resolution = '240'; break;
      case '360p': resolution = '360'; break;
      case '480p': resolution = '480'; break;
      case '720p': resolution = '720'; break;
      case '1080p': resolution = '1080'; break;
      default: resolution = '360'; // Default to 360p
    }



    // Create a temporary directory for the download
    const tempDir = path.dirname(outputPath);
    const tempFilename = `${path.basename(outputPath, '.mp4')}.ytdlp.mp4`;
    const tempPath = path.join(tempDir, tempFilename);

    // Get yt-dlp path using shared utility
    const ytdlpCommand = getYtDlpPath();



    // Initialize progress tracking if videoId is provided
    if (videoId) {
      setDownloadProgress(videoId, 0, 'starting');
    }

    // Build the yt-dlp command arguments with conditional cookie support
    const args = [
      ...getYtDlpArgs(useCookies),
      '--progress',  // Enable progress reporting
      '--newline',   // Force newlines for better parsing
      '--no-colors', // Disable ANSI colors
      videoURL,
      '-f', `bestvideo[height<=${resolution}]+bestaudio/best[height<=${resolution}]`,
      '-o', tempPath,
      '--no-playlist',
      '--merge-output-format', 'mp4',
      '--no-post-overwrites',  // Prevent hanging on post-processing
      '--prefer-ffmpeg'        // Use ffmpeg for merging (more reliable)
    ];

    console.log(`[ytdlpDownloader] Running yt-dlp with args:`, args);



    // Spawn the yt-dlp process with unbuffered output
    const ytdlpProcess = spawn(ytdlpCommand, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1'  // Force unbuffered output
      }
    });

    // Track the process for cancellation
    if (videoId) {
      activeYtdlpProcesses.set(videoId, { process: ytdlpProcess, cancelled: false });
    }

    let stdoutData = '';
    let stderrData = '';
    let stdoutBuffer = ''; // Buffer for line-by-line processing

    ytdlpProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdoutData += output;
      stdoutBuffer += output;

      // Process complete lines only
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop(); // Keep the incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          // Always log the line for debugging
          console.log(`[yt-dlp stdout] ${line.trim()}`);
          
          // Parse progress information if videoId is provided
          if (videoId) {
            updateProgressFromYtdlpOutput(videoId, line);
          }
        }
      }
    });

    ytdlpProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderrData += output;
      
      // Process line by line
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          console.log(`[yt-dlp stderr] ${line.trim()}`);
          
          // Also check stderr for progress (yt-dlp sometimes outputs progress there)
          if (videoId) {
            updateProgressFromYtdlpOutput(videoId, line);
          }
        }
      }
    });

    ytdlpProcess.on('close', (code) => {
      clearTimeout(downloadTimeout);

      // Check if process was cancelled
      let wasCancelled = false;
      if (videoId && activeYtdlpProcesses.has(videoId)) {
        wasCancelled = activeYtdlpProcesses.get(videoId).cancelled;
        activeYtdlpProcesses.delete(videoId);
      }

      console.log(`[ytdlpDownloader] Process closed with code: ${code} for video: ${videoId || 'unknown'}`);

      if (wasCancelled) {
        // Process was cancelled - this is expected
        if (videoId) {
          setDownloadProgress(videoId, 0, 'cancelled');
        }
        console.log(`[ytdlpDownloader] Download cancelled for: ${videoId}`);
        resolve(false); // Return false to indicate cancellation, not failure
      } else if (code === 0) {
        // Success - move the file to the final location
        try {
          console.log(`[ytdlpDownloader] Checking for file: ${tempPath}`);
          // Check if the file exists
          if (fs.existsSync(tempPath)) {
            console.log(`[ytdlpDownloader] File exists, setting progress to 100% for: ${videoId}`);
            // Set progress to 100% before moving file
            if (videoId) {
              setDownloadProgress(videoId, 100, 'completed');
            }

            // Use safeMoveFile to avoid EPERM errors on Windows
            // This uses copy-then-delete instead of rename
            safeMoveFile(tempPath, outputPath)
              .then(() => {
                resolve(true);
              })
              .catch((err) => {
                if (videoId) {
                  setDownloadProgress(videoId, 0, 'error');
                }
                console.error(`Error moving yt-dlp downloaded file: ${err.message}`);
                reject(err);
              });
          } else {
            if (videoId) {
              setDownloadProgress(videoId, 0, 'error');
            }
            console.error(`yt-dlp process completed but file not found: ${tempPath}`);
            reject(new Error('yt-dlp process completed but file not found'));
          }
        } catch (error) {
          if (videoId) {
            setDownloadProgress(videoId, 0, 'error');
          }
          console.error(`Error moving yt-dlp downloaded file: ${error.message}`);
          reject(error);
        }
      } else {
        // Process failed
        if (videoId) {
          setDownloadProgress(videoId, 0, 'error');
        }
        console.error(`yt-dlp process exited with code ${code}`);
        reject(new Error(`yt-dlp process failed with code ${code}: ${stderrData}`));
      }
    });

    ytdlpProcess.on('error', (error) => {
      clearTimeout(downloadTimeout);
      if (videoId) {
        setDownloadProgress(videoId, 0, 'error');
      }
      console.error(`Error spawning yt-dlp process: ${error.message}`);

      // If the error is ENOENT (command not found), provide a more helpful message
      if (error.code === 'ENOENT') {
        console.error(`yt-dlp command not found. Make sure yt-dlp is installed in the virtual environment.`);
        reject(new Error('yt-dlp command not found. Please install yt-dlp using "uv pip install yt-dlp"'));
      } else {
        reject(error);
      }
    });

    // Set timeout to prevent hanging (especially important with cookie extraction)
    downloadTimeout = setTimeout(() => {
      console.error(`[ytdlpDownloader] Download timeout for ${videoId || 'unknown'}`);
      ytdlpProcess.kill();
      if (videoId) {
        setDownloadProgress(videoId, 0, 'error');
      }
      reject(new Error('Download timeout - process took too long'));
    }, 600000); // 10 minute timeout (increased due to cookie extraction time)
  });
}

/**
 * Cancel an active yt-dlp download process
 * @param {string} videoId - Video ID to cancel
 * @returns {boolean} - True if process was found and killed
 */
function cancelYtdlpProcess(videoId) {
  if (activeYtdlpProcesses.has(videoId)) {
    const processInfo = activeYtdlpProcesses.get(videoId);
    console.log(`[ytdlpDownloader] Cancelling download for ${videoId}, killing process`);

    // Mark as cancelled before killing
    processInfo.cancelled = true;

    // Kill the process
    processInfo.process.kill('SIGTERM');

    return true;
  }
  return false;
}

module.exports = {
  downloadWithYtdlp,
  getDownloadProgress,
  cancelYtdlpProcess
};
