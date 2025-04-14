/**
 * Convert time string in format MMmSSsNNNms or HH:MM:SS.mmm to seconds
 * @param {string} timeString - Time string in format MMmSSsNNNms or HH:MM:SS.mmm
 * @returns {number} - Time in seconds
 */
export const convertTimeStringToSeconds = (timeString) => {
    console.log('Converting time string:', timeString);

    // Handle empty or invalid time strings
    if (!timeString || typeof timeString !== 'string') {
        console.warn('Empty or invalid time string:', timeString);
        return 0;
    }

    // Handle 00m00s000ms as a special case (start of video)
    if (timeString === '00m00s000ms') {
        return 0;
    }

    // First, try to match the exact format MMmSSsNNNms (e.g., 00m30s500ms)
    const exactFormatMatch = timeString.match(/^(\d+)m(\d+)s(\d+)ms$/);
    if (exactFormatMatch && exactFormatMatch[1] !== undefined && exactFormatMatch[2] !== undefined && exactFormatMatch[3] !== undefined) {
        const minutes = parseInt(exactFormatMatch[1]);
        const seconds = parseInt(exactFormatMatch[2]);
        const milliseconds = parseInt(exactFormatMatch[3]) / 1000;

        const result = minutes * 60 + seconds + milliseconds;
        console.log(`Parsed ${timeString} as ${minutes}m ${seconds}s ${milliseconds}ms = ${result}s`);
        return result;
    }

    // Try a more flexible pattern if the exact format doesn't match
    const flexibleFormatMatch = timeString.match(/(\d+)m(\d+)s(\d+)ms/);
    if (flexibleFormatMatch) {
        const minutes = parseInt(flexibleFormatMatch[1]);
        const seconds = parseInt(flexibleFormatMatch[2]);
        const milliseconds = parseInt(flexibleFormatMatch[3]) / 1000;

        const result = minutes * 60 + seconds + milliseconds;
        console.log(`Parsed ${timeString} with flexible pattern as ${minutes}m ${seconds}s ${milliseconds}ms = ${result}s`);
        return result;
    }

    // Try an even more flexible pattern that extracts any numbers
    const looseFormatMatch = timeString.match(/(\d+)[^\d]+(\d+)[^\d]+(\d+)/);
    if (looseFormatMatch) {
        // Assume the format is minutes, seconds, milliseconds in that order
        const minutes = parseInt(looseFormatMatch[1]);
        const seconds = parseInt(looseFormatMatch[2]);
        const milliseconds = parseInt(looseFormatMatch[3]) / 1000;

        const result = minutes * 60 + seconds + milliseconds;
        console.log(`Parsed ${timeString} with loose pattern as ${minutes}m ${seconds}s ${milliseconds}ms = ${result}s`);
        return result;
    }

    // Try to match HH:MM:SS.mmm format
    const timeMatch = timeString.match(/(\d+):(\d+):(\d+)(?:\.(\d+))?/);
    if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const seconds = parseInt(timeMatch[3]);
        const milliseconds = timeMatch[4] ? parseInt(timeMatch[4]) / 1000 : 0;

        return hours * 3600 + minutes * 60 + seconds + milliseconds;
    }

    // Try to match MM:SS.mmm format
    const shortTimeMatch = timeString.match(/(\d+):(\d+)(?:\.(\d+))?/);
    if (shortTimeMatch) {
        const minutes = parseInt(shortTimeMatch[1]);
        const seconds = parseInt(shortTimeMatch[2]);
        const milliseconds = shortTimeMatch[3] ? parseInt(shortTimeMatch[3]) / 1000 : 0;

        return minutes * 60 + seconds + milliseconds;
    }

    console.warn('Could not parse time string:', timeString);
    return 0;
};

/**
 * Format seconds to SRT time format (HH:MM:SS,mmm)
 * @param {number} seconds - Time in seconds
 * @returns {string} - Formatted time string
 */
export const formatSecondsToSRTTime = (seconds) => {
    if (seconds === undefined || seconds === null) {
        return '00:00:00,000';
    }
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
};
