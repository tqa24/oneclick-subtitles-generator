/**
 * Routes for Gemini image generation operations
 */
const express = require('express');
const router = express.Router();
const geminiImageController = require('../controllers/geminiImageController');

// Generate prompt for background image
router.post('/generate-prompt', geminiImageController.generatePrompt);

// Generate background image
router.post('/generate-image', geminiImageController.generateImage);

// Get current prompts
router.get('/get-prompts', geminiImageController.getPrompts);

module.exports = router;
