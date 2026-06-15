/**
 * Audio-to-video conversion helper for media routes.
 */

const { spawn } = require('child_process');
const { getFfmpegPath, getFfprobePath } = require('../services/shared/ffmpegUtils');

/**
 * Convert an audio file to a video file with a static image
 * @param {string} audioPath - Path to the audio file
 * @param {string} videoPath - Path to save the video file
 * @returns {Promise<Object>} - Video metadata
 */
function convertAudioToVideo(audioPath, videoPath) {
  return new Promise((resolve, reject) => {
    const ffmpegPath = getFfmpegPath();

    // Create a video with a static black background at 256x144 (144p) resolution
    // Using 15 fps for a smoother playback experience while keeping file size reasonable
    const ffmpeg = spawn(ffmpegPath, [
      '-i', audioPath,
      '-f', 'lavfi',
      '-i', 'color=c=black:s=256x144:r=15',
      '-shortest',
      '-c:v', 'libx264',
      '-tune', 'stillimage',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-pix_fmt', 'yuv420p',
      '-y',
      videoPath
    ]);

    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        console.error(`[CONVERT-AUDIO] FFmpeg error: ${errorOutput}`);
        return reject(new Error(`FFmpeg failed with code ${code}`));
      }

      // Get the duration of the output video
      const ffprobePath = getFfprobePath();
      const ffprobe = spawn(ffprobePath, [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        videoPath
      ]);
      // ffprobe duration here is best-effort; a spawn failure should not crash the server.
      ffprobe.on('error', () => resolve({ width: 256, height: 144, fps: 15, duration: null }));

      let durationOutput = '';

      ffprobe.stdout.on('data', (data) => {
        durationOutput += data.toString();
      });

      ffprobe.on('close', (probeCode) => {
        if (probeCode !== 0) {
          console.warn('[CONVERT-AUDIO] Could not get duration, using default');
          // Return without duration if ffprobe fails
          return resolve({
            width: 256,
            height: 144,
            fps: 15,
            duration: null
          });
        }

        const duration = parseFloat(durationOutput.trim());

        resolve({
          width: 256,
          height: 144,
          fps: 15,
          duration: isNaN(duration) ? null : duration
        });
      });
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      ffmpeg.kill();
      reject(new Error('Audio to video conversion timeout'));
    }, 300000);
  });
}

module.exports = { convertAudioToVideo };
