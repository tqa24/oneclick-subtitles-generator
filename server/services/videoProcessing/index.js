/**
 * Media (video and audio) processing functionality
 * Main export file that re-exports all functions from the modular files
 */

// Import all modules
const { getMediaDuration, getVideoDuration } = require('./durationUtils');
const { splitMediaIntoSegments, splitVideoIntoSegments } = require('./segmentUtils');
const { getVideoFrameCount, getVideoResolution } = require('./resolutionUtils');
const { optimizeVideo, createAnalysisVideo } = require('./optimizationUtils');
const { convertAudioToVideo } = require('./conversionUtils');

// Export all functions
module.exports = {
  // Duration utilities
  getMediaDuration,
  getVideoDuration,
  
  // Segment utilities
  splitMediaIntoSegments,
  splitVideoIntoSegments,
  
  // Resolution utilities
  getVideoFrameCount,
  getVideoResolution,
  
  // Optimization utilities
  optimizeVideo,
  createAnalysisVideo,
  
  // Conversion utilities
  convertAudioToVideo
};
