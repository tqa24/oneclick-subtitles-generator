/**
 * Core download utilities for YouTube videos
 */

const fs = require('fs');
const ytdl = require('ytdl-core');
const fsPromises = fs.promises;
const { isFFmpegAvailable, mergeVideoAndAudio } = require('./ffmpegUtils');

/**
 * Download video and audio separately and merge them
 * @param {string} videoURL - YouTube video URL
 * @param {string} outputPath - Path to save the merged file
 * @param {Object} videoFormat - Video format to download
 * @param {Object} audioFormat - Audio format to download
 * @returns {Promise<boolean>} - True if download and merge was successful
 */
async function downloadAndMerge(videoURL, outputPath, videoFormat, audioFormat) {
  // Check if ffmpeg is available
  const ffmpegAvailable = await isFFmpegAvailable();
  if (!ffmpegAvailable) {
    console.error(`[QUALITY DEBUG] FFmpeg is not available, cannot merge video and audio`);
    return false;
  }

  // Create temporary file paths
  const tempVideoPath = `${outputPath}.video.tmp`;
  const tempAudioPath = `${outputPath}.audio.tmp`;

  try {
    console.log(`[QUALITY DEBUG] Downloading video and audio separately:`);
    console.log(`[QUALITY DEBUG] Video format: ${videoFormat.qualityLabel || videoFormat.quality}`);
    console.log(`[QUALITY DEBUG] Audio format: ${audioFormat.qualityLabel || 'audio only'}`);

    // Download video
    await new Promise((resolve, reject) => {
      const videoStream = ytdl(videoURL, { format: videoFormat });
      const videoWriteStream = fs.createWriteStream(tempVideoPath);

      videoWriteStream.on('finish', resolve);
      videoWriteStream.on('error', reject);
      videoStream.on('error', reject);

      videoStream.pipe(videoWriteStream);
    });

    console.log(`[QUALITY DEBUG] Video download complete: ${tempVideoPath}`);

    // Download audio
    await new Promise((resolve, reject) => {
      const audioStream = ytdl(videoURL, { format: audioFormat });
      const audioWriteStream = fs.createWriteStream(tempAudioPath);

      audioWriteStream.on('finish', resolve);
      audioWriteStream.on('error', reject);
      audioStream.on('error', reject);

      audioStream.pipe(audioWriteStream);
    });

    console.log(`[QUALITY DEBUG] Audio download complete: ${tempAudioPath}`);

    // Merge video and audio
    const mergeSuccess = await mergeVideoAndAudio(tempVideoPath, tempAudioPath, outputPath);

    // Clean up temporary files
    try {
      if (fs.existsSync(tempVideoPath)) {
        await fsPromises.unlink(tempVideoPath);
      }
      if (fs.existsSync(tempAudioPath)) {
        await fsPromises.unlink(tempAudioPath);
      }
    } catch (cleanupError) {
      console.warn(`[QUALITY DEBUG] Error cleaning up temporary files:`, cleanupError);
    }

    return mergeSuccess;
  } catch (error) {
    console.error(`[QUALITY DEBUG] Error in downloadAndMerge:`, error);

    // Clean up temporary files in case of error
    try {
      if (fs.existsSync(tempVideoPath)) {
        await fsPromises.unlink(tempVideoPath);
      }
      if (fs.existsSync(tempAudioPath)) {
        await fsPromises.unlink(tempAudioPath);
      }
    } catch (cleanupError) {
      console.warn(`[QUALITY DEBUG] Error cleaning up temporary files:`, cleanupError);
    }

    return false;
  }
}

module.exports = {
  downloadAndMerge
};
