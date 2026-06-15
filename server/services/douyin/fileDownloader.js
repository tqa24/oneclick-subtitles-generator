/**
 * HTTP/HTTPS file downloader with progress tracking and cancellation support
 */

const fs = require('fs');
const { setDownloadProgress } = require('../shared/progressTracker');

/**
 * Download file with progress tracking and cancellation support
 * @param {string} url - File URL to download
 * @param {string} outputPath - Output file path
 * @param {string} videoId - Video ID for progress tracking
 * @param {AbortController} abortController - Abort controller for cancellation
 * @returns {Promise<void>}
 */
async function downloadFileWithProgress(url, outputPath, videoId, abortController = null) {
  const https = require('https');
  const http = require('http');

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;

    // Check if already aborted
    if (abortController && abortController.signal.aborted) {
      reject(new Error('Download was cancelled'));
      return;
    }

    const request = protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: HTTP ${response.statusCode}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;

      const fileStream = fs.createWriteStream(outputPath);

      // Handle abort signal
      if (abortController) {
        abortController.signal.addEventListener('abort', () => {
          console.log(`[DOUYIN] Download cancelled for ${videoId}`);
          request.destroy();
          response.destroy();
          fileStream.destroy();

          // Clean up partial file
          fs.unlink(outputPath, () => {});

          reject(new Error('Download was cancelled'));
        });
      }

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize) {
          const progress = Math.round((downloadedSize / totalSize) * 70) + 30; // 30-100%
          setDownloadProgress(videoId, progress, 'downloading');
        }
      });

      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (error) => {
        fs.unlink(outputPath, () => {}); // Delete the file on error
        reject(error);
      });
    });

    request.on('error', (error) => {
      reject(error);
    });
  });
}

module.exports = {
  downloadFileWithProgress
};
