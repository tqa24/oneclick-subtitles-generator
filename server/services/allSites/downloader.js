/**
 * Generic URL downloader module that uses yt-dlp for downloading videos from any supported site
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { VIDEOS_DIR } = require('../../config');
const { safeMoveFile } = require('../../utils/fileOperations');
const { getYtDlpPath, getCommonYtDlpArgs } = require('../shared/ytdlpUtils');
const {
  setDownloadProgress,
  updateProgressFromYtdlpOutput
} = require('../shared/progressTracker');



/**
 * Check if yt-dlp is installed and get its version
 * @returns {Promise<string>} - yt-dlp version
 */
async function checkYtDlpVersion() {
  const ytDlpPath = getYtDlpPath();

  try {
    const { stdout } = await require('util').promisify(require('child_process').exec)(`"${ytDlpPath}" --version`);

    return stdout.trim();
  } catch (error) {
    console.error('Error checking yt-dlp version:', error.message);
    console.warn('yt-dlp is not installed or not in PATH. Will attempt to use alternative methods.');
    return 'not-installed';
  }
}

/**
 * Download video from any site using yt-dlp
 * @param {string} videoId - Generated video ID
 * @param {string} videoURL - Video URL
 * @param {string} quality - Desired video quality (e.g., '144p', '360p', '720p')
 * @returns {Promise<Object>} - Result object with success status and path
 */
async function downloadVideoWithYtDlp(videoId, videoURL, quality = '360p') {
  const outputPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);
  const tempPath = path.join(VIDEOS_DIR, `${videoId}.temp.mp4`);



  try {
    // Check if yt-dlp is installed
    const ytdlpVersion = await checkYtDlpVersion();

  } catch (error) {
    console.error('yt-dlp check failed:', error.message);
    throw error;
  }

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

  // Create a promise to handle the download process
  return new Promise((resolve, reject) => {
    // Get the path to yt-dlp
    const ytDlpPath = getYtDlpPath();

    // Choose format strategy based on the site for better compatibility
    let formatString;
    if (videoURL.includes('tiktok.com') || videoURL.includes('douyin.com')) {
      // For TikTok/Douyin, use simple format to avoid compatibility issues
      formatString = `best[height<=${resolution}]`;
      console.log(`[allSites] Using TikTok/Douyin compatible format: ${formatString}`);
    } else {
      // For other sites, use complex format for better quality
      formatString = `bestvideo[height<=${resolution}]+bestaudio/best[height<=${resolution}]`;
      console.log(`[allSites] Using complex format: ${formatString}`);
    }

    // Use yt-dlp with site-appropriate format options and cookie support
    const args = [
      ...getCommonYtDlpArgs(),
      '--verbose',
      '--format', formatString,
      '--merge-output-format', 'mp4',
      '--output', tempPath,
      '--force-overwrites',
      '--no-check-certificate',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      videoURL
    ];

    console.log(`[allSites] Running yt-dlp with args:`, args);
    const ytdlpProcess = spawn(ytDlpPath, args);

    let errorOutput = '';
    let stdoutData = '';

    ytdlpProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      stdoutData += dataStr;

    });

    ytdlpProcess.stderr.on('data', (data) => {
      const dataStr = data.toString();
      errorOutput += dataStr;
      console.error(`yt-dlp stderr: ${dataStr}`);
    });

    ytdlpProcess.on('close', (code) => {
      if (code === 0) {
        // Check if the file was created successfully
        if (fs.existsSync(tempPath)) {
          // Check if the file size is reasonable (at least 100KB)
          const fileStats = fs.statSync(tempPath);
          if (fileStats.size < 100 * 1024) { // Less than 100KB
            console.error(`Downloaded file is too small (${fileStats.size} bytes), likely not a valid video`);
            reject(new Error(`Downloaded file is too small (${fileStats.size} bytes), likely not a valid video`));
            return;
          }

          // Move the temp file to the final location
          safeMoveFile(tempPath, outputPath)
            .then(() => {

              resolve({
                success: true,
                path: outputPath,
                message: 'Video downloaded successfully with yt-dlp',
                method: 'yt-dlp',
                size: fileStats.size
              });
            })
            .catch(err => {
              console.error(`Error moving downloaded file: ${err.message}`);
              reject(err);
            });
        } else {
          console.error(`Download completed but video file was not found at ${tempPath}`);
          reject(new Error('Download completed but video file was not found'));
        }
      } else {
        console.error(`yt-dlp process exited with code ${code}`);
        console.error(`Error output: ${errorOutput}`);
        console.error(`Standard output: ${stdoutData}`);
        reject(new Error(`yt-dlp process failed with code ${code}: ${errorOutput}`));
      }
    });

    ytdlpProcess.on('error', (error) => {
      console.error(`Error spawning yt-dlp process: ${error.message}`);
      reject(error);
    });
  });
}

/**
 * Download video from any site with retry mechanism
 * @param {string} videoId - Generated video ID
 * @param {string} videoURL - Video URL
 * @param {string} quality - Desired video quality (e.g., '144p', '360p', '720p')
 * @returns {Promise<Object>} - Result object with success status and path
 */
async function downloadVideoWithRetry(videoId, videoURL, quality = '360p') {
  try {
    // First attempt with standard options
    return await downloadVideoWithYtDlp(videoId, videoURL, quality);
  } catch (error) {
    console.error(`First download attempt failed: ${error.message}`);

    // Try with fallback options
    try {
      return await downloadVideoWithFallbackOptions(videoId, videoURL, quality);
    } catch (fallbackError) {
      console.error(`Fallback download attempt failed: ${fallbackError.message}`);

      // Try with most basic options (no format specification)
      try {
        return await downloadVideoWithBasicOptions(videoId, videoURL);
      } catch (basicError) {
        console.error(`Basic download attempt failed: ${basicError.message}`);
        throw basicError;
      }
    }
  }
}

/**
 * Download video with fallback options
 * @param {string} videoId - Generated video ID
 * @param {string} videoURL - Video URL
 * @returns {Promise<Object>} - Result object with success status and path
 */
async function downloadVideoWithFallbackOptions(videoId, videoURL, quality = '360p') {
  const outputPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);
  const tempPath = path.join(VIDEOS_DIR, `${videoId}.temp.mp4`);

  // Convert quality string to resolution for yt-dlp fallback
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

  return new Promise((resolve, reject) => {
    // Get the path to yt-dlp
    const ytDlpPath = getYtDlpPath();

    // For TikTok, try even more basic format options
    let formatString;
    if (videoURL.includes('tiktok.com') || videoURL.includes('douyin.com')) {
      // For TikTok, use the most basic format possible
      formatString = 'best';
      console.log(`[allSites-fallback] Using most basic format for TikTok: ${formatString}`);
    } else {
      // For other sites, still try to respect quality limit
      formatString = `best[height<=${resolution}]`;
      console.log(`[allSites-fallback] Using quality-limited format: ${formatString}`);
    }

    // Use yt-dlp with minimal options and cookie support
    const args = [
      ...getCommonYtDlpArgs(),
      '--verbose',
      '--no-check-certificate',
      '--format', formatString,
      '--output', tempPath,
      videoURL
    ];

    console.log(`[allSites-fallback] Running yt-dlp with args:`, args);
    const ytdlpProcess = spawn(ytDlpPath, args);

    let errorOutput = '';
    let stdoutData = '';

    ytdlpProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      stdoutData += dataStr;

    });

    ytdlpProcess.stderr.on('data', (data) => {
      const dataStr = data.toString();
      errorOutput += dataStr;
      console.error(`Fallback stderr: ${dataStr}`);
    });

    ytdlpProcess.on('close', (code) => {
      if (code === 0) {
        // Check if the file was created successfully
        if (fs.existsSync(tempPath)) {
          // Check if the file size is reasonable (at least 100KB)
          const fileStats = fs.statSync(tempPath);
          if (fileStats.size < 100 * 1024) { // Less than 100KB
            console.error(`Downloaded file is too small (${fileStats.size} bytes), likely not a valid video`);
            reject(new Error(`Downloaded file is too small (${fileStats.size} bytes), likely not a valid video`));
            return;
          }

          // Move the temp file to the final location
          safeMoveFile(tempPath, outputPath)
            .then(() => {

              resolve({
                success: true,
                path: outputPath,
                message: 'Video downloaded successfully with fallback options',
                method: 'yt-dlp-fallback',
                size: fileStats.size
              });
            })
            .catch(err => {
              console.error(`Error moving downloaded file: ${err.message}`);
              reject(err);
            });
        } else {
          console.error(`Fallback download completed but video file was not found at ${tempPath}`);
          reject(new Error('Fallback download completed but video file was not found'));
        }
      } else {
        console.error(`Fallback yt-dlp process exited with code ${code}`);
        reject(new Error(`Fallback yt-dlp process failed with code ${code}: ${errorOutput}`));
      }
    });

    ytdlpProcess.on('error', (error) => {
      console.error(`Error spawning fallback yt-dlp process: ${error.message}`);
      reject(error);
    });
  });
}

/**
 * Download video with most basic options (no format specification)
 * @param {string} videoId - Generated video ID
 * @param {string} videoURL - Video URL
 * @returns {Promise<Object>} - Result object with success status and path
 */
async function downloadVideoWithBasicOptions(videoId, videoURL) {
  const outputPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);
  const tempPath = path.join(VIDEOS_DIR, `${videoId}.temp.mp4`);

  return new Promise((resolve, reject) => {
    // Get the path to yt-dlp
    const ytDlpPath = getYtDlpPath();

    console.log(`[allSites-basic] Attempting download with no format specification`);

    // Use yt-dlp with absolute minimal options and cookie support
    const args = [
      ...getCommonYtDlpArgs(),
      '--no-check-certificate',
      '--output', tempPath,
      videoURL
    ];

    console.log(`[allSites-basic] Running yt-dlp with args:`, args);
    const ytdlpProcess = spawn(ytDlpPath, args);

    let errorOutput = '';
    let stdoutData = '';

    ytdlpProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      stdoutData += dataStr;
    });

    ytdlpProcess.stderr.on('data', (data) => {
      const dataStr = data.toString();
      errorOutput += dataStr;
      console.error(`Basic stderr: ${dataStr}`);
    });

    ytdlpProcess.on('close', (code) => {
      if (code === 0) {
        // Check if the file was created successfully
        if (fs.existsSync(tempPath)) {
          // Check if the file size is reasonable (at least 100KB)
          const fileStats = fs.statSync(tempPath);
          if (fileStats.size < 100 * 1024) { // Less than 100KB
            console.error(`Downloaded file is too small (${fileStats.size} bytes), likely not a valid video`);
            reject(new Error(`Downloaded file is too small (${fileStats.size} bytes), likely not a valid video`));
            return;
          }

          // Move the temp file to the final location
          safeMoveFile(tempPath, outputPath)
            .then(() => {
              resolve({
                success: true,
                path: outputPath,
                message: 'Video downloaded successfully with basic options',
                method: 'yt-dlp-basic',
                size: fileStats.size
              });
            })
            .catch(err => {
              console.error(`Error moving downloaded file: ${err.message}`);
              reject(err);
            });
        } else {
          console.error(`Basic download completed but video file was not found at ${tempPath}`);
          reject(new Error('Basic download completed but video file was not found'));
        }
      } else {
        console.error(`Basic yt-dlp process exited with code ${code}`);
        reject(new Error(`Basic yt-dlp process failed with code ${code}: ${errorOutput}`));
      }
    });

    ytdlpProcess.on('error', (error) => {
      console.error(`Error spawning basic yt-dlp process: ${error.message}`);
      reject(error);
    });
  });
}

module.exports = {
  downloadVideoWithRetry
};
