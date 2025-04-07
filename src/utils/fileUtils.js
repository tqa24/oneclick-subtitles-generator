/**
 * Convert seconds to SRT time format (HH:MM:SS,mmm)
 * @param {number} seconds - Time in seconds
 * @returns {string} - Time in SRT format
 */
export const secondsToSrtTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
};

/**
 * Generate SRT content from subtitles
 * @param {Array} subtitles - Array of subtitle objects
 * @returns {string} - SRT content
 */
export const generateSrtContent = (subtitles) => {
  return subtitles.map((subtitle, index) => {
    // Check if the subtitle has startTime/endTime strings or start/end numbers
    const startTime = subtitle.startTime || secondsToSrtTime(subtitle.start);
    const endTime = subtitle.endTime || secondsToSrtTime(subtitle.end);

    return `${index + 1}\n${startTime} --> ${endTime}\n${subtitle.text}\n`;
  }).join('\n');
};

/**
 * Download subtitles as SRT file
 * @param {Array} subtitles - Array of subtitle objects
 * @param {string} filename - Name of the file to download
 */
export const downloadSRT = (subtitles, filename) => {
  if (!subtitles || subtitles.length === 0) {
    console.error('No subtitles to download');
    return;
  }

  const content = generateSrtContent(subtitles);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'subtitles.srt';
  document.body.appendChild(a);
  a.click();

  // Clean up
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
};

/**
 * Generate JSON content from subtitles
 * @param {Array} subtitles - Array of subtitle objects
 * @returns {string} - JSON content
 */
export const generateJsonContent = (subtitles) => {
  // Create a clean version of the subtitles with consistent properties
  const cleanSubtitles = subtitles.map((subtitle, index) => {
    // Convert any startTime/endTime strings to numeric values if needed
    let start = subtitle.start;
    let end = subtitle.end;

    // If we have startTime/endTime strings but no numeric values, convert them
    if (subtitle.startTime && start === undefined) {
      // Parse the SRT time format (00:00:00,000) to seconds
      const [hours, minutes, secondsMs] = subtitle.startTime.split(':');
      const [seconds, ms] = secondsMs.split(',');
      start = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(ms) / 1000;
    }

    if (subtitle.endTime && end === undefined) {
      const [hours, minutes, secondsMs] = subtitle.endTime.split(':');
      const [seconds, ms] = secondsMs.split(',');
      end = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(ms) / 1000;
    }

    return {
      id: index + 1,
      start: start,
      end: end,
      startTime: subtitle.startTime,
      endTime: subtitle.endTime,
      text: subtitle.text
    };
  });

  return JSON.stringify(cleanSubtitles, null, 2); // Pretty print with 2 spaces
};

/**
 * Download subtitles as JSON file
 * @param {Array} subtitles - Array of subtitle objects
 * @param {string} filename - Name of the file to download
 */
export const downloadJSON = (subtitles, filename) => {
  if (!subtitles || subtitles.length === 0) {
    console.error('No subtitles to download');
    return;
  }

  const content = generateJsonContent(subtitles);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'subtitles.json';
  document.body.appendChild(a);
  a.click();

  // Clean up
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
};
