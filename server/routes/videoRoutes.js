/**
 * API routes for video operations
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { VIDEOS_DIR, SEGMENTS_DIR, SERVER_URL } = require('../config');
const { downloadYouTubeVideo } = require('../services/youtubeService');
const { splitVideoIntoSegments } = require('../services/videoProcessingService');

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
  const segmentPath = path.join(SEGMENTS_DIR, `${segmentId}.mp4`);

  if (fs.existsSync(segmentPath)) {
    const stats = fs.statSync(segmentPath);
    res.json({
      exists: true,
      url: `/segments/${segmentId}.mp4`,
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
  const { videoId } = req.body;

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
    // Download the video using JavaScript libraries
    const result = await downloadYouTubeVideo(videoId);

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
 * POST /api/upload-and-split-video - Upload and split a video
 */
router.post('/upload-and-split-video', express.raw({ limit: '2gb', type: 'video/*' }), async (req, res) => {
  try {
    // Generate a unique filename
    const timestamp = Date.now();
    const fileExtension = req.headers['content-type'].split('/')[1] || 'mp4';
    const filename = `upload_${timestamp}.${fileExtension}`;
    const videoPath = path.join(VIDEOS_DIR, filename);

    // Save the uploaded video
    fs.writeFileSync(videoPath, req.body);
    console.log(`Video saved to ${videoPath}`);

    // Get segment duration from query params or use default (10 minutes)
    const segmentDuration = parseInt(req.query.segmentDuration || '600');

    // Split the video into segments
    const result = await splitVideoIntoSegments(
      videoPath,
      segmentDuration,
      SEGMENTS_DIR,
      `segment_${timestamp}`
    );

    // Return the list of segment files
    res.json({
      success: true,
      originalVideo: `/videos/${filename}`,
      batchId: result.batchId,
      segments: result.segments.map(segment => `/segments/${path.basename(segment)}`),
      message: 'Video uploaded and split successfully'
    });
  } catch (error) {
    console.error('Error processing video upload:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process video'
    });
  }
});

/**
 * POST /api/split-video - Split a video into segments
 */
router.post('/split-video', express.raw({ limit: '2gb', type: 'video/*' }), async (req, res) => {
  try {
    // Generate a unique filename for the original video
    const videoId = req.query.videoId || `video_${Date.now()}`;
    const fileExtension = req.headers['content-type'].split('/')[1] || 'mp4';
    const filename = `${videoId}.${fileExtension}`;
    const videoPath = path.join(VIDEOS_DIR, filename);

    // Save the uploaded video
    fs.writeFileSync(videoPath, req.body);
    console.log(`Video saved to ${videoPath}`);

    // Get segment duration from query params or use default (10 minutes = 600 seconds)
    const segmentDuration = parseInt(req.query.segmentDuration || '600');

    // Split the video into segments
    const result = await splitVideoIntoSegments(
      videoPath,
      segmentDuration,
      VIDEOS_DIR, // Save segments in the videos directory
      `${videoId}_part`
    );

    // Return the list of segment files
    res.json({
      success: true,
      originalVideo: `/videos/${filename}`,
      videoId: videoId,
      segments: result.segments.map(segment => {
        const segmentName = path.basename(segment);
        return {
          path: `/videos/${segmentName}`,
          url: `${SERVER_URL}/videos/${segmentName}`,
          name: segmentName
        };
      }),
      message: 'Video split successfully'
    });
  } catch (error) {
    console.error('Error splitting video:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to split video'
    });
  }
});

module.exports = router;
