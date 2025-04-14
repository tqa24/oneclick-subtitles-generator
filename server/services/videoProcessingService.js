/**
 * Media (video and audio) processing functionality
 * This file is maintained for backward compatibility
 * It re-exports all functions from the modular videoProcessing directory
 */

// Import all functions from the modular structure
const videoProcessing = require('./videoProcessing');

// Re-export all functions for backward compatibility
module.exports = videoProcessing;
