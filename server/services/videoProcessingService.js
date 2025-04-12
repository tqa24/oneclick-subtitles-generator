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
    const durationProbe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      mediaPath
    ]);

    let durationOutput = '';

    durationProbe.stdout.on('data', (data) => {
      durationOutput += data.toString();
    });

    durationProbe.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Failed to get media duration for ${mediaPath}`));
      }

      const duration = parseFloat(durationOutput.trim());
      resolve(duration);
    });

    durationProbe.stderr.on('data', (data) => {
      console.error(`ffprobe stderr: ${data}`);
    });

    durationProbe.on('error', (err) => {
      reject(err);
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
function splitMediaIntoSegments(mediaPath, segmentDuration, outputDir, filePrefix, options = {}) {
  // Default to video if mediaType not specified
  const mediaType = options.mediaType || 'video';
  const isAudio = mediaType === 'audio';
  const outputExtension = isAudio ? 'mp3' : 'mp4';
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const safePrefix = filePrefix.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 20);
    const batchId = `${safePrefix}_${timestamp}`;

    // First, get the duration of the media file
    const durationProbe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      mediaPath
    ]);

    let durationOutput = '';

    durationProbe.stdout.on('data', (data) => {
      durationOutput += data.toString();
    });

    durationProbe.on('close', async (code) => {
      if (code !== 0) {
        return reject(new Error(`Failed to get ${mediaType} duration`));
      }

      const totalDuration = parseFloat(durationOutput.trim());
      console.log(`${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} duration: ${totalDuration} seconds`);

      const numSegments = Math.ceil(totalDuration / segmentDuration);
      console.log(`Splitting ${mediaType} into ${numSegments} segments of ${segmentDuration} seconds each`);

      const outputPattern = path.join(outputDir, `${batchId}_%03d.${outputExtension}`);

      // Construct ffmpeg command based on splitting mode
      const ffmpegArgs = [
        '-i', mediaPath,
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
    });

    durationProbe.stderr.on('data', (data) => {
      console.error(`ffprobe stderr: ${data}`);
    });

    durationProbe.on('error', (err) => {
      reject(err);
    });
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
  return new Promise((resolve, reject) => {
    // Set default options
    const resolution = options.resolution || '360p';
    const fps = options.fps || 15;

    // Map resolution string to actual dimensions
    let width, height;
    switch (resolution) {
      case '240p':
        width = 426;
        height = 240;
        break;
      case '360p':
      default:
        width = 640;
        height = 360;
        break;
    }

    console.log(`Optimizing video to ${resolution} (${width}x${height}) at ${fps}fps`);

    // Construct ffmpeg command for optimization
    const ffmpegArgs = [
      '-i', videoPath,
      '-vf', `scale=${width}:${height}`,
      '-r', fps.toString(),
      '-c:v', 'libx264',
      '-preset', 'faster',
      '-crf', '23',  // Reasonable quality (lower is better)
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
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
        // Get the duration of the optimized video
        const duration = await getMediaDuration(outputPath);

        resolve({
          path: outputPath,
          duration,
          resolution,
          fps,
          width,
          height
        });
      } catch (error) {
        reject(new Error(`Failed to get optimized video duration: ${error.message}`));
      }
    });

    optimizeCmd.on('error', (err) => {
      reject(err);
    });
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
        '-i', videoPath,
        '-vf', `select='not(mod(n,${Math.round(frameInterval)}))',setpts=N/TB`,
        '-af', 'asetpts=N/SR/TB',  // Keep audio at original speed
        '-c:v', 'libx264',
        '-preset', 'faster',
        '-crf', '28',  // Lower quality is fine for analysis
        '-c:a', 'aac',
        '-b:a', '96k',  // Lower audio quality
        '-y',  // Overwrite output file if it exists
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

module.exports = {
  splitVideoIntoSegments,
  splitMediaIntoSegments,
  getVideoDuration,
  getMediaDuration,
  optimizeVideo,
  createAnalysisVideo,
  getVideoFrameCount
};
