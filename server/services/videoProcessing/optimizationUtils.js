/**
 * Utilities for optimizing video files
 */

const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const { getMediaDuration } = require('./durationUtils');
const { getVideoResolution, getVideoFrameCount } = require('./resolutionUtils');
const { getFfmpegPath } = require('../shared/ffmpegUtils');

/**
 * Optimize a video by scaling it to a lower resolution and reducing the frame rate
 * @param {string} videoPath - Path to the input video file
 * @param {string} outputPath - Path to save the optimized video
 * @param {Object} options - Optimization options
 * @param {string} options.resolution - Target resolution (e.g., '360p', '240p')
 * @param {number} options.fps - Target frame rate (default: 1 for Gemini optimization)
 * @returns {Promise<Object>} - Result object with optimized video path and metadata
 */
function optimizeVideo(videoPath, outputPath, options = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      // Check if the input file exists
      if (!fs.existsSync(videoPath)) {
        console.error(`[OPTIMIZE-VIDEO] Input video file does not exist: ${videoPath}`);
        return reject(new Error(`Input video file does not exist: ${videoPath}`));
      }

      // Check file size to ensure it's not empty or corrupted
      const fileStats = fs.statSync(videoPath);
      if (fileStats.size < 1000) { // Less than 1KB
        console.error(`[OPTIMIZE-VIDEO] Input video file is too small (${fileStats.size} bytes), might be corrupted: ${videoPath}`);
        return reject(new Error(`Input video file is too small or corrupted: ${videoPath}`));
      }



      // Make sure the output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {

        fs.mkdirSync(outputDir, { recursive: true });
      }
      // Set default options
      const resolution = options.resolution || '360p';
      // Use 1 FPS for Gemini optimization since Gemini only processes 1 frame per second
      const fps = options.fps || 1;

      // Map resolution string to actual dimensions
      let targetWidth, targetHeight;
      switch (resolution) {
        case '240p':
          targetWidth = 426;
          targetHeight = 240;
          break;
        case '360p':
        default:
          targetWidth = 640;
          targetHeight = 360;
          break;
      }

      // Get the current video resolution
      const { width: sourceWidth, height: sourceHeight } = await getVideoResolution(videoPath);


      // Always optimize for frame rate reduction to 1 FPS, even if resolution is already at target
      // This is important because most videos have much higher frame rates (24-60 FPS)
      // and Gemini only processes 1 FPS, so we can significantly reduce file size and upload time
      // Example: A 360p video at 30 FPS becomes 30x smaller when reduced to 1 FPS
      console.log(`[OPTIMIZE-VIDEO] Source resolution: ${sourceWidth}x${sourceHeight}, Target: ${targetWidth}x${targetHeight}`);

      // If resolution is already at or below target, we still optimize for frame rate
      // but use the original resolution to avoid upscaling
      let finalWidth = targetWidth;
      let finalHeight = targetHeight;

      if (sourceHeight <= targetHeight) {
        finalWidth = sourceWidth;
        finalHeight = sourceHeight;
        console.log(`[OPTIMIZE-VIDEO] Using original resolution ${sourceWidth}x${sourceHeight} (already at target), optimizing frame rate only`);
      }



      // Log optimization parameters for verification
      console.log(`[OPTIMIZE-VIDEO] Optimizing video with FPS: ${fps}, Resolution: ${finalWidth}x${finalHeight}`);

      // Construct ffmpeg command for optimization
      const ffmpegArgs = [
        '-hwaccel', 'auto',
        '-i', videoPath,
        '-vf', `scale=${finalWidth}:${finalHeight}`,
        '-r', fps.toString(),
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '28',
        '-tune', 'fastdecode',
        '-c:a', 'aac',
        '-b:a', '64k',          // Reduced from 128k to 32k
        '-ac', '1',             // Mono audio
        '-ar', '22050',         // Lowest reasonable sample rate
        '-movflags', '+faststart',
        '-threads', '0',
        '-y',  // Overwrite output file if it exists
        outputPath
      ];

      const ffmpegPath = getFfmpegPath();
      const optimizeCmd = spawn(ffmpegPath, ffmpegArgs);

      optimizeCmd.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('frame=')) {
          process.stdout.write('.');
        }

      });

      optimizeCmd.on('close', async (code) => {
        if (code !== 0) {
          return reject(new Error('Failed to optimize video'));
        }

        try {
          // Verify the output file was actually created
          if (!fs.existsSync(outputPath)) {
            console.error(`[OPTIMIZE-VIDEO] Output file was not created: ${outputPath}`);
            return reject(new Error(`Output file was not created: ${outputPath}`));
          }

          // Check file size to ensure it's not empty or corrupted
          const outputStats = fs.statSync(outputPath);
          if (outputStats.size < 1000) { // Less than 1KB
            console.error(`[OPTIMIZE-VIDEO] Output file is too small (${outputStats.size} bytes), might be corrupted: ${outputPath}`);
            return reject(new Error(`Output file is too small or corrupted: ${outputPath}`));
          }



          // Get the duration of the optimized video
          const duration = await getMediaDuration(outputPath);

          resolve({
            path: outputPath,
            duration,
            resolution: `${finalHeight}p`,
            fps,
            width: finalWidth,
            height: finalHeight,
            optimized: true
          });
        } catch (error) {
          reject(new Error(`Failed to get optimized video duration: ${error.message}`));
        }
      });

      optimizeCmd.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Create a smaller video for analysis by extracting 500 frames from the optimized video
 * @param {string} videoPath - Path to the optimized video file
 * @param {string} outputPath - Path to save the analysis video
 * @returns {Promise<Object>} - Result object with analysis video path and metadata
 */
function createAnalysisVideo(videoPath, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      // Get the total frame count and duration of the optimized video
      const frameCount = await getVideoFrameCount(videoPath);
      const duration = await getMediaDuration(videoPath);

      // Only create analysis video if the frame count is greater than 500
      if (frameCount <= 500) {


        resolve({
          path: videoPath,
          duration,
          frameCount,
          isOriginal: true
        });
        return;
      }

      // Calculate the frame selection interval to get exactly 500 frames
      const frameInterval = frameCount / 500;




      // Construct ffmpeg command to select frames and maintain audio
      const ffmpegArgs = [
        '-hwaccel', 'auto',
        '-i', videoPath,
        '-vf', `select='not(mod(n,${Math.round(frameInterval)}))',setpts=N/TB`,
        '-af', 'asetpts=N/SR/TB',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '30',
        '-tune', 'fastdecode',
        '-c:a', 'aac',
        '-b:a', '64k',
        '-ac', '1',
        '-ar', '22050',
        '-threads', '0',
        '-y',
        outputPath
      ];

      const ffmpegPath = getFfmpegPath();
      const analysisCmd = spawn(ffmpegPath, ffmpegArgs);

      analysisCmd.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('frame=')) {
          process.stdout.write('.');
        }

      });

      analysisCmd.on('close', async (code) => {
        if (code !== 0) {
          return reject(new Error('Failed to create analysis video'));
        }

        try {
          // Get the duration of the analysis video
          const analysisDuration = await getMediaDuration(outputPath);
          const analysisFrameCount = await getVideoFrameCount(outputPath);





          resolve({
            path: outputPath,
            duration: analysisDuration,
            frameCount: analysisFrameCount,
            originalFrameCount: frameCount,
            frameInterval
          });
        } catch (error) {
          reject(new Error(`Failed to get analysis video metadata: ${error.message}`));
        }
      });

      analysisCmd.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  optimizeVideo,
  createAnalysisVideo
};
