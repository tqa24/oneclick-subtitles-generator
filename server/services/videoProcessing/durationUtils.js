/**
 * Utilities for getting media duration
 */

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

// For backward compatibility
const getVideoDuration = getMediaDuration;

module.exports = {
  getMediaDuration,
  getVideoDuration
};
