/**
 * YouTube downloader using play-dl library
 */

const fs = require('fs');
const ytdl = require('ytdl-core');
const playDl = require('play-dl');
const { downloadAndMerge } = require('./downloadUtils');

/**
 * Download YouTube video using play-dl
 * @param {string} videoURL - YouTube video URL
 * @param {string} outputPath - Path to save the video
 * @param {string} quality - Desired video quality (e.g., '144p', '360p', '720p')
 * @returns {Promise<boolean>} - Success status
 */
async function downloadWithPlayDl(videoURL, outputPath, quality = '360p') {
  try {
    // Convert quality string to play-dl quality number
    let qualityOption;

    // Map quality string to appropriate play-dl quality option
    switch(quality) {
      case '144p':
        qualityOption = 144;
        break;
      case '240p':
        qualityOption = 240;
        break;
      case '360p':
        qualityOption = 360;
        break;
      case '480p':
        qualityOption = 480;
        break;
      case '720p':
        qualityOption = 720;
        break;
      default:
        qualityOption = 360; // Default to 360p
    }

    console.log(`[QUALITY DEBUG] Using play-dl quality option: ${qualityOption} for requested quality: ${quality}`);

    // Get video info to check available qualities
    const videoInfo = await playDl.video_info(videoURL);
    console.log(`[QUALITY DEBUG] Video title: ${videoInfo.video_details.title}`);

    // Log available formats for debugging
    console.log(`[QUALITY DEBUG] Available formats from play-dl:`);
    try {
      const formats = await playDl.video_basic_info(videoURL);
      if (formats && formats.video_details && formats.video_details.formats) {
        formats.video_details.formats.forEach(format => {
          if (format.qualityLabel) {
            console.log(`[QUALITY DEBUG] Format: ${format.qualityLabel}, mimeType: ${format.mimeType}`);
          }
        });
      } else {
        console.log(`[QUALITY DEBUG] No formats available from play-dl or format structure is different than expected`);
      }
    } catch (error) {
      console.log(`[QUALITY DEBUG] Error getting formats from play-dl: ${error.message}`);
    }

    // For low quality formats, try to use ytdl-core with our downloadAndMerge function
    // since play-dl doesn't give us as much control over format selection
    if (quality === '144p' || quality === '240p') {
      try {
        console.log(`[QUALITY DEBUG] For ${quality}, trying to use ytdl-core with downloadAndMerge`);

        // Get video info from ytdl-core
        const ytdlInfo = await ytdl.getInfo(videoURL);

        // Find video format with the target height
        const targetHeight = quality === '144p' ? 144 : 240;
        const videoFormats = ytdlInfo.formats.filter(format =>
          format.hasVideo &&
          format.height &&
          format.height <= targetHeight
        );

        // Sort by height (descending)
        videoFormats.sort((a, b) => b.height - a.height);

        if (videoFormats.length > 0) {
          console.log(`[QUALITY DEBUG] Found ${videoFormats.length} video formats for ${quality}`);

          // Get audio formats
          const audioFormats = ytdlInfo.formats.filter(format =>
            format.hasAudio && !format.hasVideo
          );

          // Sort by audio bitrate
          audioFormats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));

          if (audioFormats.length > 0) {
            console.log(`[QUALITY DEBUG] Found ${audioFormats.length} audio formats`);

            // Try to download and merge
            const downloadSuccess = await downloadAndMerge(videoURL, outputPath, videoFormats[0], audioFormats[0]);

            if (downloadSuccess) {
              console.log(`[QUALITY DEBUG] Successfully downloaded and merged video and audio`);
              return true; // Exit the function early since we've handled everything
            } else {
              console.log(`[QUALITY DEBUG] Failed to download and merge, falling back to play-dl`);
            }
          }
        }
      } catch (error) {
        console.error(`[QUALITY DEBUG] Error trying to use ytdl-core:`, error);
        console.log(`[QUALITY DEBUG] Falling back to play-dl`);
      }
    }

    // If we get here, either we're not trying to get a low quality format,
    // or the ytdl-core approach failed, so we'll use play-dl

    // Get stream with play-dl
    let streamOptions;

    // For 360p specifically, we need a different approach
    if (quality === '360p') {
      // Try a special approach for 360p that has been problematic
      try {
        // Try to download with ytdl-core directly using a specific filter that prioritizes formats with audio
        console.log(`[QUALITY DEBUG] For 360p, trying direct ytdl-core download with audio`);

        // Get video info first to check available formats
        const ytdlInfo = await ytdl.getInfo(videoURL);

        // Log available formats for debugging
        console.log(`[QUALITY DEBUG] Available formats:`);
        ytdlInfo.formats.forEach(format => {
          if (format.height) {
            console.log(`[QUALITY DEBUG] Format: ${format.qualityLabel}, Height: ${format.height}, Container: ${format.container}, Has Audio: ${format.hasAudio}`);
          }
        });

        // First, look for 360p formats that already have audio
        const formatsWithAudio = ytdlInfo.formats.filter(format =>
          format.hasVideo &&
          format.hasAudio &&
          format.height === 360 &&
          format.container === 'mp4'
        );

        if (formatsWithAudio.length > 0) {
          console.log(`[QUALITY DEBUG] Found ${formatsWithAudio.length} 360p formats with audio`);

          return new Promise((resolve, reject) => {
            try {
              // Use the first format that has both video and audio
              const selectedFormat = formatsWithAudio[0];
              console.log(`[QUALITY DEBUG] Using 360p format with audio: ${selectedFormat.qualityLabel}`);

              // Create the stream with the specific format
              const videoStream = ytdl(videoURL, { format: selectedFormat });
              const writeStream = fs.createWriteStream(outputPath);

              // Set up event handlers
              writeStream.on('finish', () => {
                console.log(`ytdl-core direct download successful for 360p with audio: ${outputPath}`);
                resolve(true);
              });

              writeStream.on('error', (err) => {
                console.error(`ytdl-core write stream error: ${err.message}`);
                reject(err);
              });

              videoStream.on('error', (err) => {
                console.error(`ytdl-core stream error: ${err.message}`);
                reject(err);
              });

              // Pipe the stream to the file
              videoStream.pipe(writeStream);
            } catch (err) {
              console.error(`Error setting up ytdl-core stream: ${err.message}`);
              reject(err);
            }
          });
        } else {
          console.log(`[QUALITY DEBUG] No 360p formats with audio found, falling back to filter approach`);

          return new Promise((resolve, reject) => {
            try {
              // Create a ytdl stream with specific options for 360p
              const ytdlOptions = {
                filter: format => {
                  return format.container === 'mp4' &&
                         format.hasVideo &&
                         format.height >= 360 &&
                         format.height <= 480;
                }
              };

              console.log(`[QUALITY DEBUG] Using specific ytdl-core filter for 360p`);

              // Create the stream
              const videoStream = ytdl(videoURL, ytdlOptions);
              const writeStream = fs.createWriteStream(outputPath);

              // Set up event handlers
              writeStream.on('finish', () => {
                console.log(`ytdl-core direct download successful for 360p: ${outputPath}`);
                resolve(true);
              });

              writeStream.on('error', (err) => {
                console.error(`ytdl-core write stream error: ${err.message}`);
                reject(err);
              });

              videoStream.on('error', (err) => {
                console.error(`ytdl-core stream error: ${err.message}`);
                reject(err);
              });

              // Pipe the stream to the file
              videoStream.pipe(writeStream);
            } catch (err) {
              console.error(`Error setting up ytdl-core stream: ${err.message}`);
              reject(err);
            }
          });
        }
      } catch (error) {
        console.log(`[QUALITY DEBUG] Error with direct ytdl-core approach for 360p: ${error.message}`);
        // Continue to the next approach
      }

      // If we get here, the direct ytdl-core approach failed
      // We'll skip the downloadAndMerge approach for 360p since we want to prioritize formats with audio
      // and only use downloadAndMerge as a last resort
      console.log(`[QUALITY DEBUG] Direct ytdl-core approach failed, skipping downloadAndMerge for 360p and trying play-dl`);

      // If we get here, the ytdl-core approach failed, so use play-dl with a specific quality
      // For 360p, we want to make sure we get a format with audio
      streamOptions = {
        quality: 360,
        filter: 'audioandvideo' // This ensures we get a format with both audio and video
      };
      console.log(`[QUALITY DEBUG] Using quality: 360 with audioandvideo filter for play-dl`);
    } else if (quality === '144p' || quality === '240p') {
      // For low qualities, force the lowest possible quality
      streamOptions = { quality: 'lowest' };
      console.log(`[QUALITY DEBUG] Using 'lowest' quality option for play-dl to get ${quality}`);
    } else {
      // For other qualities, use the standard quality option
      streamOptions = { quality: qualityOption };
      console.log(`[QUALITY DEBUG] Using standard quality option for play-dl: ${qualityOption}`);
    }

    // Try to download with play-dl
    return new Promise(async (resolve, reject) => {
      try {
        console.log(`[QUALITY DEBUG] Attempting play-dl download with options:`, streamOptions);
        const stream = await playDl.stream(videoURL, streamOptions);

        // Create write stream
        const writeStream = fs.createWriteStream(outputPath);

        // Set up event handlers
        writeStream.on('finish', () => {
          console.log(`play-dl download successful: ${outputPath}`);
          resolve(true);
        });

        writeStream.on('error', (err) => {
          console.error(`play-dl write stream error: ${err.message}`);
          writeStream.end();
          reject(err);
        });

        stream.stream.on('error', (err) => {
          console.error(`play-dl stream error: ${err.message}`);
          writeStream.end();
          reject(err);
        });

        // Pipe the stream to the file
        stream.stream.pipe(writeStream);
      } catch (error) {
        console.log(`[QUALITY DEBUG] Error getting stream from play-dl: ${error.message}`);

        // Try with a different approach as fallback
        try {
          console.log(`[QUALITY DEBUG] Trying with default options as fallback`);
          const fallbackStream = await playDl.stream(videoURL);

          // Create write stream
          const writeStream = fs.createWriteStream(outputPath);

          // Set up event handlers
          writeStream.on('finish', () => {
            console.log(`play-dl fallback download successful: ${outputPath}`);
            resolve(true);
          });

          writeStream.on('error', (err) => {
            console.error(`play-dl fallback write stream error: ${err.message}`);
            writeStream.end();
            reject(err);
          });

          fallbackStream.stream.on('error', (err) => {
            console.error(`play-dl fallback stream error: ${err.message}`);
            writeStream.end();
            reject(err);
          });

          // Pipe the stream to the file
          fallbackStream.stream.pipe(writeStream);
        } catch (fallbackError) {
          console.error(`play-dl fallback error: ${fallbackError.message}`);
          reject(fallbackError);
        }
      }
    });
  } catch (error) {
    console.error('play-dl error:', error);
    return false;
  }
}

module.exports = {
  downloadWithPlayDl
};
