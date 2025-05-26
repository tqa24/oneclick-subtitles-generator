/**
 * Generic URL downloader module that uses yt-dlp for downloading videos from any supported site
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { VIDEOS_DIR } = require('../../config');
const { safeMoveFile } = require('../../utils/fileOperations');
const {
  setDownloadProgress,
  updateProgressFromYtdlpOutput
} = require('../shared/progressTracker');

/**
 * Get the path to yt-dlp executable
 * First checks for yt-dlp in the virtual environment, then in PATH
 * @returns {string} - Path to yt-dlp executable
 */
function getYtDlpPath() {
  // Check for venv at root level
  const venvPath = path.join(process.cwd(), '.venv');
  const venvBinDir = process.platform === 'win32' ? 'Scripts' : 'bin';
  const venvYtDlpPath = path.join(venvPath, venvBinDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

  if (fs.existsSync(venvYtDlpPath)) {

    return venvYtDlpPath;
  }

  // If not in venv, use the one in PATH

  return 'yt-dlp';
}

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
 * @returns {Promise<Object>} - Result object with success status and path
 */
async function downloadVideoWithYtDlp(videoId, videoURL) {
  const outputPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);
  const tempPath = path.join(VIDEOS_DIR, `${videoId}.temp.mp4`);



  try {
    // Check if yt-dlp is installed
    const ytdlpVersion = await checkYtDlpVersion();

  } catch (error) {
    console.error('yt-dlp check failed:', error.message);
    throw error;
  }

  // Create a promise to handle the download process
  return new Promise((resolve, reject) => {
    // Get the path to yt-dlp
    const ytDlpPath = getYtDlpPath();

    // Use yt-dlp with options for best compatibility
    const ytdlpProcess = spawn(ytDlpPath, [
      '--verbose',
      '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--output', tempPath,
      '--force-overwrites',
      '--no-check-certificate',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      videoURL
    ]);

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
 * @returns {Promise<Object>} - Result object with success status and path
 */
async function downloadVideoWithRetry(videoId, videoURL) {
  try {
    // First attempt with standard options
    return await downloadVideoWithYtDlp(videoId, videoURL);
  } catch (error) {
    console.error(`First download attempt failed: ${error.message}`);

    // Try with fallback options
    try {
      return await downloadVideoWithFallbackOptions(videoId, videoURL);
    } catch (fallbackError) {
      console.error(`Fallback download attempt failed: ${fallbackError.message}`);
      throw fallbackError;
    }
  }
}

/**
 * Download video with fallback options
 * @param {string} videoId - Generated video ID
 * @param {string} videoURL - Video URL
 * @returns {Promise<Object>} - Result object with success status and path
 */
async function downloadVideoWithFallbackOptions(videoId, videoURL) {
  const outputPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);
  const tempPath = path.join(VIDEOS_DIR, `${videoId}.temp.mp4`);

  return new Promise((resolve, reject) => {
    // Get the path to yt-dlp
    const ytDlpPath = getYtDlpPath();

    // Use yt-dlp with minimal options for maximum compatibility
    const ytdlpProcess = spawn(ytDlpPath, [
      '--verbose',
      '--no-check-certificate',
      '--format', 'best',
      '--output', tempPath,
      videoURL
    ]);

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

module.exports = {
  downloadVideoWithRetry
};
