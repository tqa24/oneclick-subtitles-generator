/**
 * API routes for media (video and audio) operations
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { VIDEOS_DIR, SERVER_URL } = require('../config');
const { downloadYouTubeVideo } = require('../services/youtube');
const {
  splitVideoIntoSegments,
  splitMediaIntoSegments,
  optimizeVideo,
  createAnalysisVideo,
  convertAudioToVideo
} = require('../services/videoProcessingService');

/**
 * GET /api/video-exists/:videoId - Check if a video exists
 */
router.get('/video-exists/:videoId', (req, res) => {
  const { videoId } = req.params;
  const videoPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);

  if (fs.existsSync(videoPath)) {
    const stats = fs.statSync(videoPath);
    res.json({
      exists: true,
      url: `/videos/${videoId}.mp4`,
      size: stats.size,
      createdAt: stats.birthtime
    });
  } else {
    res.json({ exists: false });
  }
});

/**
 * GET /api/segment-exists/:segmentId - Check if a segment exists
 */
router.get('/segment-exists/:segmentId', (req, res) => {
  const { segmentId } = req.params;
  const segmentPath = path.join(VIDEOS_DIR, `${segmentId}.mp4`);

  if (fs.existsSync(segmentPath)) {
    const stats = fs.statSync(segmentPath);
    res.json({
      exists: true,
      url: `/videos/${segmentId}.mp4`,
      size: stats.size,
      createdAt: stats.birthtime
    });
  } else {
    res.json({ exists: false });
  }
});

/**
 * POST /api/download-video - Download a YouTube video
 */
router.post('/download-video', async (req, res) => {
  const { videoId, quality } = req.body;

  console.log(`[QUALITY DEBUG] Received download request for videoId: ${videoId} with quality: ${quality || 'not specified'}`);

  if (!videoId) {
    return res.status(400).json({ error: 'Video ID is required' });
  }

  const videoPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);

  // Check if video already exists
  if (fs.existsSync(videoPath)) {
    return res.json({
      success: true,
      message: 'Video already downloaded',
      url: `/videos/${videoId}.mp4`
    });
  }

  try {
    // Download the video using JavaScript libraries with specified quality
    const result = await downloadYouTubeVideo(videoId, quality);

    // Check if the file was created successfully
    if (fs.existsSync(videoPath)) {
      console.log(`Video downloaded successfully: ${videoId}.mp4`);
      return res.json({
        success: true,
        message: result.message || 'Video downloaded successfully',
        url: `/videos/${videoId}.mp4`
      });
    } else {
      throw new Error('Download completed but video file was not found');
    }
  } catch (error) {
    console.error('Error downloading video:', error);

    // Clean up any partial file
    try {
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
    } catch (e) {
      console.error('Error cleaning up incomplete file:', e);
    }

    return res.status(500).json({
      error: 'Failed to download video',
      details: error.message
    });
  }
});

/**
 * POST /api/upload-and-split-video - Upload and split a media file (video or audio)
 */
router.post('/upload-and-split-video', express.raw({ limit: '2gb', type: '*/*' }), async (req, res) => {
  try {
    // Determine if this is a video or audio file based on MIME type
    const contentType = req.headers['content-type'] || '';
    const isAudio = contentType.startsWith('audio/');
    const mediaType = isAudio ? 'audio' : 'video';

    // Generate a unique filename
    const timestamp = Date.now();
    const fileExtension = contentType.split('/')[1] || (isAudio ? 'mp3' : 'mp4');
    const filename = `upload_${timestamp}.${fileExtension}`;
    const mediaPath = path.join(VIDEOS_DIR, filename);

    // Save the uploaded media file
    fs.writeFileSync(mediaPath, req.body);
    console.log(`${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} saved to ${mediaPath}`);

    // Get segment duration from query params or use default (10 minutes)
    const segmentDuration = parseInt(req.query.segmentDuration || '600');
    const fastSplit = req.query.fastSplit === 'true';
    const optimizeVideos = req.query.optimizeVideos === 'true';
    const optimizedResolution = req.query.optimizedResolution || '360p';

    let processPath = mediaPath;
    let optimizedResult = null;

    // Optimize video if requested and it's a video (not audio)
    if (optimizeVideos && !isAudio) {
      try {
        console.log(`Optimizing video to ${optimizedResolution} before splitting`);
        const optimizedFilename = `optimized_${timestamp}.mp4`;
        const optimizedPath = path.join(VIDEOS_DIR, optimizedFilename);

        optimizedResult = await optimizeVideo(processPath, optimizedPath, {
          resolution: optimizedResolution,
          fps: 15
        });

        // Use the optimized video for splitting
        processPath = optimizedPath;
        console.log(`Using optimized video for splitting: ${optimizedPath}`);
      } catch (error) {
        console.error('Error optimizing video:', error);
        console.log('Falling back to previous video for splitting');
      }
    }

    // Split the media file into segments
    const result = await splitMediaIntoSegments(
      processPath,
      segmentDuration,
      VIDEOS_DIR,
      `segment_${timestamp}`,
      {
        fastSplit,
        mediaType
      }
    );

    // Return the list of segment files
    res.json({
      success: true,
      originalMedia: `/videos/${filename}`,
      mediaType: mediaType,
      batchId: result.batchId,
      segments: result.segments.map(segment => `/videos/${path.basename(segment.path)}`),
      message: `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} uploaded and split successfully`,
      // Include optimized video information if available and actually optimized
      optimized: optimizedResult ? {
        video: `/videos/${path.basename(optimizedResult.path)}`,
        resolution: optimizedResult.resolution,
        fps: optimizedResult.fps,
        width: optimizedResult.width,
        height: optimizedResult.height,
        wasOptimized: optimizedResult.optimized !== false
      } : null
    });
  } catch (error) {
    const errorMediaType = req.headers['content-type']?.startsWith('audio/') ? 'audio' : 'video';
    console.error(`Error processing ${errorMediaType} upload:`, error);
    res.status(500).json({
      success: false,
      error: error.message || `Failed to process ${errorMediaType}`
    });
  }
});

/**
 * POST /api/split-video - Split a media file (video or audio) into segments
 */
router.post('/split-video', express.raw({ limit: '2gb', type: '*/*' }), async (req, res) => {
  try {
    // Determine if this is a video or audio file based on MIME type
    const contentType = req.headers['content-type'] || '';
    const isAudio = contentType.startsWith('audio/');
    const mediaType = isAudio ? 'audio' : 'video';

    // Generate a unique filename for the original media file
    let mediaId = req.query.mediaId || req.query.videoId || `${mediaType}_${Date.now()}`;

    // Remove any file extension from mediaId to prevent double extensions
    mediaId = mediaId.replace(/\.(mp[34]|webm|mov|avi|wmv|flv|mkv)$/i, '');

    // Log the cleaned mediaId
    console.log(`[SPLIT-VIDEO] Using mediaId: ${mediaId} (after removing any extensions)`);

    const fileExtension = contentType.split('/')[1] || (isAudio ? 'mp3' : 'mp4');
    const filename = `${mediaId}.${fileExtension}`;
    const mediaPath = path.join(VIDEOS_DIR, filename);

    // Save the uploaded media file
    fs.writeFileSync(mediaPath, req.body);
    console.log(`[SPLIT-VIDEO] ${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} saved to ${mediaPath}`);
    console.log(`[SPLIT-VIDEO] Content-Type: ${contentType}, File size: ${req.body.length} bytes`);

    // Get segment duration from query params or use default (10 minutes = 600 seconds)
    const segmentDuration = parseInt(req.query.segmentDuration || '600');
    const fastSplit = req.query.fastSplit === 'true';
    // Parse optimizeVideos parameter - default to false to avoid duplication
    // Check explicitly for 'true' string to ensure we don't optimize unless explicitly requested
    const optimizeVideos = req.query.optimizeVideos === 'true';
    console.log(`[SPLIT-VIDEO] optimizeVideos parameter: ${req.query.optimizeVideos}, parsed as: ${optimizeVideos}`);
    const optimizedResolution = req.query.optimizedResolution || '360p';

    let processPath = mediaPath;
    let optimizedResult = null;

    // Optimize video if requested and it's a video (not audio)
    if (optimizeVideos && !isAudio) {
      try {
        console.log(`[SPLIT-VIDEO] Optimizing video to ${optimizedResolution} before splitting`);
        console.log(`[SPLIT-VIDEO] optimizeVideos=${optimizeVideos} (should be false if already optimized)`);
        // Ensure we don't have double extensions in the optimized filename
        const cleanMediaId = mediaId.replace(/\.(mp[34]|webm|mov|avi|wmv|flv|mkv)$/i, '');
        const optimizedFilename = `optimized_${cleanMediaId}.mp4`;
        const optimizedPath = path.join(VIDEOS_DIR, optimizedFilename);
        console.log(`[SPLIT-VIDEO] Creating optimized video at: ${optimizedPath}`);

        optimizedResult = await optimizeVideo(processPath, optimizedPath, {
          resolution: optimizedResolution,
          fps: 15
        });

        // Double-check that the optimization was successful
        if (!optimizedResult) {
          console.error(`[SPLIT-VIDEO] Optimization failed: optimizedResult is null or undefined`);
          throw new Error('Video optimization failed');
        }

        // Only use the optimized video if it actually exists
        if (fs.existsSync(optimizedPath)) {
          processPath = optimizedPath;
          console.log(`[SPLIT-VIDEO] Using optimized video for splitting: ${optimizedPath}`);
        } else {
          console.log(`[SPLIT-VIDEO] Optimized video not found at ${optimizedPath}, falling back to original video`);
          // Keep using the original video path
        }
      } catch (error) {
        console.error('[SPLIT-VIDEO] Error optimizing video:', error);
        console.log('[SPLIT-VIDEO] Falling back to previous video for splitting');
      }
    }

    // Split the media file into segments
    const result = await splitMediaIntoSegments(
      processPath,
      segmentDuration,
      VIDEOS_DIR,
      `${mediaId}_part`,
      {
        fastSplit,
        mediaType
      }
    );

    // Return the list of segment files with actual durations
    res.json({
      success: true,
      originalMedia: `/videos/${filename}`,
      mediaId: mediaId,
      mediaType: mediaType,
      segments: result.segments.map(segment => ({
        path: `/videos/${path.basename(segment.path)}`,
        // Include actual duration and start time in the URL as query parameters
        url: `${SERVER_URL}/videos/${path.basename(segment.path)}?startTime=${segment.startTime}&duration=${segment.duration}`,
        name: path.basename(segment.path),
        // Include actual duration and start time in the segment object
        startTime: segment.startTime,
        duration: segment.duration,
        // Include theoretical values for reference
        theoreticalStartTime: segment.theoreticalStartTime,
        theoreticalDuration: segment.theoreticalDuration
      })),
      message: `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} split successfully`,
      // Include optimized video information if available and actually optimized
      optimized: optimizedResult ? {
        video: `/videos/${path.basename(optimizedResult.path)}`,
        resolution: optimizedResult.resolution,
        fps: optimizedResult.fps,
        width: optimizedResult.width,
        height: optimizedResult.height,
        wasOptimized: optimizedResult.optimized !== false
      } : null
    });
  } catch (error) {
    const errorMediaType = req.headers['content-type']?.startsWith('audio/') ? 'audio' : 'video';
    console.error(`[SPLIT-VIDEO] Error splitting ${errorMediaType}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || `Failed to split ${errorMediaType}`
    });
  }
});

/**
 * POST /api/optimize-video - Optimize a video by scaling it to a lower resolution and reducing the frame rate
 * Also creates an analysis video with 500 frames for Gemini analysis
 * Automatically converts audio files to video at the start
 */
router.post('/optimize-video', express.raw({ limit: '2gb', type: '*/*' }), async (req, res) => {
  try {
    // Get optimization options from query params
    const resolution = req.query.resolution || '360p';
    const fps = parseInt(req.query.fps || '15');

    // Determine if this is a video or audio file based on MIME type
    const contentType = req.headers['content-type'] || 'video/mp4';
    const isAudio = contentType.startsWith('audio/');
    const mediaType = isAudio ? 'audio' : 'video';

    // Generate a unique filename for the original file
    const timestamp = Date.now();
    const originalFileExtension = contentType.split('/')[1] || (isAudio ? 'mp3' : 'mp4');
    const originalFilename = `original_${timestamp}.${originalFileExtension}`;
    const originalPath = path.join(VIDEOS_DIR, originalFilename);

    // Always use mp4 for processed files
    const optimizedFilename = `optimized_${timestamp}.mp4`;
    const analysisFilename = `analysis_500frames_${timestamp}.mp4`;
    const optimizedPath = path.join(VIDEOS_DIR, optimizedFilename);
    const analysisPath = path.join(VIDEOS_DIR, analysisFilename);

    // Save the uploaded file
    fs.writeFileSync(originalPath, req.body);
    console.log(`[OPTIMIZE-VIDEO] Original ${mediaType} saved to ${originalPath}`);
    console.log(`[OPTIMIZE-VIDEO] Content-Type: ${contentType}, File size: ${req.body.length} bytes`);

    // If it's an audio file, convert it to video first
    let videoPath = originalPath;

    if (isAudio) {
      try {
        console.log(`[OPTIMIZE-VIDEO] Converting audio to video at the start`);
        const videoFilename = `converted_${timestamp}.mp4`;
        videoPath = path.join(VIDEOS_DIR, videoFilename);

        await convertAudioToVideo(originalPath, videoPath);
        console.log(`[OPTIMIZE-VIDEO] Audio successfully converted to video: ${videoPath}`);
      } catch (error) {
        console.error('[OPTIMIZE-VIDEO] Error converting audio to video:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to convert audio to video'
        });
      }
    }

    // Optimize the video
    console.log(`[OPTIMIZE-VIDEO] Optimizing ${isAudio ? 'converted audio' : 'video'} to ${resolution} at ${fps}fps`);
    console.log(`[OPTIMIZE-VIDEO] Optimized video will be saved to: ${optimizedPath}`);
    const result = await optimizeVideo(videoPath, optimizedPath, {
      resolution,
      fps
    });

    // Determine which video to use for analysis (optimized or original)
    const wasOptimized = result.optimized !== false;
    const videoForAnalysis = wasOptimized ? optimizedPath : videoPath;

    // Create an analysis video with 500 frames
    console.log('[OPTIMIZE-VIDEO] Creating analysis video with 500 frames for Gemini analysis');
    console.log(`[OPTIMIZE-VIDEO] Analysis video will be saved to: ${analysisPath}`);
    console.log(`[OPTIMIZE-VIDEO] Using ${wasOptimized ? 'optimized' : 'original'} video for analysis`);
    const analysisResult = await createAnalysisVideo(videoForAnalysis, analysisPath);

    if (analysisResult.isOriginal) {
      console.log(`[OPTIMIZE-VIDEO] Video has only ${analysisResult.frameCount} frames, using optimized video for analysis`);
    } else {
      console.log(`[OPTIMIZE-VIDEO] Successfully created analysis video with 500 frames from ${analysisResult.originalFrameCount} original frames`);
      console.log(`[OPTIMIZE-VIDEO] Analysis video saved to: ${analysisResult.path}`);
    }

    // Return the optimized and analysis video information
    // Use the optimized video path based on whether optimization was performed
    const optimizedVideoPath = wasOptimized ? `/videos/${optimizedFilename}` : `/videos/${originalFilename}`;

    res.json({
      success: true,
      originalMedia: `/videos/${originalFilename}`,
      // Report the original media type to the client
      mediaType: isAudio ? 'audio' : 'video',
      optimizedVideo: optimizedVideoPath,
      resolution: result.resolution,
      fps: result.fps,
      width: result.width,
      height: result.height,
      duration: result.duration,
      message: wasOptimized
        ? `${isAudio ? 'Audio' : 'Video'} optimized successfully to ${result.resolution} at ${result.fps}fps`
        : `${isAudio ? 'Audio' : 'Video'} resolution (${result.width}x${result.height}) is already ${result.height}p or lower. No optimization needed.`,
      // Include analysis video information
      analysis: analysisResult.isOriginal ? {
        // If the video has fewer than 500 frames, we use the optimized video (or original if not optimized)
        video: optimizedVideoPath,
        frameCount: analysisResult.frameCount,
        message: 'Using video for analysis (fewer than 500 frames)'
      } : {
        video: `/videos/${analysisFilename}`,
        frameCount: analysisResult.frameCount,
        originalFrameCount: analysisResult.originalFrameCount,
        frameInterval: analysisResult.frameInterval,
        message: `Created 500-frame analysis video from ${analysisResult.originalFrameCount} original frames`
      }
    });
  } catch (error) {
    const errorMediaType = req.headers['content-type']?.startsWith('audio/') ? 'audio' : 'video';
    console.error(`[OPTIMIZE-VIDEO] Error optimizing ${errorMediaType}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || `Failed to optimize ${errorMediaType}`
    });
  }
});

/**
 * POST /api/convert-audio-to-video - Convert an audio file to a video file
 */
router.post('/convert-audio-to-video', express.raw({ limit: '2gb', type: 'audio/*' }), async (req, res) => {
  try {
    // Get the content type to determine the audio format
    const contentType = req.headers['content-type'] || 'audio/mp3';

    // Generate a unique filename for the audio file
    const timestamp = Date.now();
    const fileExtension = contentType.split('/')[1] || 'mp3';
    const audioFilename = `audio_${timestamp}.${fileExtension}`;
    const videoFilename = `converted_${timestamp}.mp4`;
    const audioPath = path.join(VIDEOS_DIR, audioFilename);
    const videoPath = path.join(VIDEOS_DIR, videoFilename);

    // Save the uploaded audio file
    fs.writeFileSync(audioPath, req.body);
    console.log(`[CONVERT-AUDIO] Audio saved to ${audioPath}`);
    console.log(`[CONVERT-AUDIO] Content-Type: ${contentType}, File size: ${req.body.length} bytes`);

    // Convert the audio to video
    console.log(`[CONVERT-AUDIO] Converting audio to video`);
    const result = await convertAudioToVideo(audioPath, videoPath);
    console.log(`[CONVERT-AUDIO] Audio converted to video: ${videoPath}`);

    // Delete the original audio file - we don't need it anymore
    try {
      fs.unlinkSync(audioPath);
      console.log(`[CONVERT-AUDIO] Deleted original audio file: ${audioPath}`);
    } catch (deleteError) {
      console.error(`[CONVERT-AUDIO] Error deleting audio file: ${deleteError.message}`);
    }

    // Return the path to the video file
    res.json({
      success: true,
      video: `/videos/${videoFilename}`,
      width: result.width,
      height: result.height,
      fps: result.fps,
      duration: result.duration,
      resolution: '144p',  // Explicitly set resolution to 144p
      message: 'Audio converted to video successfully'
    });
  } catch (error) {
    console.error('[CONVERT-AUDIO] Error converting audio to video:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to convert audio to video'
    });
  }
});

module.exports = router;
