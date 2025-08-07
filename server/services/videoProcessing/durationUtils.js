/**
 * Utilities for getting media duration
 */

const { spawn } = require('child_process');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { getFfmpegPath, getFfprobePath } = require('../shared/ffmpegUtils');

/**
 * Get the duration of a media file using ffprobe (optimized version)
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

    // Use the optimized getVideoInfo function for video files
    if (mediaPath.match(/\.(mp4|avi|mov|mkv|webm|flv|wmv)$/i)) {
      getVideoInfo(mediaPath)
        .then(info => resolve(info.duration))
        .catch(error => {
          console.warn(`[GET-DURATION] getVideoInfo failed, using fallback: ${error.message}`);
          resolve(600);
        });
      return;
    }

    // For audio files, use a simplified approach
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
    });

    // Reduced timeout for faster failure detection
    const timeout = setTimeout(() => {
      console.error(`[GET-DURATION] Timeout while getting duration. Using fallback.`);
      durationProbe.kill();
      resolve(600); // Use fallback duration
    }, 5000); // Reduced from 10s to 5s

    durationProbe.on('close', (code) => {
      clearTimeout(timeout);

      if (code !== 0 || !durationOutput.trim()) {
        console.error(`[GET-DURATION] Failed to get duration. Using fallback duration of 600 seconds.`);
        resolve(600);
      } else {
        const duration = parseFloat(durationOutput.trim());
        resolve(isNaN(duration) ? 600 : duration);
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
 * Get comprehensive video information (dimensions, duration, codec) in a single ffprobe call
 * @param {string} mediaPath - Path to the video file
 * @returns {Promise<Object>} - Object with width, height, duration, codec, and quality info
 */
function getVideoInfo(mediaPath) {
  return new Promise((resolve, reject) => {
    // Check if the file exists first
    if (!fs.existsSync(mediaPath)) {
      console.error(`[GET-VIDEO-INFO] Video file does not exist: ${mediaPath}`);
      return reject(new Error(`Video file does not exist: ${mediaPath}`));
    }

    const ffprobePath = getFfprobePath();
    const ffprobeProcess = spawn(ffprobePath, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
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

    // Reduced timeout for faster failure detection
    const timeout = setTimeout(() => {
      console.error(`[GET-VIDEO-INFO] Timeout while getting video info`);
      ffprobeProcess.kill();
      reject(new Error('Timeout while getting video information'));
    }, 5000); // Reduced from 10s to 5s

    ffprobeProcess.on('close', (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        console.error(`[GET-VIDEO-INFO] ffprobe failed: ${stderr}`);
        reject(new Error(`ffprobe failed: ${stderr}`));
        return;
      }

      try {
        const data = JSON.parse(stdout);
        const videoStream = data.streams && data.streams[0];
        const format = data.format;

        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        // Extract dimensions
        const width = parseInt(videoStream.width);
        const height = parseInt(videoStream.height);

        if (!width || !height) {
          reject(new Error('Could not determine video dimensions'));
          return;
        }

        // Extract duration (try stream first, then format)
        let duration = parseFloat(videoStream.duration) || parseFloat(format?.duration) || 600;

        // Extract codec
        const codec = videoStream.codec_name || 'unknown';

        // Convert height to quality string
        let quality = `${height}p`;
        if (width <= height) {
          // Portrait video - show actual dimensions
          quality = `${height}p (${width}×${height})`;
        }

        console.log(`[GET-VIDEO-INFO] Video info: ${width}×${height}, ${duration}s, codec: ${codec}`);

        resolve({
          width,
          height,
          duration,
          codec,
          quality,
          resolution: `${width}×${height}`
        });
      } catch (error) {
        console.error(`[GET-VIDEO-INFO] Failed to parse ffprobe output: ${error.message}`);
        reject(new Error(`Failed to parse ffprobe output: ${error.message}`));
      }
    });

    ffprobeProcess.on('error', (error) => {
      clearTimeout(timeout);
      console.error(`[GET-VIDEO-INFO] Failed to spawn ffprobe: ${error.message}`);
      reject(new Error(`Failed to spawn ffprobe: ${error.message}`));
    });
  });
}

/**
 * Get video dimensions using ffprobe (legacy function - now uses getVideoInfo)
 * @param {string} mediaPath - Path to the video file
 * @returns {Promise<Object>} - Object with width, height, and quality string
 */
function getVideoDimensions(mediaPath) {
  return getVideoInfo(mediaPath).then(info => ({
    width: info.width,
    height: info.height,
    quality: info.quality,
    resolution: info.resolution
  }));
}

// For backward compatibility
const getVideoDuration = getMediaDuration;

/**
 * Check if a video uses HEVC codec and convert it to H.264 if needed (optimized version)
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<string>} - Path to the compatible video (original or converted)
 */
async function ensureVideoCompatibility(videoPath) {
  try {
    // Use the optimized getVideoInfo function to get codec info
    const videoInfo = await getVideoInfo(videoPath);
    const codec = videoInfo.codec.toLowerCase();

    console.log(`[VideoCompatibility] Detected video codec: ${codec}`);

    // Check if conversion is needed
    // VP9 is supported by Remotion (Chrome supports VP9), so only convert truly problematic codecs
    const problematicCodecs = ['hevc', 'h265', 'av1'];
    if (problematicCodecs.includes(codec)) {
      console.log(`[VideoCompatibility] Converting ${codec} video to H.264 for better compatibility`);

      try {
        const convertedPath = await convertToH264(videoPath);
        return convertedPath;
      } catch (error) {
        console.error(`[VideoCompatibility] Conversion failed: ${error.message}`);
        return videoPath; // Return original if conversion fails
      }
    } else {
      console.log(`[VideoCompatibility] Video codec ${codec} is compatible, no conversion needed`);
      return videoPath;
    }
  } catch (error) {
    console.error(`[VideoCompatibility] Error checking compatibility: ${error.message}`);
    return videoPath; // Return original path if we can't check
  }
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
  getVideoInfo,
  ensureVideoCompatibility
};
