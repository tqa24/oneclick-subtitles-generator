/**
 * Index file for narration controllers
 * Re-exports all functions from the modularized files
 */

// Import all controllers
const directoryManager = require('./directoryManager');
const audioFileController = require('./audioFileController');
const referenceAudioController = require('./referenceAudioController');
const narrationGenerationController = require('./narrationGenerationController');
const geminiAudioController = require('./geminiAudioController');

// Export all functions
module.exports = {
  // Directory management
  ...directoryManager,
  
  // Audio file handling
  ...audioFileController,
  
  // Reference audio handling
  ...referenceAudioController,
  
  // Narration generation
  ...narrationGenerationController,
  
  // Gemini audio handling
  ...geminiAudioController
};
