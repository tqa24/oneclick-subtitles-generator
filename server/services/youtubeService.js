/**
 * YouTube download functionality using multiple libraries
 * Implements a hybrid approach with multiple fallback mechanisms
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const ytdl = require('ytdl-core');
const playDl = require('play-dl');
const { spawn } = require('child_process');
const { VIDEOS_DIR } = require('../config');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const fsPromises = fs.promises;

/**
 * Check if ffmpeg is installed and available
 * @returns {Promise<boolean>} - True if ffmpeg is available
 */
async function isFFmpegAvailable() {
  try {
    await exec('ffmpeg -version');
    return true;
  } catch (error) {
    console.warn('FFmpeg is not available:', error.message);
    return false;
  }
}

/**
 * Merge video and audio files using ffmpeg
 * @param {string} videoPath - Path to the video file
 * @param {string} audioPath - Path to the audio file
 * @param {string} outputPath - Path to save the merged file
 * @returns {Promise<boolean>} - True if merge was successful
 */
async function mergeVideoAndAudio(videoPath, audioPath, outputPath) {
  try {
    console.log(`[QUALITY DEBUG] Merging video and audio files:`);
    console.log(`[QUALITY DEBUG] Video: ${videoPath}`);
    console.log(`[QUALITY DEBUG] Audio: ${audioPath}`);
    console.log(`[QUALITY DEBUG] Output: ${outputPath}`);

    // Use ffmpeg to merge the files
    const command = `ffmpeg -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -strict experimental "${outputPath}" -y`;
    console.log(`[QUALITY DEBUG] Running command: ${command}`);

    const { stdout, stderr } = await exec(command);

    if (stderr) {
      console.log(`[QUALITY DEBUG] FFmpeg stderr: ${stderr}`);
    }

    // Check if the output file exists
    if (fs.existsSync(outputPath)) {
      console.log(`[QUALITY DEBUG] Merge successful, output file exists`);
      return true;
    } else {
      console.error(`[QUALITY DEBUG] Merge failed, output file does not exist`);
      return false;
    }
  } catch (error) {
    console.error(`[QUALITY DEBUG] Error merging files:`, error);
    return false;
  }
}

/**
 * Download video and audio separately and merge them
 * @param {string} videoURL - YouTube video URL
 * @param {string} outputPath - Path to save the merged file
 * @param {Object} videoFormat - Video format to download
 * @param {Object} audioFormat - Audio format to download
 * @returns {Promise<boolean>} - True if download and merge was successful
 */
async function downloadAndMerge(videoURL, outputPath, videoFormat, audioFormat) {
  // Check if ffmpeg is available
  const ffmpegAvailable = await isFFmpegAvailable();
  if (!ffmpegAvailable) {
    console.error(`[QUALITY DEBUG] FFmpeg is not available, cannot merge video and audio`);
    return false;
  }

  // Create temporary file paths
  const tempVideoPath = `${outputPath}.video.tmp`;
  const tempAudioPath = `${outputPath}.audio.tmp`;

  try {
    console.log(`[QUALITY DEBUG] Downloading video and audio separately:`);
    console.log(`[QUALITY DEBUG] Video format: ${videoFormat.qualityLabel || videoFormat.quality}`);
    console.log(`[QUALITY DEBUG] Audio format: ${audioFormat.qualityLabel || 'audio only'}`);

    // Download video
    await new Promise((resolve, reject) => {
      const videoStream = ytdl(videoURL, { format: videoFormat });
      const videoWriteStream = fs.createWriteStream(tempVideoPath);

      videoWriteStream.on('finish', resolve);
      videoWriteStream.on('error', reject);
      videoStream.on('error', reject);

      videoStream.pipe(videoWriteStream);
    });

    console.log(`[QUALITY DEBUG] Video download complete: ${tempVideoPath}`);

    // Download audio
    await new Promise((resolve, reject) => {
      const audioStream = ytdl(videoURL, { format: audioFormat });
      const audioWriteStream = fs.createWriteStream(tempAudioPath);

      audioWriteStream.on('finish', resolve);
      audioWriteStream.on('error', reject);
      audioStream.on('error', reject);

      audioStream.pipe(audioWriteStream);
    });

    console.log(`[QUALITY DEBUG] Audio download complete: ${tempAudioPath}`);

    // Merge video and audio
    const mergeSuccess = await mergeVideoAndAudio(tempVideoPath, tempAudioPath, outputPath);

    // Clean up temporary files
    try {
      if (fs.existsSync(tempVideoPath)) {
        await fsPromises.unlink(tempVideoPath);
      }
      if (fs.existsSync(tempAudioPath)) {
        await fsPromises.unlink(tempAudioPath);
      }
    } catch (cleanupError) {
      console.warn(`[QUALITY DEBUG] Error cleaning up temporary files:`, cleanupError);
    }

    return mergeSuccess;
  } catch (error) {
    console.error(`[QUALITY DEBUG] Error in downloadAndMerge:`, error);

    // Clean up temporary files in case of error
    try {
      if (fs.existsSync(tempVideoPath)) {
        await fsPromises.unlink(tempVideoPath);
      }
      if (fs.existsSync(tempAudioPath)) {
        await fsPromises.unlink(tempAudioPath);
      }
    } catch (cleanupError) {
      console.warn(`[QUALITY DEBUG] Error cleaning up temporary files:`, cleanupError);
    }

    return false;
  }
}

/**
 * Download YouTube video using multiple methods with fallbacks
 * @param {string} videoId - YouTube video ID
 * @param {string} quality - Desired video quality (e.g., '144p', '360p', '720p')
 * @returns {Promise<Object>} - Result object with success status and path
 */
async function downloadYouTubeVideo(videoId, quality = '360p') {
  const videoURL = `https://www.youtube.com/watch?v=${videoId}`;
  const outputPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);

  console.log(`[QUALITY DEBUG] Downloading YouTube video: ${videoId} with quality: ${quality}`);

  // Get video info first
  let videoInfo;
  try {
    videoInfo = await getVideoInfo(videoId);
    console.log(`Video info retrieved: ${videoInfo.title}`);
  } catch (error) {
    console.warn(`Could not get video info from oEmbed API: ${error.message}`);
    videoInfo = { title: `YouTube Video ${videoId}` };
  }

  // Special handling for 360p to ensure we get audio
  if (quality === '360p') {
    try {
      console.log(`[QUALITY DEBUG] Using special 360p download method to ensure audio...`);
      const success = await download360pWithAudio(videoURL, outputPath);

      if (success) {
        console.log(`Successfully downloaded 360p video with audio`);
        return {
          success: true,
          path: outputPath,
          message: `Video downloaded successfully with 360p special method`,
          title: videoInfo.title,
          method: '360p-special'
        };
      }
    } catch (error) {
      console.error(`Error with special 360p download: ${error.message}`);
      console.log(`Falling back to standard methods...`);
    }
  }

  // Try multiple download methods in sequence
  const methods = [
    { name: 'ytdl-core', fn: downloadWithYtdlCore },
    { name: 'play-dl', fn: downloadWithPlayDl },
    { name: 'direct-stream', fn: downloadWithDirectStream }
  ];

  let lastError = null;

  for (const method of methods) {
    try {
      console.log(`Attempting to download with ${method.name}...`);
      const result = await method.fn(videoURL, outputPath, quality);
      console.log(`Successfully downloaded video with ${method.name}`);

      return {
        success: true,
        path: outputPath,
        message: `Video downloaded successfully with ${method.name}`,
        title: videoInfo.title,
        method: method.name
      };
    } catch (error) {
      console.error(`${method.name} download failed:`, error.message);
      lastError = error;
    }
  }

  // If we get here, all methods failed
  throw new Error(`All download methods failed. Last error: ${lastError?.message}`);
}

/**
 * Get basic video information from YouTube's oEmbed API
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Object>} - Video info object
 */
function getVideoInfo(videoId) {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;

    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to get video info: HTTP ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const info = JSON.parse(data);
          resolve({
            title: info.title,
            author: info.author_name,
            thumbnailUrl: info.thumbnail_url
          });
        } catch (error) {
          reject(new Error(`Failed to parse video info: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Failed to fetch video info: ${error.message}`));
    });
  });
}

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
  downloadYouTubeVideo
};
