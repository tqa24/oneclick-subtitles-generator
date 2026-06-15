/**
 * Routes for querying media existence/metadata and basic file management
 * (video-exists, segment-exists, video-dimensions, probe-media, copy-large-file, delete-videos).
 * Registered onto the shared media router by videoRoutes.js.
 */

const fs = require('fs');
const path = require('path');
const { VIDEOS_DIR } = require('../config');
const { normalizeVideo } = require('../services/video/universalVideoNormalizer');
const { getVideoDimensions } = require('./videoMetadataHelpers');
const { upload } = require('./videoUploadConfig');

/**
 * Registers media-info and file-management routes onto the provided router.
 * @param {import('express').Router} router
 */
function registerVideoMediaInfoRoutes(router) {
  /**
   * POST /api/copy-large-file - Copy a large file to the videos directory with progress tracking
   */
  router.post('/copy-large-file', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const filePath = req.file.path;
      const filename = req.file.filename;

      // Normalize the video if needed (fix codec/stream issues)
      console.log('[UPLOAD] Checking video for compatibility issues...');
      const normalizationResult = await normalizeVideo(filePath);

      if (normalizationResult.normalized) {
        console.log(`[UPLOAD] Video normalized using ${normalizationResult.method}`);
      }

      // Return the file path for the client to reference
      res.json({
        success: true,
        filePath: `/videos/${filename}`,
        serverPath: filePath,
        size: req.file.size,
        normalized: normalizationResult.normalized,
        normalizationMethod: normalizationResult.method || null,
        message: normalizationResult.normalized ?
          'File uploaded and normalized successfully' :
          'Large file copied successfully'
      });
    } catch (error) {
      console.error('Error copying large file:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to copy large file',
        details: error.message
      });
    }
  });

  /**
   * GET /api/video-exists/:videoId - Check if a video exists
   */
  router.get('/video-exists/:videoId', (req, res) => {
    const { videoId } = req.params;
    let videoPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);
    let filename = `${videoId}.mp4`;

    // If exact match doesn't exist, look for files starting with videoId
    if (!fs.existsSync(videoPath)) {
      const files = fs.readdirSync(VIDEOS_DIR);
      const matchingFile = files.find(file =>
        file.startsWith(`${videoId}_`) && file.endsWith('.mp4')
      );

      if (matchingFile) {
        videoPath = path.join(VIDEOS_DIR, matchingFile);
        filename = matchingFile;
      }
    }

    if (fs.existsSync(videoPath)) {
      const stats = fs.statSync(videoPath);
      res.json({
        exists: true,
        url: `/videos/${filename}`,
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
   * GET /api/video-dimensions/:videoId - Get video dimensions and quality
   */
  router.get('/video-dimensions/:videoId', async (req, res) => {
    const { videoId } = req.params;


    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    try {
      // Look for video file with pattern matching (handles files with titles)
      let videoPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);

      // If exact match doesn't exist, look for files starting with videoId
      if (!fs.existsSync(videoPath)) {
        const files = fs.readdirSync(VIDEOS_DIR);

        const matchingFile = files.find(file =>
          file.startsWith(`${videoId}_`) && file.endsWith('.mp4')
        );

        if (matchingFile) {
          videoPath = path.join(VIDEOS_DIR, matchingFile);
        } else {
          // Try to find files that contain the videoId (more flexible matching)
          const flexibleMatch = files.find(file =>
            file.includes(videoId) && file.endsWith('.mp4')
          );

          if (flexibleMatch) {
            videoPath = path.join(VIDEOS_DIR, flexibleMatch);
          }
        }
      }


      if (!fs.existsSync(videoPath)) {
        return res.status(404).json({
          success: false,
          error: 'Video file not found'
        });
      }

      const dimensions = await getVideoDimensions(videoPath);


      res.json({
        success: true,
        videoId: videoId,
        width: dimensions.width,
        height: dimensions.height,
        quality: dimensions.quality,
        resolution: dimensions.resolution,
        dimensions: `${dimensions.width}x${dimensions.height}`,
        fps: dimensions.fps ?? null,
        codec: dimensions.codec || null,
        bit_rate: dimensions.bit_rate ?? null,
        audio_codec: dimensions.audio_codec || null,
        audio_channels: dimensions.audio_channels ?? null,
        audio_sample_rate: dimensions.audio_sample_rate ?? null,
        audio_channel_layout: dimensions.audio_channel_layout || null,
        audio_bit_rate: dimensions.audio_bit_rate ?? null
      });
    } catch (error) {
      console.error('Error getting video dimensions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get video dimensions',
        details: error.message
      });
    }
  });

  /**
   * GET /api/probe-media?url=... - Probe arbitrary HTTP(S) media with ffprobe
   */
  router.get('/probe-media', async (req, res) => {
    try {
      const url = req.query.url;
      if (!url || !(typeof url === 'string') || !/^https?:\/\//i.test(url)) {
        return res.status(400).json({ success: false, error: 'Invalid or missing url parameter' });
      }

      // no-op log removed

      const meta = await getVideoDimensions(url);

      res.json({
        success: true,
        url,
        width: meta.width,
        height: meta.height,
        quality: meta.quality,
        resolution: meta.resolution,
        dimensions: `${meta.width}x${meta.height}`,
        fps: meta.fps ?? null,
        codec: meta.codec || null,
        bit_rate: meta.bit_rate ?? null,
        audio_codec: meta.audio_codec || null,
        audio_channels: meta.audio_channels ?? null,
        audio_sample_rate: meta.audio_sample_rate ?? null,
        audio_channel_layout: meta.audio_channel_layout || null,
        audio_bit_rate: meta.audio_bit_rate ?? null
      });
    } catch (error) {
      console.error('[PROBE-MEDIA] Error:', error);
      res.status(500).json({ success: false, error: 'Failed to probe media', details: error.message });
    }
  });

  /**
   * POST /api/delete-videos - Delete cached video files by URL list
   */
  router.post('/delete-videos', async (req, res) => {
    try {
      const urls = (req.body && req.body.urls) || [];
      if (!Array.isArray(urls)) {
        return res.status(400).json({ success: false, error: 'urls must be an array' });
      }
      let deleted = 0;
      let errors = [];
      for (const url of urls) {
        try {
          if (!url) continue;
          // Extract filename (supports absolute or relative)
          const filename = url.split('?')[0].split('/').pop();
          if (!filename) continue;
          const filePath = path.join(VIDEOS_DIR, filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deleted++;
          }
        } catch (e) {
          errors.push({ url, message: e.message });
        }
      }
      res.json({ success: true, deleted, errors });
    } catch (e) {
      console.error('[DELETE-VIDEOS] Error deleting videos:', e);
      res.status(500).json({ success: false, error: e.message || 'Failed to delete videos' });
    }
  });
}

module.exports = registerVideoMediaInfoRoutes;
