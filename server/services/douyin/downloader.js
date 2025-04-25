/**
 * Douyin video downloader module
 */

const path = require('path');
const fs = require('fs');
const { spawn, exec, execSync } = require('child_process');
const { VIDEOS_DIR } = require('../../config');
const { promisify } = require('util');
const execPromise = promisify(exec);
const douyinPuppeteer = require('./douyin_puppeteer');

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
    console.log(`Found yt-dlp in virtual environment: ${venvYtDlpPath}`);
    return venvYtDlpPath;
  }

  // If not in venv, use the one in PATH
  console.log('Using yt-dlp from PATH');
  return 'yt-dlp';
}

/**
 * Check if yt-dlp is installed and get its version
 * @returns {Promise<string>} - yt-dlp version
 */
async function checkYtDlpVersion() {
  const ytDlpPath = getYtDlpPath();

  try {
    const { stdout } = await execPromise(`"${ytDlpPath}" --version`);
    console.log(`yt-dlp version: ${stdout.trim()}`);
    return stdout.trim();
  } catch (error) {
    console.error('Error checking yt-dlp version:', error.message);
    console.warn('yt-dlp is not installed or not in PATH. Will attempt to use alternative methods.');
    return 'not-installed';
  }
}

/**
 * Normalize Douyin URL to ensure it's in the correct format
 * @param {string} url - The Douyin URL to normalize
 * @returns {string} - Normalized URL
 */
function normalizeDouyinUrl(url) {
  // If it's a short URL (v.douyin.com), make sure it has https:// prefix
  if (url.includes('v.douyin.com') && !url.startsWith('http')) {
    return `https://${url}`;
  }

  // If it's a full URL (www.douyin.com), make sure it has https:// prefix
  if (url.includes('douyin.com') && !url.startsWith('http')) {
    return `https://${url}`;
  }

  // Remove trailing slashes for consistency
  let normalizedUrl = url;
  while (normalizedUrl.endsWith('/')) {
    normalizedUrl = normalizedUrl.slice(0, -1);
  }

  // Special handling for short URLs to ensure they work properly
  if (normalizedUrl.includes('v.douyin.com')) {
    // Make sure the URL ends with a slash for short URLs
    if (!normalizedUrl.endsWith('/')) {
      normalizedUrl = `${normalizedUrl}/`;
    }

    console.log(`Normalized short Douyin URL: ${normalizedUrl}`);
  }

  return normalizedUrl;
}

/**
 * Download Douyin video using yt-dlp
 * @param {string} videoId - Douyin video ID
 * @param {string} videoURL - Douyin video URL
 * @returns {Promise<Object>} - Result object with success status and path
 */
async function downloadDouyinVideoYtDlp(videoId, videoURL) {
  const outputPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);

  // Normalize the URL
  const normalizedUrl = normalizeDouyinUrl(videoURL);

  console.log(`Downloading Douyin video: ${videoId} from URL: ${normalizedUrl}`);

  try {
    // Check if yt-dlp is installed
    const ytdlpVersion = await checkYtDlpVersion();
    console.log(`Using yt-dlp version: ${ytdlpVersion}`);
  } catch (error) {
    console.error('yt-dlp check failed:', error.message);
    throw error;
  }

  // Create a promise to handle the download process
  return new Promise((resolve, reject) => {
    // Get the path to yt-dlp
    const ytDlpPath = getYtDlpPath();

    // Use yt-dlp with more options for better compatibility
    const ytdlpProcess = spawn(ytDlpPath, [
      '--verbose',
      '--format', 'best',
      '--output', outputPath,
      '--force-overwrites',
      '--no-check-certificate',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      '--referer', 'https://www.douyin.com/',
      '--add-header', 'Accept-Language: zh-CN,zh;q=0.9,en;q=0.8',
      normalizedUrl
    ]);

    let errorOutput = '';
    let stdoutData = '';

    ytdlpProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      stdoutData += dataStr;
      console.log(`yt-dlp stdout: ${dataStr}`);
    });

    ytdlpProcess.stderr.on('data', (data) => {
      const dataStr = data.toString();
      errorOutput += dataStr;
      console.error(`yt-dlp stderr: ${dataStr}`);
    });

    ytdlpProcess.on('close', (code) => {
      if (code === 0) {
        // Check if the file was created successfully
        if (fs.existsSync(outputPath)) {
          console.log(`Successfully downloaded Douyin video: ${videoId}`);
          resolve({
            success: true,
            path: outputPath,
            message: 'Video downloaded successfully with yt-dlp',
            method: 'yt-dlp'
          });
        } else {
          console.error(`Download completed but video file was not found at ${outputPath}`);
          reject(new Error('Download completed but video file was not found'));
        }
      } else {
        console.error(`yt-dlp process exited with code ${code}`);
        console.error(`Error output: ${errorOutput}`);
        console.error(`Standard output: ${stdoutData}`);

        // Try to provide more helpful error messages
        if (errorOutput.includes('HTTP Error 403: Forbidden')) {
          reject(new Error('Access to this Douyin video is forbidden. The video might be private or region-restricted.'));
        } else if (errorOutput.includes('Video unavailable')) {
          reject(new Error('This Douyin video is unavailable. It may have been deleted or made private.'));
        } else if (errorOutput.includes('Unable to extract')) {
          reject(new Error('Unable to extract video information. The URL might be invalid or the video might be unavailable.'));
        } else {
          reject(new Error(`yt-dlp process exited with code ${code}: ${errorOutput}`));
        }
      }
    });

    ytdlpProcess.on('error', (error) => {
      console.error(`Failed to start yt-dlp process: ${error.message}`);
      reject(new Error(`Failed to start yt-dlp process: ${error.message}`));
    });
  });
}

/**
 * Fallback method to download Douyin video using a different approach
 * @param {string} videoId - Douyin video ID
 * @param {string} videoURL - Douyin video URL
 * @returns {Promise<Object>} - Result object with success status and path
 */
async function downloadDouyinVideoFallback(videoId, videoURL) {
  const outputPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);

  // Normalize the URL
  const normalizedUrl = normalizeDouyinUrl(videoURL);

  console.log(`Attempting fallback download for Douyin video: ${videoId} from URL: ${normalizedUrl}`);

  return new Promise((resolve, reject) => {
    // Get the path to yt-dlp
    const ytDlpPath = getYtDlpPath();

    // Use yt-dlp with different options for the fallback method
    const ytdlpProcess = spawn(ytDlpPath, [
      '--verbose',
      '--no-check-certificate',
      '--force-overwrites',
      '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
      '--referer', 'https://www.douyin.com/',
      '--add-header', 'Accept-Language: zh-CN,zh;q=0.9,en;q=0.8',
      '--add-header', 'Cookie: douyin.com',
      '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--output', outputPath,
      normalizedUrl
    ]);

    let errorOutput = '';
    let stdoutData = '';

    ytdlpProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      stdoutData += dataStr;
      console.log(`Fallback yt-dlp stdout: ${dataStr}`);
    });

    ytdlpProcess.stderr.on('data', (data) => {
      const dataStr = data.toString();
      errorOutput += dataStr;
      console.error(`Fallback yt-dlp stderr: ${dataStr}`);
    });

    ytdlpProcess.on('close', (code) => {
      if (code === 0) {
        // Check if the file was created successfully
        if (fs.existsSync(outputPath)) {
          console.log(`Successfully downloaded Douyin video with fallback method: ${videoId}`);
          resolve({
            success: true,
            path: outputPath,
            message: 'Video downloaded successfully with fallback method',
            method: 'fallback'
          });
        } else {
          console.error(`Fallback download completed but video file was not found at ${outputPath}`);
          reject(new Error('Fallback download completed but video file was not found'));
        }
      } else {
        console.error(`Fallback yt-dlp process exited with code ${code}`);
        console.error(`Fallback error output: ${errorOutput}`);
        reject(new Error(`Fallback download failed with code ${code}: ${errorOutput}`));
      }
    });

    ytdlpProcess.on('error', (error) => {
      console.error(`Failed to start fallback yt-dlp process: ${error.message}`);
      reject(new Error(`Failed to start fallback yt-dlp process: ${error.message}`));
    });
  });
}

/**
 * Second fallback method specifically for short URLs
 * @param {string} videoId - Douyin video ID
 * @param {string} videoURL - Douyin video URL
 * @returns {Promise<Object>} - Result object with success status and path
 */
async function downloadDouyinVideoShortUrlFallback(videoId, videoURL) {
  const outputPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);

  // Normalize the URL but ensure it has a trailing slash for short URLs
  let normalizedUrl = normalizeDouyinUrl(videoURL);

  // Make sure it's a short URL
  if (!normalizedUrl.includes('v.douyin.com')) {
    throw new Error('This fallback method is only for short URLs');
  }

  console.log(`Attempting short URL fallback download for Douyin video: ${videoId} from URL: ${normalizedUrl}`);

  return new Promise((resolve, reject) => {
    // Get the path to yt-dlp
    const ytDlpPath = getYtDlpPath();

    // Use yt-dlp with special options for short URLs
    const ytdlpProcess = spawn(ytDlpPath, [
      '--verbose',
      '--no-check-certificate',
      '--force-overwrites',
      '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
      '--referer', 'https://www.douyin.com/',
      '--add-header', 'Accept-Language: zh-CN,zh;q=0.9,en;q=0.8',
      '--add-header', 'Cookie: douyin.com',
      '--format', 'best',
      '--output', outputPath,
      normalizedUrl
    ]);

    let errorOutput = '';
    let stdoutData = '';

    ytdlpProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      stdoutData += dataStr;
      console.log(`Short URL fallback stdout: ${dataStr}`);
    });

    ytdlpProcess.stderr.on('data', (data) => {
      const dataStr = data.toString();
      errorOutput += dataStr;
      console.error(`Short URL fallback stderr: ${dataStr}`);
    });

    ytdlpProcess.on('close', (code) => {
      if (code === 0) {
        // Check if the file was created successfully
        if (fs.existsSync(outputPath)) {
          console.log(`Successfully downloaded Douyin video with short URL fallback method: ${videoId}`);
          resolve({
            success: true,
            path: outputPath,
            message: 'Video downloaded successfully with short URL fallback method',
            method: 'short-url-fallback'
          });
        } else {
          console.error(`Short URL fallback download completed but video file was not found at ${outputPath}`);
          reject(new Error('Short URL fallback download completed but video file was not found'));
        }
      } else {
        console.error(`Short URL fallback yt-dlp process exited with code ${code}`);
        console.error(`Short URL fallback error output: ${errorOutput}`);
        reject(new Error(`Short URL fallback download failed with code ${code}: ${errorOutput}`));
      }
    });

    ytdlpProcess.on('error', (error) => {
      console.error(`Failed to start short URL fallback yt-dlp process: ${error.message}`);
      reject(new Error(`Failed to start short URL fallback yt-dlp process: ${error.message}`));
    });
  });
}

/**
 * Final fallback method that uses a simpler approach
 * @param {string} videoId - Douyin video ID
 * @param {string} videoURL - Douyin video URL
 * @returns {Promise<Object>} - Result object with success status and path
 */
async function downloadDouyinVideoSimpleFallback(videoId, videoURL) {
  const outputPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);

  // Normalize the URL
  const normalizedUrl = normalizeDouyinUrl(videoURL);

  console.log(`Attempting simple fallback download for Douyin video: ${videoId} from URL: ${normalizedUrl}`);

  return new Promise((resolve, reject) => {
    // Get the path to yt-dlp
    const ytDlpPath = getYtDlpPath();

    // Use yt-dlp with minimal options for maximum compatibility
    const ytdlpProcess = spawn(ytDlpPath, [
      '--verbose',
      '--no-check-certificate',
      '--output', outputPath,
      normalizedUrl
    ]);

    let errorOutput = '';
    let stdoutData = '';

    ytdlpProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      stdoutData += dataStr;
      console.log(`Simple fallback stdout: ${dataStr}`);
    });

    ytdlpProcess.stderr.on('data', (data) => {
      const dataStr = data.toString();
      errorOutput += dataStr;
      console.error(`Simple fallback stderr: ${dataStr}`);
    });

    ytdlpProcess.on('close', (code) => {
      if (code === 0) {
        // Check if the file was created successfully
        if (fs.existsSync(outputPath)) {
          console.log(`Successfully downloaded Douyin video with simple fallback method: ${videoId}`);
          resolve({
            success: true,
            path: outputPath,
            message: 'Video downloaded successfully with simple fallback method',
            method: 'simple-fallback'
          });
        } else {
          console.error(`Simple fallback download completed but video file was not found at ${outputPath}`);
          reject(new Error('Simple fallback download completed but video file was not found'));
        }
      } else {
        console.error(`Simple fallback yt-dlp process exited with code ${code}`);
        console.error(`Simple fallback error output: ${errorOutput}`);
        reject(new Error(`Simple fallback download failed with code ${code}: ${errorOutput}`));
      }
    });

    ytdlpProcess.on('error', (error) => {
      console.error(`Failed to start simple fallback yt-dlp process: ${error.message}`);
      reject(new Error(`Failed to start simple fallback yt-dlp process: ${error.message}`));
    });
  });
}

/**
 * Puppeteer-based Douyin video downloader
 * @param {string} videoId - Douyin video ID
 * @param {string} videoURL - Douyin video URL
 * @returns {Promise<Object>} - Result object with success status and path
 */
async function downloadDouyinVideoPuppeteer(videoId, videoURL) {
  const outputPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);

  // Normalize the URL
  const normalizedUrl = normalizeDouyinUrl(videoURL);

  console.log(`Attempting Puppeteer-based download for Douyin video: ${videoId} from URL: ${normalizedUrl}`);
  console.log(`Output path: ${outputPath}`);

  try {
    // Use the Puppeteer-based downloader
    await douyinPuppeteer.downloadDouyinVideo(normalizedUrl, outputPath);

    // Check if the file was created successfully
    if (fs.existsSync(outputPath)) {
      console.log(`Successfully downloaded Douyin video with Puppeteer: ${videoId}`);
      return {
        success: true,
        path: outputPath,
        message: 'Video downloaded successfully with Puppeteer',
        method: 'puppeteer'
      };
    } else {
      throw new Error('Puppeteer download completed but video file was not found');
    }
  } catch (error) {
    console.error(`Puppeteer download failed: ${error.message}`);
    throw error;
  }
}

/**
 * Download Douyin video with retry and fallback
 * @param {string} videoId - Douyin video ID
 * @param {string} videoURL - Douyin video URL
 * @returns {Promise<Object>} - Result object with success status and path
 */
async function downloadDouyinVideoWithRetry(videoId, videoURL) {
  console.log(`Starting download process for Douyin video: ${videoId} from URL: ${videoURL}`);

  // Use the Puppeteer approach
  console.log('Using Puppeteer approach for Douyin video download...');
  try {
    return await downloadDouyinVideoPuppeteer(videoId, videoURL);
  } catch (error) {
    console.error(`Puppeteer download failed: ${error.message}`);

    // If the Puppeteer approach fails, provide a clear error message
    const errorMessage = `Douyin video download failed using Puppeteer approach: ${error.message}`;
    console.error(errorMessage);

    // Provide more specific error messages based on the error
    if (error.message.includes('No video URLs found')) {
      throw new Error('Could not find video on the Douyin page. The video might be private or deleted.');
    } else if (error.message.includes('Navigation timeout')) {
      throw new Error('Timed out while loading the Douyin page. Please try again later.');
    } else if (error.message.includes('net::ERR_CONNECTION_RESET') ||
               error.message.includes('net::ERR_CONNECTION_CLOSED')) {
      throw new Error('Connection was reset while accessing Douyin. This might be due to regional restrictions.');
    }

    throw new Error(errorMessage);
  }
}

module.exports = {
  downloadDouyinVideoPuppeteer,
  downloadDouyinVideoWithRetry,
  normalizeDouyinUrl
};
