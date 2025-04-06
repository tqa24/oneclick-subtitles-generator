/**
 * API routes for subtitle operations
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { SUBTITLES_DIR } = require('../config');

/**
 * GET /api/subtitle-exists/:cacheId - Check if subtitles exist
 */
router.get('/subtitle-exists/:cacheId', (req, res) => {
  const { cacheId } = req.params;
  const subtitlePath = path.join(SUBTITLES_DIR, `${cacheId}.json`);

  if (fs.existsSync(subtitlePath)) {
    console.log(`Cached subtitles found for ${cacheId}`);
    try {
      const subtitlesData = JSON.parse(fs.readFileSync(subtitlePath, 'utf8'));
      res.json({
        exists: true,
        subtitles: subtitlesData
      });
    } catch (error) {
      console.error('Error reading cached subtitles:', error);
      res.json({ exists: false });
    }
  } else {
    console.log(`No cached subtitles found for ${cacheId}`);
    res.json({ exists: false });
  }
});

/**
 * POST /api/save-subtitles - Save subtitles
 */
router.post('/save-subtitles', (req, res) => {
  const { cacheId, subtitles } = req.body;

  if (!cacheId || !subtitles) {
    return res.status(400).json({
      success: false,
      error: 'Missing required data (cacheId or subtitles)'
    });
  }

  try {
    const subtitlePath = path.join(SUBTITLES_DIR, `${cacheId}.json`);
    fs.writeFileSync(subtitlePath, JSON.stringify(subtitles, null, 2));
    console.log(`Saved subtitles to cache: ${cacheId}`);

    res.json({
      success: true,
      message: 'Subtitles saved to cache successfully'
    });
  } catch (error) {
    console.error('Error saving subtitles to cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save subtitles to cache'
    });
  }
});

module.exports = router;
