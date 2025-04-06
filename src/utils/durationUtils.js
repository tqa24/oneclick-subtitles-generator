/**
 * Utility functions for handling video durations
 */

/**
 * Get the segment duration in minutes from localStorage
 * @returns {number} - Segment duration in minutes
 */
export const getSegmentDurationMinutes = () => {
    const savedDuration = parseInt(localStorage.getItem('segment_duration') || '5');
    // Ensure the value is one of the allowed options: 3, 5, 10, 15, 20, 30, 45
    const allowedDurations = [3, 5, 10, 15, 20, 30, 45];
    return allowedDurations.includes(savedDuration) ? savedDuration : 5;
};

/**
 * Calculate the segment duration in seconds
 * @returns {number} - Segment duration in seconds
 */
export const getMaxSegmentDurationSeconds = () => getSegmentDurationMinutes() * 60;

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
 * @param {number} segmentIndex - Index of the segment
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
