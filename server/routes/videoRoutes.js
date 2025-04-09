/**
 * API routes for media (video and audio) operations
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { VIDEOS_DIR, SERVER_URL } = require('../config');
const { downloadYouTubeVideo } = require('../services/youtubeService');
const { splitVideoIntoSegments, splitMediaIntoSegments } = require('../services/videoProcessingService');

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

    // Split the media file into segments
    const result = await splitMediaIntoSegments(
      mediaPath,
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
      message: `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} uploaded and split successfully`
    });
  } catch (error) {
    console.error(`Error processing ${mediaType} upload:`, error);
    res.status(500).json({
      success: false,
      error: error.message || `Failed to process ${mediaType}`
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
    const mediaId = req.query.mediaId || req.query.videoId || `${mediaType}_${Date.now()}`;
    const fileExtension = contentType.split('/')[1] || (isAudio ? 'mp3' : 'mp4');
    const filename = `${mediaId}.${fileExtension}`;
    const mediaPath = path.join(VIDEOS_DIR, filename);

    // Save the uploaded media file
    fs.writeFileSync(mediaPath, req.body);
    console.log(`${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} saved to ${mediaPath}`);

    // Get segment duration from query params or use default (10 minutes = 600 seconds)
    const segmentDuration = parseInt(req.query.segmentDuration || '600');
    const fastSplit = req.query.fastSplit === 'true';

    // Split the media file into segments
    const result = await splitMediaIntoSegments(
      mediaPath,
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
      message: `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} split successfully`
    });
  } catch (error) {
    console.error(`Error splitting ${mediaType}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || `Failed to split ${mediaType}`
    });
  }
});

module.exports = router;
