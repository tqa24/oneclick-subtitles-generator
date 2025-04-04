/**
 * Utility functions for processing videos, including splitting long videos
 * into smaller segments for Gemini API processing
 */

import { callGeminiApi } from '../services/geminiService';
import { splitVideoOnServer, fetchSegment } from './videoSplitter';

/**
 * Parse raw text from Gemini when the subtitle parser fails
 * @param {string} rawText - The raw text from Gemini
 * @param {number} startTime - The start time offset for this segment
 * @returns {Array} - Array of subtitle objects
 */
const parseRawTextManually = (rawText, startTime = 0) => {
    if (!rawText) return [];

    const subtitles = [];

    // Match the format with both start and end times: [ 0m0s000ms - 0m1s500ms ] Text
    // This handles various formats including with or without milliseconds
    const regex = /\[\s*(\d+)m(\d+)s(?:(\d+)ms)?\s*-\s*(\d+)m(\d+)s(?:(\d+)ms)?\s*\]\s*(.+?)(?=\[|$)/g;
    let match;

    while ((match = regex.exec(rawText)) !== null) {
        const startMin = parseInt(match[1]);
        const startSec = parseInt(match[2]);
        const startMs = match[3] ? parseInt(match[3]) / 1000 : 0;
        const endMin = parseInt(match[4]);
        const endSec = parseInt(match[5]);
        const endMs = match[6] ? parseInt(match[6]) / 1000 : 0;
        const text = match[7].trim();

        if (text) {
            subtitles.push({
                id: subtitles.length + 1,
                start: startMin * 60 + startSec + startMs,
                end: endMin * 60 + endSec + endMs,
                text: text
            });
        }
    }

    // If no matches with the above format, try the single timestamp format: [ 0m0s437ms ] Text
    if (subtitles.length === 0) {
        const singleTimestampRegex = /\[\s*(\d+)m(\d+)s(?:(\d+)ms)?\s*\]\s*(.+?)(?=\[|$)/g;

        // Process each subtitle

        while ((match = singleTimestampRegex.exec(rawText)) !== null) {
            const startMin = parseInt(match[1]);
            const startSec = parseInt(match[2]);
            const startMs = match[3] ? parseInt(match[3]) / 1000 : 0;
            const text = match[4].trim();

            const start = startMin * 60 + startSec + startMs;

            // If this is not the first subtitle, set the end time of the previous subtitle
            if (subtitles.length > 0) {
                subtitles[subtitles.length - 1].end = start;
            }

            // For the current subtitle, set the end time to start + 5 seconds (temporary)
            const end = start + 5;

            if (text) {
                subtitles.push({
                    id: subtitles.length + 1,
                    start: start,
                    end: end,
                    text: text
                });
            }
        }

        // Adjust the end time of the last subtitle if needed
        if (subtitles.length > 0) {
            const lastSubtitle = subtitles[subtitles.length - 1];
            if (lastSubtitle.end > lastSubtitle.start + 10) {
                lastSubtitle.end = lastSubtitle.start + 5; // Limit to 5 seconds if it's too long
            }
        }
    }

    // If no matches, try to split by lines and look for timestamps
    if (subtitles.length === 0) {
        const lines = rawText.split('\n');
        for (const line of lines) {
            const lineMatch = line.match(/\[\s*(\d+)m(\d+)s\s*-\s*(\d+)m(\d+)s\s*\]\s*(.+)/);
            if (lineMatch) {
                const startMin = parseInt(lineMatch[1]);
                const startSec = parseInt(lineMatch[2]);
                const endMin = parseInt(lineMatch[3]);
                const endSec = parseInt(lineMatch[4]);
                const text = lineMatch[5].trim();

                if (text) {
                    subtitles.push({
                        id: subtitles.length + 1,
                        start: startMin * 60 + startSec,
                        end: endMin * 60 + endSec,
                        text: text
                    });
                }
            }
        }
    }

    // Apply the start time offset to all subtitles
    if (startTime > 0 && subtitles.length > 0) {
        subtitles.forEach(subtitle => {
            subtitle.start += startTime;
            subtitle.end += startTime;
        });
    }

    return subtitles;
};

// Maximum video duration in minutes for a single Gemini API call
// Get the segment duration from localStorage or use default (30 minutes)
const getSegmentDurationMinutes = () => {
    const savedDuration = parseInt(localStorage.getItem('segment_duration') || '30');
    // Ensure the value is one of the allowed options: 5, 10, 15, 20, 30, 45
    const allowedDurations = [5, 10, 15, 20, 30, 45];
    return allowedDurations.includes(savedDuration) ? savedDuration : 30;
};

// Calculate the segment duration in seconds when needed
const getMaxSegmentDurationSeconds = () => getSegmentDurationMinutes() * 60;

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
async function processSegment(segment, segmentIndex, startTime, segmentCacheId, onStatusUpdate, t) {
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
// We'll use the getter function to get the current value whenever needed

/**
 * Get the duration of a video file
 * @param {File} videoFile - The video file
 * @returns {Promise<number>} - The duration in seconds
 */
export const getVideoDuration = (videoFile) => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';

        video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            resolve(video.duration);
        };

        video.onerror = () => {
            window.URL.revokeObjectURL(video.src);
            reject(new Error('Failed to load video metadata'));
        };

        video.src = URL.createObjectURL(videoFile);
    });
};

/**
 * Create a video segment from the original file
 * @param {File} originalFile - The original video file
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @returns {File} - A new File object representing the segment
 */
export const createVideoSegment = (originalFile, startTime, endTime, segmentIndex) => {
    // Since we can't actually split the video in the browser,
    // we'll create a reference to the original file with metadata
    // about the segment's time range
    const segmentFile = new File([originalFile], `segment_${segmentIndex}.mp4`, {
        type: originalFile.type,
        lastModified: originalFile.lastModified
    });

    // Attach metadata to the file object
    segmentFile.segmentStartTime = startTime;
    segmentFile.segmentEndTime = endTime;
    segmentFile.segmentIndex = segmentIndex;
    segmentFile.originalFileName = originalFile.name;

    return segmentFile;
};

/**
 * Process a long video by splitting it into segments and processing each segment
 * @param {File} videoFile - The video file
 * @param {Function} onStatusUpdate - Callback for status updates
 * @param {Function} t - Translation function
 * @returns {Promise<Array>} - Array of subtitle objects
 */
export const processLongVideo = async (videoFile, onStatusUpdate, t) => {
    // Create an array to track segment status
    const segmentStatusArray = [];

    // Function to update segment status
    const updateSegmentStatus = (index, status, message) => {
        // Update the status array
        segmentStatusArray[index] = {
            index,
            status,
            message,
            // Use simple status indicators without segment numbers
            shortMessage: status === 'loading' ? t('output.processing') :
                         status === 'success' ? t('output.done') :
                         status === 'error' ? t('output.failed') :
                         status === 'cached' ? t('output.cached') :
                         status === 'pending' ? t('output.pending') : ''
        };

        // Dispatch event to update UI
        const event = new CustomEvent('segmentStatusUpdate', {
            detail: [...segmentStatusArray]
        });
        window.dispatchEvent(event);
    };
    try {
        // Get video duration
        const duration = await getVideoDuration(videoFile);
        console.log(`Video duration: ${duration} seconds`);

        // If video is shorter than the maximum segment duration, process it directly
        if (duration <= getMaxSegmentDurationSeconds()) {
            return await callGeminiApi(videoFile, 'file-upload');
        }

        // Calculate number of segments
        const numSegments = Math.ceil(duration / getMaxSegmentDurationSeconds());
        console.log(`Splitting video into ${numSegments} segments`);

        // Initialize segment status array with pending status
        for (let i = 0; i < numSegments; i++) {
            updateSegmentStatus(i, 'pending', t('output.pendingProcessing', 'Waiting to be processed...'));
        }

        // Notify user about long video processing
        onStatusUpdate({
            message: t('output.longVideoProcessing', 'Processing video longer than 30 minutes. This may take a while...'),
            type: 'loading'
        });

        // Use server-side splitting to physically split the video into segments
        console.log('Using server-side video splitting');
        onStatusUpdate({
            message: t('output.serverSplitting', 'Uploading and splitting video on server...'),
            type: 'loading'
        });

        // Upload the video to the server and split it into segments
        const splitResult = await splitVideoOnServer(
            videoFile,
            getMaxSegmentDurationSeconds(),
            (progress, message) => {
                onStatusUpdate({
                    message: `${message} (${progress}%)`,
                    type: 'loading'
                });
            }
        );

        console.log('Video split into segments:', splitResult);

        // Process all segments in parallel
        const segments = splitResult.segments;

        // Update status to show we're processing in parallel
        onStatusUpdate({
            message: t('output.processingInParallel', 'Processing in parallel...'),
            type: 'loading'
        });

        // Create an array to hold the processing promises for each segment
        const segmentPromises = segments.map(async (segment, i) => {
            const segmentIndex = i;
            const startTime = segmentIndex * getMaxSegmentDurationSeconds();

            // Generate cache ID for this segment
            const segmentCacheId = `segment_${segment.name}`;

            try {
                // First check if we have this segment cached
                updateSegmentStatus(i, 'loading', t('output.checkingCache', 'Checking cache...'));
                const response = await fetch(`http://localhost:3004/api/subtitle-exists/${segmentCacheId}`);
                const data = await response.json();

                if (data.exists) {
                    console.log(`Loaded cached subtitles for segment ${i+1}`);
                    updateSegmentStatus(i, 'cached', t('output.loadedFromCache', 'Loaded from cache'));

                    // Return the cached subtitles with adjusted timestamps
                    return data.subtitles.map(subtitle => ({
                        ...subtitle,
                        start: subtitle.start + startTime,
                        end: subtitle.end + startTime
                    }));
                }

                // If not cached, process the segment
                updateSegmentStatus(i, 'loading', t('output.processing', 'Processing...'));
                const result = await processSegment(segment, segmentIndex, startTime, segmentCacheId, onStatusUpdate, t);
                updateSegmentStatus(i, 'success', t('output.processingComplete', 'Processing complete'));
                return result;
            } catch (error) {
                console.error(`Error processing segment ${i+1}:`, error);
                updateSegmentStatus(i, 'error', error.message || t('output.processingFailed', 'Processing failed'));
                throw error; // Re-throw to be caught by Promise.allSettled
            }
        });

        // Wait for all segment processing to complete (even if some fail)
        const results = await Promise.allSettled(segmentPromises);

        // Collect all successful results
        const allSubtitles = [];
        let hasFailures = false;

        results.forEach((result, i) => {
            if (result.status === 'fulfilled') {
                // Add successful subtitles to the combined results
                allSubtitles.push(...result.value);
            } else {
                // Log the error for failed segments
                console.error(`Segment ${i+1} failed:`, result.reason);
                hasFailures = true;
            }
        });

        // Warn the user if some segments failed
        if (hasFailures) {
            onStatusUpdate({
                message: t('output.someSegmentsFailed', 'Some segments failed to process. The subtitles may be incomplete.'),
                type: 'warning'
            });
        }

        // Sort subtitles by start time
        allSubtitles.sort((a, b) => a.start - b.start);

        // Renumber IDs
        allSubtitles.forEach((subtitle, index) => {
            subtitle.id = index + 1;
        });

        return allSubtitles;
    } catch (error) {
        console.error('Error processing long video:', error);

        // Provide more helpful error messages for common issues
        if (error.message && error.message.includes('timeout')) {
            throw new Error('Video upload timed out. This may be due to the large file size. Please try a smaller or lower quality video.');
        } else if (error.message && error.message.includes('ffmpeg')) {
            throw new Error('Error splitting video: ' + error.message);
        } else {
            throw error;
        }
    }
};
