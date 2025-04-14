/**
 * Service for processing video and audio segments
 */

import { callGeminiApi, getProcessingForceStopped } from './geminiService';
import { fetchSegment } from '../utils/videoSplitter';
import { parseRawTextManually } from '../utils/subtitle';
import { getTranscriptionRules } from '../utils/transcriptionRulesStore';

/**
 * Process a single media segment (video or audio)
 * @param {Object} segment - The segment object with URL
 * @param {number} segmentIndex - The index of the segment
 * @param {number} startTime - The start time offset for this segment
 * @param {string} segmentCacheId - The cache ID for this segment
 * @param {Function} onStatusUpdate - Callback for status updates
 * @param {Function} t - Translation function
 * @param {string} mediaType - Type of media ('video' or 'audio')
 * @returns {Promise<Array>} - Array of subtitle objects with adjusted timestamps
 */
export async function processSegment(segment, segmentIndex, startTime, segmentCacheId, onStatusUpdate, t, mediaType = 'video', options = {}) {
    // Extract options
    const { userProvidedSubtitles } = options;
    let retryCount = 0;
    const maxRetries = 3;
    let success = false;
    let segmentSubtitles = null;

    // Update status to show we're processing in parallel
    onStatusUpdate({
        message: t('output.processingInParallel', 'Processing in parallel...'),
        type: 'loading'
    });

    while (!success && retryCount < maxRetries) {
        // Check if processing has been force stopped
        if (getProcessingForceStopped()) {
            console.log(`Segment ${segmentIndex+1} processing was force stopped, aborting retries`);
            throw new Error('Processing was force stopped');
        }
        try {
            // Fetch the segment file from the server
            const segmentFile = await fetchSegment(segment.url, segmentIndex, mediaType);

            // Log the segment file details
            console.log(`Processing ${mediaType} segment ${segmentIndex+1}:`, {
                name: segmentFile.name,
                type: segmentFile.type,
                size: segmentFile.size
            });

            // Only get transcription rules if we're not using user-provided subtitles
            if (!userProvidedSubtitles) {
                // Get transcription rules from localStorage
                const transcriptionRules = getTranscriptionRules();
                if (transcriptionRules) {
                    console.log(`Using transcription rules for segment ${segmentIndex+1}:`, transcriptionRules);
                } else {
                    console.log(`No transcription rules found for segment ${segmentIndex+1}`);
                }
            } else {
                console.log(`Skipping transcription rules for segment ${segmentIndex+1} because user-provided subtitles are present`);
            }

            // Process the segment with Gemini
            console.log(`Processing segment ${segmentIndex+1} with${userProvidedSubtitles ? ' user-provided' : ''} subtitles`);

            // Get the total duration from the parent if available
            const totalDuration = options.totalDuration || null;

            // Create segment info for the prompt
            const segmentInfo = {
                isSegment: true,
                segmentIndex,
                startTime,
                duration: segment.duration,
                totalDuration
            };

            // Pass segment info to callGeminiApi
            segmentSubtitles = await callGeminiApi(segmentFile, 'file-upload', {
                userProvidedSubtitles,
                segmentInfo
            });
            success = true;
        } catch (error) {
            retryCount++;
            console.error(`Error processing segment ${segmentIndex+1}, attempt ${retryCount}:`, error);

            // Check if this is an empty response (empty JSON array)
            if (error.message && error.message.includes('Unrecognized subtitle format') &&
                error.message.includes('rawText":"[]"')) {
                console.log('Empty JSON array response detected, returning empty subtitles');
                // Return empty array instead of retrying
                return [];
            }

            // Check for 503 error
            if (error.message && (
                (error.message.includes('503') && error.message.includes('Service Unavailable')) ||
                error.message.includes('The model is overloaded')
            )) {
                // If we hit a 503 error, throw it with segment information
                throw new Error(`Segment ${segmentIndex+1}: ${t('errors.geminiOverloaded')}`);
            }

            // Check for token limit error
            if (error.message && error.message.includes('token') && error.message.includes('exceeds the maximum')) {
                // If we hit token limit, we need to use smaller segments
                throw new Error(`Token limit exceeded for segment ${segmentIndex+1}. Please try with a shorter video segment or lower video quality.`);
            }

            // Check for unrecognized format error or empty subtitles
            try {
                const errorData = JSON.parse(error.message);

                if (errorData.type === 'unrecognized_format') {
                    // Extract the raw text from the error
                    const rawText = errorData.rawText;

                    // Try to parse the raw text manually
                    const manualSubtitles = parseRawTextManually(rawText, startTime);

                    if (manualSubtitles && manualSubtitles.length > 0) {
                        console.log(`Manually parsed ${manualSubtitles.length} subtitles from segment ${segmentIndex+1}`);
                        segmentSubtitles = manualSubtitles;
                        success = true;
                        break; // Exit the retry loop, we've handled it
                    }
                }

                // Handle the case where all subtitles are empty
                if (errorData.type === 'empty_subtitles') {
                    console.log(`Segment ${segmentIndex+1} has no speech content:`, errorData.message);
                    // Return an empty array for this segment
                    segmentSubtitles = [];
                    success = true;
                    break; // Exit the retry loop, we've handled it
                }
            } catch (parseError) {
                console.error('Error parsing error message:', parseError);
            }

            if (retryCount >= maxRetries) {
                throw new Error(`Failed to process segment ${segmentIndex+1} after ${maxRetries} attempts`);
            }

            // Update status for retry - keep using the parallel processing message
            onStatusUpdate({
                message: t('output.processingInParallel', 'Processing in parallel...'),
                type: 'loading'
            });

            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    // Cache the segment results
    if (success && segmentSubtitles) {
        try {
            await fetch('http://localhost:3004/api/save-subtitles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    cacheId: segmentCacheId,
                    subtitles: segmentSubtitles
                })
            });
        } catch (error) {
            console.error('Error caching segment subtitles:', error);
            // Continue even if caching fails
        }
    }

    // If we got here without subtitles, something went wrong
    if (!segmentSubtitles) {
        throw new Error(`Failed to process segment ${segmentIndex+1}`);
    }

    // Handle the case where the API returned an empty array (no speech in segment)
    if (Array.isArray(segmentSubtitles) && segmentSubtitles.length === 0) {
        console.log(`Segment ${segmentIndex+1} has no speech content (empty array returned)`);
        // Continue processing with an empty array
    }

    // Get the actual segment duration and start time if available
    const segmentDuration = segment.duration !== undefined ? segment.duration : null;

    // Log detailed information about this segment
    console.log(`Adjusting timestamps for segment ${segmentIndex+1}:`);
    console.log(`  Start time: ${startTime.toFixed(2)}s`);
    if (segmentDuration) {
        console.log(`  Duration: ${segmentDuration.toFixed(2)}s`);
        console.log(`  End time: ${(startTime + segmentDuration).toFixed(2)}s`);
    }

    // Log the original timestamps for debugging
    console.log(`  Original timestamps (first 3 subtitles):`,
        segmentSubtitles.slice(0, 3).map(s => `${s.start.toFixed(2)}-${s.end.toFixed(2)}: ${s.text.substring(0, 20)}...`));

    // Adjust timestamps based on segment start time
    const adjustedSubtitles = segmentSubtitles.map(subtitle => {
        // Apply the offset based on actual segment start time
        const adjustedStart = subtitle.start + startTime;
        const adjustedEnd = subtitle.end + startTime;

        return {
            ...subtitle,
            start: adjustedStart,
            end: adjustedEnd
        };
    });

    // Log the adjusted timestamps for debugging
    console.log(`  Adjusted timestamps (first 3 subtitles):`,
        adjustedSubtitles.slice(0, 3).map(s => `${s.start.toFixed(2)}-${s.end.toFixed(2)}: ${s.text.substring(0, 20)}...`));
    console.log(`  Total subtitles in segment: ${adjustedSubtitles.length}`);

    return adjustedSubtitles;
}

/**
 * Update segment status in the UI
 * @param {number} index - Segment index
 * @param {string} status - Status type
 * @param {string} message - Status message
 * @param {Function} t - Translation function
 * @param {string} timeRange - Time range for the segment (optional)
 */
export const updateSegmentStatus = (index, status, message, t, timeRange = null) => {
    // Create the status object
    const segmentStatus = {
        index,
        status,
        message,
        timeRange,
        shortMessage: status === 'loading' ? t('output.processing') :
                     status === 'success' ? t('output.done') :
                     status === 'error' ? t('output.failed') :
                     status === 'cached' ? t('output.cached') :
                     status === 'pending' ? t('output.pending') :
                     status === 'retrying' ? t('output.retrying', 'Retrying...') : ''
    };

    // Dispatch event to update UI
    const event = new CustomEvent('segmentStatusUpdate', {
        detail: [segmentStatus]
    });
    window.dispatchEvent(event);
};
