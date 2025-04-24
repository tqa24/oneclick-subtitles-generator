/**
 * Main YouTube downloader module that orchestrates the download process
 * using multiple methods with fallbacks
 */

const path = require('path');
const { VIDEOS_DIR } = require('../../config');
const { getVideoInfo } = require('./infoUtils');
const { downloadWithYtdlCore } = require('./ytdlDownloader');
const { downloadWithPlayDl } = require('./playDlDownloader');
const { downloadWithAudio, downloadWithDirectStream } = require('./specialDownloaders');
const { downloadWithYtdlp } = require('./ytdlpDownloader');

/**
 * Download YouTube video using multiple methods with fallbacks
 * Always prioritizes formats with audio
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Object>} - Result object with success status and path
 */
async function downloadYouTubeVideo(videoId) {
  const videoURL = `https://www.youtube.com/watch?v=${videoId}`;
  const outputPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);

  console.log(`[QUALITY DEBUG] Downloading YouTube video: ${videoId} with audio prioritized`);

  // Get video info first
  let videoInfo;
  try {
    videoInfo = await getVideoInfo(videoId);
    console.log(`Video info retrieved: ${videoInfo.title}`);
  } catch (error) {
    console.warn(`Could not get video info from oEmbed API: ${error.message}`);
    videoInfo = { title: `YouTube Video ${videoId}` };
  }

  // Always try to get a format with audio first
  try {
    console.log(`[QUALITY DEBUG] Using special download method to ensure audio...`);
    const success = await downloadWithAudio(videoURL, outputPath);

    if (success) {
      console.log(`Successfully downloaded video with audio`);
      return {
        success: true,
        path: outputPath,
        message: `Video downloaded successfully with audio`,
        title: videoInfo.title,
        method: 'audio-prioritized'
      };
    }
  } catch (error) {
    console.error(`Error with audio-prioritized download: ${error.message}`);
    console.log(`Falling back to standard methods...`);
  }

  // Try multiple download methods in sequence
  const methods = [
    { name: 'yt-dlp', fn: downloadWithYtdlp }, // yt-dlp as first priority
    { name: 'ytdl-core', fn: downloadWithYtdlCore },
    { name: 'play-dl', fn: downloadWithPlayDl },
    { name: 'direct-stream', fn: downloadWithDirectStream }
  ];

  let lastError = null;

  for (const method of methods) {
    try {
      console.log(`Attempting to download with ${method.name}...`);
      // Always pass '360p' as the quality parameter to ensure consistent behavior
      // The actual format selection is done in the download functions to prioritize audio
      const result = await method.fn(videoURL, outputPath, '360p');
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
