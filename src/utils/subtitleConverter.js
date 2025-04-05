/**
 * Utility functions for converting subtitles to different formats
 */

/**
 * Converts subtitle objects to SRT format
 * @param {Array} subtitles - Array of subtitle objects with start, end, and text properties
 * @returns {Array} - Array of SRT formatted strings
 */
export const convertToSRT = (subtitles) => {
  return subtitles.map((subtitle, index) => {
    const id = index + 1;
    const startTime = formatSRTTime(subtitle.start);
    const endTime = formatSRTTime(subtitle.end);

    return `${id}\n${startTime} --> ${endTime}\n${subtitle.text}`;
  });
};

/**
 * Formats time in seconds to SRT time format (HH:MM:SS,mmm)
 * @param {number} timeInSeconds - Time in seconds
 * @returns {string} - Formatted time string
 */
const formatSRTTime = (timeInSeconds) => {
  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor((timeInSeconds % 3600) / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  const milliseconds = Math.floor((timeInSeconds % 1) * 1000);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
};

/**
 * Converts subtitle objects to WebVTT format
 * @param {Array} subtitles - Array of subtitle objects with start, end, and text properties
 * @returns {string} - WebVTT formatted string
 */
export const convertToWebVTT = (subtitles) => {
  const header = 'WEBVTT\n\n';
  
  const cues = subtitles.map((subtitle, index) => {
    const id = index + 1;
    const startTime = formatWebVTTTime(subtitle.start);
    const endTime = formatWebVTTTime(subtitle.end);
    
    return `${id}\n${startTime} --> ${endTime}\n${subtitle.text}`;
  }).join('\n\n');
  
  return header + cues;
};

/**
 * Formats time in seconds to WebVTT time format (HH:MM:SS.mmm)
 * @param {number} timeInSeconds - Time in seconds
 * @returns {string} - Formatted time string
 */
const formatWebVTTTime = (timeInSeconds) => {
  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor((timeInSeconds % 3600) / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  const milliseconds = Math.floor((timeInSeconds % 1) * 1000);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
};
