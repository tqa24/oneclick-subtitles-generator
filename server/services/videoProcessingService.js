/**
 * Media (video and audio) processing functionality
 */

const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

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
        console.log(`[GET-DURATION] Using fallback duration for cached file: 600 seconds`);
        return resolve(600);
      }
      return reject(new Error(`Media file does not exist: ${mediaPath}`));
    }

    // Check file size
    const fileSize = fs.statSync(mediaPath).size;
    console.log(`[GET-DURATION] Getting duration for: ${mediaPath}`);
    console.log(`[GET-DURATION] File size: ${fileSize} bytes`);

    // If file is too small, it might be corrupted
    if (fileSize < 1000) { // Less than 1KB
      console.warn(`[GET-DURATION] File is very small (${fileSize} bytes), might be corrupted`);
      console.log(`[GET-DURATION] Using fallback duration: 600 seconds`);
      return resolve(600);
    }

    // Try to get duration using format information first
    const durationProbe = spawn('ffprobe', [
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
        console.log(`[GET-DURATION] Trying alternative method with stream information...`);

        // Try alternative method using stream information
        const streamProbe = spawn('ffprobe', [
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
            console.log(`[GET-DURATION] Trying final method with ffmpeg frame analysis...`);
            const frameProbe = spawn('ffmpeg', [
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
                console.log(`[GET-DURATION] Got duration from frame analysis: ${totalSeconds} seconds`);
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
            console.log(`[GET-DURATION] Got duration from stream info: ${duration} seconds`);
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
        console.log(`[GET-DURATION] Got duration from format info: ${duration} seconds`);
        resolve(duration);
      }
    });

    durationProbe.on('error', (err) => {
      clearTimeout(timeout);
      console.error(`[GET-DURATION] Error: ${err.message}`);

      // For cached files, use a fallback duration instead of failing
      if (mediaPath.includes('cache') || mediaPath.includes('videos')) {
        console.log(`[GET-DURATION] Using fallback duration after error: 600 seconds`);
        resolve(600);
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Split a media file (video or audio) into segments using ffmpeg
 * @param {string} mediaPath - Path to the media file
 * @param {number} segmentDuration - Duration of each segment in seconds
 * @param {string} outputDir - Directory to save segments
 * @param {string} filePrefix - Prefix for segment filenames
 * @param {Object} options - Additional options
 * @param {boolean} options.fastSplit - If true, uses stream copy instead of re-encoding
 * @param {string} options.mediaType - Type of media ('video' or 'audio')
 * @returns {Promise<Object>} - Result object with segments array
 */
async function splitMediaIntoSegments(mediaPath, segmentDuration, outputDir, filePrefix, options = {}) {
  // Default to video if mediaType not specified
  const mediaType = options.mediaType || 'video';
  const isAudio = mediaType === 'audio';
  const outputExtension = isAudio ? 'mp3' : 'mp4';
  return new Promise(async (resolve, reject) => {
    const timestamp = Date.now();
    const safePrefix = filePrefix.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 20);
    const batchId = `${safePrefix}_${timestamp}`;

    // First, validate the media file exists and is accessible
    try {
      // Check if the file exists
      if (!fs.existsSync(mediaPath)) {
        console.error(`[SPLIT-MEDIA] Media file does not exist: ${mediaPath}`);
        return reject(new Error(`Media file does not exist: ${mediaPath}`));
      }

      // Check file size to ensure it's not empty or corrupted
      const fileStats = fs.statSync(mediaPath);
      if (fileStats.size < 1000) { // Less than 1KB
        console.error(`[SPLIT-MEDIA] Media file is too small (${fileStats.size} bytes), might be corrupted: ${mediaPath}`);
        return reject(new Error(`Media file is too small or corrupted: ${mediaPath}`));
      }

      console.log(`[SPLIT-MEDIA] Media file validated: ${mediaPath}, size: ${fileStats.size} bytes`);

      // Get the duration of the media file using our more robust getMediaDuration function
      console.log(`[SPLIT-MEDIA] Getting duration for media file: ${mediaPath}`);
      const totalDuration = await getMediaDuration(mediaPath);
      console.log(`[SPLIT-MEDIA] ${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} duration: ${totalDuration} seconds`);

      const numSegments = Math.ceil(totalDuration / segmentDuration);
      console.log(`Splitting ${mediaType} into ${numSegments} segments of ${segmentDuration} seconds each`);

      const outputPattern = path.join(outputDir, `${batchId}_%03d.${outputExtension}`);

      // Double-check the file path before proceeding
      if (!fs.existsSync(mediaPath)) {
        console.error(`[SPLIT-MEDIA] Media file disappeared before splitting: ${mediaPath}`);
        return reject(new Error(`Media file not found before splitting: ${mediaPath}`));
      }

      // Log the absolute file path for debugging
      const absolutePath = path.resolve(mediaPath);
      console.log(`[SPLIT-MEDIA] Using absolute path for ffmpeg: ${absolutePath}`);

      // Construct ffmpeg command based on splitting mode
      const ffmpegArgs = [
        '-i', absolutePath, // Use absolute path to avoid any path resolution issues
        '-f', 'segment',
        '-segment_time', segmentDuration.toString(),
        '-reset_timestamps', '1'
      ];

      // If fast split is enabled, use stream copy instead of re-encoding
      if (options.fastSplit) {
        // When using stream copy, we need to be careful about keyframes
        // Add segment_time_delta to allow some flexibility in segment boundaries
        ffmpegArgs.push(
          '-segment_time_delta', '1.0',  // Allow 1 second flexibility
          '-c', 'copy'
        );
        console.log('Using fast split mode with stream copy');
      } else if (isAudio) {
        // For audio, use high-quality audio encoding
        ffmpegArgs.push(
          '-c:a', 'libmp3lame',
          '-q:a', '2', // High quality (0 is best, 9 is worst)
          '-threads', '0'
        );
        console.log('Using audio encoding mode');
      } else {
        // For video, use high-performance encoding settings
        ffmpegArgs.push(
          '-c:v', 'libx264',
          '-preset', 'faster', // Use faster preset for better performance
          '-c:a', 'aac',
          '-force_key_frames', `expr:gte(t,n_forced*${segmentDuration})`, // Force keyframe at segment boundaries
          '-threads', '0'
        );
        console.log('Using re-encoding mode with forced keyframes');
      }

      ffmpegArgs.push(outputPattern);

      const segmentCmd = spawn('ffmpeg', ffmpegArgs);
      const segments = [];

      segmentCmd.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('frame=')) {
          process.stdout.write('.');
        }
        console.log('ffmpeg stderr:', output);
      });

      segmentCmd.on('close', async (code) => {
        if (code !== 0) {
          return reject(new Error(`Failed to split ${mediaType}`));
        }

        // Read the created segments
        fs.readdir(outputDir, async (err, files) => {
          if (err) return reject(err);

          const segmentFiles = files
            .filter(file => file.startsWith(batchId))
            .sort((a, b) => {
              // Use a regex that works for both mp3 and mp4 files
              const aMatch = a.match(/(\d+)\.(mp[34])$/);
              const bMatch = b.match(/(\d+)\.(mp[34])$/);
              if (!aMatch || !bMatch) return 0;
              const aIndex = parseInt(aMatch[1]);
              const bIndex = parseInt(bMatch[1]);
              return aIndex - bIndex;
            });

          // Get actual durations for all segments
          let cumulativeStartTime = 0;
          const segmentPromises = segmentFiles.map(async (file, index) => {
            const filePath = path.join(outputDir, file);
            // Get actual duration using ffprobe
            const actualDuration = await getMediaDuration(filePath);

            // Calculate start time based on previous segments' actual durations
            const startTime = cumulativeStartTime;
            // Update cumulative start time for next segment
            cumulativeStartTime += actualDuration;

            // For the last segment, use the actual duration
            // For other segments, use the actual measured duration
            return {
              index,
              path: filePath,
              url: `/videos/${file}`,
              startTime,
              duration: actualDuration,
              // Keep the theoretical values for reference
              theoreticalStartTime: index * segmentDuration,
              theoreticalDuration: index < numSegments - 1 ?
                segmentDuration :
                totalDuration - (index * segmentDuration)
            };
          });

          try {
            // Wait for all duration checks to complete
            let segmentResults = await Promise.all(segmentPromises);

            // Log the initial segment information
            console.log('Initial segment information:');
            segmentResults.forEach((segment, i) => {
              console.log(`Segment ${i} (file index ${segment.index}): startTime=${segment.startTime.toFixed(2)}s, duration=${segment.duration.toFixed(2)}s, endTime=${(segment.startTime + segment.duration).toFixed(2)}s`);
            });

            // Check if segments are in the correct order by start time
            // This is important when using stream-copy mode, which can split at unexpected points
            const isOutOfOrder = segmentResults.some((segment, i) => {
              if (i === 0) return false;
              const isWrongOrder = segment.startTime < segmentResults[i-1].startTime;
              if (isWrongOrder) {
                console.log(`Segment order issue detected: Segment ${i} starts at ${segment.startTime.toFixed(2)}s which is before segment ${i-1} at ${segmentResults[i-1].startTime.toFixed(2)}s`);
              }
              return isWrongOrder;
            });

            if (isOutOfOrder) {
              console.log('WARNING: Segments are out of order by start time. Reordering...');

              // Sort segments by their file index first (this should be the intended order)
              segmentResults.sort((a, b) => a.index - b.index);

              // Recalculate start times based on the correct order
              let newCumulativeStartTime = 0;
              segmentResults = segmentResults.map((segment, i) => {
                const newStartTime = newCumulativeStartTime;
                newCumulativeStartTime += segment.duration;

                return {
                  ...segment,
                  startTime: newStartTime,
                  // Update theoretical values too
                  theoreticalStartTime: i * segmentDuration,
                  theoreticalDuration: i < numSegments - 1 ?
                    segmentDuration :
                    totalDuration - (i * segmentDuration)
                };
              });

              // Log the reordered segment information
              console.log('Segments reordered by file index. New segment information:');
              segmentResults.forEach((segment, i) => {
                console.log(`Segment ${i} (file index ${segment.index}): startTime=${segment.startTime.toFixed(2)}s, duration=${segment.duration.toFixed(2)}s, endTime=${(segment.startTime + segment.duration).toFixed(2)}s`);
              });
            }

            segments.push(...segmentResults);
            resolve({ segments, batchId });
          } catch (error) {
            reject(new Error(`Failed to get segment durations: ${error.message}`));
          }
        });
      });

      segmentCmd.stderr.on('data', (data) => {
        console.error(`ffmpeg stderr: ${data}`);
      });

      segmentCmd.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      console.error(`[SPLIT-MEDIA] Error getting media duration: ${error.message}`);
      reject(error);
    }
  });
}

// For backward compatibility
const splitVideoIntoSegments = (videoPath, segmentDuration, outputDir, filePrefix, options = {}) => {
  return splitMediaIntoSegments(videoPath, segmentDuration, outputDir, filePrefix, { ...options, mediaType: 'video' });
};

// For backward compatibility
const getVideoDuration = getMediaDuration;

/**
 * Optimize a video by scaling it to a lower resolution and reducing the frame rate
 * @param {string} videoPath - Path to the input video file
 * @param {string} outputPath - Path to save the optimized video
 * @param {Object} options - Optimization options
 * @param {string} options.resolution - Target resolution (e.g., '360p', '240p')
 * @param {number} options.fps - Target frame rate (default: 15)
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

      console.log(`[OPTIMIZE-VIDEO] Input video file validated: ${videoPath}, size: ${fileStats.size} bytes`);

      // Make sure the output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        console.log(`[OPTIMIZE-VIDEO] Creating output directory: ${outputDir}`);
        fs.mkdirSync(outputDir, { recursive: true });
      }
      // Set default options
      const resolution = options.resolution || '360p';
      const fps = options.fps || 15;

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
      console.log(`Source video resolution: ${sourceWidth}x${sourceHeight}`);

      // Only optimize if the source resolution is higher than the target resolution
      // For 360p, that means height > 360
      if (sourceHeight <= targetHeight) {
        console.log(`Video resolution (${sourceWidth}x${sourceHeight}) is already ${sourceHeight}p or lower. Skipping optimization.`);

        // Return the original video path and metadata
        const duration = await getMediaDuration(videoPath);
        resolve({
          path: videoPath,
          duration,
          resolution: `${sourceHeight}p`,
          fps,
          width: sourceWidth,
          height: sourceHeight,
          optimized: false
        });
        return;
      }

      console.log(`Optimizing video to ${resolution} (${targetWidth}x${targetHeight}) at ${fps}fps`);

      // Construct ffmpeg command for optimization
      const ffmpegArgs = [
        '-hwaccel', 'auto',
        '-i', videoPath,
        '-vf', `scale=${targetWidth}:${targetHeight}`,
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

      const optimizeCmd = spawn('ffmpeg', ffmpegArgs);

      optimizeCmd.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('frame=')) {
          process.stdout.write('.');
        }
        console.log('ffmpeg stderr:', output);
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

          console.log(`[OPTIMIZE-VIDEO] Output file validated: ${outputPath}, size: ${outputStats.size} bytes`);

          // Get the duration of the optimized video
          const duration = await getMediaDuration(outputPath);

          resolve({
            path: outputPath,
            duration,
            resolution,
            fps,
            width: targetWidth,
            height: targetHeight,
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
      console.log(`Video frame count: ${frameCount}`);
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
      console.log(`Video resolution: ${width}x${height}`);
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
        console.log('[ANALYSIS-VIDEO] Video has 500 or fewer frames, using optimized video for analysis');
        console.log(`[ANALYSIS-VIDEO] Frame count: ${frameCount}, path: ${videoPath}`);
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
      console.log(`[ANALYSIS-VIDEO] Creating analysis video with 500 frames from ${frameCount} frames (interval: ${frameInterval.toFixed(2)})`);
      console.log(`[ANALYSIS-VIDEO] Input path: ${videoPath}`);
      console.log(`[ANALYSIS-VIDEO] Output path: ${outputPath}`);

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

      const analysisCmd = spawn('ffmpeg', ffmpegArgs);

      analysisCmd.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('frame=')) {
          process.stdout.write('.');
        }
        console.log('ffmpeg stderr:', output);
      });

      analysisCmd.on('close', async (code) => {
        if (code !== 0) {
          return reject(new Error('Failed to create analysis video'));
        }

        try {
          // Get the duration of the analysis video
          const analysisDuration = await getMediaDuration(outputPath);
          const analysisFrameCount = await getVideoFrameCount(outputPath);

          console.log(`[ANALYSIS-VIDEO] Successfully created analysis video with ${analysisFrameCount} frames`);
          console.log(`[ANALYSIS-VIDEO] Analysis video duration: ${analysisDuration.toFixed(2)}s`);
          console.log(`[ANALYSIS-VIDEO] Analysis video path: ${outputPath}`);

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
      console.log(`[AUDIO-TO-VIDEO] Converting audio file to video. Duration: ${duration.toFixed(2)}s`);
      console.log(`[AUDIO-TO-VIDEO] Input path: ${audioPath}`);
      console.log(`[AUDIO-TO-VIDEO] Output path: ${outputPath}`);

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
        console.log('ffmpeg stderr:', output);
      });

      convertCmd.on('close', async (code) => {
        if (code !== 0) {
          return reject(new Error('Failed to convert audio to video'));
        }

        try {
          // Get the duration of the created video
          const videoDuration = await getMediaDuration(outputPath);

          console.log(`[AUDIO-TO-VIDEO] Successfully converted audio to video`);
          console.log(`[AUDIO-TO-VIDEO] Video duration: ${videoDuration.toFixed(2)}s`);
          console.log(`[AUDIO-TO-VIDEO] Video path: ${outputPath}`);

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
  splitVideoIntoSegments,
  splitMediaIntoSegments,
  getVideoDuration,
  getMediaDuration,
  optimizeVideo,
  createAnalysisVideo,
  getVideoFrameCount,
  getVideoResolution,
  convertAudioToVideo
};


