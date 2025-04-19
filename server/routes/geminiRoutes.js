/**
 * Routes for Gemini API operations
 */
const express = require('express');
const router = express.Router();
const geminiController = require('../controllers/geminiController');

// Clean lyrics using Gemini
router.post('/clean-lyrics', geminiController.cleanLyrics);

module.exports = router;
