/**
 * Subtitle merging utilities for segment-based processing
 * Handles merging new segment results with existing subtitles
 */

/**
 * Merge new segment subtitles with existing subtitles
 * Replaces any existing subtitles that overlap with the segment time range
 * @param {Array} existingSubtitles - Current subtitle array
 * @param {Array} newSegmentSubtitles - New subtitles from segment processing
 * @param {Object} segment - Segment info with start and end times
 * @returns {Array} - Merged subtitle array
 */
export const mergeSegmentSubtitles = (existingSubtitles, newSegmentSubtitles, segment) => {
  if (!existingSubtitles || existingSubtitles.length === 0) {
    // If no existing subtitles, just return the new ones
    return newSegmentSubtitles || [];
  }

  if (!newSegmentSubtitles || newSegmentSubtitles.length === 0) {
    // If no new subtitles, return existing ones
    return existingSubtitles;
  }

  const { start: segmentStart, end: segmentEnd } = segment;

  console.log(`[SubtitleMerger] Input data:`, {
    segmentRange: `${segmentStart}s - ${segmentEnd}s`,
    existingCount: existingSubtitles.length,
    newCount: newSegmentSubtitles.length,
    existing: existingSubtitles.map(s => `${s.start}-${s.end}: ${s.text.substring(0, 15)}...`),
    new: newSegmentSubtitles.map(s => `${s.start}-${s.end}: ${s.text.substring(0, 15)}...`)
  });

  // Filter out existing subtitles that overlap with the segment time range
  const subtitlesBeforeSegment = existingSubtitles.filter(sub => sub.end <= segmentStart);
  const subtitlesAfterSegment = existingSubtitles.filter(sub => sub.start >= segmentEnd);

  console.log(`[SubtitleMerger] Filtering results:`, {
    before: subtitlesBeforeSegment.map(s => `${s.start}-${s.end}: ${s.text.substring(0, 15)}...`),
    after: subtitlesAfterSegment.map(s => `${s.start}-${s.end}: ${s.text.substring(0, 15)}...`)
  });

  // Combine: before + new segment + after
  const mergedSubtitles = [
    ...subtitlesBeforeSegment,
    ...newSegmentSubtitles,
    ...subtitlesAfterSegment
  ];

  // Sort by start time to ensure proper order
  mergedSubtitles.sort((a, b) => a.start - b.start);

  console.log(`[SubtitleMerger] Final result:`, {
    segmentRange: `${segmentStart}s - ${segmentEnd}s`,
    before: subtitlesBeforeSegment.length,
    new: newSegmentSubtitles.length,
    after: subtitlesAfterSegment.length,
    total: mergedSubtitles.length,
    final: mergedSubtitles.map(s => `${s.start}-${s.end}: ${s.text.substring(0, 15)}...`)
  });

  return mergedSubtitles;
};

/**
 * Check if a subtitle overlaps with a time range
 * @param {Object} subtitle - Subtitle object with start and end times
 * @param {number} rangeStart - Start time of the range
 * @param {number} rangeEnd - End time of the range
 * @returns {boolean} - True if subtitle overlaps with the range
 */
export const subtitleOverlapsWithRange = (subtitle, rangeStart, rangeEnd) => {
  return !(subtitle.end <= rangeStart || subtitle.start >= rangeEnd);
};

/**
 * Get subtitles that fall within a specific time range
 * @param {Array} subtitles - Array of subtitle objects
 * @param {number} rangeStart - Start time of the range
 * @param {number} rangeEnd - End time of the range
 * @returns {Array} - Subtitles within the range
 */
export const getSubtitlesInRange = (subtitles, rangeStart, rangeEnd) => {
  return subtitles.filter(sub => subtitleOverlapsWithRange(sub, rangeStart, rangeEnd));
};

/**
 * Remove subtitles that fall within a specific time range
 * @param {Array} subtitles - Array of subtitle objects
 * @param {number} rangeStart - Start time of the range
 * @param {number} rangeEnd - End time of the range
 * @returns {Array} - Subtitles outside the range
 */
export const removeSubtitlesInRange = (subtitles, rangeStart, rangeEnd) => {
  return subtitles.filter(sub => !subtitleOverlapsWithRange(sub, rangeStart, rangeEnd));
};

/**
 * Validate and clean subtitle array
 * @param {Array} subtitles - Array of subtitle objects
 * @returns {Array} - Cleaned subtitle array
 */
export const validateAndCleanSubtitles = (subtitles) => {
  if (!Array.isArray(subtitles)) {
    return [];
  }

  return subtitles
    .filter(sub =>
      sub &&
      typeof sub.start === 'number' &&
      typeof sub.end === 'number' &&
      sub.start < sub.end &&
      typeof sub.text === 'string' &&
      sub.text.trim().length > 0
    )
    .sort((a, b) => a.start - b.start);
};

/**
 * Example usage and test function (for development/debugging)
 */
export const testSubtitleMerging = () => {
  const existingSubtitles = [
    { start: 0, end: 10, text: "Hello" },
    { start: 10, end: 20, text: "World" },
    { start: 20, end: 30, text: "This will be replaced" },
    { start: 30, end: 40, text: "Keep this" }
  ];

  const newSegmentSubtitles = [
    { start: 15, end: 25, text: "New content here" },
    { start: 25, end: 35, text: "More new content" }
  ];

  const segment = { start: 15, end: 35 };

  const result = mergeSegmentSubtitles(existingSubtitles, newSegmentSubtitles, segment);

  console.log('Test merge result:', result);
  // Expected: [
  //   { start: 0, end: 10, text: "Hello" },
  //   { start: 10, end: 20, text: "World" }, // kept (ends exactly at segment start)
  //   { start: 15, end: 25, text: "New content here" }, // new
  //   { start: 25, end: 35, text: "More new content" }, // new
  //   { start: 30, end: 40, text: "Keep this" } // kept (starts exactly at segment end)
  // ]

  // Verify the logic
  const beforeSegment = existingSubtitles.filter(sub => sub.end <= segment.start);
  const afterSegment = existingSubtitles.filter(sub => sub.start >= segment.end);

  console.log('Filter test:', {
    segment: `${segment.start}-${segment.end}`,
    before: beforeSegment.map(s => `${s.start}-${s.end}: ${s.text}`),
    after: afterSegment.map(s => `${s.start}-${s.end}: ${s.text}`)
  });

  return result;
};
