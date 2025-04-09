/**
 * Parse time string (00:00:00,000 or 00:00:00.000) to seconds
 * @param {string} timeString - Time string in format 00:00:00,000 or 00:00:00.000
 * @returns {number} - Time in seconds
 */
export const parseTimeString = (timeString) => {
  if (!timeString) return 0;

  // Handle SRT format (00:00:00,000) or WebVTT format (00:00:00.000)
  if (timeString.includes(':')) {
    const [hours, minutes, secondsMs] = timeString.split(':');
    const [seconds, ms] = secondsMs.includes(',')
      ? secondsMs.split(',')
      : secondsMs.split('.');

    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(ms) / 1000;
  }

  // If it's just a number, return it as is
  if (!isNaN(parseFloat(timeString))) {
    return parseFloat(timeString);
  }

  return 0;
};

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
    // Always convert to proper SRT format (HH:MM:SS,mmm)
    let startTime, endTime;

    // If we have numeric start/end values, convert them to SRT format
    if (subtitle.start !== undefined) {
      startTime = secondsToSrtTime(subtitle.start);
    }
    // If we have startTime string, ensure it's in SRT format
    else if (subtitle.startTime) {
      // Check if it's already in SRT format
      if (/^\d{2}:\d{2}:\d{2},\d{3}$/.test(subtitle.startTime)) {
        startTime = subtitle.startTime;
      } else {
        // Try to parse and convert to SRT format
        const timeInSeconds = parseTimeString(subtitle.startTime);
        startTime = secondsToSrtTime(timeInSeconds);
      }
    } else {
      startTime = '00:00:00,000';
    }

    // Same for end time
    if (subtitle.end !== undefined) {
      endTime = secondsToSrtTime(subtitle.end);
    }
    else if (subtitle.endTime) {
      if (/^\d{2}:\d{2}:\d{2},\d{3}$/.test(subtitle.endTime)) {
        endTime = subtitle.endTime;
      } else {
        const timeInSeconds = parseTimeString(subtitle.endTime);
        endTime = secondsToSrtTime(timeInSeconds);
      }
    } else {
      endTime = '00:00:05,000';
    }

    return `${index + 1}\n${startTime} --> ${endTime}\n${subtitle.text}`;
  }).join('\n\n');
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

/**
 * Generate plain text content from subtitles (without timings)
 * @param {Array} subtitles - Array of subtitle objects
 * @returns {string} - Plain text content
 */
export const generateTxtContent = (subtitles) => {
  return subtitles.map(subtitle => subtitle.text).join('\n\n');
};

/**
 * Download subtitles as TXT file (text only, no timings)
 * @param {Array} subtitles - Array of subtitle objects
 * @param {string} filename - Name of the file to download
 */
export const downloadTXT = (subtitles, filename) => {
  if (!subtitles || subtitles.length === 0) {
    console.error('No subtitles to download');
    return;
  }

  const content = generateTxtContent(subtitles);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'subtitles.txt';
  document.body.appendChild(a);
  a.click();

  // Clean up
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);

  // Return the plain text content for potential further processing
  return content;
};
