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

        // Always combine with existing subtitles (if any)
        // Ensure currentSubtitles is at least an empty array
        const existingSubtitles = currentSubtitles || [];

        // Remove subtitles from this segment's time range
        const segmentStartTime = startTime;
        const segmentEndTime = startTime + getMaxSegmentDurationSeconds();

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
