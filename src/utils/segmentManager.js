/**
 * Utility functions for managing video segments
 */

import { getMaxSegmentDurationSeconds } from './durationUtils';
import { processSegment, updateSegmentStatus } from '../services/segmentProcessingService';

/**
 * Retry processing a specific segment
 * @param {number} segmentIndex - The index of the segment to retry
 * @param {Array} segments - Array of segment objects with URLs
 * @param {Array} currentSubtitles - Current subtitles array
 * @param {Function} onStatusUpdate - Callback for status updates
 * @param {Function} t - Translation function
 * @param {string} mediaType - Type of media ('video' or 'audio')
 * @returns {Promise<Array>} - Updated array of subtitle objects
 */
export const retrySegmentProcessing = async (segmentIndex, segments, currentSubtitles, onStatusUpdate, t, mediaType = 'video', options = {}) => {
    // Extract options
    const { userProvidedSubtitles, modelId } = options;
    if (!segments || !segments[segmentIndex]) {
        throw new Error(`Segment ${segmentIndex + 1} not found`);
    }

    const segment = segments[segmentIndex];

    // Use the actual start time from the segment if available, otherwise fall back to theoretical calculation
    const startTime = segment.startTime !== undefined ? segment.startTime : segmentIndex * getMaxSegmentDurationSeconds();
    const segmentDuration = segment.duration !== undefined ? segment.duration : getMaxSegmentDurationSeconds();
    const endTime = startTime + segmentDuration;
    const segmentCacheId = `segment_${segment.name}`;

    // Format time range for display
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    const timeRange = `${formatTime(startTime)} - ${formatTime(endTime)}`;

    // Update status to show we're retrying this segment
    onStatusUpdate({
        message: t('output.retryingSegment', 'Retrying segment {{segmentNumber}}...', { segmentNumber: segmentIndex + 1 }),
        type: 'loading'
    });

    // Update just this segment's status
    updateSegmentStatus(segmentIndex, 'retrying', t('output.retryingSegment', 'Retrying segment...'), t, timeRange);

    try {
        // Process the segment
        console.log(`Retrying segment ${segmentIndex + 1} with startTime=${startTime}, mediaType=${mediaType}`);
        if (userProvidedSubtitles) {
            console.log(`Using user-provided subtitles for segment ${segmentIndex + 1}`);
            console.log('User-provided subtitles content:', userProvidedSubtitles);
        }
        const newSegmentSubtitles = await processSegment(segment, segmentIndex, startTime, segmentCacheId, onStatusUpdate, t, mediaType, { userProvidedSubtitles, modelId });

        // Update status to show success
        updateSegmentStatus(segmentIndex, 'success', t('output.processingComplete', 'Processing complete'), t, timeRange);

        // Always combine with existing subtitles (if any)
        // Ensure currentSubtitles is at least an empty array
        const existingSubtitles = currentSubtitles || [];

        // Remove subtitles from this segment's time range
        const segmentStartTime = startTime;
        // Use the actual duration from the segment if available, otherwise fall back to theoretical calculation
        const segmentDuration = segment.duration !== undefined ? segment.duration : getMaxSegmentDurationSeconds();
        const segmentEndTime = startTime + segmentDuration;

        console.log(`Using actual segment duration: ${segmentDuration}s for segment ${segmentIndex + 1}`);
        console.log(`Segment ${segmentIndex + 1} actual time range: ${segmentStartTime}s to ${segmentEndTime}s`);

        // Filter out subtitles that belong to this segment's time range
        // Keep subtitles that are completely outside this segment's time range
        const filteredSubtitles = existingSubtitles.filter(subtitle => {
            // Keep subtitles that end before this segment starts
            if (subtitle.end <= segmentStartTime) return true;
            // Keep subtitles that start after this segment ends
            if (subtitle.start >= segmentEndTime) return true;
            // Filter out subtitles that overlap with this segment's time range
            return false;
        });

        // Add the new subtitles
        const updatedSubtitles = [...filteredSubtitles, ...newSegmentSubtitles];

        // Sort by start time
        updatedSubtitles.sort((a, b) => a.start - b.start);

        // Renumber IDs
        updatedSubtitles.forEach((subtitle, index) => {
            subtitle.id = index + 1;
        });

        console.log(`Segment ${segmentIndex + 1} time range: ${segmentStartTime}s to ${segmentEndTime}s`);
        console.log(`Combined ${filteredSubtitles.length} existing subtitles with ${newSegmentSubtitles.length} new subtitles from segment ${segmentIndex + 1}`);
        console.log(`Total subtitles after combining: ${updatedSubtitles.length}`);
        return updatedSubtitles;
    } catch (error) {
        console.error(`Error retrying segment ${segmentIndex + 1}:`, error);
        updateSegmentStatus(segmentIndex, 'error', error.message || t('output.processingFailed', 'Processing failed'), t);
        throw error;
    }
};
