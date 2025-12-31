/**
 * Video normalizer for Douyin videos
 * Fixes format issues that cause problems with subtitle generation
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const util = require('util');
const execPromise = util.promisify(exec);
const { getFfmpegPath } = require('../shared/ffmpegUtils');

/**
 * Normalize a Douyin video to fix common format issues
 * @param {string} inputPath - Path to the downloaded Douyin video
 * @param {string} outputPath - Path for the normalized video (optional)
 * @returns {Promise<string>} - Path to the normalized video
 */
async function normalizeDouyinVideo(inputPath, outputPath = null) {
  console.log('[VideoNormalizer] Starting normalization for:', inputPath);
  
  // Generate output path if not provided
  if (!outputPath) {
    const dir = path.dirname(inputPath);
    const basename = path.basename(inputPath, '.mp4');
    outputPath = path.join(dir, `${basename}_normalized.mp4`);
  }
  
  // Build ffmpeg command to fix all issues
  const ffmpegPath = getFfmpegPath();
  const ffmpegCmd = [
    `"${ffmpegPath}"`,
    '-i', `"${inputPath}"`,
    '-y', // Overwrite output
    
    // Map streams in correct order (video first, then audio)
    '-map', '0:v:0', // Map first video stream
    '-map', '0:a:0', // Map first audio stream
    
    // Video settings - keep original quality
    '-c:v', 'libx264', // Re-encode with H.264
    '-preset', 'fast', // Fast encoding
    '-crf', '23', // Good quality
    '-pix_fmt', 'yuv420p', // Compatible pixel format
    '-movflags', '+faststart', // Web optimization
    
    // Audio settings - convert to standard AAC
    '-c:a', 'aac', // Convert to standard AAC (not HE-AAC)
    '-b:a', '128k', // Better audio bitrate
    '-ar', '44100', // Keep sample rate
    '-ac', '2', // Stereo
    
    // Remove all metadata
    '-map_metadata', '-1', // Strip all metadata
    '-metadata', 'comment=""', // Clear comment
    '-metadata', 'title=""', // Clear title
    
    // Fix timing issues
    '-vsync', 'cfr', // Constant frame rate
    '-r', '30', // Force 30 fps
    '-async', '1', // Sync audio start
    
    // Output
    `"${outputPath}"`
  ].join(' ');
  
  try {
    console.log('[VideoNormalizer] Running ffmpeg normalization...');
    const { stdout, stderr } = await execPromise(ffmpegCmd, {
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    // Check if output file exists
    await fs.access(outputPath);
    
    // Get file stats for verification
    const stats = await fs.stat(outputPath);
    console.log('[VideoNormalizer] Normalized video created:', {
      path: outputPath,
      size: Math.round(stats.size / 1024 / 1024 * 100) / 100 + ' MB'
    });
    
    return outputPath;
    
  } catch (error) {
    console.error('[VideoNormalizer] Normalization failed:', error.message);
    throw new Error(`Video normalization failed: ${error.message}`);
  }
}

/**
 * Check if a video needs normalization
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<Object>} - Object with issues found and needsNormalization flag
 */
async function checkVideoIssues(videoPath) {
  const { getFfprobePath } = require('../shared/ffmpegUtils');
  const ffprobePath = getFfprobePath();
  const ffprobeCmd = `"${ffprobePath}" -v quiet -print_format json -show_streams -show_format "${videoPath}"`;
  
  try {
    const { stdout } = await execPromise(ffprobeCmd);
    const data = JSON.parse(stdout);
    
    const issues = [];
    let needsNormalization = false;
    
    // Check stream order
    const streams = data.streams || [];
    const firstVideoIndex = streams.findIndex(s => s.codec_type === 'video');
    const firstAudioIndex = streams.findIndex(s => s.codec_type === 'audio');
    
    if (firstAudioIndex !== -1 && firstVideoIndex !== -1 && firstAudioIndex < firstVideoIndex) {
      issues.push('Audio stream before video stream');
      needsNormalization = true;
    }
    
    // Check for HE-AAC audio
    const audioStream = streams.find(s => s.codec_type === 'audio');
    if (audioStream && audioStream.profile && audioStream.profile.includes('HE-AAC')) {
      issues.push(`HE-AAC audio codec (${audioStream.profile})`);
      needsNormalization = true;
    }
    
    // Check duration (warn if over 5 minutes)
    const duration = parseFloat(data.format.duration || 0);
    if (duration > 300) {
      issues.push(`Long duration: ${Math.round(duration)} seconds`);
      // Don't force normalization for this, just warn
    }
    
    // Check for Douyin metadata
    if (data.format.tags) {
      if (data.format.tags.comment && data.format.tags.comment.includes('vid:')) {
        issues.push('Contains Douyin metadata');
        needsNormalization = true;
      }
      if (data.format.tags.information && data.format.tags.information.includes('bytedance')) {
        issues.push('Contains Bytedance metadata');
        needsNormalization = true;
      }
    }
    
    return {
      needsNormalization,
      issues,
      duration,
      format: data.format,
      streams: streams.map(s => ({
        index: s.index,
        type: s.codec_type,
        codec: s.codec_name,
        profile: s.profile
      }))
    };
    
  } catch (error) {
    console.error('[VideoNormalizer] Error checking video:', error);
    return {
      needsNormalization: true,
      issues: ['Unable to analyze video'],
      error: error.message
    };
  }
}

/**
 * Quick normalize - only fix critical issues (stream order and codec)
 * @param {string} inputPath - Path to the downloaded Douyin video
 * @returns {Promise<string>} - Path to the normalized video
 */
async function quickNormalizeDouyinVideo(inputPath) {
  console.log('[VideoNormalizer] Quick normalization for:', inputPath);
  
  const dir = path.dirname(inputPath);
  const basename = path.basename(inputPath, '.mp4');
  const outputPath = path.join(dir, `${basename}_fixed.mp4`);
  
  // Simpler, faster command - just fix stream order and audio codec
  const ffmpegPath = getFfmpegPath();
  const ffmpegCmd = [
    `"${ffmpegPath}"`,
    '-i', `"${inputPath}"`,
    '-y',
    '-map', '0:v:0', // Video first
    '-map', '0:a:0', // Audio second
    '-c:v', 'copy', // Copy video (no re-encode)
    '-c:a', 'aac', // Convert audio to standard AAC
    '-b:a', '128k',
    '-movflags', '+faststart',
    `"${outputPath}"`
  ].join(' ');
  
  try {
    await execPromise(ffmpegCmd);
    console.log('[VideoNormalizer] Quick fix completed:', outputPath);
    return outputPath;
  } catch (error) {
    console.error('[VideoNormalizer] Quick fix failed, trying full normalization...');
    return normalizeDouyinVideo(inputPath, outputPath);
  }
}

module.exports = {
  normalizeDouyinVideo,
  checkVideoIssues,
  quickNormalizeDouyinVideo
};
