/**
 * Index file for audio file controller modules
 * Re-exports all functions from the modularized files
 */

// Import all modules
const serveAudio = require('./serveAudio');
const alignAudio = require('./alignAudio');
const batchProcessor = require('./batchProcessor');
const zipAudio = require('./zipAudio');
const enhancer = require('./enhancer');

// Export all functions
module.exports = {
  // Serve audio files
  serveAudioFile: serveAudio.serveAudioFile,
  
  // Aligned audio processing
  downloadAlignedAudio: alignAudio.downloadAlignedAudio,
  
  // Batch processing for large numbers of segments
  processBatch: batchProcessor.processBatch,
  concatenateAudioFiles: batchProcessor.concatenateAudioFiles,
  
  // Zip file creation
  downloadAllAudio: zipAudio.downloadAllAudio,
  
  // Utility functions
  enhanceF5TTSNarrations: enhancer.enhanceF5TTSNarrations
};
