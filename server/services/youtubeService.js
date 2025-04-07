/**
 * YouTube download functionality using multiple libraries
 * Implements a hybrid approach with multiple fallback mechanisms
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const ytdl = require('ytdl-core');
const playDl = require('play-dl');
const { spawn } = require('child_process');
const { VIDEOS_DIR } = require('../config');

/**
 * Download YouTube video using multiple methods with fallbacks
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Object>} - Result object with success status and path
 */
async function downloadYouTubeVideo(videoId) {
  const videoURL = `https://www.youtube.com/watch?v=${videoId}`;
  const outputPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);

  console.log(`Downloading YouTube video: ${videoId}`);

  // Get video info first
  let videoInfo;
  try {
    videoInfo = await getVideoInfo(videoId);
    console.log(`Video info retrieved: ${videoInfo.title}`);
  } catch (error) {
    console.warn(`Could not get video info from oEmbed API: ${error.message}`);
    videoInfo = { title: `YouTube Video ${videoId}` };
  }

  // Try multiple download methods in sequence
  const methods = [
    { name: 'ytdl-core', fn: downloadWithYtdlCore },
    { name: 'play-dl', fn: downloadWithPlayDl },
    { name: 'direct-stream', fn: downloadWithDirectStream }
  ];

  let lastError = null;

  for (const method of methods) {
    try {
      console.log(`Attempting to download with ${method.name}...`);
      const result = await method.fn(videoURL, outputPath);
      console.log(`Successfully downloaded video with ${method.name}`);

      return {
        success: true,
        path: outputPath,
        message: `Video downloaded successfully with ${method.name}`,
        title: videoInfo.title,
        method: method.name
      };
    } catch (error) {
      console.error(`${method.name} download failed:`, error.message);
      lastError = error;
    }
  }

  // If we get here, all methods failed
  throw new Error(`All download methods failed. Last error: ${lastError?.message}`);
}

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

/**
 * Download YouTube video using ytdl-core
 * @param {string} videoURL - YouTube video URL
 * @param {string} outputPath - Path to save the video
 * @returns {Promise<boolean>} - Success status
 */
function downloadWithYtdlCore(videoURL, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      // Set up ytdl options for best quality that includes both video and audio
      const options = {
        quality: 'highest',
        filter: format => format.container === 'mp4' && format.hasVideo && format.hasAudio
      };

      // Create write stream
      const writeStream = fs.createWriteStream(outputPath);

      // Set up event handlers
      writeStream.on('finish', () => {
        console.log(`ytdl-core download successful: ${outputPath}`);
        resolve(true);
      });

      writeStream.on('error', (err) => {
        console.error('Write stream error:', err);
        reject(err);
      });

      // Start download
      const videoStream = ytdl(videoURL, options);

      videoStream.on('error', (err) => {
        console.error('ytdl-core stream error:', err);
        writeStream.end();
        reject(err);
      });

      // Log progress
      videoStream.on('progress', (chunkLength, downloaded, total) => {
        const percent = downloaded / total * 100;
        console.log(`ytdl-core download progress: ${percent.toFixed(2)}%`);
      });

      // Pipe the video stream to the file
      videoStream.pipe(writeStream);
    } catch (err) {
      console.error('ytdl-core setup error:', err);
      reject(err);
    }
  });
}

/**
 * Download YouTube video using play-dl
 * @param {string} videoURL - YouTube video URL
 * @param {string} outputPath - Path to save the video
 * @returns {Promise<boolean>} - Success status
 */
async function downloadWithPlayDl(videoURL, outputPath) {
  try {
    // Get stream with play-dl
    const stream = await playDl.stream(videoURL, { quality: 720 });

    return new Promise((resolve, reject) => {
      // Create write stream
      const writeStream = fs.createWriteStream(outputPath);

      writeStream.on('finish', () => {
        console.log(`play-dl download successful: ${outputPath}`);
        resolve(true);
      });

      writeStream.on('error', (err) => {
        console.error('Write stream error:', err);
        reject(err);
      });

      // Pipe the video stream to the file
      stream.stream.pipe(writeStream);

      stream.stream.on('error', (err) => {
        console.error('play-dl stream error:', err);
        writeStream.end();
        reject(err);
      });
    });
  } catch (error) {
    console.error('play-dl error:', error);
    throw error;
  }
}

/**
 * Download YouTube video using direct stream approach
 * This is a fallback method that uses a more direct approach
 * @param {string} videoURL - YouTube video URL
 * @param {string} outputPath - Path to save the video
 * @returns {Promise<boolean>} - Success status
 */
function downloadWithDirectStream(videoURL, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      // Create a temporary file for the video
      const tempFilePath = `${outputPath}.temp`;
      const writeStream = fs.createWriteStream(tempFilePath);

      // Set up event handlers
      writeStream.on('finish', () => {
        // Rename the temp file to the final output path
        fs.rename(tempFilePath, outputPath, (err) => {
          if (err) {
            console.error('Error renaming temp file:', err);
            reject(err);
            return;
          }
          console.log(`Direct stream download successful: ${outputPath}`);
          resolve(true);
        });
      });

      writeStream.on('error', (err) => {
        console.error('Write stream error:', err);
        // Clean up temp file if it exists
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        reject(err);
      });

      // Use a more direct approach with fetch
      const fetchVideo = async () => {
        try {
          // First try to get a direct video URL using ytdl-core's getInfo
          const info = await ytdl.getInfo(videoURL);
          const format = ytdl.chooseFormat(info.formats, { quality: 'highest' });

          if (!format || !format.url) {
            throw new Error('No suitable format found');
          }

          console.log(`Got direct video URL: ${format.url.substring(0, 50)}...`);

          // Create an HTTP request to the video URL
          const req = https.get(format.url, (res) => {
            if (res.statusCode !== 200) {
              writeStream.end();
              reject(new Error(`Failed to download video: HTTP ${res.statusCode}`));
              return;
            }

            // Pipe the response to the file
            res.pipe(writeStream);

            res.on('error', (err) => {
              console.error('Response error:', err);
              writeStream.end();
              reject(err);
            });
          });

          req.on('error', (err) => {
            console.error('Request error:', err);
            writeStream.end();
            reject(err);
          });
        } catch (err) {
          console.error('Error in fetchVideo:', err);
          writeStream.end();
          reject(err);
        }
      };

      // Start the fetch process
      fetchVideo();
    } catch (err) {
      console.error('Direct stream setup error:', err);
      reject(err);
    }
  });
}

module.exports = {
  downloadYouTubeVideo
};
