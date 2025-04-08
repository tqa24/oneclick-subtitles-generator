/**
 * Utility functions for WebVTT subtitle format
 */

/**
 * Convert SRT time format (00:00:00,000) to seconds
 * @param {string} timeString - Time in SRT format
 * @returns {number} - Time in seconds
 */
export const convertTimeStringToSeconds = (timeString) => {
  if (!timeString) return 0;

  const match = timeString.match(/^(\d+):(\d+):(\d+),(\d+)$/);
  if (!match) return 0;

  const hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const seconds = parseInt(match[3]);
  const milliseconds = parseInt(match[4]);

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
};

/**
 * Convert seconds to WebVTT time format (HH:MM:SS.mmm)
 * @param {number} seconds - Time in seconds
 * @returns {string} - Time in WebVTT format
 */
export const secondsToVttTime = (seconds) => {
  if (seconds === undefined || seconds === null) return '00:00:00.000';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
};

/**
 * Convert SRT time format (00:00:00,000) to WebVTT time format (00:00:00.000)
 * @param {string} srtTime - Time in SRT format
 * @returns {string} - Time in WebVTT format
 */
export const srtTimeToVttTime = (srtTime) => {
  if (!srtTime) return '00:00:00.000';
  return srtTime.replace(',', '.');
};

/**
 * Convert subtitles array to WebVTT format
 * @param {Array} subtitles - Array of subtitle objects
 * @param {boolean} isTranslated - Whether these are translated subtitles
 * @param {Array} originalSubtitles - Original subtitles for reference (needed for translated subtitles)
 * @returns {string} - WebVTT formatted subtitles
 */
export const subtitlesToVtt = (subtitles, isTranslated = false, originalSubtitles = null) => {
  if (!subtitles || subtitles.length === 0) return '';

  // Start with the WebVTT header
  let vttContent = 'WEBVTT\n\n';

  // Process each subtitle
  subtitles.forEach((subtitle, index) => {
    let startTime, endTime;

    if (isTranslated && originalSubtitles && subtitle.originalId) {
      // For translated subtitles, use the timing from the original subtitle
      const originalSub = originalSubtitles.find(s => s.id === subtitle.originalId);
      if (originalSub) {
        startTime = secondsToVttTime(originalSub.start);
        endTime = secondsToVttTime(originalSub.end);
      } else {
        // Fallback to the translated subtitle's own timing
        startTime = subtitle.start !== undefined
          ? secondsToVttTime(subtitle.start)
          : srtTimeToVttTime(subtitle.startTime);

        endTime = subtitle.end !== undefined
          ? secondsToVttTime(subtitle.end)
          : srtTimeToVttTime(subtitle.endTime);
      }
    } else {
      // For original subtitles, use their own timing
      startTime = subtitle.start !== undefined
        ? secondsToVttTime(subtitle.start)
        : srtTimeToVttTime(subtitle.startTime);

      endTime = subtitle.end !== undefined
        ? secondsToVttTime(subtitle.end)
        : srtTimeToVttTime(subtitle.endTime);
    }

    // Add the cue
    vttContent += `${index + 1}\n`;
    vttContent += `${startTime} --> ${endTime}\n`;
    vttContent += `${subtitle.text}\n\n`;
  });

  return vttContent;
};

/**
 * Create a Blob URL for WebVTT subtitles
 * @param {string} vttContent - WebVTT formatted subtitles
 * @returns {string} - Blob URL
 */
export const createVttBlobUrl = (vttContent) => {
  const blob = new Blob([vttContent], { type: 'text/vtt' });
  return URL.createObjectURL(blob);
};

/**
 * Revoke a Blob URL to prevent memory leaks
 * @param {string} url - Blob URL to revoke
 */
export const revokeVttBlobUrl = (url) => {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};
