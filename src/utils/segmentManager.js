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
 * @returns {Promise<Array>} - Updated array of subtitle objects
 */
export const retrySegmentProcessing = async (segmentIndex, segments, currentSubtitles, onStatusUpdate, t) => {
    if (!segments || !segments[segmentIndex]) {
        throw new Error(`Segment ${segmentIndex + 1} not found`);
    }

    const segment = segments[segmentIndex];
    const startTime = segmentIndex * getMaxSegmentDurationSeconds();
    const segmentCacheId = `segment_${segment.name}`;

    // Update status to show we're retrying this segment
    onStatusUpdate({
        message: t('output.retryingSegment', 'Retrying segment {{segmentNumber}}...', { segmentNumber: segmentIndex + 1 }),
        type: 'loading'
    });

    // Update just this segment's status
    updateSegmentStatus(segmentIndex, 'retrying', t('output.retryingSegment', 'Retrying segment...'), t);

    try {
        // Process the segment
        const newSegmentSubtitles = await processSegment(segment, segmentIndex, startTime, segmentCacheId, onStatusUpdate, t);

        // Update status to show success
        updateSegmentStatus(segmentIndex, 'success', t('output.processingComplete', 'Processing complete'), t);

        // If we have current subtitles, replace the ones from this segment
        if (currentSubtitles && currentSubtitles.length > 0) {
            // Remove subtitles from this segment's time range
            const segmentStartTime = startTime;
            const segmentEndTime = startTime + getMaxSegmentDurationSeconds();

            // Filter out subtitles in this segment's time range
            const filteredSubtitles = currentSubtitles.filter(subtitle =>
                subtitle.start < segmentStartTime || subtitle.start >= segmentEndTime
            );

            // Add the new subtitles
            const updatedSubtitles = [...filteredSubtitles, ...newSegmentSubtitles];

            // Sort by start time
            updatedSubtitles.sort((a, b) => a.start - b.start);

            // Renumber IDs
            updatedSubtitles.forEach((subtitle, index) => {
                subtitle.id = index + 1;
            });

            return updatedSubtitles;
        }

        // If we don't have current subtitles, just return the new ones
        return newSegmentSubtitles;
    } catch (error) {
        console.error(`Error retrying segment ${segmentIndex + 1}:`, error);
        updateSegmentStatus(segmentIndex, 'error', error.message || t('output.processingFailed', 'Processing failed'), t);
        throw error;
    }
};
