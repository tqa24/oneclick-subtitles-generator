/**
 * Routes for the deprecated split/optimize/analysis-video flows
 * (split-existing-file, optimize-existing-file, create-analysis-video).
 * Registered onto the shared media router by videoRoutes.js.
 */

const fs = require('fs');
const path = require('path');
const { VIDEOS_DIR } = require('../config');
const { convertAudioToVideo } = require('./audioConversionHelpers');
const { streamingUpload } = require('./videoUploadConfig');

// Stub implementations for deprecated functions
const optimizeVideo = async (inputPath, outputPath, options) => {
  console.warn('optimizeVideo is deprecated and not implemented');
  return { success: true, path: outputPath, optimized: false };
};

const createAnalysisVideo = async (inputPath, outputPath) => {
  console.warn('createAnalysisVideo is deprecated and not implemented');
  return { success: true, path: outputPath, isOriginal: true, frameCount: 0 };
};

/**
 * Registers split/optimize/analysis routes onto the provided router.
 * @param {import('express').Router} router
 */
function registerVideoSplitOptimizeRoutes(router) {
  /**
   * POST /api/split-existing-file - Split a file that already exists on the server
   * @deprecated This endpoint is deprecated. Use simplified processing instead.
   */
  router.post('/split-existing-file', async (req, res) => {
    res.status(410).json({
      error: 'Video splitting is deprecated. Please enable "Use Simplified Processing" in settings for better performance.',
      deprecated: true
    });
  });

  /**
   * POST /api/optimize-existing-file - Optimize a file that already exists on the server
   */
  router.post('/optimize-existing-file', async (req, res) => {
    try {
      const { filename, resolution = '360p', fps = 1, useVideoAnalysis = true } = req.body;

      if (!filename) {
        return res.status(400).json({ error: 'Filename is required' });
      }

      const filePath = path.join(VIDEOS_DIR, filename);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found on server' });
      }

      console.log(`[OPTIMIZE-EXISTING] Optimizing existing file: ${filename}`);

      // Determine media type from file extension
      const extension = path.extname(filename).toLowerCase();
      const isAudio = ['.mp3', '.wav', '.aac', '.ogg', '.flac'].includes(extension);

      // Generate timestamp for optimized files
      const timestamp = Date.now();

      // Always use mp4 for processed files
      const optimizedFilename = `optimized_${timestamp}.mp4`;
      const analysisFilename = `analysis_500frames_${timestamp}.mp4`;
      const optimizedPath = path.join(VIDEOS_DIR, optimizedFilename);
      const analysisPath = path.join(VIDEOS_DIR, analysisFilename);

      let videoPath = filePath;
      let optimizedResult = null;
      let analysisResult = null;

      // If it's an audio file, convert it to video first
      if (isAudio) {
        const convertedFilename = `converted_${timestamp}.mp4`;
        const convertedPath = path.join(VIDEOS_DIR, convertedFilename);

        const conversionResult = await convertAudioToVideo(filePath, convertedPath);
        if (conversionResult && fs.existsSync(convertedPath)) {
          videoPath = convertedPath;
        }
      }

      // Optimize the video
      optimizedResult = await optimizeVideo(videoPath, optimizedPath, {
        resolution: resolution,
        fps: fps
      });

      if (!optimizedResult) {
        throw new Error('Video optimization failed');
      }

      // Create analysis video if requested and optimization was successful
      if (useVideoAnalysis && optimizedResult && fs.existsSync(optimizedPath)) {
        try {
          analysisResult = await createAnalysisVideo(optimizedPath, analysisPath);
        } catch (error) {
          console.warn(`[OPTIMIZE-EXISTING] Analysis video creation failed: ${error.message}`);
          // Continue without analysis video
        }
      }

      // Return the result
      res.json({
        success: true,
        originalVideo: `/videos/${filename}`,
        optimizedVideo: `/videos/${optimizedFilename}`,
        resolution: optimizedResult.resolution,
        fps: optimizedResult.fps,
        width: optimizedResult.width,
        height: optimizedResult.height,
        wasOptimized: optimizedResult.optimized !== false,
        analysis: analysisResult ? (analysisResult.isOriginal ? {
          // If the video has fewer than 500 frames, we use the optimized video
          video: `/videos/${optimizedFilename}`,
          frameCount: analysisResult.frameCount,
          duration: analysisResult.duration,
          message: 'Using optimized video for analysis (fewer than 500 frames)'
        } : {
          video: `/videos/${analysisFilename}`,
          frameCount: analysisResult.frameCount,
          duration: analysisResult.duration,
          originalFrameCount: analysisResult.originalFrameCount,
          frameInterval: analysisResult.frameInterval,
          message: `Created 500-frame analysis video from ${analysisResult.originalFrameCount} original frames`
        }) : null,
        message: 'Video optimized successfully from existing file'
      });
    } catch (error) {
      console.error('[OPTIMIZE-EXISTING] Error optimizing existing file:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to optimize existing file'
      });
    }
  });

  /**
   * POST /api/create-analysis-video - Create a 500-frame analysis video without optimization
   */
  router.post('/create-analysis-video', streamingUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const timestamp = Date.now();
      const originalPath = req.file.path;
      const originalFilename = req.file.filename;

      // Create analysis video filename
      const analysisFilename = `analysis_${timestamp}.mp4`;
      const analysisPath = path.join(VIDEOS_DIR, analysisFilename);

      console.log('[CREATE-ANALYSIS-VIDEO] Creating analysis video from:', originalPath);

      // Create analysis video with 500 frames
      const analysisResult = await createAnalysisVideo(originalPath, analysisPath);

      if (analysisResult.isOriginal) {
        console.log('[CREATE-ANALYSIS-VIDEO] Using original video for analysis (fewer than 500 frames)');
      } else {
        console.log(`[CREATE-ANALYSIS-VIDEO] Created analysis video with ${analysisResult.frameCount} frames from ${analysisResult.originalFrameCount} original frames`);
      }

      // Return the result
      res.json({
        success: true,
        originalVideo: `/videos/${originalFilename}`,
        analysis: analysisResult.isOriginal ? {
          video: `/videos/${originalFilename}`,
          frameCount: analysisResult.frameCount,
          message: 'Using original video for analysis (fewer than 500 frames)'
        } : {
          video: `/videos/${analysisFilename}`,
          frameCount: analysisResult.frameCount,
          originalFrameCount: analysisResult.originalFrameCount,
          frameInterval: analysisResult.frameInterval,
          message: `Created 500-frame analysis video from ${analysisResult.originalFrameCount} original frames`
        }
      });

    } catch (error) {
      console.error('[CREATE-ANALYSIS-VIDEO] Error:', error);
      res.status(500).json({
        error: 'Failed to create analysis video',
        details: error.message
      });
    }
  });
}

module.exports = registerVideoSplitOptimizeRoutes;
