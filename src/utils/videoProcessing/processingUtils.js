/**
 * Legacy processing utilities for video/audio processing
 * @deprecated These functions are deprecated. Use simplifiedProcessing.js instead.
 * 
 * This file provides backward compatibility for legacy code that still uses
 * the old segment-based processing approach. All functions now redirect to
 * the new simplified processing system for better performance.
 */

console.warn('[LEGACY] processingUtils.js is deprecated. Please enable "Use Simplified Processing" in settings for better performance.');

/**
 * Process a short video/audio file (shorter than max segment duration)
 * @deprecated Use processVideoWithFilesApi from simplifiedProcessing.js instead
 * @param {File} mediaFile - The media file
 * @param {Function} onStatusUpdate - Callback for status updates
 * @param {Function} t - Translation function
 * @param {Object} options - Processing options
 * @returns {Promise<Array>} - Array of subtitle objects
 */
export const processShortMedia = async (mediaFile, onStatusUpdate, t, options = {}) => {
  console.warn('[LEGACY] processShortMedia is deprecated. Redirecting to simplified processing.');
  
  // Show a helpful message to the user
  onStatusUpdate({
    message: t('output.usingLegacyFallback', 'Using legacy processing. Enable "Simplified Processing" in settings for better performance.'),
    type: 'warning'
  });
  
  // Redirect to simplified processing
  const { processVideoWithFilesApi } = await import('./simplifiedProcessing');
  return await processVideoWithFilesApi(mediaFile, onStatusUpdate, t, options);
};

/**
 * Process a long video/audio file by splitting it into segments
 * @deprecated Use processVideoWithFilesApi from simplifiedProcessing.js instead
 * @param {File} mediaFile - The media file
 * @param {Function} onStatusUpdate - Callback for status updates
 * @param {Function} t - Translation function
 * @param {Object} options - Processing options
 * @returns {Promise<Array>} - Array of subtitle objects
 */
export const processLongVideo = async (mediaFile, onStatusUpdate, t, options = {}) => {
  console.warn('[LEGACY] processLongVideo is deprecated. Redirecting to simplified processing.');
  
  // Show a helpful message to the user
  onStatusUpdate({
    message: t('output.usingLegacyFallback', 'Using legacy processing. Enable "Simplified Processing" in settings for better performance.'),
    type: 'warning'
  });
  
  // Redirect to simplified processing
  const { processVideoWithFilesApi } = await import('./simplifiedProcessing');
  return await processVideoWithFilesApi(mediaFile, onStatusUpdate, t, options);
};

/**
 * Alias for processLongVideo to maintain backward compatibility
 * @deprecated Use processVideoWithFilesApi from simplifiedProcessing.js instead
 */
export const processLongMedia = processLongVideo;
