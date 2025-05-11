/**
 * Utilities for converting between media formats
 */

const { spawn } = require('child_process');
const { getMediaDuration } = require('./durationUtils');

/**
 * Convert an audio file to a video file with a black background
 * @param {string} audioPath - Path to the audio file
 * @param {string} outputPath - Path to save the video file
 * @returns {Promise<Object>} - Result object with video path and metadata
 */
function convertAudioToVideo(audioPath, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      // Get the duration of the audio file
      const duration = await getMediaDuration(audioPath);




      // Construct ffmpeg command to create a video with black background and the audio
      // Using 144p resolution (256x144) instead of 360p
      const ffmpegArgs = [
        '-f', 'lavfi',
        '-i', `color=c=black:s=256x144:r=15:d=${duration}`,  // Explicitly set duration
        '-i', audioPath,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '28',
        '-tune', 'stillimage',
        '-c:a', 'aac',
        '-b:a', '64k',
        '-map', '0:v:0',  // Explicitly map video stream
        '-map', '1:a:0',  // Explicitly map audio stream
        '-threads', '0',
        '-y',
        outputPath
      ];

      const convertCmd = spawn('ffmpeg', ffmpegArgs);

      convertCmd.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('frame=')) {
          process.stdout.write('.');
        }

      });

      convertCmd.on('close', async (code) => {
        if (code !== 0) {
          return reject(new Error('Failed to convert audio to video'));
        }

        try {
          // Get the duration of the created video
          const videoDuration = await getMediaDuration(outputPath);





          resolve({
            path: outputPath,
            duration: videoDuration,
            width: 256,
            height: 144,
            fps: 15
          });
        } catch (error) {
          reject(new Error(`Failed to get converted video metadata: ${error.message}`));
        }
      });

      convertCmd.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  convertAudioToVideo
};
