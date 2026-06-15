/**
 * Douyin video downloader using Puppeteer
 * This approach uses a headless browser to navigate to the Douyin page,
 * wait for the video to load, and then extract the video URL.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { extractVideoUrl } = require('./puppeteerVideoExtractor');

/**
 * Download a file from a URL to a local path
 * @param {string} url - URL of the file to download
 * @param {string} outputPath - Path where the file should be saved
 * @returns {Promise<boolean>} - True if download was successful
 */
async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {


    // Create directory if it doesn't exist
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Determine if we need http or https
    const client = url.startsWith('https') ? https : http;

    const request = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://www.douyin.com/',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive'
      }
    }, (response) => {
      // Check if response is a redirect
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {

        // Recursively follow redirects
        downloadFile(response.headers.location, outputPath)
          .then(resolve)
          .catch(reject);
        return;
      }

      // Check if response is successful
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: HTTP status code ${response.statusCode}`));
        return;
      }

      // Create write stream
      const fileStream = fs.createWriteStream(outputPath);

      // Set up event handlers
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();

        resolve(true);
      });

      fileStream.on('error', (err) => {
        fs.unlink(outputPath, () => {}); // Delete the file if there's an error
        reject(err);
      });

      // Track download progress
      let downloaded = 0;
      const total = parseInt(response.headers['content-length'] || 0);

      response.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total > 0) {
          const percent = Math.round((downloaded / total) * 100);
          process.stdout.write(`Download progress: ${percent}%\r`);
        }
      });
    });

    request.on('error', (err) => {
      fs.unlink(outputPath, () => {}); // Delete the file if there's an error
      reject(err);
    });
  });
}

/**
 * Download a Douyin video using Puppeteer
 * @param {string} url - Douyin video URL
 * @param {string} outputPath - Path where the video should be saved
 * @returns {Promise<boolean>} - True if download was successful
 */
async function downloadDouyinVideo(url, outputPath) {
  try {
    // Extract video URL
    const videoUrl = await extractVideoUrl(url);


    // Download the video
    await downloadFile(videoUrl, outputPath);

    return true;
  } catch (error) {
    console.error(`Error downloading Douyin video: ${error.message}`);
    throw error;
  }
}

module.exports = {
  downloadDouyinVideo,
  extractVideoUrl
};
