/**
 * Utilities for splitting media into segments
 */

const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const { getMediaDuration } = require('./durationUtils');

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
