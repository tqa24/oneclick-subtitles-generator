/**
 * Utility functions for aligned narration
 */

/**
 * Create a deep hash of an object for comparison
 * @param {any} obj - Object to hash
 * @returns {string} - Hash string
 */
export const createHash = (obj) => {
  if (!obj) return 'null';

  // For arrays, hash each element and join
  if (Array.isArray(obj)) {
    return obj.map(item => createHash(item)).join('|');
  }

  // For objects, sort keys and hash each key-value pair
  if (typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .map(key => {
        // Only include specific properties we care about for comparison
        // Focus on timing-related properties to prevent unnecessary regeneration
        if (['id', 'subtitle_id', 'start', 'end', 'filename', 'success'].includes(key)) {
          // For timing values, round to 2 decimal places to avoid tiny changes triggering regeneration
          if (key === 'start' || key === 'end') {
            const value = obj[key];
            if (typeof value === 'number') {
              return `${key}:${Math.round(value * 100) / 100}`;
            }
          }
          return `${key}:${createHash(obj[key])}`;
        }
        return '';
      })
      .filter(Boolean)
      .join('|');
  }

  // For primitives, convert to string
  return String(obj);
};

/**
 * Enhance narration results with subtitle timing information
 * @param {Array} generationResults - Array of narration results
 * @param {Object} subtitleMap - Map of subtitles by ID
 * @returns {Array} - Enhanced narration results with timing information
 */
export const enhanceNarrationWithTiming = (generationResults, subtitleMap) => {
  if (!generationResults || !subtitleMap) {
    console.warn('Missing generationResults or subtitleMap in enhanceNarrationWithTiming');
    return generationResults;
  }

  console.log('Enhancing narration with timing. Results count:', generationResults.length);
  console.log('Available subtitle IDs in map:', Object.keys(subtitleMap));

  return generationResults.map(result => {
    // Get the correct subtitle ID from the result
    const subtitleId = result.subtitle_id;

    // Log the lookup attempt for debugging
    console.log(`Looking up timing for subtitle ID: ${subtitleId}`);

    // Get the subtitle from the map using the exact ID from the result
    const subtitle = subtitleMap[subtitleId];

    // If we found a matching subtitle, use its timing
    if (subtitle && typeof subtitle.start === 'number' && typeof subtitle.end === 'number') {
      console.log(`Found timing for subtitle ${subtitleId}: ${subtitle.start}s - ${subtitle.end}s`);
      return {
        ...result,
        start: subtitle.start,
        end: subtitle.end
      };
    } else {
      console.warn(`No timing found for subtitle ${subtitleId}. Using defaults.`);

      // Otherwise, keep existing timing or use defaults
      return {
        ...result,
        start: result.start || 0,
        end: result.end || (result.start ? result.start + 5 : 5)
      };
    }
  });
};

/**
 * Create a map of subtitles by ID
 * @param {Array} subtitles - Array of subtitles
 * @returns {Object} - Map of subtitles by ID
 */
export const createSubtitleMap = (subtitles) => {
  if (!subtitles || !Array.isArray(subtitles)) {
    console.warn('No subtitles provided to createSubtitleMap or not an array');
    return {};
  }

  console.log(`Creating subtitle map from ${subtitles.length} subtitles`);

  const map = {};
  subtitles.forEach((subtitle, index) => {
    if (subtitle && subtitle.id) {
      // Store the subtitle in the map using its ID as the key
      map[subtitle.id] = subtitle;

      // Log the first few and last few for debugging
      if (index < 3 || index >= subtitles.length - 3) {
        console.log(`Mapped subtitle ID ${subtitle.id} with timing ${subtitle.start}s - ${subtitle.end}s`);
      }
    } else {
      console.warn(`Subtitle at index ${index} has no ID or is invalid:`, subtitle);
    }
  });

  console.log(`Created subtitle map with ${Object.keys(map).length} entries`);
  return map;
};

/**
 * Get all available subtitles from various sources
 * @returns {Array} - Combined array of subtitles
 */
export const getAllSubtitles = () => {
  const allSubtitles = [];
  const sources = {};

  // Try to get subtitles from window.subtitles (main source)
  if (window.subtitles && Array.isArray(window.subtitles)) {
    console.log(`Found ${window.subtitles.length} subtitles in window.subtitles`);
    sources.subtitles = window.subtitles;
  }

  // Also check window.subtitlesData (alternative source)
  if (window.subtitlesData && Array.isArray(window.subtitlesData)) {
    console.log(`Found ${window.subtitlesData.length} subtitles in window.subtitlesData`);
    sources.subtitlesData = window.subtitlesData;
  }

  // Also check window.originalSubtitles (for original language)
  if (window.originalSubtitles && Array.isArray(window.originalSubtitles)) {
    console.log(`Found ${window.originalSubtitles.length} subtitles in window.originalSubtitles`);
    sources.originalSubtitles = window.originalSubtitles;
  }

  // Also check window.translatedSubtitles (for translated language)
  if (window.translatedSubtitles && Array.isArray(window.translatedSubtitles)) {
    console.log(`Found ${window.translatedSubtitles.length} subtitles in window.translatedSubtitles`);
    sources.translatedSubtitles = window.translatedSubtitles;
  }

  // Determine which source to use based on which has the most subtitles
  // This helps ensure we're using the most complete set of subtitles
  let bestSource = null;
  let maxLength = 0;

  for (const [sourceName, subtitles] of Object.entries(sources)) {
    if (subtitles.length > maxLength) {
      maxLength = subtitles.length;
      bestSource = sourceName;
    }
  }

  if (bestSource) {
    console.log(`Using ${bestSource} as the primary source with ${maxLength} subtitles`);
    allSubtitles.push(...sources[bestSource]);
  } else {
    console.warn('No subtitle sources found');
  }

  // Validate that all subtitles have proper timing information
  const validSubtitles = allSubtitles.filter(subtitle => {
    const isValid = subtitle &&
                   subtitle.id &&
                   typeof subtitle.start === 'number' &&
                   typeof subtitle.end === 'number';

    if (!isValid) {
      console.warn('Found invalid subtitle:', subtitle);
    }

    return isValid;
  });

  console.log(`Found ${validSubtitles.length} valid subtitles out of ${allSubtitles.length} total`);

  return validSubtitles;
};
