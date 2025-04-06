/**
 * Service for processing video segments
 */

import { callGeminiApi } from './geminiService';
import { fetchSegment } from '../utils/videoSplitter';
import { parseRawTextManually } from '../utils/subtitleParser';

/**
 * Process a single video segment
 * @param {Object} segment - The segment object with URL
 * @param {number} segmentIndex - The index of the segment
 * @param {number} startTime - The start time offset for this segment
 * @param {string} segmentCacheId - The cache ID for this segment
 * @param {Function} onStatusUpdate - Callback for status updates
 * @param {Function} t - Translation function
 * @returns {Promise<Array>} - Array of subtitle objects with adjusted timestamps
 */
export async function processSegment(segment, segmentIndex, startTime, segmentCacheId, onStatusUpdate, t) {
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
        try {
            // Fetch the segment file from the server
            const segmentFile = await fetchSegment(segment.url);

            // Process the segment with Gemini
            segmentSubtitles = await callGeminiApi(segmentFile, 'file-upload');
            success = true;
        } catch (error) {
            retryCount++;
            console.error(`Error processing segment ${segmentIndex+1}, attempt ${retryCount}:`, error);

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

            // Check for unrecognized format error
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

    // Adjust timestamps for this segment and return
    return segmentSubtitles.map(subtitle => ({
        ...subtitle,
        start: subtitle.start + startTime,
        end: subtitle.end + startTime
    }));
}

/**
 * Update segment status in the UI
 * @param {number} index - Segment index
 * @param {string} status - Status type
 * @param {string} message - Status message
 * @param {Function} t - Translation function
 */
export const updateSegmentStatus = (index, status, message, t) => {
    // Create the status object
    const segmentStatus = {
        index,
        status,
        message,
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
