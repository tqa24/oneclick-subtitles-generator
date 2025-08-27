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
    'medium': 'MEDIA_RESOLUTION_MEDIUM'
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

    // Prepare video metadata for segment processing
    // Using string format that was working before
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

/**
 * Process a specific segment with streaming support
 * @param {File} file - The media file
 * @param {Object} segment - Segment with start/end times
 * @param {Object} options - Processing options
 * @param {Function} setStatus - Status update callback
 * @param {Function} onSubtitleUpdate - Real-time subtitle update callback
 * @param {Function} t - Translation function
 * @returns {Promise<Array>} - Final subtitle array
 */
export const processSegmentWithStreaming = async (file, segment, options, setStatus, onSubtitleUpdate, t) => {
  return new Promise((resolve, reject) => {
    const { fps, mediaResolution, model, userProvidedSubtitles } = options;
    
    // Check if this is a Gemini 2.0 model (they don't respect video_metadata offsets)
    const isGemini20Model = model && (model.includes('gemini-2.0') || model.includes('gemini-1.5'));
    if (isGemini20Model) {
      console.warn(`[ProcessingUtils] Model ${model} may not respect video segment offsets - will filter results and use early stopping`);
    }
    
    // Track if we've stopped early due to subtitles going past segment
    let hasStoppedEarly = false;
    let earlyStopController = null;

    // Import streaming processor
    import('../../utils/subtitle/realtimeProcessor').then(({ createRealtimeProcessor }) => {
      // Create realtime processor
      const processor = createRealtimeProcessor({
        onSubtitleUpdate: (data) => {
          console.log('[ProcessingUtils] Subtitle update:', data.subtitles.length, 'subtitles');
          
          // For Gemini 2.0 models: implement early stopping when subtitles exceed segment
          if (isGemini20Model && data.subtitles && data.subtitles.length > 0 && !hasStoppedEarly) {
            const segmentStart = segment.start;
            const segmentEnd = segment.end;
            
            // Check if we have subtitles that are significantly past the segment end
            // We add a small buffer (5 seconds) to avoid stopping too early
            const bufferTime = 5;
            const lastSubtitle = data.subtitles[data.subtitles.length - 1];
            
            if (lastSubtitle && lastSubtitle.start > (segmentEnd + bufferTime)) {
              console.warn(`[ProcessingUtils] Early stopping: Last subtitle at ${lastSubtitle.start}s exceeds segment end ${segmentEnd}s by more than ${bufferTime}s`);
              hasStoppedEarly = true;
              
              // Trigger early completion with filtered subtitles
              const filteredForCompletion = data.subtitles.filter(sub => {
                return sub.start < segmentEnd && sub.end > segmentStart;
              }).map(sub => {
                return {
                  ...sub,
                  start: Math.max(sub.start, segmentStart),
                  end: Math.min(sub.end, segmentEnd)
                };
              });
              
              console.log(`[ProcessingUtils] Early stop: Completing with ${filteredForCompletion.length} subtitles (from ${data.subtitles.length} total)`);
              
              // Cancel the streaming if we have a controller
              if (earlyStopController && typeof earlyStopController.abort === 'function') {
                earlyStopController.abort();
              }
              
              // Manually trigger completion
              processor.complete(JSON.stringify(filteredForCompletion));
              return; // Stop processing further updates
            }
          }
          
          // Filter subtitles for Gemini 2.0 models that don't respect segment offsets
          let filteredSubtitles = data.subtitles;
          if (isGemini20Model && data.subtitles && data.subtitles.length > 0) {
            const segmentStart = segment.start;
            const segmentEnd = segment.end;
            
            filteredSubtitles = data.subtitles.filter(sub => {
              // Keep subtitles that overlap with the segment
              return sub.start < segmentEnd && sub.end > segmentStart;
            }).map(sub => {
              // Clip subtitles to segment boundaries
              return {
                ...sub,
                start: Math.max(sub.start, segmentStart),
                end: Math.min(sub.end, segmentEnd)
              };
            });
            
            console.log(`[ProcessingUtils] Filtered ${data.subtitles.length} subtitles to ${filteredSubtitles.length} for segment ${segmentStart}-${segmentEnd}`);
          }
          
          // Dispatch streaming-update event for timeline animations
          if (data.isStreaming) {
            window.dispatchEvent(new CustomEvent('streaming-update', {
              detail: {
                subtitles: filteredSubtitles,
                segment: segment
              }
            }));
          }
          
          if (onSubtitleUpdate) {
            onSubtitleUpdate(filteredSubtitles, data.isStreaming);
          }
        },
        onStatusUpdate: setStatus,
        onComplete: (finalSubtitles) => {
          console.log('[ProcessingUtils] Streaming complete:', finalSubtitles.length, 'subtitles');
          
          // Filter final subtitles for Gemini 2.0 models
          let filteredFinal = finalSubtitles;
          if (isGemini20Model && finalSubtitles && finalSubtitles.length > 0) {
            const segmentStart = segment.start;
            const segmentEnd = segment.end;
            
            filteredFinal = finalSubtitles.filter(sub => {
              // Keep subtitles that overlap with the segment
              return sub.start < segmentEnd && sub.end > segmentStart;
            }).map(sub => {
              // Clip subtitles to segment boundaries
              return {
                ...sub,
                start: Math.max(sub.start, segmentStart),
                end: Math.min(sub.end, segmentEnd)
              };
            });
            
            console.log(`[ProcessingUtils] Final filter: ${finalSubtitles.length} subtitles to ${filteredFinal.length} for segment ${segmentStart}-${segmentEnd}`);
          }
          
          // Dispatch streaming-complete event for timeline animations
          window.dispatchEvent(new CustomEvent('streaming-complete', {
            detail: {
              subtitles: filteredFinal,
              segment: segment
            }
          }));
          
          resolve(filteredFinal);
        },
        onError: (error) => {
          console.error('[ProcessingUtils] Streaming error:', error);
          reject(error);
        }
      });

      // Prepare video metadata for segment processing
      // Using string format that was working before
      // FPS compatibility is now handled in the UI (VideoProcessingOptionsModal)
      const videoMetadata = {
        start_offset: `${Math.floor(segment.start)}s`,
        end_offset: `${Math.floor(segment.end)}s`,
        fps: fps
      };

      // Map media resolution to API enum value
      const mappedMediaResolution = mapMediaResolution(mediaResolution);

      // Prepare options for streaming API call
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

      // Start streaming
      import('../../services/gemini').then(({ streamGeminiApiWithFilesApi }) => {
        streamGeminiApiWithFilesApi(
          file,
          apiOptions,
          (chunk) => processor.processChunk(chunk),
          (finalText) => processor.complete(finalText),
          (error) => processor.error(error)
        );
      }).catch(reject);
    }).catch(reject);
  });
};
