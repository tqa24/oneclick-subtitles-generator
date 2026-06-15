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
import { autoSplitSubtitles } from '../../utils/subtitle/splitUtils';
import { uploadFileToGemini } from './filesApi';
import { showInfoToast } from '../../utils/toastUtils';
import {
    is503Error,
    is429Error,
    getRetryDelaySeconds
} from './parallelRetryPolicy';

// Re-export the Files-API + offsets coordinator so existing consumers keep
// importing it from this module (one-directional import; no runtime cycle).
export { coordinateParallelStreaming } from './coordinateParallelFilesApi';

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
 * Coordinate parallel streaming using INLINE extraction (no video_metadata offsets)
 * - Cuts sub-segments locally (server-side ffmpeg) and streams each as inline base64
 * - Starts streaming each sub-segment as soon as its cut is ready (no need to wait for all cuts)
 */
export const coordinateParallelInlineStreaming = async (
    sourceFile,
    _fileUri,
    options = {},
    onChunk,
    onComplete,
    onError,
    onProgress
) => {
    try {
        const { segmentInfo, maxDurationPerRequest, segmentProcessingDelay = 0, autoSplitSubtitles: autoSplitEnabled, maxWordsPerSubtitle, t } = options || {};

        if (!segmentInfo || !maxDurationPerRequest) {
            // Fallback to single inline streaming (no splitting)
            return streamGeminiContent(sourceFile, null, { ...options, forceInline: true, videoMetadata: undefined }, onChunk, onComplete, onError);
        }

        const fullSeg = { start: segmentInfo.start, end: segmentInfo.end };
        const subSegments = splitSegmentForParallelProcessing(fullSeg, maxDurationPerRequest);

        if (subSegments.length === 1) {
            return streamGeminiContent(sourceFile, null, { ...options, forceInline: true, videoMetadata: undefined }, onChunk, onComplete, onError);
        }
        // Detect FE-only; if so, switch to Files API offsets and return early
        const { probeServerAvailability } = await import('../../utils/serverEnv');
        const hasServer = await probeServerAvailability();
        if (!hasServer) {
            try {
                const uploadRes = await uploadFileToGemini(sourceFile, undefined, { runId: options && options.runId ? options.runId : undefined });
                const fileUri = uploadRes?.uri || uploadRes?.file?.uri;
                const filesApiOptions = {
                    ...options,
                    // Ensure we do not force inline; we want Files API + offsets
                    forceInline: undefined,
                    videoMetadata: {
                        start_offset: `${Math.floor(fullSeg.start)}s`,
                        end_offset: `${Math.ceil(fullSeg.end)}s`
                    }
                };

                // Lazily import the Files-API coordinator to avoid pulling it in
                // for the common INLINE path.
                const { coordinateParallelStreaming } = await import('./coordinateParallelFilesApi');
                return await coordinateParallelStreaming(
                    sourceFile,
                    fileUri,
                    filesApiOptions,
                    onChunk,
                    onComplete,
                    onError,
                    onProgress
                );
            } catch (e) {
                console.warn('[ParallelCoordinator INLINE] Files API path failed in FE-only mode:', e);
                onError(e);
                return;
            }
        }


        console.log(`[ParallelCoordinator INLINE] Starting with ${subSegments.length} sub-segments`);

        const progressTracker = new ParallelProgressTracker(subSegments.length, onProgress);

        const segmentSubtitles = new Array(subSegments.length).fill([]);
        const segmentTexts = new Array(subSegments.length).fill('');

        // Inline large-clip threshold: subclips above this size are routed
        // through the Files API instead of inline base64. The retry policy
        // itself is shared via parallelRetryPolicy.
        const INLINE_LARGE_SEGMENT_THRESHOLD_BYTES = 20 * 1024 * 1024; // 20MB (align with Google recommendation)

        // Stream a prepared (already-clipped) sub-segment with retries and large-clip Files API fallback
        const streamSubSegmentWithRetry = async (clipped, subSeg, index, attempt = 0, maxRetries = 5) => {
            const useFilesApiForThisClip = clipped && clipped.size > INLINE_LARGE_SEGMENT_THRESHOLD_BYTES;

            // Common options for this specific sub-segment
            const segOptions = {
                ...options,
                // Ensure INLINE does not send videoMetadata; Files API path also uses the clipped media without offsets
                videoMetadata: undefined,
                forceInline: !useFilesApiForThisClip,
                segmentInfo: {
                    start: subSeg.start,
                    end: subSeg.end,
                    duration: subSeg.end - subSeg.start
                }
            };

            // Chunk handler (shared for INLINE and Files API path) with aggregation
            const handleChunk = (chunk) => {
                if (chunk.subtitles && chunk.subtitles.length > 0) {
                    // Adjust relative timestamps if needed (shift by subSeg.start)
                    const first = chunk.subtitles[0];
                    const looksRelative = first && (first.start < subSeg.start / 2);

                    let adjusted = looksRelative
                        ? chunk.subtitles.map(s => ({ ...s, start: (s.start || 0) + subSeg.start, end: (s.end || 0) + subSeg.start }))
                        : chunk.subtitles;

                    if (autoSplitEnabled && maxWordsPerSubtitle > 0) {
                        adjusted = autoSplitSubtitles(adjusted, maxWordsPerSubtitle);
                    }

                    segmentSubtitles[index] = adjusted;
                    segmentTexts[index] = chunk.accumulatedText || '';

                    // Aggregate and emit combined progress update
                    const aggregated = mergeParallelSubtitles(
                        subSegments.map((ss, i) => ({ segment: ss, subtitles: segmentSubtitles[i] || [] }))
                    );

                    onChunk({
                         text: segmentTexts.join('\n'),
                         accumulatedText: segmentTexts.join('\n'),
                         subtitles: aggregated,
                         chunkCount: chunk.chunkCount,
                         isComplete: false,
                         parallelInfo: {
                             segmentIndex: index,
                             totalSegments: subSegments.length,
                             segmentProgress: progressTracker.segmentProgress,
                             actualSegment: subSeg  // Pass the actual sub-segment being processed
                         }
                     });

                    // Rough progress signal for this segment
                    progressTracker.updateSegmentProgress(index, Math.min(90, (chunk.chunkCount || 1) * 10));
                }
            };

            // Completion handler for this sub-segment
            const handleComplete = (finalText) => {
                segmentTexts[index] = finalText || segmentTexts[index];
                progressTracker.markSegmentComplete(index);

                // CRITICAL FIX: Send final chunk when segment completes
                // This ensures React receives results as each segment finishes, not just at the very end
                // This is what triggers per-segment animations
                const finalAggregated = mergeParallelSubtitles(
                    subSegments.map((ss, i) => ({ segment: ss, subtitles: segmentSubtitles[i] || [] }))
                );

                onChunk({
                    text: segmentTexts.join('\n'),
                    accumulatedText: segmentTexts.join('\n'),
                    subtitles: finalAggregated,
                    chunkCount: 999, // Use high number to indicate final chunk
                    isComplete: false,
                    isSegmentComplete: true, // Mark that a segment just completed
                    completedSegmentIndex: index,
                    parallelInfo: {
                        segmentIndex: index,
                        totalSegments: subSegments.length,
                        segmentProgress: progressTracker.segmentProgress,
                        actualSegment: subSeg  // Pass the actual sub-segment being processed
                    }
                });
            };

            // Error handler that applies retry policy
            const handleError = async (err) => {
                const shouldRetry = (is503Error(err) || is429Error(err)) && attempt < maxRetries;
                if (shouldRetry) {
                    const delaySec = getRetryDelaySeconds(attempt);
                    console.warn(`[ParallelCoordinator INLINE] Segment ${index + 1}/${subSegments.length} retry in ${delaySec}s (attempt ${attempt + 1}/${maxRetries}) due to:`, err?.message || err);
                    await new Promise(r => setTimeout(r, 1000 * delaySec));
                    return streamSubSegmentWithRetry(clipped, subSeg, index, attempt + 1, maxRetries);
                }
                console.error(`[ParallelCoordinator INLINE] Segment ${index + 1} failed:`, err);
                progressTracker.markSegmentFailed(index, err);
                // Re-throw so caller can mark this task as failed
                throw err;
            };

            try {
                if (useFilesApiForThisClip) {
                    // Route this subclip through Files API streaming (benefits from upload + reuse + stability)
                    await (await import('./core')).streamGeminiApiWithFilesApi(
                        clipped,
                        segOptions,
                        handleChunk,
                        handleComplete,
                        (e) => { throw e; },
                        undefined // onProgress not used here (we aggregate via handleChunk)
                    );
                } else {
                    // Pure INLINE streaming for smaller subclips
                    await streamGeminiContent(
                        clipped,
                        null,
                        segOptions,
                        handleChunk,
                        handleComplete,
                        (e) => { throw e; }
                    );
                }
            } catch (err) {
                return handleError(err);
            }
        };

        // For each sub-segment, create task creators (don't execute immediately)
        const taskCreators = subSegments.map((subSeg, index) => async () => {
            try {
                progressTracker.updateSegmentProgress(index, 5, 'cutting');
                const { extractVideoSegmentLocally } = await import('../../utils/videoSegmenter');
                const clipped = await extractVideoSegmentLocally(sourceFile, subSeg.start, subSeg.end, { runId: options && options.runId ? options.runId : undefined });
                progressTracker.updateSegmentProgress(index, 10, 'streaming');
                await streamSubSegmentWithRetry(clipped, subSeg, index, 0, 5);
            } catch (e) {
                console.error(`[ParallelCoordinator INLINE] Error in segment ${index + 1}:`, e);
                progressTracker.markSegmentFailed(index, e);
            }
        });

        // Execute tasks: staggered start when using delays, otherwise with concurrency
        if (segmentProcessingDelay > 0) {
            // Staggered parallel execution: start requests with delays between start times
            console.log(`[ParallelCoordinator INLINE] ✓ STAGGERED PARALLEL MODE - Processing ${taskCreators.length} segments with ${segmentProcessingDelay}s delay between request starts`);
            const seqMsg = t ? t('processing.segmentProcessingSequential', `Processing ${taskCreators.length} segments with ${segmentProcessingDelay}s delay between request starts`, { count: taskCreators.length, delay: segmentProcessingDelay }) : `Processing ${taskCreators.length} segments with ${segmentProcessingDelay}s delay between request starts`;
            showInfoToast(seqMsg, 10000);

            const promises = [];
            for (let i = 0; i < taskCreators.length; i++) {
                // Wait for the delay before starting the next segment (except for the first one)
                if (i > 0) {
                    console.log(`[ParallelCoordinator INLINE] Waiting ${segmentProcessingDelay}s before starting segment ${i + 1}/${taskCreators.length}`);
                    await new Promise(resolve => setTimeout(resolve, segmentProcessingDelay * 1000));
                }

                console.log(`[ParallelCoordinator INLINE] Starting segment ${i + 1}/${taskCreators.length}`);
                const startMsg = t ? t('processing.segmentProcessingStart', `Starting segment ${i + 1}/${taskCreators.length}...`, { current: i + 1, total: taskCreators.length }) : `Starting segment ${i + 1}/${taskCreators.length}...`;
                showInfoToast(startMsg, 3000);
                // Start the request (don't await - let it run in parallel with other segments)
                promises.push(taskCreators[i]());
            }

            // Wait for all parallel requests to complete
            await Promise.allSettled(promises);
        } else {
            // Parallel execution: process 2 at a time
            console.log(`[ParallelCoordinator INLINE] ✓ PARALLEL MODE - Processing ${taskCreators.length} segments with concurrency`);
            const MAX_CONCURRENCY = 2;
            for (let i = 0; i < taskCreators.length; i += MAX_CONCURRENCY) {
                await Promise.allSettled(taskCreators.slice(i, i + MAX_CONCURRENCY).map(creator => creator()));
            }
        }

        // Merge final results
        const finalAgg = mergeParallelSubtitles(
            subSegments.map((ss, i) => ({ segment: ss, subtitles: segmentSubtitles[i] || [] }))
        );

        onComplete({
            subtitles: finalAgg,
            isSegmentResult: true,
            segment: segmentInfo,
            text: segmentTexts.join('\n')
        });
    } catch (error) {
        console.error('[ParallelCoordinator INLINE] Unexpected error:', error);
        onError(error);
    }
};
