/**
 * Helpers for Gemini streaming response processing.
 * Extracted from streamingService.js to keep that file focused on the
 * streaming control flow. Behavior is preserved byte-for-byte.
 */

import { getTranscriptionPrompt } from './promptManagement';
import { parseGeminiResponse } from '../../utils/subtitle';
import { createSubtitleSchema, addResponseSchema } from '../../utils/schemaUtils';
import { addThinkingConfig } from '../../utils/thinkingBudgetUtils';
import { fileToBase64 } from '../../utils/fileUtils';
import { supportsMediaResolution } from './modelCapabilities';
import {
  detectCharacterRepetition,
  detectSequenceRepetition,
  detectTextDominance,
  detectStuckTimestamp,
  detectBlockRepetition,
  detectRepeatedText,
  detectUniformDuration
} from './hallucinationDetector';
import { classifySubtitleAgainstSegmentEnd } from './segmentValidator';

/**
 * Build the streaming request payload for the Gemini streamGenerateContent call.
 * @param {File} file - The media file
 * @param {string} fileUri - The uploaded file URI from Files API (or null for inline)
 * @param {Object} options - Generation options
 * @param {boolean} isAudio - Whether the content is audio
 * @param {string} MODEL - The resolved model id
 * @returns {Promise<Object>} - The fully-built requestData payload
 */
export const buildStreamingRequest = async (file, fileUri, options, isAudio, MODEL) => {
  const { userProvidedSubtitles, videoMetadata, mediaResolution } = options;

  // Determine content type
  const contentType = isAudio ? 'audio' : 'video';

  // Get the transcription prompt
  const segmentInfo = options?.segmentInfo || {};
  const promptText = getTranscriptionPrompt(contentType, userProvidedSubtitles, { segmentInfo });

  const useInline = !fileUri;

  let requestData = {
    model: MODEL,
    contents: []
  };

  if (useInline) {
    // For audio files, convert to a format supported by Gemini
    let processedFile = file;
    if (isAudio) {
      const { convertAudioForGemini } = await import('../../utils/audioConverter');
      processedFile = await convertAudioForGemini(file);
    }
    const base64 = await fileToBase64(processedFile);
    requestData.contents = [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: processedFile.type,
              data: base64
            }
          },
          { text: promptText }
        ]
      }
    ];
  } else {
    const isYouTube = /(youtube\.com|youtu\.be)\//.test(fileUri);
    const fileDataPart = isYouTube
      ? { file_uri: fileUri }
      : { file_uri: fileUri, mime_type: file.type };

    requestData.contents = [
      {
        role: "user",
        parts: [
          {
            file_data: fileDataPart
          },
          { text: promptText }
        ]
      }
    ];

    // Add video metadata if provided (Files API path only)
    if (videoMetadata && !isAudio) {
      requestData.contents[0].parts[0].video_metadata = videoMetadata; // Now at index 0 since video is first
    }
  }

  // Add structured output schema
  const isUserProvided = userProvidedSubtitles && userProvidedSubtitles.trim() !== '';
  requestData = addResponseSchema(requestData, createSubtitleSchema(isUserProvided), isUserProvided);

  // Add thinking configuration if supported by the model
  requestData = addThinkingConfig(requestData, MODEL);

  // Add generation config with media resolution if provided (only for supported models)
  if (mediaResolution && supportsMediaResolution(MODEL)) {
    if (!requestData.generationConfig) {
      requestData.generationConfig = {};
    }
    requestData.generationConfig.mediaResolution = mediaResolution;
  } else if (mediaResolution && !supportsMediaResolution(MODEL)) {
    console.log('[StreamingService] Skipping media resolution for unsupported model:', MODEL);
  }

  return { requestData, useInline };
};

/**
 * Parse accumulated streaming text into subtitles.
 * @param {string} accumulatedText - The full accumulated response text
 * @returns {Array|null} - Parsed subtitles (may throw if unparseable mid-stream)
 */
export const parseAccumulatedSubtitles = (accumulatedText) => {
  // Create a mock response object for the parser
  const mockResponse = {
    candidates: [{
      content: {
        parts: [{
          text: accumulatedText
        }]
      }
    }]
  };

  return parseGeminiResponse(mockResponse);
};

/**
 * Scan parsed subtitles for hallucination patterns and segment-bound violations.
 *
 * The per-chunk accumulators (invalidTimingCount, repeatedTextCount, lastText,
 * uniformDurationCount, lastDuration, recentTextBlocks, blockRepetitionCount,
 * validSubtitles) are local to a single scan and re-initialized here each call,
 * matching the original inline behavior. The only value crossing the chunk
 * boundary is lastValidSubtitleEndTime, which is taken in and returned out.
 *
 * @param {Array} parsedSubtitles - Subtitles parsed so far
 * @param {number} segmentEndOffset - Segment end offset in seconds
 * @param {number} lastValidSubtitleEndTime - Running end time across chunks
 * @returns {{validSubtitles: Array, foundExceeding: boolean, foundHallucination: boolean, lastValidSubtitleEndTime: number}}
 */
export const scanSubtitlesForHallucination = (parsedSubtitles, segmentEndOffset, lastValidSubtitleEndTime) => {
  // Find the last subtitle that's within the segment bounds
  let validSubtitles = [];
  let foundExceeding = false;
  let foundHallucination = false;

  // Hallucination accumulators that MUST persist across iterations.
  // These cannot move into the pure detectors; only the stateless
  // pattern/threshold decisions are delegated below.
  let invalidTimingCount = 0;
  let repeatedTextCount = 0;
  let lastText = null;
  let uniformDurationCount = 0;
  let lastDuration = null;

  // Track blocks of text to detect verse/chorus repetitions
  let recentTextBlocks = [];
  let blockRepetitionCount = 0;

  // PERFORMANCE: Only check new subtitles for hallucination, not all accumulated ones
  // Check last 50 subtitles max to catch patterns while keeping performance good
  const startIndex = Math.max(0, parsedSubtitles.length - 50);

  for (let i = 0; i < parsedSubtitles.length; i++) {
    const subtitle = parsedSubtitles[i];
    // Only do expensive hallucination checks on recent subtitles
    const shouldCheckHallucination = i >= startIndex;
    // Stateless text-pattern checks (single char, short sequence, dominance)
    if (shouldCheckHallucination && subtitle.text) {
      if (detectCharacterRepetition(subtitle) ||
          detectSequenceRepetition(subtitle) ||
          detectTextDominance(subtitle)) {
        foundHallucination = true;
        break;
      }
    }

    // Check for invalid timing (0,0 or both start and end are 0)
    if (shouldCheckHallucination && subtitle.start === 0 && subtitle.end === 0) {
      invalidTimingCount++;
      if (invalidTimingCount >= 3) {
        foundHallucination = true;
        console.log(`[StreamingService] Detected hallucination: Multiple subtitles with 0,0 timing`);
        break;
      }
    }

    // Stuck-timestamp check reads the running end time + recent window
    // (stateless inputs) and mutates nothing of its own.
    if (detectStuckTimestamp(subtitle, lastValidSubtitleEndTime, recentTextBlocks)) {
      foundHallucination = true;
      break;
    }

    // Track recent text blocks to detect verse/chorus repetitions
    // Keep a sliding window of the last 20 subtitles
    recentTextBlocks.push(subtitle.text);
    if (recentTextBlocks.length > 20) {
      recentTextBlocks.shift();
    }

    // Check for block-level repetitions (e.g., same verse repeating)
    // Look for patterns where a sequence of 5+ subtitles repeats.
    // The accumulator stays here; only the threshold decision is delegated.
    if (recentTextBlocks.length >= 10) {
      const halfLength = Math.floor(recentTextBlocks.length / 2);
      const firstHalf = recentTextBlocks.slice(0, halfLength).join('|');
      const secondHalf = recentTextBlocks.slice(halfLength, halfLength * 2).join('|');

      if (firstHalf === secondHalf && halfLength >= 5) {
        blockRepetitionCount++;
        if (detectBlockRepetition(blockRepetitionCount)) {
          foundHallucination = true;
          console.log(`[StreamingService] Detected hallucination: Block of ${halfLength} subtitles repeated ${blockRepetitionCount} times`);
          console.log(`[StreamingService] Repeated block sample: "${recentTextBlocks[0]}" ... "${recentTextBlocks[halfLength - 1]}"`);
          break;
        } else if (blockRepetitionCount >= 5) {
          // Log but don't terminate for moderate repetitions
          console.log(`[StreamingService] Allowing block repetition ${blockRepetitionCount} (likely chorus/bridge): "${recentTextBlocks[0].substring(0, 30)}..."`);
        }
      }
    }

    // Check for repeated text (same text multiple times in a row).
    // The repeatedTextCount/lastText accumulators stay here; the
    // threshold decision is delegated.
    if (lastText && subtitle.text === lastText) {
      repeatedTextCount++;
      if (detectRepeatedText(subtitle, repeatedTextCount)) {
        foundHallucination = true;
        break;
      }
    } else {
      repeatedTextCount = 0;
      lastText = subtitle.text;
    }

    // Check for uniform durations (all subtitles have exact same duration)
    // NOTE: This check should be careful not to flag legitimate cases
    // Some transcription systems might use fixed-duration segments
    // IMPORTANT: Skip this check if subtitle is marked as auto-split
    const duration = subtitle.end - subtitle.start;

    // Skip uniform duration check for auto-split subtitles (they're expected to have similar durations)
    if (!subtitle.isSplit) {
      // Only check for EXTREMELY uniform durations (less than 0.001s difference)
      // and only flag if duration is suspiciously round (like exactly 1.0s, 2.0s, etc.)
      if (lastDuration !== null && Math.abs(duration - lastDuration) < 0.001) {
        uniformDurationCount++;

        // Debug logging for uniform durations
        if (uniformDurationCount === 5) {
          console.log(`[StreamingService] Notice: ${uniformDurationCount + 1} subtitles with nearly identical duration ${duration.toFixed(3)}s`);
        }

        // Threshold + suspicious-shape decision is delegated.
        if (detectUniformDuration(subtitle, uniformDurationCount)) {
          foundHallucination = true;
          console.log(`[StreamingService] Detected hallucination: ${uniformDurationCount + 1} subtitles with identical duration ${duration.toFixed(3)}s`);
          console.log(`[StreamingService] Uniform duration reason: Suspiciously uniform duration detected`);
          console.log(`[StreamingService] Duration pattern: All ${uniformDurationCount + 1} subtitles have exactly ${duration.toFixed(3)}s duration`);
          console.log(`[StreamingService] Last few subtitle texts:`, validSubtitles.slice(-3).map(s => s.text.substring(0, 30)));
          break;
        }
      } else {
        // Reset only if duration difference is significant (> 0.1s)
        if (lastDuration === null || Math.abs(duration - lastDuration) > 0.1) {
          uniformDurationCount = 0;
        }
      }
      lastDuration = duration;
    }

    // Check segment bounds (delegated classification). The running
    // lastValidSubtitleEndTime accumulator stays here because the
    // stuck-timestamp check above reads it intra-chunk.
    const { exceeds, valid } = classifySubtitleAgainstSegmentEnd(subtitle, segmentEndOffset);
    if (exceeds) {
      foundExceeding = true;
      console.log(`[StreamingService] Found subtitle exceeding segment end (${subtitle.start} > ${segmentEndOffset}), preparing to terminate...`);
    } else if (valid) {
      // Only add subtitles with valid timing that are within bounds
      validSubtitles.push(subtitle);
      lastValidSubtitleEndTime = Math.max(lastValidSubtitleEndTime, subtitle.end || subtitle.start);
    }
  }

  return { validSubtitles, foundExceeding, foundHallucination, lastValidSubtitleEndTime };
};
