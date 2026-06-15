/**
 * Hallucination detection helpers for streaming Gemini transcriptions.
 *
 * These are PURE pattern-matchers extracted verbatim from
 * processStreamingResponse. Each takes a subtitle (and, where noted, a
 * stateless piece of context such as a counter value or a sliding window of
 * recent text) and returns a boolean indicating whether the pattern looks like
 * a model hallucination. They intentionally hold NO mutable state of their own:
 * the stuck-chunk counters and running accumulators stay in the caller.
 *
 * Logging side-effects that depend only on the inputs are preserved here so
 * behavior is identical to the original inline checks.
 */

/**
 * Detect a single character repeated an implausible number of times.
 * e.g. "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".
 * @param {{text?: string}} subtitle
 * @returns {boolean}
 */
export const detectCharacterRepetition = (subtitle) => {
  if (!subtitle.text) return false;

  // Check for single character repeated many times
  const singleCharPattern = /(.)\1{29,}/; // Same character repeated 30+ times (raised from 20)
  if (singleCharPattern.test(subtitle.text)) {
    // Some legitimate cases: "Ahhhhhhhh!" (screaming), "Zzzzzz" (sleeping)
    const match = subtitle.text.match(singleCharPattern);
    const char = match[1];
    const count = match[0].length;

    // Common legitimate extended characters in subtitles
    // Vowels from various languages, h (breathing), z (sleeping), dots, dashes
    // Using Unicode categories for broader coverage:
    // - Any vowel-like character (rough approximation)
    // - Common sound effect characters
    const legitimateExtended = /[aeiouAEIOUаеёиоуыэюяАЕЁИОУЫЭЮЯあいうえおアイウエオㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣhHzZｚＺ.\-~!?]/.test(char) ||
                             // Or any letter that might be legitimately extended
                             /[\p{L}]/u.test(char);

    if (!legitimateExtended || count > 50) {
      // Only log the actual hallucination, not the allowed cases
      console.log(`[StreamingService] Hallucination: "${char}" x${count}`);
      return true;
    }
  }
  return false;
};

/**
 * Detect a short (2-5 char) sequence repeated many times.
 * @param {{text?: string}} subtitle
 * @returns {boolean}
 */
export const detectSequenceRepetition = (subtitle) => {
  if (!subtitle.text) return false;

  // Check for short sequences repeated many times
  // NOTE: Be careful with legitimate repetitive content like song lyrics
  // Convert to lowercase for case-insensitive matching
  const textLower = subtitle.text.toLowerCase();
  const shortSequencePattern = /(.{2,5})\1{19,}/; // 2-5 char sequence repeated 20+ times
  if (shortSequencePattern.test(textLower)) {
    const match = textLower.match(shortSequencePattern);
    const repetitions = match[0].length / match[1].length;
    const repeatedPattern = match[1];

    // Also check the original text to get the actual pattern (with original casing)
    // Find the starting position in lowercase text and extract from original
    const startPos = textLower.indexOf(match[0]);
    const originalRepeatedSection = subtitle.text.substring(startPos, startPos + match[1].length);

    // Simple rule: ANY pattern repeated more than 30 times is a hallucination
    // Even the most repetitive songs rarely repeat the same word/syllable 30+ times in a row
    if (repetitions > 30) {
      console.log(`[StreamingService] Hallucination: "${originalRepeatedSection}" x${Math.floor(repetitions)}`);
      return true;
    }

    // For patterns repeated 20-30 times, only allow if it contains actual text
    // \p{L} = any letter from any language
    const hasLetters = /[\p{L}]/u.test(repeatedPattern);
    const looksLikeGibberish = /^[^\p{L}\p{N}\s]+$/u.test(repeatedPattern);

    if (!hasLetters || looksLikeGibberish) {
      console.log(`[StreamingService] Hallucination: Non-text "${originalRepeatedSection}" x${Math.floor(repetitions)}`);
      return true;
    }
  }
  return false;
};

/**
 * Detect text dominated (>80%) by a single character.
 * @param {{text?: string}} subtitle
 * @returns {boolean}
 */
export const detectTextDominance = (subtitle) => {
  if (!subtitle.text) return false;

  // Check if more than 80% of the text is the same character
  if (subtitle.text.length > 50) {
    const charCounts = {};
    for (const char of subtitle.text) {
      charCounts[char] = (charCounts[char] || 0) + 1;
    }
    const maxCount = Math.max(...Object.values(charCounts));
    if (maxCount / subtitle.text.length > 0.8) {
      const dominantChar = Object.keys(charCounts).find(key => charCounts[key] === maxCount);
      console.log(`[StreamingService] Detected hallucination: Text is ${Math.round(maxCount / subtitle.text.length * 100)}% character "${dominantChar}"`);
      return true;
    }
  }
  return false;
};

/**
 * Detect many identical non-musical subtitles all landing at a stuck timestamp.
 * Reads stateless context (last valid end time and the sliding window of recent
 * text blocks) but mutates nothing.
 * @param {{start: number}} subtitle
 * @param {number} lastValidSubtitleEndTime
 * @param {string[]} recentTextBlocks
 * @returns {boolean}
 */
export const detectStuckTimestamp = (subtitle, lastValidSubtitleEndTime, recentTextBlocks) => {
  // Check for stuck timestamps (many subtitles with very similar times)
  // This catches cases like multiple lines all at 01:36:09,517
  // HOWEVER: Be very careful with music - repetitive lyrics can legitimately appear at similar times
  if (lastValidSubtitleEndTime > 0) {
    const timeDiff = Math.abs(subtitle.start - lastValidSubtitleEndTime);
    // Only check for stuck timestamps if they're EXTREMELY close (< 0.1 seconds)
    // AND the text repeats many times (10+), not just 5
    if (timeDiff < 0.1 && recentTextBlocks.length > 10) {
      const lastFewTexts = recentTextBlocks.slice(-10);
      const uniqueTexts = [...new Set(lastFewTexts)];
      // Only flag if ALL 10 recent texts are identical AND timestamps barely moved
      if (uniqueTexts.length === 1 && lastFewTexts.length === 10 && timeDiff < 0.05) {
        // Check if it looks like music/vocal content
        const hasMusicalPattern = /[\p{L}]{2,}/u.test(uniqueTexts[0]);
        if (!hasMusicalPattern) {
          // Only flag non-musical content as hallucination
          console.log(`[StreamingService] Detected hallucination: 10+ identical non-musical subtitles at stuck timestamp`);
          console.log(`[StreamingService] Text: "${uniqueTexts[0]}" at ~${subtitle.start.toFixed(1)}s with time diff ${timeDiff.toFixed(3)}s`);
          return true;
        } else {
          // Log but don't terminate for musical content
          console.log(`[StreamingService] Allowing repeated musical content: "${uniqueTexts[0].substring(0, 50)}..." at ~${subtitle.start.toFixed(1)}s`);
        }
      }
    }
  }
  return false;
};

/**
 * Stateless threshold decision for block-level (verse/chorus) repetition.
 * The sliding-window comparison and the blockRepetitionCount accumulator stay
 * in the caller; this only evaluates whether the current count crosses the
 * hallucination threshold.
 * @param {number} blockRepetitionCount
 * @returns {boolean}
 */
export const detectBlockRepetition = (blockRepetitionCount) => {
  // Songs commonly have 4-8 repetitions of chorus/bridge sections
  // Only flag as hallucination after 8+ identical block repetitions
  return blockRepetitionCount >= 8; // Increased from 4 to allow more chorus repetitions
};

/**
 * Stateless threshold decision for the same text repeated back-to-back.
 * The repeatedTextCount accumulator and lastText tracking stay in the caller.
 * @param {{text: string}} subtitle
 * @param {number} repeatedTextCount
 * @returns {boolean}
 */
export const detectRepeatedText = (subtitle, repeatedTextCount) => {
  // Context-aware thresholds:
  // - Very short text (< 5 chars): Could be "No!", "Oh!", etc. Allow more
  // - Medium text (5-20 chars): Could be short phrases, moderate threshold
  // - Long text (> 20 chars): Full sentences, choruses often repeat 4-6 times
  // - Very long text (> 50 chars): Full verses might repeat 3-4 times in songs
  const textLength = subtitle.text.length;
  let threshold;
  if (textLength < 5) {
    threshold = 20; // "No!" repeated many times in excitement (increased from 15)
  } else if (textLength <= 20) {
    threshold = 15;  // Short phrases in songs (increased from 12)
  } else if (textLength <= 50) {
    threshold = 12;  // Medium sentences/choruses (increased from 8)
  } else {
    threshold = 10;  // Long verses can still repeat multiple times
  }

  // Check if it looks like dialogue or song (has actual words from ANY language)
  // \p{L} matches any Unicode letter from any language
  const hasWords = /[\p{L}]{2,}/u.test(subtitle.text);

  if (repeatedTextCount >= threshold) {
    // Give dialogue/songs more leeway
    if (!hasWords || repeatedTextCount >= threshold + 3) {
      console.log(`[StreamingService] Detected hallucination: Text "${subtitle.text.substring(0, 50)}" repeated ${repeatedTextCount + 1} times`);
      return true;
    } else {
      console.log(`[StreamingService] Warning: Text "${subtitle.text.substring(0, 30)}..." repeated ${repeatedTextCount + 1} times (allowing as it contains words)`);
    }
  }
  return false;
};

/**
 * Stateless threshold decision for suspiciously uniform durations.
 * The uniformDurationCount accumulator and lastDuration tracking stay in the
 * caller; this evaluates whether the current count + duration shape qualifies
 * as a hallucination.
 * @param {{start: number, end: number}} subtitle
 * @param {number} uniformDurationCount
 * @returns {boolean}
 */
export const detectUniformDuration = (subtitle, uniformDurationCount) => {
  const duration = subtitle.end - subtitle.start;

  // Only flag as hallucination if:
  // 1. We have 15+ subtitles with identical duration (raised from 10)
  // 2. AND the duration is suspiciously round or very short
  const isSuspiciousDuration =
    (duration % 1.0 < 0.01 || duration % 1.0 > 0.99) || // Round numbers like 1.0, 2.0
    (duration < 0.1); // Very short durations

  return uniformDurationCount >= 15 && isSuspiciousDuration;
};
