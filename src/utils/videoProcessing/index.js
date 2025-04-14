/**
 * Main media processing module for handling long videos/audio and segment processing
 * This file re-exports all functions from the modular structure
 */

// Import from utility modules
import { getCacheIdForMedia } from './cacheUtils';
import { createSegmentStatusUpdater, formatTime } from './segmentUtils';
import { optimizeVideo } from './optimizationUtils';
import { analyzeVideoAndWaitForUserChoice } from './analysisUtils';
import { processLongVideo, processLongMedia, processShortMedia } from './processingUtils';

// Import from other modules for re-export
import { getVideoDuration } from '../durationUtils';
import { retrySegmentProcessing } from '../segmentManager';
import { setTranscriptionRules } from '../transcriptionRulesStore';

// Export all functions
export {
  // Main processing functions
  processLongVideo,
  processLongMedia,
  processShortMedia,
  
  // Cache utilities
  getCacheIdForMedia,
  
  // Segment utilities
  createSegmentStatusUpdater,
  formatTime,
  
  // Optimization utilities
  optimizeVideo,
  
  // Analysis utilities
  analyzeVideoAndWaitForUserChoice,
  
  // Re-exports from other modules
  getVideoDuration,
  retrySegmentProcessing,
  setTranscriptionRules
};
