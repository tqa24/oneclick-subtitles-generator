/**
 * Utilities for getting YouTube video information
 */

const https = require('https');

/**
 * Get basic video information from YouTube's oEmbed API
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Object>} - Video info object
 */
function getVideoInfo(videoId) {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;

    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to get video info: HTTP ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const info = JSON.parse(data);
          resolve({
            title: info.title,
            author: info.author_name,
            thumbnailUrl: info.thumbnail_url
          });
        } catch (error) {
          reject(new Error(`Failed to parse video info: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Failed to fetch video info: ${error.message}`));
    });
  });
}

module.exports = {
  getVideoInfo
};
