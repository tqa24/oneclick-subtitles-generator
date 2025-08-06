/**
 * Utilities for getting media duration
 */

const { spawn } = require('child_process');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { getFfmpegPath, getFfprobePath } = require('../shared/ffmpegUtils');

/**
 * Get the duration of a media file using ffprobe
 * @param {string} mediaPath - Path to the media file
 * @returns {Promise<number>} - Duration in seconds
 */
function getMediaDuration(mediaPath) {
  return new Promise((resolve, reject) => {
    // Check if the file exists first
    if (!fs.existsSync(mediaPath)) {
      console.error(`[GET-DURATION] Media file does not exist: ${mediaPath}`);
      // For cached files, use a fallback duration instead of failing
      if (mediaPath.includes('cache') || mediaPath.includes('videos')) {

        return resolve(600);
      }
      return reject(new Error(`Media file does not exist: ${mediaPath}`));
    }

    // Check file size
    const fileSize = fs.statSync(mediaPath).size;



    // If file is too small, it might be corrupted
    if (fileSize < 1000) { // Less than 1KB
      console.warn(`[GET-DURATION] File is very small (${fileSize} bytes), might be corrupted`);

      return resolve(600);
    }

    // Try to get duration using format information first
    const ffprobePath = getFfprobePath();
    const durationProbe = spawn(ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      mediaPath
    ]);

    let durationOutput = '';
    let errorOutput = '';

    durationProbe.stdout.on('data', (data) => {
      durationOutput += data.toString();
    });

    durationProbe.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(`[GET-DURATION] ffprobe stderr: ${data}`);
    });

    // Set a timeout to prevent hanging
    const timeout = setTimeout(() => {
      console.error(`[GET-DURATION] Timeout while getting duration. Using fallback.`);
      durationProbe.kill();
      resolve(600); // Use fallback duration
    }, 10000); // 10 second timeout

    durationProbe.on('close', (code) => {
      clearTimeout(timeout); // Clear the timeout

      if (code !== 0 || !durationOutput.trim()) {
        console.error(`[GET-DURATION] Failed to get duration from format. Error code: ${code}`);
        console.error(`[GET-DURATION] Error output: ${errorOutput}`);


        // Try alternative method using stream information
        const streamProbe = spawn(ffprobePath, [
          '-v', 'error',
          '-select_streams', 'v:0',
          '-show_entries', 'stream=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1',
          mediaPath
        ]);

        let streamDurationOutput = '';
        let streamErrorOutput = '';

        streamProbe.stdout.on('data', (data) => {
          streamDurationOutput += data.toString();
        });

        streamProbe.stderr.on('data', (data) => {
          streamErrorOutput += data.toString();
          console.error(`[GET-DURATION] Alternative ffprobe stderr: ${data}`);
        });

        // Set a timeout for the alternative method
        const streamTimeout = setTimeout(() => {
          console.error(`[GET-DURATION] Timeout in alternative method. Using fallback.`);
          streamProbe.kill();
          resolve(600); // Use fallback duration
        }, 10000); // 10 second timeout

        streamProbe.on('close', (streamCode) => {
          clearTimeout(streamTimeout); // Clear the timeout

          if (streamCode !== 0 || !streamDurationOutput.trim()) {
            console.error(`[GET-DURATION] Both methods failed. Using fallback duration of 600 seconds.`);
            console.error(`[GET-DURATION] Alternative method error code: ${streamCode}`);
            console.error(`[GET-DURATION] Alternative method error output: ${streamErrorOutput}`);

            // Try one more method - using ffmpeg to analyze frames
            const ffmpegPath = getFfmpegPath();
            const frameProbe = spawn(ffmpegPath, [
              '-i', mediaPath,
              '-f', 'null',
              '-hide_banner',
              '-loglevel', 'info',
              '-'  // Output to null
            ]);

            let frameOutput = '';

            frameProbe.stderr.on('data', (data) => {
              frameOutput += data.toString();
            });

            // Set a timeout for the final method
            const frameTimeout = setTimeout(() => {
              console.error(`[GET-DURATION] Timeout in final method. Using fallback.`);
              frameProbe.kill();
              resolve(600); // Use fallback duration
            }, 15000); // 15 second timeout

            frameProbe.on('close', (frameCode) => {
              clearTimeout(frameTimeout); // Clear the timeout

              // Try to extract duration from ffmpeg output
              const durationMatch = frameOutput.match(/Duration: (\d+):(\d+):(\d+\.\d+)/i);
              if (frameCode === 0 && durationMatch) {
                const hours = parseInt(durationMatch[1]);
                const minutes = parseInt(durationMatch[2]);
                const seconds = parseFloat(durationMatch[3]);
                const totalSeconds = hours * 3600 + minutes * 60 + seconds;

                resolve(totalSeconds);
              } else {
                console.error(`[GET-DURATION] All methods failed. Using fallback duration of 600 seconds.`);
                // Use a fallback duration of 10 minutes (600 seconds)
                // This allows processing to continue even if we can't determine the exact duration
                resolve(600);
              }
            });

            frameProbe.on('error', (err) => {
              clearTimeout(frameTimeout);
              console.error(`[GET-DURATION] Final method error: ${err.message}`);
              // Use fallback duration
              resolve(600);
            });
          } else {
            const duration = parseFloat(streamDurationOutput.trim());

            resolve(duration);
          }
        });

        streamProbe.on('error', (err) => {
          clearTimeout(streamTimeout);
          console.error(`[GET-DURATION] Alternative method error: ${err.message}`);
          // Use fallback duration
          resolve(600);
        });

      } else {
        const duration = parseFloat(durationOutput.trim());

        resolve(duration);
      }
    });

    durationProbe.on('error', (err) => {
      clearTimeout(timeout);
      console.error(`[GET-DURATION] Error: ${err.message}`);

      // For cached files, use a fallback duration instead of failing
      if (mediaPath.includes('cache') || mediaPath.includes('videos')) {

        resolve(600);
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Get video dimensions using ffprobe
 * @param {string} mediaPath - Path to the video file
 * @returns {Promise<Object>} - Object with width, height, and quality string
 */
function getVideoDimensions(mediaPath) {
  return new Promise((resolve, reject) => {
    // Check if the file exists first
    if (!fs.existsSync(mediaPath)) {
      console.error(`[GET-DIMENSIONS] Video file does not exist: ${mediaPath}`);
      return reject(new Error(`Video file does not exist: ${mediaPath}`));
    }

    const ffprobePath = getFfprobePath();
    const ffprobeProcess = spawn(ffprobePath, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-select_streams', 'v:0',
      mediaPath
    ]);

    let stdout = '';
    let stderr = '';

    ffprobeProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobeProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Set a timeout to prevent hanging
    const timeout = setTimeout(() => {
      console.error(`[GET-DIMENSIONS] Timeout while getting dimensions`);
      ffprobeProcess.kill();
      reject(new Error('Timeout while getting video dimensions'));
    }, 10000); // 10 second timeout

    ffprobeProcess.on('close', (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        console.error(`[GET-DIMENSIONS] ffprobe failed: ${stderr}`);
        reject(new Error(`ffprobe failed: ${stderr}`));
        return;
      }

      try {
        const data = JSON.parse(stdout);
        const videoStream = data.streams && data.streams[0];

        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        const width = parseInt(videoStream.width);
        const height = parseInt(videoStream.height);

        if (!width || !height) {
          reject(new Error('Could not determine video dimensions'));
          return;
        }

        // Convert height to quality string
        let quality = `${height}p`;

        // Handle common aspect ratios and special cases
        if (width > height) {
          // Landscape video
          quality = `${height}p`;
        } else {
          // Portrait video (common for TikTok, Instagram Stories) - show actual dimensions
          quality = `${height}p (${width}×${height})`;
        }

        console.log(`[GET-DIMENSIONS] Video dimensions: ${width}×${height} (${quality})`);

        resolve({
          width,
          height,
          quality,
          resolution: `${width}×${height}`
        });
      } catch (error) {
        console.error(`[GET-DIMENSIONS] Failed to parse ffprobe output: ${error.message}`);
        reject(new Error(`Failed to parse ffprobe output: ${error.message}`));
      }
    });

    ffprobeProcess.on('error', (error) => {
      clearTimeout(timeout);
      console.error(`[GET-DIMENSIONS] Failed to spawn ffprobe: ${error.message}`);
      reject(new Error(`Failed to spawn ffprobe: ${error.message}`));
    });
  });
}

// For backward compatibility
const getVideoDuration = getMediaDuration;

/**
 * Check if a video uses HEVC codec and convert it to H.264 if needed
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<string>} - Path to the compatible video (original or converted)
 */
async function ensureVideoCompatibility(videoPath) {
  return new Promise((resolve, reject) => {
    // First, check the video codec
    const ffprobeArgs = [
      '-v', 'quiet',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name',
      '-of', 'csv=p=0',
      videoPath
    ];

    const ffprobePath = getFfprobePath();
    const ffprobe = spawn(ffprobePath, ffprobeArgs);
    let stdout = '';
    let stderr = '';

    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobe.on('close', async (code) => {
      if (code !== 0) {
        console.error(`[VideoCompatibility] FFprobe failed: ${stderr}`);
        resolve(videoPath); // Return original path if we can't check
        return;
      }

      const codec = stdout.trim().toLowerCase();
      console.log(`[VideoCompatibility] Detected video codec: ${codec}`);

      // Check if conversion is needed
      // VP9 is supported by Remotion (Chrome supports VP9), so only convert truly problematic codecs
      const problematicCodecs = ['hevc', 'h265', 'av1'];
      if (problematicCodecs.includes(codec)) {
        console.log(`[VideoCompatibility] Converting ${codec} video to H.264 for better compatibility`);

        try {
          const convertedPath = await convertToH264(videoPath);
          resolve(convertedPath);
        } catch (error) {
          console.error(`[VideoCompatibility] Conversion failed: ${error.message}`);
          resolve(videoPath); // Return original if conversion fails
        }
      } else {
        console.log(`[VideoCompatibility] Video codec ${codec} is compatible, no conversion needed`);
        resolve(videoPath);
      }
    });

    ffprobe.on('error', (error) => {
      console.error(`[VideoCompatibility] FFprobe error: ${error.message}`);
      resolve(videoPath); // Return original path if we can't check
    });
  });
}

/**
 * Convert a video to H.264 codec for better web compatibility
 * @param {string} inputPath - Path to the input video
 * @returns {Promise<string>} - Path to the converted video (same as input, file is replaced)
 */
async function convertToH264(inputPath) {
  const tempOutputPath = inputPath.replace(/\.mp4$/, '_h264_temp.mp4');

  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-i', inputPath,
      '-c:v', 'libx264',           // Convert to H.264
      '-preset', 'ultrafast',       // Fastest encoding
      '-crf', '23',                 // Good quality balance
      '-pix_fmt', 'yuv420p',        // Compatible pixel format
      '-c:a', 'copy',               // Copy audio without re-encoding to avoid issues
      '-movflags', '+faststart',    // Optimize for web
      '-avoid_negative_ts', 'make_zero', // Fix timestamp issues
      '-y',                         // Overwrite output
      tempOutputPath
    ];

    console.log(`[VideoCompatibility] Converting video: ${path.basename(inputPath)} -> H.264 (replacing original)`);

    const ffmpegPath = getFfmpegPath();
    const ffmpeg = spawn(ffmpegPath, ffmpegArgs);
    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
      // Show progress dots
      if (data.toString().includes('frame=')) {
        process.stdout.write('.');
      }
    });

    ffmpeg.on('close', async (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg conversion failed: ${stderr}`));
        return;
      }

      try {
        // Verify the temp output file exists and has content
        const stats = await fsPromises.stat(tempOutputPath);
        if (stats.size < 1000) {
          reject(new Error('Converted file is too small'));
          return;
        }

        console.log(`\n[VideoCompatibility] Conversion completed: ${stats.size} bytes`);

        // Don't replace the original file during rendering to avoid corruption
        // Instead, return the path to the converted file
        console.log(`[VideoCompatibility] Conversion completed, using converted file: ${path.basename(tempOutputPath)}`);

        resolve(tempOutputPath); // Return the converted file path
      } catch (error) {
        reject(new Error(`Failed to replace original file: ${error.message}`));
      }
    });

    ffmpeg.on('error', (error) => {
      reject(error);
    });
  });
}

module.exports = {
  getMediaDuration,
  getVideoDuration,
  getVideoDimensions,
  ensureVideoCompatibility
};
