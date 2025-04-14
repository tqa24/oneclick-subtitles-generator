/**
 * YouTube download functionality using multiple libraries
 * Implements a hybrid approach with multiple fallback mechanisms
 * Main export file that re-exports all functions from the modular files
 */

// Import all modules
const { downloadYouTubeVideo } = require('./downloader');

// Export all functions
module.exports = {
  downloadYouTubeVideo
};
