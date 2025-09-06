/**
 * Main media processing module for handling long videos/audio and segment processing
 * This file re-exports all functions from the modular structure
 */

// Import from utility modules
import { getCacheIdForMedia } from './cacheUtils';
import { analyzeVideoAndWaitForUserChoice } from './analysisUtils';
import {
  processVideoWithFilesApi,
  shouldUseSimplifiedProcessing,
  processMediaFile,
  createVideoMetadata,
  getEstimatedDuration
} from './simplifiedProcessing';

// Import from other modules for re-export
import { getVideoDuration } from '../durationUtils';
import { setTranscriptionRules } from '../transcriptionRulesStore';

// Export all functions
export {
  // New simplified processing functions (recommended)
  processVideoWithFilesApi,
  shouldUseSimplifiedProcessing,
  processMediaFile,
  createVideoMetadata,
  getEstimatedDuration,

  // Cache utilities
  getCacheIdForMedia,

  // Analysis utilities
  analyzeVideoAndWaitForUserChoice,

  // Re-exports from other modules
  getVideoDuration,
  setTranscriptionRules
};
