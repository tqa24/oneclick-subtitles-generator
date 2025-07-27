/**
 * YouTube downloader using yt-dlp command line tool
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { safeMoveFile } = require('../../utils/fileOperations');
const { getYtDlpPath, getCommonYtDlpArgs } = require('../shared/ytdlpUtils');
const {
  getDownloadProgress,
  setDownloadProgress,
  updateProgressFromYtdlpOutput
} = require('../shared/progressTracker');



/**
 * Download YouTube video using yt-dlp command line tool
 * @param {string} videoURL - YouTube video URL
 * @param {string} outputPath - Path to save the video
 * @param {string} quality - Desired video quality (e.g., '144p', '360p', '720p')
 * @param {string} videoId - Video ID for progress tracking (optional)
 * @returns {Promise<boolean>} - Success status
 */
async function downloadWithYtdlp(videoURL, outputPath, quality = '360p', videoId = null) {
  return new Promise((resolve, reject) => {


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

    // Build the yt-dlp command arguments with cookie support
    const args = [
      ...getCommonYtDlpArgs(),
      videoURL,
      '-f', `bestvideo[height<=${resolution}]+bestaudio/best[height<=${resolution}]`,
      '-o', tempPath,
      '--no-playlist',
      '--merge-output-format', 'mp4',
      '--progress',  // Enable progress reporting
      '--newline'    // Force newlines for better parsing
    ];

    console.log(`[ytdlpDownloader] Running yt-dlp with args:`, args);



    // Spawn the yt-dlp process
    const ytdlpProcess = spawn(ytdlpCommand, args);

    let stdoutData = '';
    let stderrData = '';

    ytdlpProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdoutData += output;

      // Parse progress information if videoId is provided
      if (videoId) {
        updateProgressFromYtdlpOutput(videoId, output);
      }
    });

    ytdlpProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderrData += output;
      console.error(`[yt-dlp error] ${output.trim()}`);
    });

    ytdlpProcess.on('close', (code) => {
      if (code === 0) {
        // Success - move the file to the final location
        try {
          // Check if the file exists
          if (fs.existsSync(tempPath)) {
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
        // Check if this is a Chrome cookie database error
        const isCookieError = stderrData.includes('Could not copy Chrome cookie database') ||
                             stderrData.includes('https://github.com/yt-dlp/yt-dlp/issues/7271');

        if (isCookieError && args.includes('--cookies-from-browser')) {
          console.log(`[yt-dlp fallback] Chrome cookie error detected, retrying without cookies...`);

          // Retry without cookie arguments
          const fallbackArgs = args.filter(arg => arg !== '--cookies-from-browser' && arg !== 'chrome');
          console.log(`[yt-dlp fallback] Retry args:`, fallbackArgs);

          // Reset progress for retry
          if (videoId) {
            setDownloadProgress(videoId, 0, 'downloading');
          }

          // Spawn new process without cookies
          const fallbackProcess = spawn(ytdlpCommand, fallbackArgs);
          let fallbackStdout = '';
          let fallbackStderr = '';

          fallbackProcess.stdout.on('data', (data) => {
            const output = data.toString();
            fallbackStdout += output;
            if (videoId) {
              updateProgressFromYtdlpOutput(videoId, output);
            }
          });

          fallbackProcess.stderr.on('data', (data) => {
            const output = data.toString();
            fallbackStderr += output;
            console.error(`[yt-dlp fallback error] ${output.trim()}`);
          });

          fallbackProcess.on('close', (fallbackCode) => {
            if (fallbackCode === 0) {
              // Success with fallback
              try {
                if (fs.existsSync(tempPath)) {
                  if (videoId) {
                    setDownloadProgress(videoId, 100, 'completed');
                  }
                  console.log(`[yt-dlp fallback] Download successful without cookies`);
                  safeMoveFile(tempPath, outputPath)
                    .then(() => resolve(true))
                    .catch((err) => {
                      if (videoId) {
                        setDownloadProgress(videoId, 0, 'error');
                      }
                      console.error(`Error moving fallback downloaded file: ${err.message}`);
                      reject(err);
                    });
                } else {
                  if (videoId) {
                    setDownloadProgress(videoId, 0, 'error');
                  }
                  console.error(`Fallback process completed but file not found: ${tempPath}`);
                  reject(new Error('Fallback process completed but file not found'));
                }
              } catch (error) {
                if (videoId) {
                  setDownloadProgress(videoId, 0, 'error');
                }
                console.error(`Error in fallback process: ${error.message}`);
                reject(error);
              }
            } else {
              // Fallback also failed
              if (videoId) {
                setDownloadProgress(videoId, 0, 'error');
              }
              console.error(`yt-dlp fallback also failed with code ${fallbackCode}`);
              reject(new Error(`yt-dlp failed both with cookies (${stderrData}) and without cookies (${fallbackStderr})`));
            }
          });

          fallbackProcess.on('error', (error) => {
            if (videoId) {
              setDownloadProgress(videoId, 0, 'error');
            }
            console.error(`Error in fallback yt-dlp process: ${error.message}`);
            reject(error);
          });

        } else {
          // Not a cookie error or already tried without cookies
          if (videoId) {
            setDownloadProgress(videoId, 0, 'error');
          }
          console.error(`yt-dlp process exited with code ${code}`);
          reject(new Error(`yt-dlp process failed with code ${code}: ${stderrData}`));
        }
      }
    });

    ytdlpProcess.on('error', (error) => {
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
  });
}

module.exports = {
  downloadWithYtdlp,
  getDownloadProgress
};
