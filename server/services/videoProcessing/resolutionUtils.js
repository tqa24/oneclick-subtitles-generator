/**
 * Utilities for getting video resolution and frame count
 */

const { spawn } = require('child_process');

/**
 * Get the total frame count of a video file
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<number>} - Total frame count
 */
function getVideoFrameCount(videoPath) {
  return new Promise((resolve, reject) => {
    const frameCountProbe = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-count_packets',
      '-show_entries', 'stream=nb_read_packets',
      '-of', 'csv=p=0',
      videoPath
    ]);

    let frameCountOutput = '';

    frameCountProbe.stdout.on('data', (data) => {
      frameCountOutput += data.toString();
    });

    frameCountProbe.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Failed to get frame count for ${videoPath}`));
      }

      const frameCount = parseInt(frameCountOutput.trim());

      resolve(frameCount);
    });

    frameCountProbe.stderr.on('data', (data) => {
      console.error(`ffprobe stderr: ${data}`);
    });

    frameCountProbe.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Get the resolution (width and height) of a video file
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<Object>} - Object with width and height properties
 */
function getVideoResolution(videoPath) {
  return new Promise((resolve, reject) => {
    const resolutionProbe = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'csv=p=0',
      videoPath
    ]);

    let resolutionOutput = '';

    resolutionProbe.stdout.on('data', (data) => {
      resolutionOutput += data.toString();
    });

    resolutionProbe.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Failed to get resolution for ${videoPath}`));
      }

      const [width, height] = resolutionOutput.trim().split(',').map(Number);

      resolve({ width, height });
    });

    resolutionProbe.stderr.on('data', (data) => {
      console.error(`ffprobe stderr: ${data}`);
    });

    resolutionProbe.on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = {
  getVideoFrameCount,
  getVideoResolution
};
