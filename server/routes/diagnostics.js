/**
 * Diagnostic routes for troubleshooting
 */

const express = require('express');
const router = express.Router();
const { getDiagnosticInfo } = require('../services/shared/ffmpegUtils');

/**
 * GET /api/diagnostics/ffmpeg
 * Get diagnostic information about ffmpeg/ffprobe availability
 */
router.get('/ffmpeg', async (req, res) => {
  try {
    const diagnostics = await getDiagnosticInfo();
    res.json({
      success: true,
      diagnostics
    });
  } catch (error) {
    console.error('Error getting ffmpeg diagnostics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
