/**
 * Main YouTube downloader module that orchestrates the download process
 * using multiple methods with fallbacks
 */

const path = require('path');
const { VIDEOS_DIR } = require('../../config');
const { getVideoInfo } = require('./infoUtils');
const { downloadWithYtdlCore } = require('./ytdlDownloader');
const { downloadWithPlayDl } = require('./playDlDownloader');
const { download360pWithAudio, downloadWithDirectStream } = require('./specialDownloaders');

/**
 * Download YouTube video using multiple methods with fallbacks
 * @param {string} videoId - YouTube video ID
 * @param {string} quality - Desired video quality (e.g., '144p', '360p', '720p')
 * @returns {Promise<Object>} - Result object with success status and path
 */
async function downloadYouTubeVideo(videoId, quality = '360p') {
  const videoURL = `https://www.youtube.com/watch?v=${videoId}`;
  const outputPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);

  console.log(`[QUALITY DEBUG] Downloading YouTube video: ${videoId} with quality: ${quality}`);

  // Get video info first
  let videoInfo;
  try {
    videoInfo = await getVideoInfo(videoId);
    console.log(`Video info retrieved: ${videoInfo.title}`);
  } catch (error) {
    console.warn(`Could not get video info from oEmbed API: ${error.message}`);
    videoInfo = { title: `YouTube Video ${videoId}` };
  }

  // Special handling for 360p to ensure we get audio
  if (quality === '360p') {
    try {
      console.log(`[QUALITY DEBUG] Using special 360p download method to ensure audio...`);
      const success = await download360pWithAudio(videoURL, outputPath);

      if (success) {
        console.log(`Successfully downloaded 360p video with audio`);
        return {
          success: true,
          path: outputPath,
          message: `Video downloaded successfully with 360p special method`,
          title: videoInfo.title,
          method: '360p-special'
        };
      }
    } catch (error) {
      console.error(`Error with special 360p download: ${error.message}`);
      console.log(`Falling back to standard methods...`);
    }
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
      const result = await method.fn(videoURL, outputPath, quality);
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

module.exports = {
  downloadYouTubeVideo
};
