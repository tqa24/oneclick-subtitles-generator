/**
 * Utility functions for WebVTT subtitle format
 */

/**
 * Convert time string to seconds
 * @param {string} timeString - Time in SRT format (00:00:00,000) or MMmSSsNNNms format (00m00s000ms)
 * @returns {number} - Time in seconds
 */
export const convertTimeStringToSeconds = (timeString) => {
  if (!timeString) return 0;

  // Check if timeString is a string
  if (typeof timeString !== 'string') {
    console.warn('Invalid time string type:', typeof timeString, timeString);
    return 0;
  }

  // Handle SRT format (00:00:00,000)
  const srtMatch = timeString.match(/^(\d+):(\d+):(\d+),(\d+)$/);
  if (srtMatch) {
    const hours = parseInt(srtMatch[1]);
    const minutes = parseInt(srtMatch[2]);
    const seconds = parseInt(srtMatch[3]);
    const milliseconds = parseInt(srtMatch[4]);

    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }

  // Handle MMmSSsNNNms format (e.g., 00m30s500ms)
  const mmssmsMatch = timeString.match(/^(\d+)m(\d+)s(\d+)ms$/);
  if (mmssmsMatch) {
    const minutes = parseInt(mmssmsMatch[1]);
    const seconds = parseInt(mmssmsMatch[2]);
    const milliseconds = parseInt(mmssmsMatch[3]);

    return minutes * 60 + seconds + milliseconds / 1000;
  }

  // Handle WebVTT format (00:00:00.000)
  const vttMatch = timeString.match(/^(\d+):(\d+):(\d+)\.(\d+)$/);
  if (vttMatch) {
    const hours = parseInt(vttMatch[1]);
    const minutes = parseInt(vttMatch[2]);
    const seconds = parseInt(vttMatch[3]);
    const milliseconds = parseInt(vttMatch[4]);

    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }

  console.warn('Unrecognized time format:', timeString);
  return 0;
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

    if (isTranslated && originalSubtitles) {
      // For translated subtitles, try multiple methods to find the original timing

      // Method 1: Use originalId to find the matching original subtitle
      if (subtitle.originalId) {
        const originalSub = originalSubtitles.find(s => s.id === subtitle.originalId);
        if (originalSub) {
          console.log(`Found original subtitle by ID ${subtitle.originalId} for translated subtitle ${index + 1}`);
          startTime = secondsToVttTime(originalSub.start);
          endTime = secondsToVttTime(originalSub.end);
        }
      }

      // Method 2: If no match by ID, try to match by index
      if (!startTime && index < originalSubtitles.length) {
        const originalSub = originalSubtitles[index];
        console.log(`Using original subtitle at index ${index} for translated subtitle ${index + 1}`);
        startTime = secondsToVttTime(originalSub.start);
        endTime = secondsToVttTime(originalSub.end);
      }

      // Method 3: Fallback to the translated subtitle's own timing if available
      if (!startTime) {
        console.log(`Falling back to subtitle's own timing for translated subtitle ${index + 1}`);
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
