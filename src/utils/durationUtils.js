/**
 * Utility functions for handling media (video and audio) durations
 */

/**
 * Get the segment duration in minutes from localStorage
 * @returns {number} - Segment duration in minutes
 */
export const getSegmentDurationMinutes = () => {
    const savedDuration = parseInt(localStorage.getItem('segment_duration') || '3');
    // Ensure the value is one of the allowed options: 1, 2, 3, 5, 10, 15, 20, 30, 45
    const allowedDurations = [1, 2, 3, 5, 10, 15, 20, 30, 45];
    return allowedDurations.includes(savedDuration) ? savedDuration : 3;
};

/**
 * Calculate the segment duration in seconds
 * @returns {number} - Segment duration in seconds
 */
export const getMaxSegmentDurationSeconds = () => getSegmentDurationMinutes() * 60;

/**
 * Get the duration of a media file (video or audio)
 * @param {File} mediaFile - The media file (video or audio)
 * @returns {Promise<number>} - The duration in seconds
 */
export const getVideoDuration = (mediaFile) => {
    return new Promise((resolve, reject) => {
        // Determine if this is a video or audio file based on MIME type
        const isAudio = mediaFile.type.startsWith('audio/');
        const isVideo = mediaFile.type.startsWith('video/');

        if (isVideo) {
            // Use video element for video files
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

            video.src = URL.createObjectURL(mediaFile);
        } else if (isAudio) {
            // Use audio element for audio files
            const audio = document.createElement('audio');
            audio.preload = 'metadata';

            audio.onloadedmetadata = () => {
                window.URL.revokeObjectURL(audio.src);
                resolve(audio.duration);
            };

            audio.onerror = () => {
                window.URL.revokeObjectURL(audio.src);
                reject(new Error('Failed to load audio metadata'));
            };

            audio.src = URL.createObjectURL(mediaFile);
        } else {
            reject(new Error('Unsupported file type. Expected video or audio.'));
        }
    });
};

/**
 * Alias for getVideoDuration to maintain backward compatibility
 * @param {File} mediaFile - The media file (video or audio)
 * @returns {Promise<number>} - The duration in seconds
 */
export const getMediaDuration = getVideoDuration;

/**
 * Create a media segment from the original file
 * @param {File} originalFile - The original media file (video or audio)
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @param {number} segmentIndex - Index of the segment
 * @returns {File} - A new File object representing the segment
 */
export const createVideoSegment = (originalFile, startTime, endTime, segmentIndex) => {
    // Since we can't actually split the media in the browser,
    // we'll create a reference to the original file with metadata
    // about the segment's time range
    const isAudio = originalFile.type.startsWith('audio/');
    const extension = isAudio ? 'mp3' : 'mp4';

    const segmentFile = new File([originalFile], `segment_${segmentIndex}.${extension}`, {
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
