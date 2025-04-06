/**
 * Video processing functionality
 */

const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

/**
 * Split a video into segments using ffmpeg
 * @param {string} videoPath - Path to the video file
 * @param {number} segmentDuration - Duration of each segment in seconds
 * @param {string} outputDir - Directory to save segments
 * @param {string} filePrefix - Prefix for segment filenames
 * @returns {Promise<Object>} - Result object with segments array
 */
function splitVideoIntoSegments(videoPath, segmentDuration, outputDir, filePrefix) {
  return new Promise((resolve, reject) => {
    // Create a unique ID for this batch of segments
    const batchId = `${filePrefix}_${Date.now()}`;
    const outputPattern = path.join(outputDir, `${batchId}_%03d.mp4`);

    console.log(`Splitting video ${videoPath} into ${segmentDuration}-second segments`);

    // Use ffmpeg to split the video
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-c', 'copy',            // Copy codec (no re-encoding)
      '-map', '0',             // Map all streams
      '-segment_time', segmentDuration,  // Segment duration in seconds
      '-f', 'segment',         // Use segment format
      '-reset_timestamps', '1', // Reset timestamps for each segment
      '-max_muxing_queue_size', '9999', // Increase queue size for large files
      '-threads', '0',         // Use all available CPU cores
      outputPattern            // Output pattern
    ]);

    let stdoutData = '';
    let stderrData = '';

    ffmpeg.stdout.on('data', (data) => {
      stdoutData += data.toString();
      console.log(`ffmpeg stdout: ${data}`);
    });

    ffmpeg.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.log(`ffmpeg stderr: ${data}`); // Use log instead of error for ffmpeg progress
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`ffmpeg split successful`);

        // Get the list of created segment files
        const segmentFiles = fs.readdirSync(outputDir)
          .filter(file => file.startsWith(batchId))
          .map(file => path.join(outputDir, file));

        resolve({
          success: true,
          batchId: batchId,
          segments: segmentFiles,
          message: 'Video split successfully'
        });
      } else {
        console.error(`ffmpeg process exited with code ${code}`);
        reject(new Error(`ffmpeg failed with code ${code}: ${stderrData}`));
      }
    });

    ffmpeg.on('error', (err) => {
      console.error('Failed to start ffmpeg process:', err);
      reject(err);
    });
  });
}

module.exports = {
  splitVideoIntoSegments
};
