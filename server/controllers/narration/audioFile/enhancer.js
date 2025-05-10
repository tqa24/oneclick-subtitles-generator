/**
 * Module for enhancing narration results with additional metadata
 */

/**
 * Enhance F5-TTS narration results with timing information
 * This function ensures F5-TTS narrations have the same metadata as Gemini narrations
 * for proper alignment and playback in the video player.
 *
 * @param {Array} narrationResults - Array of narration results from F5-TTS
 * @param {Array} subtitles - Array of subtitles with timing information
 * @returns {Array} - Enhanced narration results with timing information
 */
const enhanceF5TTSNarrations = (narrationResults, subtitles) => {
  if (!narrationResults || !Array.isArray(narrationResults)) {
    console.log('No narration results to enhance');
    return narrationResults;
  }

  if (!subtitles || !Array.isArray(subtitles)) {
    console.log('No subtitles provided for timing information');
    return narrationResults;
  }

  console.log(`Enhancing ${narrationResults.length} F5-TTS narration results with timing information`);

  // Create a map of subtitles by ID for quick lookup
  const subtitleMap = {};
  subtitles.forEach(subtitle => {
    if (subtitle.id) {
      subtitleMap[subtitle.id] = subtitle;
    }
  });

  // Enhance each narration result with timing information
  return narrationResults.map(result => {
    // Find the corresponding subtitle for timing information
    const subtitle = subtitleMap[result.subtitle_id];

    // If we found a matching subtitle, use its timing
    if (subtitle && typeof subtitle.start === 'number' && typeof subtitle.end === 'number') {
      console.log(`Found timing for subtitle ${result.subtitle_id}: ${subtitle.start}s - ${subtitle.end}s`);
      return {
        ...result,
        start: subtitle.start,
        end: subtitle.end
      };
    }

    // Otherwise, keep existing timing or use defaults
    return {
      ...result,
      start: result.start || 0,
      end: result.end || (result.start ? result.start + 5 : 5)
    };
  });
};

module.exports = {
  enhanceF5TTSNarrations
};
