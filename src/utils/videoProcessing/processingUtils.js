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

/**
 * Map UI media resolution values to Gemini API enum values
 */
const mapMediaResolution = (resolution) => {
  const resolutionMap = {
    'low': 'MEDIA_RESOLUTION_LOW',
    'medium': 'MEDIA_RESOLUTION_MEDIUM',
    'high': 'MEDIA_RESOLUTION_HIGH'
  };
  return resolutionMap[resolution] || 'MEDIA_RESOLUTION_MEDIUM';
};

/**
 * Process a specific segment of video using Files API with custom options
 * This is the new segment-based processing function for the improved workflow
 */
export const processSegmentWithFilesApi = async (file, segment, options, setStatus, t) => {
  try {
    const { fps, mediaResolution, model, userProvidedSubtitles } = options;

    setStatus({
      message: t('processing.processingSegment', 'Processing selected segment (reusing uploaded file)...'),
      type: 'loading'
    });

    // Prepare video metadata for segment processing according to Gemini API docs
    // Format: start_offset: "60s", end_offset: "120s", fps: 5
    const videoMetadata = {
      start_offset: `${Math.floor(segment.start)}s`,
      end_offset: `${Math.floor(segment.end)}s`,
      fps: fps
    };

    // Map media resolution to API enum value
    const mappedMediaResolution = mapMediaResolution(mediaResolution);

    // Prepare options for the Files API call
    const apiOptions = {
      userProvidedSubtitles,
      modelId: model,
      videoMetadata,
      mediaResolution: mappedMediaResolution,
      segmentInfo: {
        start: segment.start,
        end: segment.end,
        duration: segment.end - segment.start
      }
    };

    // Call the Gemini API with Files API
    const { callGeminiApiWithFilesApi } = await import('../../services/gemini');
    const result = await callGeminiApiWithFilesApi(file, apiOptions);

    return result;
  } catch (error) {
    console.error('Error processing segment with Files API:', error);
    throw error;
  }
};
