import { LyricEntry } from '../types';

/**
 * Converts SRT timestamp format (00:00:00,000) to seconds
 * @param timestamp SRT format timestamp
 * @returns Time in seconds
 */
const timeToSeconds = (timestamp: string): number => {
  // Format: 00:00:00,000 or 00:00:00.000
  const normalizedTimestamp = timestamp.replace(',', '.');
  const [hours, minutes, seconds] = normalizedTimestamp.split(':');

  const hoursInSeconds = parseInt(hours, 10) * 3600;
  const minutesInSeconds = parseInt(minutes, 10) * 60;
  const secondsValue = parseFloat(seconds);

  return hoursInSeconds + minutesInSeconds + secondsValue;
};

/**
 * Parses SRT file content and converts it to LyricEntry format
 * @param srtContent Raw content of an SRT file
 * @returns Array of LyricEntry objects
 */
export const parseSRT = (srtContent: string): LyricEntry[] => {
  // Split the content by double newline (which separates subtitle entries)
  const entries = srtContent.trim().split(/\r?\n\r?\n/);

  const subtitles: LyricEntry[] = [];

  for (const entry of entries) {
    const lines = entry.split(/\r?\n/);

    // Skip if there aren't enough lines for a valid entry
    if (lines.length < 3) continue;

    // The second line contains the timestamps
    const timestampLine = lines[1];
    const timestampMatch = timestampLine.match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);

    if (!timestampMatch) continue;

    const startTime = timeToSeconds(timestampMatch[1]);
    const endTime = timeToSeconds(timestampMatch[2]);

    // The text is everything from the third line onwards
    const text = lines.slice(2).join('\n');

    subtitles.push({
      start: startTime,
      end: endTime,
      text
    });
  }

  return subtitles;
};

/**
 * Detects if a file is likely an SRT file based on its content
 * @param content File content to check
 * @returns True if the content appears to be in SRT format
 */
export const isSRTContent = (content: string): boolean => {
  // Check for typical SRT format patterns
  const lines = content.trim().split(/\r?\n/);

  // SRT files typically start with a number (1) followed by timestamps
  if (lines.length < 2) return false;

  // Check if the first line is a number
  if (!/^\d+$/.test(lines[0].trim())) return false;

  // Check if the second line has the timestamp format
  const timestampPattern = /\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}/;
  return timestampPattern.test(lines[1].trim());
};
