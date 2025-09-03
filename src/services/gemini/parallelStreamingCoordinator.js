/**
 * Parallel Streaming Coordinator for Gemini API
 * Manages multiple concurrent streaming requests and coordinates their responses
 */

import { streamGeminiContent } from './streamingService';
import { 
  splitSegmentForParallelProcessing, 
  mergeParallelSubtitles,
  ParallelProgressTracker 
} from '../../utils/parallelProcessingUtils';

/**
 * Coordinate parallel streaming requests for a video segment
 * @param {File} file - The media file (already uploaded to Files API)
 * @param {string} fileUri - The uploaded file URI from Files API
 * @param {Object} options - Generation options including maxDurationPerRequest
 * @param {Function} onChunk - Callback for each streaming chunk (aggregated from all parallel streams)
 * @param {Function} onComplete - Callback when all streams are complete
 * @param {Function} onError - Callback for errors
 * @param {Function} onProgress - Callback for progress updates
 */
export const coordinateParallelStreaming = async (
  file,
  fileUri,
  options = {},
  onChunk,
  onComplete,
  onError,
  onProgress
) => {
  const { 
    segmentInfo, 
    maxDurationPerRequest,
    userProvidedSubtitles,
    modelId,
    videoMetadata,
    mediaResolution
  } = options;

  // Check if we need to split the segment
  if (!segmentInfo || !maxDurationPerRequest) {
    // No parallel processing needed, use single stream
    console.log('[ParallelCoordinator] No parallel processing needed, using single stream');
    return streamGeminiContent(file, fileUri, options, onChunk, onComplete, onError);
  }

  const segment = {
    start: segmentInfo.start,
    end: segmentInfo.end
  };

  // Split the segment for parallel processing
  const subSegments = splitSegmentForParallelProcessing(segment, maxDurationPerRequest);

  if (subSegments.length === 1) {
    // No splitting needed, use single stream
    console.log('[ParallelCoordinator] Segment within max duration, using single stream');
    return streamGeminiContent(file, fileUri, options, onChunk, onComplete, onError);
  }

  console.log(`[ParallelCoordinator] Starting parallel processing with ${subSegments.length} segments`);

  // Initialize progress tracker
  const progressTracker = new ParallelProgressTracker(subSegments.length, onProgress);

  // Store results from each segment
  const segmentResults = new Array(subSegments.length);
  const segmentSubtitles = new Array(subSegments.length).fill([]);
  const segmentTexts = new Array(subSegments.length).fill('');
  let completedSegments = 0;
  let failedSegments = [];

  // Helper function to attempt streaming with retries for 503 errors
  const streamWithRetry = async (subSegment, index, retryCount = 0, maxRetries = 3) => {
    return new Promise((resolve, reject) => {
      const attemptNumber = retryCount + 1;
      
      if (retryCount > 0) {
        console.log(`[ParallelCoordinator] Retrying segment ${index + 1}/${subSegments.length} (attempt ${attemptNumber}/${maxRetries + 1})`);
      } else {
        console.log(`[ParallelCoordinator] Starting stream for segment ${index + 1}/${subSegments.length}: [${subSegment.start}s-${subSegment.end}s]`);
      }

      // Prepare options for this segment
      const segmentOptions = {
        ...options,
        segmentInfo: {
          start: subSegment.start,
          end: subSegment.end,
          duration: subSegment.end - subSegment.start
        },
        // Adjust video metadata for this specific segment
        videoMetadata: videoMetadata ? {
          ...videoMetadata,
          start_offset: `${Math.floor(subSegment.start)}s`,
          end_offset: `${Math.floor(subSegment.end)}s`
        } : undefined
      };

      // Start streaming for this segment
      streamGeminiContent(
        file,
        fileUri,
        segmentOptions,
        // onChunk - collect subtitles from each segment
        (chunk) => {
          if (chunk.subtitles && chunk.subtitles.length > 0) {
            segmentSubtitles[index] = chunk.subtitles;
            segmentTexts[index] = chunk.accumulatedText || '';

            // Update progress for this segment
            const progress = Math.min(90, (chunk.chunkCount || 1) * 10); // Estimate progress
            progressTracker.updateSegmentProgress(index, progress);

            // Aggregate and send combined results
            const aggregatedSubtitles = mergeParallelSubtitles(
              segmentSubtitles
                .map((subs, i) => ({ segment: subSegments[i], subtitles: subs }))
                .filter(result => result.subtitles.length > 0)
            );

            // Send aggregated chunk update
            onChunk({
              text: segmentTexts.join('\n'),
              accumulatedText: segmentTexts.join('\n'),
              subtitles: aggregatedSubtitles,
              chunkCount: chunk.chunkCount,
              isComplete: false,
              parallelInfo: {
                segmentIndex: index,
                totalSegments: subSegments.length,
                segmentProgress: progressTracker.segmentProgress
              }
            });
          }
        },
        // onComplete for this segment
        (finalText) => {
          console.log(`[ParallelCoordinator] Segment ${index + 1}/${subSegments.length} completed`);
          
          // Store final results for this segment
          segmentResults[index] = {
            segment: subSegment,
            subtitles: segmentSubtitles[index],
            text: finalText
          };

          progressTracker.markSegmentComplete(index);
          completedSegments++;

          resolve({
            segmentIndex: index,
            subtitles: segmentSubtitles[index],
            text: finalText
          });
        },
        // onError for this segment
        async (error) => {
          // Check if this is a 503 error (overload)
          const is503Error = error && error.message && (
            error.message.includes('503') ||
            error.message.includes('overloaded') ||
            error.message.includes('UNAVAILABLE')
          );
          
          if (is503Error && retryCount < maxRetries) {
            console.warn(`[ParallelCoordinator] Segment ${index + 1}/${subSegments.length} got 503 error, retrying in ${2 ** retryCount} seconds...`);
            
            // Exponential backoff: wait 1s, 2s, 4s
            await new Promise(wait => setTimeout(wait, 1000 * (2 ** retryCount)));
            
            // Retry the segment
            try {
              const result = await streamWithRetry(subSegment, index, retryCount + 1, maxRetries);
              resolve(result);
            } catch (retryError) {
              // If retry also fails, handle as final error
              console.error(`[ParallelCoordinator] Error in segment ${index + 1}/${subSegments.length} after ${attemptNumber} attempts:`, retryError);
              
              progressTracker.markSegmentFailed(index, retryError);
              failedSegments.push({ index, error: retryError });

              segmentResults[index] = {
                segment: subSegment,
                error: retryError,
                subtitles: [],
                text: ''
              };

              resolve({
                segmentIndex: index,
                error: retryError
              });
            }
          } else {
            // Not a 503 error or max retries reached
            console.error(`[ParallelCoordinator] Error in segment ${index + 1}/${subSegments.length}:`, error);
            
            progressTracker.markSegmentFailed(index, error);
            failedSegments.push({ index, error });

            // Don't reject immediately - allow other segments to complete
            // But mark this segment as failed
            segmentResults[index] = {
              segment: subSegment,
              error: error,
              subtitles: [],
              text: ''
            };

            resolve({
              segmentIndex: index,
              error: error
            });
          }
        }
      );
    });
  };

  // Create a promise for each segment
  const segmentPromises = subSegments.map((subSegment, index) => {
    return streamWithRetry(subSegment, index, 0, 3);
  });

  try {
    // Wait for all segments to complete (or fail)
    const results = await Promise.allSettled(segmentPromises);

    console.log(`[ParallelCoordinator] All segments processed. Success: ${completedSegments}, Failed: ${failedSegments.length}`);

    // Check if we have at least some successful segments
    const successfulResults = segmentResults.filter(r => r && !r.error && r.subtitles);

    if (successfulResults.length === 0) {
      // All segments failed
      const error = new Error(`All ${subSegments.length} parallel segments failed to process`);
      onError(error);
      return;
    }

    // Merge all successful subtitles
    const finalSubtitles = mergeParallelSubtitles(successfulResults);
    const finalText = successfulResults
      .map(r => r.text)
      .filter(t => t)
      .join('\n');

    // If some segments failed, notify but still return partial results
    if (failedSegments.length > 0) {
      console.warn(`[ParallelCoordinator] ${failedSegments.length} segments failed, returning partial results`);
      
      // Dispatch warning event
      window.dispatchEvent(new CustomEvent('parallel-processing-partial', {
        detail: {
          totalSegments: subSegments.length,
          failedSegments: failedSegments,
          successfulSegments: successfulResults.length
        }
      }));
    }

    // Call onComplete with merged results (prefer passing subtitles array directly)
    onComplete(finalSubtitles);

  } catch (error) {
    console.error('[ParallelCoordinator] Unexpected error in parallel processing:', error);
    onError(error);
  }
};

/**
 * Check if parallel processing should be used
 * @param {Object} segment - The segment to process
 * @param {number} maxDurationPerRequest - Maximum duration per request
 * @returns {boolean} Whether to use parallel processing
 */
export const shouldUseParallelProcessing = (segment, maxDurationPerRequest) => {
  if (!segment || !maxDurationPerRequest) return false;
  
  const duration = segment.end - segment.start;
  return duration > maxDurationPerRequest;
};

/**
 * Estimate time savings from parallel processing
 * @param {number} totalDuration - Total duration in seconds
 * @param {number} maxDurationPerRequest - Maximum duration per request in seconds
 * @param {number} avgProcessingTimePerMinute - Average processing time per minute of video
 * @returns {Object} Time estimation
 */
export const estimateParallelTimeSavings = (
  totalDuration, 
  maxDurationPerRequest, 
  avgProcessingTimePerMinute = 10 // Default: 10 seconds per minute of video
) => {
  const numSegments = Math.ceil(totalDuration / maxDurationPerRequest);
  
  // Sequential time estimate
  const sequentialTime = (totalDuration / 60) * avgProcessingTimePerMinute;
  
  // Parallel time estimate (assuming perfect parallelization)
  // In reality, there's some overhead, so add 20% overhead
  const parallelTime = ((totalDuration / numSegments) / 60) * avgProcessingTimePerMinute * 1.2;
  
  const timeSaved = Math.max(0, sequentialTime - parallelTime);
  const speedup = sequentialTime / parallelTime;

  return {
    numSegments,
    sequentialTime: Math.round(sequentialTime),
    parallelTime: Math.round(parallelTime),
    timeSaved: Math.round(timeSaved),
    speedup: speedup.toFixed(2)
  };
};
