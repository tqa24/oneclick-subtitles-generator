/**
 * Utility functions for parsing SRT files
 */

/**
 * Parse SRT file content into subtitle objects
 * @param {string} srtContent - The content of the SRT file
 * @returns {Array} - Array of subtitle objects
 */
export const parseSrtContent = (srtContent) => {
  if (!srtContent) return [];

  const subtitles = [];
  const blocks = srtContent.trim().split(/\r?\n\r?\n/);

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    if (lines.length < 3) continue;

    // The first line is the subtitle number
    const id = parseInt(lines[0].trim());
    if (isNaN(id)) continue;

    // The second line contains the timestamps
    const timestampLine = lines[1].trim();
    const timestampMatch = timestampLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    if (!timestampMatch) continue;

    // Extract start and end times
    const startHours = parseInt(timestampMatch[1]);
    const startMinutes = parseInt(timestampMatch[2]);
    const startSeconds = parseInt(timestampMatch[3]);
    const startMilliseconds = parseInt(timestampMatch[4]);
    
    const endHours = parseInt(timestampMatch[5]);
    const endMinutes = parseInt(timestampMatch[6]);
    const endSeconds = parseInt(timestampMatch[7]);
    const endMilliseconds = parseInt(timestampMatch[8]);

    // Convert to seconds
    const startTime = startHours * 3600 + startMinutes * 60 + startSeconds + startMilliseconds / 1000;
    const endTime = endHours * 3600 + endMinutes * 60 + endSeconds + endMilliseconds / 1000;

    // The remaining lines form the subtitle text
    const text = lines.slice(2).join('\\n').trim();

    subtitles.push({
      id,
      start: startTime,
      end: endTime,
      text,
      // Also store the formatted time strings for compatibility
      startTime: `${padZero(startHours)}:${padZero(startMinutes)}:${padZero(startSeconds)},${padZero(startMilliseconds, 3)}`,
      endTime: `${padZero(endHours)}:${padZero(endMinutes)}:${padZero(endSeconds)},${padZero(endMilliseconds, 3)}`
    });
  }

  return subtitles;
};

/**
 * Pad a number with leading zeros
 * @param {number} num - The number to pad
 * @param {number} length - The desired length (default: 2)
 * @returns {string} - Padded number as string
 */
const padZero = (num, length = 2) => {
  return String(num).padStart(length, '0');
};

/**
 * Convert seconds to SRT time format (HH:MM:SS,mmm)
 * @param {number} seconds - Time in seconds
 * @returns {string} - Formatted time string
 */
export const secondsToSrtTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);
  
  return `${padZero(hours)}:${padZero(minutes)}:${padZero(secs)},${padZero(milliseconds, 3)}`;
};
