/**
 * Routes for audio extraction and audio/video conversion
 * (extract-audio, extract-audio-from-blob, converted-audio-exists,
 * convert-audio-to-video, extract-video-segment).
 * Registered onto the shared media router by videoRoutes.js.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { VIDEOS_DIR } = require('../config');
const { getFfmpegPath, getFfprobePath } = require('../services/shared/ffmpegUtils');
const { convertAudioToVideo } = require('./audioConversionHelpers');
const { streamingUpload } = require('./videoUploadConfig');

/**
 * Registers audio extraction/conversion routes onto the provided router.
 * @param {import('express').Router} router
 */
function registerVideoAudioRoutes(router) {
  /**
   * POST /api/extract-audio - Extract audio from a video file path
   */
  router.post('/extract-audio', async (req, res) => {
    try {
      const { videoPath } = req.body;
      // Get filename from query parameter or body
      const filename = req.query.filename || req.body.filename || 'audio';

      if (!videoPath) {
        return res.status(400).json({ error: 'Video path is required' });
      }

      // Determine if the path is a URL or a local path
      const isUrl = videoPath.startsWith('http');

      // Skip blob URLs - they should use the /extract-audio-from-blob endpoint
      if (videoPath.startsWith('blob:')) {
        return res.status(400).json({ error: 'Blob URLs are not supported by this endpoint. Use /extract-audio-from-blob instead.' });
      }

      // Resolve the actual file path
      let actualVideoPath;



      if (isUrl) {
        // Extract the filename from the URL
        const urlParts = videoPath.split('/');
        const filename = urlParts[urlParts.length - 1];
        actualVideoPath = path.join(VIDEOS_DIR, filename);

      } else {
        // If it's a relative path like /videos/filename.mp4
        const relativePath = videoPath.startsWith('/') ? videoPath.substring(1) : videoPath;
        const pathParts = relativePath.split('/');
        const filename = pathParts[pathParts.length - 1];
        actualVideoPath = path.join(VIDEOS_DIR, filename);

      }

      // If the file doesn't exist, try to extract the filename from the path and look for it directly
      if (!fs.existsSync(actualVideoPath)) {


        // Try to get just the filename without query parameters
        const filenameWithoutQuery = videoPath.split('?')[0].split('/').pop();
        const alternativePath = path.join(VIDEOS_DIR, filenameWithoutQuery);


        if (fs.existsSync(alternativePath)) {
          actualVideoPath = alternativePath;

        } else {
          // List all files in the videos directory to help with debugging

          const files = fs.readdirSync(VIDEOS_DIR);

        }
      }

      // Check if the video file exists
      if (!fs.existsSync(actualVideoPath)) {
        return res.status(404).json({ error: 'Video file not found' });
      }

      // Generate a unique filename for the audio
      const timestamp = Date.now();
      const audioFilename = `audio_${timestamp}.mp3`;
      const audioPath = path.join(VIDEOS_DIR, audioFilename);

      // Use ffmpeg to extract audio
      const ffmpegProcess = spawn(getFfmpegPath(), [
        '-i', actualVideoPath,
        '-vn',  // No video
        '-acodec', 'libmp3lame',  // MP3 codec
        '-q:a', '2',  // Quality (0-9, lower is better)
        '-y',  // Overwrite output file
        audioPath
      ]);

      // Handle process completion
      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          // Success


          // Set the Content-Disposition header to force download with the provided filename
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.mp3"`);
          res.setHeader('Content-Type', 'audio/mpeg');

          // Stream the file directly instead of returning a URL
          const fileStream = fs.createReadStream(audioPath);
          fileStream.pipe(res);
        } else {
          // Error
          console.error(`Error extracting audio: ffmpeg process exited with code ${code}`);
          res.status(500).json({
            success: false,
            error: 'Failed to extract audio'
          });
        }
      });

      // Handle process error
      ffmpegProcess.on('error', (err) => {
        console.error('Error spawning ffmpeg process:', err);
        res.status(500).json({
          success: false,
          error: 'Failed to start audio extraction process'
        });
      });
    } catch (error) {
      console.error('Error extracting audio:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to extract audio'
      });
    }
  });

  /**
   * POST /api/extract-audio-from-blob - Extract audio from a video file using streaming
   * This endpoint accepts the actual video data as a file upload
   */
  router.post('/extract-audio-from-blob', streamingUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Get filename from query parameter
      const filename = req.query.filename || 'audio';

      // File is already saved to disk by multer streaming
      const videoPath = req.file.path;

      // Generate unique filename for the output audio
      const timestamp = Date.now();
      const audioFilename = `audio_${timestamp}.mp3`;
      const audioPath = path.join(VIDEOS_DIR, audioFilename);


      // Use ffmpeg to extract audio
      const ffmpegProcess = spawn(getFfmpegPath(), [
        '-i', videoPath,
        '-vn',  // No video
        '-acodec', 'libmp3lame',  // MP3 codec
        '-q:a', '2',  // Quality (0-9, lower is better)
        '-y',  // Overwrite output file
        audioPath
      ]);

      // Handle process completion
      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          // Success


          // Clean up the temporary video file
          try {
            fs.unlinkSync(videoPath);

          } catch (err) {
            console.error(`Error deleting temporary video file: ${err.message}`);
          }

          // Set the Content-Disposition header to force download with the provided filename
          res.setHeader('Content-Disposition', `attachment; filename="${filename}.mp3"`);
          res.setHeader('Content-Type', 'audio/mpeg');

          // Stream the file directly instead of returning a URL
          const fileStream = fs.createReadStream(audioPath);
          fileStream.pipe(res);
        } else {
          // Error
          console.error(`Error extracting audio: ffmpeg process exited with code ${code}`);

          // Clean up the temporary video file
          try {
            fs.unlinkSync(videoPath);

          } catch (err) {
            console.error(`Error deleting temporary video file: ${err.message}`);
          }

          res.status(500).json({
            success: false,
            error: 'Failed to extract audio'
          });
        }
      });

      // Handle process error
      ffmpegProcess.on('error', (err) => {
        console.error('Error spawning ffmpeg process:', err);

        // Clean up the temporary video file
        try {
          fs.unlinkSync(videoPath);

        } catch (deleteErr) {
          console.error(`Error deleting temporary video file: ${deleteErr.message}`);
        }

        res.status(500).json({
          success: false,
          error: 'Failed to start audio extraction process'
        });
      });
    } catch (error) {
      console.error('Error extracting audio from blob:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to extract audio from blob'
      });
    }
  });

  /**
   * GET /api/converted-audio-exists/:audioHash - Check if a converted audio file exists
   */
  router.get('/converted-audio-exists/:audioHash', (req, res) => {
    const { audioHash } = req.params;

    // Look for any files that match the pattern converted_<audioHash>_*.mp4
    const files = fs.readdirSync(VIDEOS_DIR);
    const convertedFile = files.find(file => file.startsWith(`converted_${audioHash}_`) && file.endsWith('.mp4'));

    if (convertedFile) {
      const videoPath = path.join(VIDEOS_DIR, convertedFile);
      const stats = fs.statSync(videoPath);

      // Get video metadata using ffprobe (using implementation from narration controller)
      const { getMediaDuration } = require('../controllers/narration/audioFile/batchProcessor');

      // Get the duration asynchronously and then respond
      getMediaDuration(videoPath)
        .then(duration => {
          res.json({
            exists: true,
            video: `/videos/${convertedFile}`,
            width: 256,  // Default values for converted audio files
            height: 144,
            fps: 15,
            duration: duration,
            resolution: '144p',
            size: stats.size,
            createdAt: stats.birthtime
          });
        })
        .catch(error => {
          console.error(`[CONVERTED-AUDIO-EXISTS] Error getting duration for ${videoPath}:`, error);
          // Still return that the file exists, just without duration
          res.json({
            exists: true,
            video: `/videos/${convertedFile}`,
            width: 256,
            height: 144,
            fps: 15,
            resolution: '144p',
            size: stats.size,
            createdAt: stats.birthtime
          });
        });
    } else {
      res.json({ exists: false });
    }
  });

  /**
   * POST /api/convert-audio-to-video - Convert an audio file to a video file using streaming
   */
  router.post('/convert-audio-to-video', streamingUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // File is already saved to disk by multer streaming
      const audioPath = req.file.path;
      const contentType = req.file.mimetype || 'audio/mp3';

      // Generate a unique filename for the video file
      const timestamp = Date.now();
      const fileExtension = contentType.split('/')[1] || 'mp3';

      // Generate a hash of the audio file for caching purposes
      const crypto = require('crypto');
      const audioBuffer = fs.readFileSync(audioPath);
      const audioHash = crypto.createHash('md5').update(audioBuffer).digest('hex').substring(0, 10);

      // Check if we already have a converted file for this audio
      const files = fs.readdirSync(VIDEOS_DIR);
      const existingConvertedFile = files.find(file => file.startsWith(`converted_${audioHash}_`) && file.endsWith('.mp4'));

      if (existingConvertedFile) {

        const videoPath = path.join(VIDEOS_DIR, existingConvertedFile);

        try {
          // Get video metadata (using implementation from narration controller)
          const { getMediaDuration } = require('../controllers/narration/audioFile/batchProcessor');
          const duration = await getMediaDuration(videoPath);

          // Return the existing converted file
          return res.json({
            success: true,
            video: `/videos/${existingConvertedFile}`,
            width: 256,
            height: 144,
            fps: 15,
            duration: duration,
            resolution: '144p',
            message: 'Using cached converted video',
            cached: true
          });
        } catch (error) {
          console.error(`[CONVERT-AUDIO] Error getting metadata for existing converted file: ${error.message}`);
          // Continue with new conversion as fallback
        }
      }

      const videoFilename = `converted_${audioHash}_${timestamp}.mp4`;
      const videoPath = path.join(VIDEOS_DIR, videoFilename);

      // Audio file is already saved to disk by multer streaming at audioPath



      // Convert the audio to video

      const result = await convertAudioToVideo(audioPath, videoPath);


      // Delete the original audio file - we don't need it anymore
      try {
        fs.unlinkSync(audioPath);

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

  /**
   * POST /api/extract-video-segment - Extract a segment using ffmpeg with stream copy
   */
  router.post('/extract-video-segment', streamingUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }
      const start = parseFloat(req.query.start || req.body.start);
      const end = parseFloat(req.query.end || req.body.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return res.status(400).json({ success: false, error: 'Invalid start/end range' });
      }

      const duration = end - start;
      const ffmpegPath = getFfmpegPath();
      const timestamp = Date.now();

      // Check if input file has video stream to determine output format
      let hasVideo = false;
      try {
        const probeResult = await new Promise((resolve, reject) => {
          const ffprobe = spawn(getFfprobePath(), [
            '-v', 'error',
            '-show_streams',
            '-of', 'json',
            req.file.path
          ]);
          let out = '';
          ffprobe.on('error', err => reject(err)); // don't let a spawn failure crash the server
          ffprobe.stdout.on('data', d => out += d);
          ffprobe.on('close', code => {
            if (code === 0) {
              const data = JSON.parse(out);
              hasVideo = data.streams?.some(s => s.codec_type === 'video') || false;
              resolve(hasVideo);
            } else {
              reject(new Error('ffprobe failed'));
            }
          });
        });
      } catch (error) {
        console.warn('[EXTRACT] Could not probe file, assuming video:', error.message);
        hasVideo = true; // Default to video if probe fails
      }

      const isAudio = !hasVideo;
      const outName = `extracted_${timestamp}.${isAudio ? 'mp3' : 'mp4'}`;
      const outPath = path.join(VIDEOS_DIR, outName);

      console.log(`[EXTRACT] Cutting ${isAudio ? 'audio' : 'video'} segment ${start}s-${end}s from ${req.file.path} -> ${outPath}`);

      const ff = spawn(ffmpegPath, [
        '-ss', String(start),
        '-i', req.file.path,
        '-t', String(duration),
        ...(isAudio ? ['-vn', '-acodec', 'libmp3lame', '-q:a', '2'] : ['-c', 'copy', '-movflags', '+faststart']),
        '-y',
        outPath
      ]);

      let err = '';
      ff.on('error', (spawnErr) => {
        try { fs.unlinkSync(req.file.path); } catch {}
        if (!res.headersSent) res.status(500).json({ success: false, error: `Failed to launch ffmpeg: ${spawnErr.message}` });
      });
      ff.stderr.on('data', d => { err += d.toString(); });
      ff.on('close', (code) => {
        try { fs.unlinkSync(req.file.path); } catch {}
        if (code !== 0) {
          console.error('[EXTRACT] ffmpeg failed:', err);
          return res.status(500).json({ success: false, error: 'FFmpeg failed to extract segment' });
        }
        return res.json({ success: true, url: `/videos/${outName}` });
      });
    } catch (e) {
      console.error('[EXTRACT] Error extracting video segment:', e);
      res.status(500).json({ success: false, error: e.message || 'Failed to extract video segment' });
    }
  });
}

module.exports = registerVideoAudioRoutes;
