/**
 * YouTube downloader using ytdl-core library
 */

const fs = require('fs');
const ytdl = require('ytdl-core');
const { downloadAndMerge } = require('./downloadUtils');

/**
 * Download YouTube video using ytdl-core
 * @param {string} videoURL - YouTube video URL
 * @param {string} outputPath - Path to save the video
 * @param {string} quality - Desired video quality (e.g., '144p', '360p', '720p')
 * @returns {Promise<boolean>} - Success status
 */
async function downloadWithYtdlCore(videoURL, outputPath, quality = '360p') {
  return new Promise(async (resolve, reject) => {
    try {
      // Convert quality string to itag or quality level
      let qualityOption;

      // Map quality string to appropriate ytdl-core quality option
      switch(quality) {
        case '144p':
          qualityOption = 'lowest';
          break;
        case '240p':
          qualityOption = 'lowest';
          break;
        case '360p':
          qualityOption = 'medium';
          break;
        case '480p':
          qualityOption = 'medium';
          break;
        case '720p':
          qualityOption = 'highest';
          break;
        default:
          qualityOption = 'medium'; // Default to medium quality
      }

      console.log(`[QUALITY DEBUG] Using ytdl-core quality option: ${qualityOption} for requested quality: ${quality}`);

      // Set up ytdl options for the specified quality that includes both video and audio
      let options;

      // For all qualities, we'll use a more specific approach with format filtering
      // This helps avoid the 'No such format found: medium' error
      const targetHeight = {
        '144p': 144,
        '240p': 240,
        '360p': 360,
        '480p': 480,
        '720p': 720,
        '1080p': 1080
      }[quality] || 360;

      console.log(`[QUALITY DEBUG] Target height for ${quality}: ${targetHeight}px`);

      // Don't use qualityOption (like 'medium') at all - it's causing the error
      // Instead, use a filter function that selects formats based on height
      options = {
        filter: format => {
          // For 360p specifically, we need to prioritize formats with audio
          if (quality === '360p') {
            // First priority: exact 360p with audio
            if (format.container === 'mp4' && format.hasVideo && format.hasAudio && format.height === 360) {
              return true;
            }

            // Second priority: close to 360p with audio
            if (format.container === 'mp4' && format.hasVideo && format.hasAudio &&
                format.height >= 360 && format.height <= 480) {
              return true;
            }

            // Last resort: 360p without audio (will need separate audio download)
            return format.container === 'mp4' && format.hasVideo &&
                   (format.height === 360 || (format.height >= 360 && format.height <= 480));
          }

          // For other qualities, use the standard height filter
          return format.container === 'mp4' &&
                 format.hasVideo &&
                 format.height <= targetHeight;
        }
      };

      console.log(`[QUALITY DEBUG] Using height-based filter for ${quality}`);

      // Create write stream
      const writeStream = fs.createWriteStream(outputPath);

      // Set up event handlers
      writeStream.on('finish', () => {
        console.log(`ytdl-core download successful: ${outputPath}`);
        resolve(true);
      });

      writeStream.on('error', (err) => {
        console.error('Write stream error:', err);
        reject(err);
      });

      // Start download
      // Get video info to check available formats
      const info = await ytdl.getInfo(videoURL);
      console.log(`[QUALITY DEBUG] Video title: ${info.videoDetails.title}`);

      // For 144p, 240p, and 360p, try to find a specific format
      let videoStream;
      if (quality === '360p') {
        // Log all available formats for debugging
        console.log(`[QUALITY DEBUG] Available formats:`);
        info.formats.forEach(format => {
          if (format.height) {
            console.log(`[QUALITY DEBUG] Format: ${format.qualityLabel}, Height: ${format.height}, Container: ${format.container}, Has Audio: ${format.hasAudio}`);
          }
        });

        // First, look for 360p formats that already have audio
        const formatsWithAudio = info.formats.filter(format =>
          format.hasVideo &&
          format.hasAudio &&
          format.height === 360 &&
          format.container === 'mp4'
        );

        if (formatsWithAudio.length > 0) {
          console.log(`[QUALITY DEBUG] Found ${formatsWithAudio.length} 360p formats with audio`);
          const selectedFormat = formatsWithAudio[0];
          console.log(`[QUALITY DEBUG] Using 360p format with audio: ${selectedFormat.qualityLabel}`);
          videoStream = ytdl(videoURL, { format: selectedFormat });
        } else {
          console.log(`[QUALITY DEBUG] No 360p formats with audio found, using filter`);
          videoStream = ytdl(videoURL, options);
        }
      } else if (quality === '144p' || quality === '240p') {
        const targetHeight = quality === '144p' ? 144 : 240;
        console.log(`[QUALITY DEBUG] Looking for format with height <= ${targetHeight}`);

        // Log all available formats for debugging
        console.log(`[QUALITY DEBUG] Available formats:`);
        info.formats.forEach(format => {
          if (format.hasVideo && format.height) {
            console.log(`[QUALITY DEBUG] Format: ${format.qualityLabel}, Height: ${format.height}, Container: ${format.container}, Has Audio: ${format.hasAudio}`);
          }
        });

        // Find formats with the target height or lower
        // For 144p, we need to be very specific
        let formats;
        if (quality === '144p') {
          formats = info.formats.filter(format =>
            format.hasVideo &&
            format.height &&
            format.height <= targetHeight
          );

          // Sort by height (descending)
          formats.sort((a, b) => b.height - a.height);

          // If we found formats, take the highest one within our limit
          if (formats.length > 0) {
            console.log(`[QUALITY DEBUG] Found ${formats.length} formats for 144p, using height ${formats[0].height}`);
          }
        } else {
          // For other qualities, require mp4 container and audio
          formats = info.formats.filter(format =>
            format.hasVideo &&
            format.hasAudio &&
            format.container === 'mp4' &&
            format.height &&
            format.height <= targetHeight
          );
        }

        // Sort by height (descending) to get the highest quality within our limit
        formats.sort((a, b) => b.height - a.height);

        if (formats.length > 0) {
          console.log(`[QUALITY DEBUG] Found specific format with height ${formats[0].height}, has audio: ${formats[0].hasAudio}`);

          // For low quality formats, we often need to handle formats without audio
          if (!formats[0].hasAudio) {
            console.log(`[QUALITY DEBUG] Selected format doesn't have audio, using special handling`);

            // Get an audio-only format
            const audioFormats = info.formats.filter(format =>
              format.hasAudio && !format.hasVideo
            );

            if (audioFormats.length > 0) {
              console.log(`[QUALITY DEBUG] Found audio format, will download video and audio separately`);

              // Sort audio formats by bitrate (descending)
              audioFormats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));

              console.log(`[QUALITY DEBUG] Selected audio format with bitrate: ${audioFormats[0].audioBitrate}kbps`);

              // Use our downloadAndMerge function to handle this case
              const downloadSuccess = await downloadAndMerge(videoURL, outputPath, formats[0], audioFormats[0]);

              if (downloadSuccess) {
                console.log(`[QUALITY DEBUG] Successfully downloaded and merged video and audio`);
                resolve(true);
                return; // Exit the function early since we've handled everything
              } else {
                console.log(`[QUALITY DEBUG] Failed to download and merge, falling back to video-only format`);
                videoStream = ytdl(videoURL, { format: formats[0] });
              }
            } else {
              console.log(`[QUALITY DEBUG] No audio formats found, using video-only format`);
              videoStream = ytdl(videoURL, { format: formats[0] });
            }
          } else {
            // Use the specific format that already has audio
            console.log(`[QUALITY DEBUG] Selected format has audio, using it directly`);
            videoStream = ytdl(videoURL, { format: formats[0] });
          }
        } else {
          console.log(`[QUALITY DEBUG] No specific format found for height <= ${targetHeight}, falling back to options`);
          videoStream = ytdl(videoURL, options);
        }
      } else if (quality === '360p') {
        // For 360p, we want to prioritize formats with audio
        // First, look for formats that have both video and audio
        const formatsWithAudio = info.formats.filter(format =>
          format.hasVideo &&
          format.hasAudio &&
          format.height === 360 &&
          format.container === 'mp4'
        );

        if (formatsWithAudio.length > 0) {
          console.log(`[QUALITY DEBUG] Found ${formatsWithAudio.length} 360p formats with audio`);
          const selectedFormat = formatsWithAudio[0];
          console.log(`[QUALITY DEBUG] Using 360p format with audio: ${selectedFormat.qualityLabel}`);
          videoStream = ytdl(videoURL, { format: selectedFormat });
        } else {
          // If no 360p format with audio, try formats close to 360p with audio
          const nearbyFormatsWithAudio = info.formats.filter(format =>
            format.hasVideo &&
            format.hasAudio &&
            format.height >= 360 &&
            format.height <= 480 &&
            format.container === 'mp4'
          );

          if (nearbyFormatsWithAudio.length > 0) {
            // Sort by height (closest to 360p first)
            nearbyFormatsWithAudio.sort((a, b) => Math.abs(a.height - 360) - Math.abs(b.height - 360));
            const selectedFormat = nearbyFormatsWithAudio[0];
            console.log(`[QUALITY DEBUG] Using nearby format with audio: ${selectedFormat.qualityLabel}`);
            videoStream = ytdl(videoURL, { format: selectedFormat });
          } else {
            // If no formats with audio, use the standard options and let the downloadAndMerge logic handle it
            console.log(`[QUALITY DEBUG] No 360p formats with audio found, using standard options`);
            videoStream = ytdl(videoURL, options);
          }
        }
      } else {
        // Use the standard options
        videoStream = ytdl(videoURL, options);
      }

      videoStream.on('error', (err) => {
        console.error('ytdl-core stream error:', err);
        writeStream.end();
        reject(err);
      });

      // Log progress
      videoStream.on('progress', (chunkLength, downloaded, total) => {
        const percent = downloaded / total * 100;
        console.log(`ytdl-core download progress: ${percent.toFixed(2)}%`);
      });

      // Pipe the video stream to the file
      videoStream.pipe(writeStream);
    } catch (err) {
      console.error('ytdl-core setup error:', err);
      reject(err);
    }
  });
}

module.exports = {
  downloadWithYtdlCore
};
