/**
 * Special YouTube download methods for specific quality requirements
 */

const fs = require('fs');
const https = require('https');
const ytdl = require('ytdl-core');
const { downloadAndMerge } = require('./downloadUtils');

/**
 * Special function to download 360p videos with audio
 * This function prioritizes formats that have both video and audio
 * @param {string} videoURL - YouTube video URL
 * @param {string} outputPath - Path to save the video
 * @returns {Promise<boolean>} - Success status
 */
async function download360pWithAudio(videoURL, outputPath) {
  try {
    console.log(`[QUALITY DEBUG] Attempting to download 360p video with audio...`);

    // Get video info
    const info = await ytdl.getInfo(videoURL);

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
            console.log(`[QUALITY DEBUG] 360p download with audio successful: ${outputPath}`);
            resolve(true);
          });

          writeStream.on('error', (err) => {
            console.error(`[QUALITY DEBUG] Write stream error: ${err.message}`);
            reject(err);
          });

          videoStream.on('error', (err) => {
            console.error(`[QUALITY DEBUG] Video stream error: ${err.message}`);
            reject(err);
          });

          // Log progress
          videoStream.on('progress', (chunkLength, downloaded, total) => {
            const percent = downloaded / total * 100;
            console.log(`[QUALITY DEBUG] 360p download progress: ${percent.toFixed(2)}%`);
          });

          // Pipe the stream to the file
          videoStream.pipe(writeStream);
        } catch (err) {
          console.error(`[QUALITY DEBUG] Error setting up 360p download: ${err.message}`);
          reject(err);
        }
      });
    }

    // If no exact 360p formats with audio, try nearby resolutions
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

      return new Promise((resolve, reject) => {
        try {
          const selectedFormat = nearbyFormatsWithAudio[0];
          console.log(`[QUALITY DEBUG] Using nearby format with audio: ${selectedFormat.qualityLabel}`);

          // Create the stream with the specific format
          const videoStream = ytdl(videoURL, { format: selectedFormat });
          const writeStream = fs.createWriteStream(outputPath);

          // Set up event handlers
          writeStream.on('finish', () => {
            console.log(`[QUALITY DEBUG] Nearby resolution download with audio successful: ${outputPath}`);
            resolve(true);
          });

          writeStream.on('error', (err) => {
            console.error(`[QUALITY DEBUG] Write stream error: ${err.message}`);
            reject(err);
          });

          videoStream.on('error', (err) => {
            console.error(`[QUALITY DEBUG] Video stream error: ${err.message}`);
            reject(err);
          });

          // Log progress
          videoStream.on('progress', (chunkLength, downloaded, total) => {
            const percent = downloaded / total * 100;
            console.log(`[QUALITY DEBUG] Nearby resolution download progress: ${percent.toFixed(2)}%`);
          });

          // Pipe the stream to the file
          videoStream.pipe(writeStream);
        } catch (err) {
          console.error(`[QUALITY DEBUG] Error setting up nearby resolution download: ${err.message}`);
          reject(err);
        }
      });
    }

    // If no formats with audio found, try to download video and audio separately and merge
    console.log(`[QUALITY DEBUG] No formats with audio found, trying to download and merge...`);

    // Find the best video format
    const videoFormats = info.formats.filter(format =>
      format.hasVideo &&
      format.height &&
      format.height >= 360 &&
      format.height <= 480
    );

    // Sort by height (closest to 360p first)
    videoFormats.sort((a, b) => Math.abs(a.height - 360) - Math.abs(b.height - 360));

    if (videoFormats.length > 0) {
      // Find the best audio format
      const audioFormats = info.formats.filter(format =>
        format.hasAudio && !format.hasVideo
      );

      // Sort by audio bitrate
      audioFormats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));

      if (audioFormats.length > 0) {
        console.log(`[QUALITY DEBUG] Found video and audio formats, attempting to download and merge...`);

        // Try to download and merge
        const downloadSuccess = await downloadAndMerge(videoURL, outputPath, videoFormats[0], audioFormats[0]);

        if (downloadSuccess) {
          console.log(`[QUALITY DEBUG] Successfully downloaded and merged video and audio for 360p`);
          return true;
        }
      }
    }

    console.log(`[QUALITY DEBUG] All 360p special methods failed, falling back to standard methods...`);
    return false;
  } catch (error) {
    console.error(`[QUALITY DEBUG] Error in download360pWithAudio: ${error.message}`);
    return false;
  }
}

/**
 * Download YouTube video using direct stream approach
 * This is a fallback method that uses a more direct approach
 * @param {string} videoURL - YouTube video URL
 * @param {string} outputPath - Path to save the video
 * @param {string} quality - Desired video quality (e.g., '144p', '360p', '720p')
 * @returns {Promise<boolean>} - Success status
 */
async function downloadWithDirectStream(videoURL, outputPath, quality = '360p') {
  // Note: For direct stream, we can't easily control quality
  // but we log it for consistency
  console.log(`[QUALITY DEBUG] Using direct stream with requested quality: ${quality}`);

  // For low quality formats, try to use ytdl-core with our downloadAndMerge function first
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
            console.log(`[QUALITY DEBUG] Failed to download and merge, falling back to direct stream`);
          }
        }
      }
    } catch (error) {
      console.error(`[QUALITY DEBUG] Error trying to use ytdl-core:`, error);
      console.log(`[QUALITY DEBUG] Falling back to direct stream`);
    }
  }

  // If we get here, either we're not trying to get a low quality format,
  // or the ytdl-core approach failed, so we'll use direct stream
  console.log(`[QUALITY DEBUG] Using direct stream method (quality not directly supported)`);

  return new Promise((resolve, reject) => {
    try {
      // Create a temporary file for the video
      const tempFilePath = `${outputPath}.temp`;
      const writeStream = fs.createWriteStream(tempFilePath);

      // Set up event handlers
      writeStream.on('finish', () => {
        // Rename the temp file to the final output path
        fs.rename(tempFilePath, outputPath, (err) => {
          if (err) {
            console.error('Error renaming temp file:', err);
            reject(err);
            return;
          }
          console.log(`Direct stream download successful: ${outputPath}`);
          resolve(true);
        });
      });

      writeStream.on('error', (err) => {
        console.error('Write stream error:', err);
        // Clean up temp file if it exists
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        reject(err);
      });

      // Use a more direct approach with fetch
      const fetchVideo = async () => {
        try {
          // First try to get a direct video URL using ytdl-core's getInfo
          const info = await ytdl.getInfo(videoURL);
          const format = ytdl.chooseFormat(info.formats, { quality: 'highest' });

          if (!format || !format.url) {
            throw new Error('No suitable format found');
          }

          console.log(`Got direct video URL: ${format.url.substring(0, 50)}...`);

          // Create an HTTP request to the video URL
          const req = https.get(format.url, (res) => {
            if (res.statusCode !== 200) {
              writeStream.end();
              reject(new Error(`Failed to download video: HTTP ${res.statusCode}`));
              return;
            }

            // Pipe the response to the file
            res.pipe(writeStream);

            res.on('error', (err) => {
              console.error('Response error:', err);
              writeStream.end();
              reject(err);
            });
          });

          req.on('error', (err) => {
            console.error('Request error:', err);
            writeStream.end();
            reject(err);
          });
        } catch (err) {
          console.error('Error in fetchVideo:', err);
          writeStream.end();
          reject(err);
        }
      };

      // Start the fetch process
      fetchVideo();
    } catch (err) {
      console.error('Direct stream setup error:', err);
      reject(err);
    }
  });
}

module.exports = {
  download360pWithAudio,
  downloadWithDirectStream
};
