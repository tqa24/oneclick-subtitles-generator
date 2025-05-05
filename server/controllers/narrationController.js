/**
 * Controller for narration-related endpoints
 * This file now imports from the modularized controllers in the narration directory
 */

// Import all controllers from the narration directory
const narrationControllers = require('./narration');

// Re-export all functions
module.exports = narrationControllers;
