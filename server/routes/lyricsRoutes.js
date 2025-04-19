/**
 * API routes for lyrics operations
 */

const express = require('express');
const router = express.Router();
const { getLyrics } = require('../controllers/geniusController');

/**
 * POST /api/lyrics - Get lyrics from Genius API
 */
router.post('/lyrics', getLyrics);

module.exports = router;
