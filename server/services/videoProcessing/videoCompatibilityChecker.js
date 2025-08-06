/**
 * Video Compatibility Checker and Processor
 * Handles TikTok and other problematic video formats
 */

const { spawn } = require('child_process');
const { getFfprobePath } = require('../shared/ffmpegUtils');
const path = require('path');
const fs = require('fs').promises;

/**
 * Check if a video file is compatible with Remotion rendering
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<Object>} - Compatibility report
 */
async function checkVideoCompatibility(videoPath) {
  return new Promise((resolve, reject) => {
    const ffprobeArgs = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      videoPath
    ];

    const ffprobePath = getFfprobePath();
    const ffprobe = spawn(ffprobePath, ffprobeArgs);
    let stdout = '';
    let stderr = '';

    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FFprobe failed: ${stderr}`));
        return;
      }

      try {
        const data = JSON.parse(stdout);
        const videoStream = data.streams?.find(s => s.codec_type === 'video');
        const audioStream = data.streams?.find(s => s.codec_type === 'audio');

        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        const compatibility = {
          isCompatible: true,
          issues: [],
          videoCodec: videoStream.codec_name,
          audioCodec: audioStream?.codec_name,
          width: parseInt(videoStream.width),
          height: parseInt(videoStream.height),
          duration: parseFloat(data.format.duration),
          bitrate: parseInt(data.format.bit_rate),
          frameRate: eval(videoStream.r_frame_rate), // Convert fraction to decimal
          pixelFormat: videoStream.pix_fmt,
          profile: videoStream.profile,
          level: videoStream.level
        };

        // Check for common TikTok/problematic video issues
        checkCodecCompatibility(compatibility);
        checkMetadataIssues(compatibility, data);
        checkEncodingIssues(compatibility);

        resolve(compatibility);
      } catch (error) {
        reject(new Error(`Failed to parse FFprobe output: ${error.message}`));
      }
    });

    ffprobe.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Check codec compatibility with Remotion
 */
function checkCodecCompatibility(compatibility) {
  // Problematic video codecs - VP9 is supported by Remotion (Chrome supports VP9)
  const problematicVideoCodecs = ['hevc', 'av1'];
  const problematicAudioCodecs = ['opus', 'vorbis'];

  if (problematicVideoCodecs.includes(compatibility.videoCodec)) {
    compatibility.isCompatible = false;
    compatibility.issues.push({
      type: 'video_codec',
      message: `Video codec ${compatibility.videoCodec} may cause issues with Remotion`,
      severity: 'high'
    });
  }

  if (compatibility.audioCodec && problematicAudioCodecs.includes(compatibility.audioCodec)) {
    compatibility.issues.push({
      type: 'audio_codec',
      message: `Audio codec ${compatibility.audioCodec} may cause issues`,
      severity: 'medium'
    });
  }

  // Check for missing audio
  if (!compatibility.audioCodec) {
    compatibility.issues.push({
      type: 'no_audio',
      message: 'Video has no audio stream',
      severity: 'low'
    });
  }
}

/**
 * Check for metadata issues common in TikTok videos
 */
function checkMetadataIssues(compatibility, data) {
  // Check for invalid duration
  if (!compatibility.duration || compatibility.duration <= 0) {
    compatibility.isCompatible = false;
    compatibility.issues.push({
      type: 'invalid_duration',
      message: 'Video duration could not be determined',
      severity: 'high'
    });
  }

  // Check for invalid dimensions
  if (!compatibility.width || !compatibility.height || compatibility.width <= 0 || compatibility.height <= 0) {
    compatibility.isCompatible = false;
    compatibility.issues.push({
      type: 'invalid_dimensions',
      message: 'Video dimensions could not be determined',
      severity: 'high'
    });
  }

  // Check for variable frame rate (common in TikTok videos)
  if (compatibility.frameRate <= 0 || compatibility.frameRate > 120) {
    compatibility.issues.push({
      type: 'unusual_framerate',
      message: `Unusual frame rate: ${compatibility.frameRate}fps`,
      severity: 'medium'
    });
  }
}

/**
 * Check for encoding issues
 */
function checkEncodingIssues(compatibility) {
  // Check for unusual pixel formats
  const supportedPixelFormats = ['yuv420p', 'yuv422p', 'yuv444p'];
  if (compatibility.pixelFormat && !supportedPixelFormats.includes(compatibility.pixelFormat)) {
    compatibility.issues.push({
      type: 'pixel_format',
      message: `Unusual pixel format: ${compatibility.pixelFormat}`,
      severity: 'medium'
    });
  }

  // Check for very high or very low bitrates
  if (compatibility.bitrate) {
    if (compatibility.bitrate < 100000) { // Less than 100kbps
      compatibility.issues.push({
        type: 'low_bitrate',
        message: 'Very low bitrate may indicate quality issues',
        severity: 'low'
      });
    } else if (compatibility.bitrate > 50000000) { // More than 50Mbps
      compatibility.issues.push({
        type: 'high_bitrate',
        message: 'Very high bitrate may cause processing issues',
        severity: 'medium'
      });
    }
  }
}

/**
 * Convert a problematic video to a Remotion-compatible format
 * @param {string} inputPath - Path to the input video
 * @param {string} outputPath - Path for the output video
 * @param {Object} options - Conversion options
 * @returns {Promise<Object>} - Conversion result
 */
async function convertToCompatibleFormat(inputPath, outputPath, options = {}) {
  const {
    targetWidth = null,
    targetHeight = null,
    targetFrameRate = 30,
    targetBitrate = '2M',
    preserveAspectRatio = true
  } = options;

  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-i', inputPath,
      '-c:v', 'libx264',           // Use H.264 codec (most compatible)
      '-preset', 'medium',          // Balance between speed and compression
      '-crf', '23',                 // Good quality
      '-pix_fmt', 'yuv420p',        // Compatible pixel format
      '-c:a', 'aac',                // Use AAC audio codec
      '-b:a', '128k',               // Audio bitrate
      '-movflags', '+faststart',    // Optimize for web playback
      '-avoid_negative_ts', 'make_zero', // Fix timestamp issues
      '-fflags', '+genpts',         // Generate presentation timestamps
      '-r', targetFrameRate.toString(), // Set frame rate
      '-y',                         // Overwrite output file
      outputPath
    ];

    // Add video scaling if dimensions are specified
    if (targetWidth && targetHeight) {
      if (preserveAspectRatio) {
        ffmpegArgs.splice(-2, 0, '-vf', `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black`);
      } else {
        ffmpegArgs.splice(-2, 0, '-vf', `scale=${targetWidth}:${targetHeight}`);
      }
    }

    console.log(`[VideoCompatibility] Converting video with args: ${ffmpegArgs.join(' ')}`);

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
      // Log progress
      if (data.toString().includes('frame=')) {
        process.stdout.write('.');
      }
    });

    ffmpeg.on('close', async (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg conversion failed: ${stderr}`));
        return;
      }

      try {
        // Verify the output file was created and has content
        const stats = await fs.stat(outputPath);
        if (stats.size < 1000) {
          reject(new Error('Converted file is too small, conversion may have failed'));
          return;
        }

        console.log(`\n[VideoCompatibility] Conversion completed successfully`);
        resolve({
          success: true,
          outputPath: outputPath,
          originalSize: (await fs.stat(inputPath)).size,
          convertedSize: stats.size
        });
      } catch (error) {
        reject(new Error(`Failed to verify converted file: ${error.message}`));
      }
    });

    ffmpeg.on('error', (error) => {
      reject(error);
    });
  });
}

module.exports = {
  checkVideoCompatibility,
  convertToCompatibleFormat
};
