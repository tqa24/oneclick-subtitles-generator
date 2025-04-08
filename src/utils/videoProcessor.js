/**
 * Main media processing module for handling long videos/audio and segment processing
 */

import { callGeminiApi } from '../services/geminiService';
import { splitVideoOnServer } from './videoSplitter';
import { getVideoDuration, getMaxSegmentDurationSeconds } from './durationUtils';
import { processSegment } from '../services/segmentProcessingService';
import { retrySegmentProcessing } from './segmentManager';

// Re-export functions from other modules
export { getVideoDuration } from './durationUtils';
export { retrySegmentProcessing };

/**
 * Process a long media file (video or audio) by splitting it into segments and processing each segment
 * @param {File} mediaFile - The media file (video or audio)
 * @param {Function} onStatusUpdate - Callback for status updates
 * @param {Function} t - Translation function
 * @returns {Promise<Array>} - Array of subtitle objects
 */
export const processLongVideo = async (mediaFile, onStatusUpdate, t) => {
    // Determine if this is a video or audio file based on MIME type
    const isAudio = mediaFile.type.startsWith('audio/');
    const mediaType = isAudio ? 'audio' : 'video';
    // Check if using a strong model (Gemini 2.5 Pro or Gemini 2.0 Flash Thinking)
    const currentModel = localStorage.getItem('gemini_model') || 'gemini-2.0-flash';
    const strongModels = ['gemini-2.5-pro-exp-03-25', 'gemini-2.0-flash-thinking-exp-01-21'];
    const isUsingStrongModel = strongModels.includes(currentModel);

    // Create an array to track segment status
    const segmentStatusArray = [];

    // Function to update segment status
    const updateSegmentStatus = (index, status, message, timeRange = null) => {
        // Update the status array
        segmentStatusArray[index] = {
            index,
            status,
            message,
            timeRange,
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
        // Get media duration
        const duration = await getVideoDuration(mediaFile);
        console.log(`${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} duration: ${duration} seconds`);

        // If media is shorter than the maximum segment duration, process it directly
        if (duration <= getMaxSegmentDurationSeconds()) {
            return await callGeminiApi(mediaFile, 'file-upload');
        }

        // Calculate number of segments
        const numSegments = Math.ceil(duration / getMaxSegmentDurationSeconds());
        console.log(`Splitting ${mediaType} into ${numSegments} segments`);

        // Initialize segment status array with pending status
        for (let i = 0; i < numSegments; i++) {
            // Calculate theoretical time range for initial display
            const startTime = i * getMaxSegmentDurationSeconds();
            const endTime = Math.min((i + 1) * getMaxSegmentDurationSeconds(), duration);

            // Format time range for display
            const formatTime = (seconds) => {
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return `${mins}:${secs.toString().padStart(2, '0')}`;
            };
            const timeRange = `${formatTime(startTime)} - ${formatTime(endTime)}`;

            updateSegmentStatus(i, 'pending', t('output.pendingProcessing', 'Waiting to be processed...'), timeRange);
        }

        // Notify user about long media processing
        onStatusUpdate({
            message: isAudio
                ? t('output.longAudioProcessing', 'Processing audio longer than 30 minutes. This may take a while...')
                : t('output.longVideoProcessing', 'Processing video longer than 30 minutes. This may take a while...'),
            type: 'loading'
        });

        // Use server-side splitting to physically split the media into segments
        console.log(`Using server-side ${mediaType} splitting`);
        onStatusUpdate({
            message: isAudio
                ? t('output.serverSplittingAudio', 'Uploading and splitting audio on server...')
                : t('output.serverSplitting', 'Uploading and splitting video on server...'),
            type: 'loading'
        });

        // Upload the media to the server and split it into segments
        const splitResult = await splitVideoOnServer(
            mediaFile,
            getMaxSegmentDurationSeconds(),
            (progress, message) => {
                onStatusUpdate({
                    message: `${message} (${progress}%)`,
                    type: 'loading'
                });
            },
            true // Enable fast splitting by default
        );

        console.log(`${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} split into segments:`, splitResult);

        // Process all segments in parallel
        const segments = splitResult.segments;

        // Dispatch event with segments for potential retries later
        const segmentsEvent = new CustomEvent('videoSegmentsUpdate', {
            detail: segments
        });
        window.dispatchEvent(segmentsEvent);

        // For strong model (Gemini 2.5 Pro), show warning and don't process automatically
        if (isUsingStrongModel) {
            onStatusUpdate({
                message: t('output.strongModelWarning', 'You are choosing an easily overloaded model, please process each segment one by one'),
                type: 'warning'
            });

            // Initialize all segments as pending but don't process them
            segments.forEach((segment, i) => {
                // Calculate time range for this segment
                const startTime = segment.startTime !== undefined ? segment.startTime : i * getMaxSegmentDurationSeconds();
                const segmentDuration = segment.duration !== undefined ? segment.duration : getMaxSegmentDurationSeconds();
                const endTime = startTime + segmentDuration;

                // Format time range for display
                const formatTime = (seconds) => {
                    const mins = Math.floor(seconds / 60);
                    const secs = Math.floor(seconds % 60);
                    return `${mins}:${secs.toString().padStart(2, '0')}`;
                };
                const timeRange = `${formatTime(startTime)} - ${formatTime(endTime)}`;

                updateSegmentStatus(i, 'pending', t('output.pendingProcessing', 'Waiting to be processed...'), timeRange);
            });

            // Create an empty array for subtitles that will be filled as segments are processed
            // We return an empty array but segments will be processed one by one on demand
            // and combined in the retrySegmentProcessing function
            return [];
        }

        // For other models, process in parallel as usual
        onStatusUpdate({
            message: t('output.processingInParallel', 'Processing in parallel...'),
            type: 'loading'
        });

        // Create an array to hold the processing promises for each segment
        const segmentPromises = segments.map(async (segment, i) => {
            const segmentIndex = i;

            // ALWAYS use the actual start time from the segment if available
            // This is critical for correct subtitle stitching with stream-copy segments
            const startTime = segment.startTime !== undefined ? segment.startTime : segmentIndex * getMaxSegmentDurationSeconds();
            const segmentDuration = segment.duration !== undefined ? segment.duration : getMaxSegmentDurationSeconds();
            const endTime = startTime + segmentDuration;

            // Format time range for display
            const formatTime = (seconds) => {
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return `${mins}:${secs.toString().padStart(2, '0')}`;
            };
            const timeRange = `${formatTime(startTime)} - ${formatTime(endTime)}`;

            // Log detailed information about this segment's timing
            console.log(`Processing segment ${segmentIndex + 1}:`);
            console.log(`  Using startTime=${startTime.toFixed(2)}s, duration=${segmentDuration.toFixed(2)}s, endTime=${endTime.toFixed(2)}s`);

            if (segment.startTime !== undefined) {
                const theoreticalStart = segmentIndex * getMaxSegmentDurationSeconds();
                console.log(`  Actual start time differs from theoretical by ${(startTime - theoreticalStart).toFixed(2)}s`);
                console.log(`  This ensures correct subtitle timing when segments have variable durations`);
            }

            // Update the segment status with time range
            updateSegmentStatus(i, 'pending', t('output.pendingProcessing', 'Waiting to be processed...'), timeRange);

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
                updateSegmentStatus(i, 'loading', t('output.processing', 'Processing...'), timeRange);
                // Determine if this is a video or audio file
                const isAudio = mediaFile.type.startsWith('audio/');
                const mediaType = isAudio ? 'audio' : 'video';
                const result = await processSegment(segment, segmentIndex, startTime, segmentCacheId, onStatusUpdate, t, mediaType);
                updateSegmentStatus(i, 'success', t('output.processingComplete', 'Processing complete'), timeRange);
                return result;
            } catch (error) {
                console.error(`Error processing segment ${i+1}:`, error);
                updateSegmentStatus(i, 'error', error.message || t('output.processingFailed', 'Processing failed'), timeRange);
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
        console.error(`Error processing long ${mediaType}:`, error);

        // Provide more helpful error messages for common issues
        if (error.message && error.message.includes('timeout')) {
            throw new Error(`${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} upload timed out. This may be due to the large file size. Please try a smaller or lower quality ${mediaType}.`);
        } else if (error.message && error.message.includes('ffmpeg')) {
            throw new Error(`Error splitting ${mediaType}: ` + error.message);
        } else {
            throw error;
        }
    }
};

/**
 * Alias for processLongVideo to maintain backward compatibility
 * @param {File} mediaFile - The media file (video or audio)
 * @param {Function} onStatusUpdate - Callback for status updates
 * @param {Function} t - Translation function
 * @returns {Promise<Array>} - Array of subtitle objects
 */
export const processLongMedia = processLongVideo;
