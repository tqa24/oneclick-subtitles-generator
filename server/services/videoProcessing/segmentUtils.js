/**
 * Utilities for splitting media into segments
 */

const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const { getMediaDuration } = require('./durationUtils');
const { getFfmpegPath, getFfprobePath } = require('../shared/ffmpegUtils');

/**
 * Detect the frame rate of a video file
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<number>} - Frame rate in FPS
 */
async function detectVideoFrameRate(videoPath) {
  return new Promise((resolve, reject) => {
    const ffprobePath = getFfprobePath();
    const ffprobeProcess = spawn(ffprobePath, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-select_streams', 'v:0',
      videoPath
    ]);

    let stdout = '';
    let stderr = '';

    ffprobeProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobeProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobeProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`[DETECT-FPS] ffprobe failed with code ${code}: ${stderr}`);
        // Return default frame rate if detection fails
        return resolve(30);
      }

      try {
        const data = JSON.parse(stdout);
        const videoStream = data.streams && data.streams[0];

        if (!videoStream || !videoStream.r_frame_rate) {
          console.warn(`[DETECT-FPS] No frame rate found, using default 30 FPS`);
          return resolve(30);
        }

        // Parse frame rate (can be in format like "30/1" or "29.97")
        const frameRateStr = videoStream.r_frame_rate;
        let frameRate;

        if (frameRateStr.includes('/')) {
          const [numerator, denominator] = frameRateStr.split('/').map(Number);
          frameRate = numerator / denominator;
        } else {
          frameRate = parseFloat(frameRateStr);
        }

        console.log(`[DETECT-FPS] Detected frame rate: ${frameRate} FPS`);
        resolve(frameRate);
      } catch (error) {
        console.error(`[DETECT-FPS] Failed to parse ffprobe output: ${error.message}`);
        // Return default frame rate if parsing fails
        resolve(30);
      }
    });

    ffprobeProcess.on('error', (error) => {
      console.error(`[DETECT-FPS] Failed to spawn ffprobe: ${error.message}`);
      // Return default frame rate if spawn fails
      resolve(30);
    });
  });
}

/**
 * Split low FPS video using precise time-based cutting
 * @param {string} videoPath - Path to the video file
 * @param {number} segmentDuration - Duration of each segment in seconds
 * @param {string} outputDir - Directory to save segments
 * @param {string} batchId - Batch ID for naming
 * @param {number} totalDuration - Total video duration
 * @param {string} outputExtension - Output file extension
 * @returns {Promise<Object>} - Result object with segments array
 */
async function splitLowFpsVideoByTime(videoPath, segmentDuration, outputDir, batchId, totalDuration, outputExtension) {
  return new Promise(async (resolve, reject) => {
    try {
      const numSegments = Math.ceil(totalDuration / segmentDuration);
      const segments = [];

      console.log(`[SPLIT-LOW-FPS] Splitting ${totalDuration}s video into ${numSegments} segments of ${segmentDuration}s each`);

      // Create segments using precise time-based cutting
      for (let i = 0; i < numSegments; i++) {
        const startTime = i * segmentDuration;
        const duration = Math.min(segmentDuration, totalDuration - startTime);
        const outputFile = `${batchId}_${String(i).padStart(3, '0')}.${outputExtension}`;
        const outputPath = path.join(outputDir, outputFile);

        console.log(`[SPLIT-LOW-FPS] Creating segment ${i + 1}/${numSegments}: ${startTime}s - ${startTime + duration}s`);

        // Use ffmpeg to extract this specific time range
        // Use -ss and -to (end time) instead of -ss and -t (duration) to avoid cumulative issues
        const endTime = startTime + duration;
        const ffmpegArgs = [
          '-i', videoPath, // Input file
          '-ss', startTime.toString(), // Start time (after input)
          '-to', endTime.toString(), // End time (instead of duration)
          '-c:v', 'libx264', // Re-encode video to ensure frames are included
          '-preset', 'ultrafast', // Fast encoding
          '-crf', '18', // High quality
          '-c:a', 'copy', // Keep audio as-is
          '-avoid_negative_ts', 'make_zero',
          '-map_metadata', '-1', // Remove metadata to avoid duration confusion
          '-y', // Overwrite output
          outputPath
        ];

        const ffmpegPath = getFfmpegPath();

        // Debug: Log the exact ffmpeg command being executed
        console.log(`[SPLIT-LOW-FPS] Executing: ${ffmpegPath} ${ffmpegArgs.join(' ')}`);

        await new Promise((segmentResolve, segmentReject) => {
          const segmentCmd = spawn(ffmpegPath, ffmpegArgs);

          segmentCmd.on('close', (code) => {
            if (code !== 0) {
              segmentReject(new Error(`Failed to create segment ${i + 1}`));
            } else {
              segmentResolve();
            }
          });

          segmentCmd.on('error', (err) => {
            segmentReject(err);
          });
        });

        // Use the calculated duration instead of detecting it from the file
        // This avoids issues with ffprobe returning incorrect durations for segments
        console.log(`[SPLIT-LOW-FPS] Segment ${i + 1} created with calculated duration: ${duration}s`);

        segments.push({
          index: i,
          path: outputPath,
          url: `/videos/${outputFile}`,
          startTime: startTime,
          duration: duration, // Use calculated duration instead of detected duration
          name: outputFile
        });

        console.log(`[SPLIT-LOW-FPS] Segment ${i + 1} final: startTime=${startTime}s, duration=${duration}s, endTime=${startTime + duration}s`);
      }

      console.log(`[SPLIT-LOW-FPS] Successfully created ${segments.length} segments`);
      resolve({ segments, batchId });

    } catch (error) {
      console.error(`[SPLIT-LOW-FPS] Error: ${error.message}`);
      reject(error);
    }
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



      // Get the duration of the media file using our more robust getMediaDuration function

      const totalDuration = await getMediaDuration(mediaPath);


      const numSegments = Math.ceil(totalDuration / segmentDuration);


      const outputPattern = path.join(outputDir, `${batchId}_%03d.${outputExtension}`);

      // Double-check the file path before proceeding
      if (!fs.existsSync(mediaPath)) {
        console.error(`[SPLIT-MEDIA] Media file disappeared before splitting: ${mediaPath}`);
        return reject(new Error(`Media file not found before splitting: ${mediaPath}`));
      }

      // Log the absolute file path for debugging
      const absolutePath = path.resolve(mediaPath);


      // Detect frame rate for video files to adapt segment_time_delta
      let frameRate = 30; // Default frame rate
      let adaptedSegmentTimeDelta = '1.0'; // Default segment time delta

      if (!isAudio) {
        try {
          frameRate = await detectVideoFrameRate(absolutePath);

          // Adapt segment_time_delta based on frame rate
          // For very low frame rates (like 1 FPS from optimization), use much smaller delta
          if (frameRate <= 1) {
            adaptedSegmentTimeDelta = '0.01'; // Extremely small delta for 1 FPS
          } else if (frameRate <= 2) {
            adaptedSegmentTimeDelta = '0.05'; // Very small delta for 2 FPS
          } else if (frameRate <= 5) {
            adaptedSegmentTimeDelta = '0.2'; // Small delta for low FPS
          } else if (frameRate <= 15) {
            adaptedSegmentTimeDelta = '0.5'; // Medium delta for medium FPS
          } else {
            adaptedSegmentTimeDelta = '1.0'; // Default delta for normal FPS
          }

          console.log(`[SPLIT-MEDIA] Video FPS: ${frameRate}, using segment_time_delta: ${adaptedSegmentTimeDelta}`);
        } catch (error) {
          console.warn(`[SPLIT-MEDIA] Failed to detect frame rate, using defaults: ${error.message}`);
        }
      }

      // Construct ffmpeg command based on splitting mode
      const ffmpegArgs = [
        '-i', absolutePath, // Use absolute path to avoid any path resolution issues
        '-f', 'segment',
        '-segment_time', segmentDuration.toString(),
        '-reset_timestamps', '1'
      ];

      // If fast split is enabled, use stream copy instead of re-encoding
      if (options.fastSplit) {
        // For very low frame rate videos, use a different approach entirely
        if (!isAudio && frameRate <= 2) {
          console.log(`[SPLIT-MEDIA] Very low FPS (${frameRate}), using precise time-based splitting`);
          // Use precise time-based splitting instead of segment filter
          try {
            const result = await splitLowFpsVideoByTime(mediaPath, segmentDuration, outputDir, batchId, totalDuration, outputExtension);
            resolve(result);
            return;
          } catch (error) {
            reject(error);
            return;
          }
        } else {
          console.log(`[SPLIT-MEDIA] Using fast split with stream copy, segment_time_delta: ${adaptedSegmentTimeDelta}`);
          ffmpegArgs.push(
            '-segment_time_delta', adaptedSegmentTimeDelta,
            '-c', 'copy'
          );
        }

      } else if (isAudio) {
        // For audio, use high-quality audio encoding
        ffmpegArgs.push(
          '-c:a', 'libmp3lame',
          '-q:a', '2', // High quality (0 is best, 9 is worst)
          '-threads', '0'
        );

      } else {
        // For video, use high-performance encoding settings
        ffmpegArgs.push(
          '-c:v', 'libx264',
          '-preset', 'faster', // Use faster preset for better performance
          '-c:a', 'aac',
          '-force_key_frames', `expr:gte(t,n_forced*${segmentDuration})`, // Force keyframe at segment boundaries
          '-threads', '0'
        );

      }

      ffmpegArgs.push(outputPattern);

      const ffmpegPath = getFfmpegPath();
      const segmentCmd = spawn(ffmpegPath, ffmpegArgs);
      const segments = [];

      segmentCmd.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('frame=')) {
          process.stdout.write('.');
        }

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

            segmentResults.forEach((segment, i) => {

            });

            // Check if segments are in the correct order by start time
            // This is important when using stream-copy mode, which can split at unexpected points
            const isOutOfOrder = segmentResults.some((segment, i) => {
              if (i === 0) return false;
              const isWrongOrder = segment.startTime < segmentResults[i-1].startTime;
              if (isWrongOrder) {

              }
              return isWrongOrder;
            });

            if (isOutOfOrder) {


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

              segmentResults.forEach((segment, i) => {

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

module.exports = {
  splitMediaIntoSegments,
  splitVideoIntoSegments
};
