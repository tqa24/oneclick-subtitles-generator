/**
 * API routes for subtitle operations
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { SUBTITLES_DIR } = require('../config');

// Create directories for user-provided subtitles and transcription rules
const USER_SUBTITLES_DIR = path.join(SUBTITLES_DIR, 'user-provided');
const RULES_DIR = path.join(SUBTITLES_DIR, 'rules');

// Ensure directories exist
if (!fs.existsSync(USER_SUBTITLES_DIR)) {
  fs.mkdirSync(USER_SUBTITLES_DIR, { recursive: true });

}

if (!fs.existsSync(RULES_DIR)) {
  fs.mkdirSync(RULES_DIR, { recursive: true });

}

/**
 * GET /api/subtitle-exists/:cacheId - Check if subtitles exist
 */
router.get('/subtitle-exists/:cacheId', (req, res) => {
  const { cacheId } = req.params;
  const subtitlePath = path.join(SUBTITLES_DIR, `${cacheId}.json`);

  if (fs.existsSync(subtitlePath)) {

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

/**
 * GET /api/user-subtitles/:cacheId - Check if user-provided subtitles exist
 */
router.get('/user-subtitles/:cacheId', (req, res) => {
  const { cacheId } = req.params;
  const subtitlePath = path.join(USER_SUBTITLES_DIR, `${cacheId}.txt`);

  if (fs.existsSync(subtitlePath)) {

    try {
      const subtitlesText = fs.readFileSync(subtitlePath, 'utf8');
      res.json({
        exists: true,
        subtitlesText
      });
    } catch (error) {
      console.error('Error reading cached user-provided subtitles:', error);
      res.json({ exists: false });
    }
  } else {

    res.json({ exists: false });
  }
});

/**
 * POST /api/save-user-subtitles - Save user-provided subtitles
 */
router.post('/save-user-subtitles', (req, res) => {
  const { cacheId, subtitlesText } = req.body;

  if (!cacheId || subtitlesText === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Missing required data (cacheId or subtitlesText)'
    });
  }

  try {
    const subtitlePath = path.join(USER_SUBTITLES_DIR, `${cacheId}.txt`);
    fs.writeFileSync(subtitlePath, subtitlesText);


    res.json({
      success: true,
      message: 'User-provided subtitles saved to cache successfully'
    });
  } catch (error) {
    console.error('Error saving user-provided subtitles to cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save user-provided subtitles to cache'
    });
  }
});

/**
 * GET /api/rules/:cacheId - Check if transcription rules exist
 */
router.get('/rules/:cacheId', (req, res) => {
  const { cacheId } = req.params;
  const rulesPath = path.join(RULES_DIR, `${cacheId}.json`);

  if (fs.existsSync(rulesPath)) {

    try {
      const rulesData = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
      res.json({
        exists: true,
        rules: rulesData
      });
    } catch (error) {
      console.error('Error reading cached transcription rules:', error);
      res.json({ exists: false });
    }
  } else {

    res.json({ exists: false });
  }
});

/**
 * POST /api/save-rules - Save transcription rules
 */
router.post('/save-rules', (req, res) => {
  const { cacheId, rules } = req.body;

  if (!cacheId || !rules) {
    return res.status(400).json({
      success: false,
      error: 'Missing required data (cacheId or rules)'
    });
  }

  try {
    const rulesPath = path.join(RULES_DIR, `${cacheId}.json`);
    fs.writeFileSync(rulesPath, JSON.stringify(rules, null, 2));


    res.json({
      success: true,
      message: 'Transcription rules saved to cache successfully'
    });
  } catch (error) {
    console.error('Error saving transcription rules to cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save transcription rules to cache'
    });
  }
});

module.exports = router;
