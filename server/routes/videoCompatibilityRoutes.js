/**
 * Routes for video compatibility checking and conversion
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
// Legacy video compatibility checking is deprecated
// const { ensureVideoCompatibility } = require('../services/videoProcessing/durationUtils');

const router = express.Router();

/**
 * Check and convert video for compatibility if needed
 */
router.post('/ensure-compatibility', async (req, res) => {
  res.status(410).json({
    success: false,
    error: 'Video compatibility checking is deprecated. Please enable "Use Simplified Processing" in settings for better performance.',
    deprecated: true
  });
});

/**

  } catch (error) {
    console.error('[VideoCompatibility] Error ensuring video compatibility:', error);
    res.status(500).json({ 
      error: 'Failed to check video compatibility',
      details: error.message 
    });
  }
});

/**
 * Get video codec information
 */
router.post('/check-codec', async (req, res) => {
  try {
    const { videoPath } = req.body;
    
    if (!videoPath) {
      return res.status(400).json({ error: 'Video path is required' });
    }

    // Construct full path to video file
    const fullVideoPath = path.join(__dirname, '../../videos/uploads', path.basename(videoPath));
    
    // Check if file exists
    try {
      await fs.access(fullVideoPath);
    } catch (error) {
      return res.status(404).json({ error: 'Video file not found' });
    }

    // Use ffprobe to get codec information
    const { spawn } = require('child_process');
    const { getFfprobePath } = require('../services/shared/ffmpegUtils');
    
    const ffprobeArgs = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-select_streams', 'v:0',
      fullVideoPath
    ];

    const ffprobe = spawn(getFfprobePath(), ffprobeArgs);
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
        return res.status(500).json({ 
          error: 'Failed to analyze video',
          details: stderr 
        });
      }

      try {
        const data = JSON.parse(stdout);
        const videoStream = data.streams && data.streams[0];

        if (!videoStream) {
          return res.status(400).json({ error: 'No video stream found' });
        }

        const codecInfo = {
          codec_name: videoStream.codec_name,
          codec_long_name: videoStream.codec_long_name,
          profile: videoStream.profile,
          width: videoStream.width,
          height: videoStream.height,
          pix_fmt: videoStream.pix_fmt,
          // VP9 is supported by Remotion (Chrome supports VP9), so only mark truly problematic codecs
          is_compatible: !['hevc', 'h265', 'av1'].includes(videoStream.codec_name.toLowerCase())
        };

        res.json(codecInfo);
      } catch (parseError) {
        res.status(500).json({ 
          error: 'Failed to parse video information',
          details: parseError.message 
        });
      }
    });

    ffprobe.on('error', (error) => {
      res.status(500).json({ 
        error: 'FFprobe execution failed',
        details: error.message 
      });
    });

  } catch (error) {
    console.error('[VideoCompatibility] Error checking codec:', error);
    res.status(500).json({ 
      error: 'Failed to check video codec',
      details: error.message 
    });
  }
});

module.exports = router;
