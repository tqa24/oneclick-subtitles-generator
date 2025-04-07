/**
 * Video processing functionality
 */

const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

/**
 * Get the duration of a video file using ffprobe
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<number>} - Duration in seconds
 */
function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    const durationProbe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ]);

    let durationOutput = '';

    durationProbe.stdout.on('data', (data) => {
      durationOutput += data.toString();
    });

    durationProbe.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Failed to get video duration for ${videoPath}`));
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
 * Split a video into segments using ffmpeg
 * @param {string} videoPath - Path to the video file
 * @param {number} segmentDuration - Duration of each segment in seconds
 * @param {string} outputDir - Directory to save segments
 * @param {string} filePrefix - Prefix for segment filenames
 * @param {Object} options - Additional options
 * @param {boolean} options.fastSplit - If true, uses stream copy instead of re-encoding
 * @returns {Promise<Object>} - Result object with segments array
 */
function splitVideoIntoSegments(videoPath, segmentDuration, outputDir, filePrefix, options = {}) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const safePrefix = filePrefix.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 20);
    const batchId = `${safePrefix}_${timestamp}`;

    // First, get the duration of the video
    const durationProbe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ]);

    let durationOutput = '';

    durationProbe.stdout.on('data', (data) => {
      durationOutput += data.toString();
    });

    durationProbe.on('close', async (code) => {
      if (code !== 0) {
        return reject(new Error('Failed to get video duration'));
      }

      const totalDuration = parseFloat(durationOutput.trim());
      console.log(`Video duration: ${totalDuration} seconds`);

      const numSegments = Math.ceil(totalDuration / segmentDuration);
      console.log(`Splitting into ${numSegments} segments of ${segmentDuration} seconds each`);

      const outputPattern = path.join(outputDir, `${batchId}_%03d.mp4`);

      // Construct ffmpeg command based on splitting mode
      const ffmpegArgs = [
        '-i', videoPath,
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
      } else {
        // Otherwise use high-performance encoding settings
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
      });

      segmentCmd.on('close', async (code) => {
        if (code !== 0) {
          return reject(new Error('Failed to split video'));
        }

        // Read the created segments
        fs.readdir(outputDir, async (err, files) => {
          if (err) return reject(err);

          const segmentFiles = files
            .filter(file => file.startsWith(batchId))
            .sort((a, b) => {
              const aIndex = parseInt(a.match(/(\d+)\.mp4$/)[1]);
              const bIndex = parseInt(b.match(/(\d+)\.mp4$/)[1]);
              return aIndex - bIndex;
            });

          // Get actual durations for all segments
          let cumulativeStartTime = 0;
          const segmentPromises = segmentFiles.map(async (file, index) => {
            const filePath = path.join(outputDir, file);
            // Get actual duration using ffprobe
            const actualDuration = await getVideoDuration(filePath);

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
            resolve({ segments });
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

module.exports = {
  splitVideoIntoSegments,
  getVideoDuration
};
