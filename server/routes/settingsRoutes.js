/**
 * Routes for settings operations
 */
const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');

// Update prompts
router.post('/settings/update-prompts', settingsController.updatePrompts);

module.exports = router;
