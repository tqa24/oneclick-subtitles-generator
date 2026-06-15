/**
 * Segment boundary validation for streaming Gemini transcriptions.
 *
 * Pure helpers (no shared mutable state) that decide whether a subtitle falls
 * within a segment's end bound. Extracted verbatim from the inline bounds logic
 * in processStreamingResponse so it can be reused and tested in isolation.
 */

/**
 * Classify a single subtitle against the segment end offset.
 *
 * Mirrors the original inline branch exactly:
 *   - start beyond the segment end  => exceeds (drop, signal foundExceeding)
 *   - any positive timing           => valid (keep)
 *   - otherwise                     => neither (drop silently)
 *
 * @param {{start: number, end: number}} subtitle
 * @param {number} segmentEnd - Segment end offset in seconds.
 * @returns {{exceeds: boolean, valid: boolean}}
 */
export const classifySubtitleAgainstSegmentEnd = (subtitle, segmentEnd) => {
  if (subtitle.start > segmentEnd) {
    return { exceeds: true, valid: false };
  }
  if (subtitle.start > 0 || subtitle.end > 0) {
    return { exceeds: false, valid: true };
  }
  return { exceeds: false, valid: false };
};

/**
 * Filter a list of subtitles down to those within the segment end bound.
 *
 * @param {Array<{start: number, end: number}>} subtitles
 * @param {number} segmentEnd - Segment end offset in seconds.
 * @returns {{validSubtitles: Array, foundExceeding: boolean}}
 */
export const filterSubtitlesBySegmentBounds = (subtitles, segmentEnd) => {
  const validSubtitles = [];
  let foundExceeding = false;

  for (const subtitle of subtitles) {
    const { exceeds, valid } = classifySubtitleAgainstSegmentEnd(subtitle, segmentEnd);
    if (exceeds) {
      foundExceeding = true;
    } else if (valid) {
      validSubtitles.push(subtitle);
    }
  }

  return { validSubtitles, foundExceeding };
};
