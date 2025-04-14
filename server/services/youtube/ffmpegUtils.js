/**
 * FFmpeg utility functions for YouTube video processing
 */

const fs = require('fs');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const fsPromises = fs.promises;

/**
 * Check if ffmpeg is installed and available
 * @returns {Promise<boolean>} - True if ffmpeg is available
 */
async function isFFmpegAvailable() {
  try {
    await exec('ffmpeg -version');
    return true;
  } catch (error) {
    console.warn('FFmpeg is not available:', error.message);
    return false;
  }
}

/**
 * Merge video and audio files using ffmpeg
 * @param {string} videoPath - Path to the video file
 * @param {string} audioPath - Path to the audio file
 * @param {string} outputPath - Path to save the merged file
 * @returns {Promise<boolean>} - True if merge was successful
 */
async function mergeVideoAndAudio(videoPath, audioPath, outputPath) {
  try {
    console.log(`[QUALITY DEBUG] Merging video and audio files:`);
    console.log(`[QUALITY DEBUG] Video: ${videoPath}`);
    console.log(`[QUALITY DEBUG] Audio: ${audioPath}`);
    console.log(`[QUALITY DEBUG] Output: ${outputPath}`);

    // Use ffmpeg to merge the files
    const command = `ffmpeg -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -strict experimental "${outputPath}" -y`;
    console.log(`[QUALITY DEBUG] Running command: ${command}`);

    const { stdout, stderr } = await exec(command);

    if (stderr) {
      console.log(`[QUALITY DEBUG] FFmpeg stderr: ${stderr}`);
    }

    // Check if the output file exists
    if (fs.existsSync(outputPath)) {
      console.log(`[QUALITY DEBUG] Merge successful, output file exists`);
      return true;
    } else {
      console.error(`[QUALITY DEBUG] Merge failed, output file does not exist`);
      return false;
    }
  } catch (error) {
    console.error(`[QUALITY DEBUG] Error merging files:`, error);
    return false;
  }
}

module.exports = {
  isFFmpegAvailable,
  mergeVideoAndAudio
};
