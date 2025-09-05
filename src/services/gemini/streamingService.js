/**
 * Gemini API Streaming Service
 * Handles streaming responses from Gemini API with real-time subtitle processing
 */

import { getNextAvailableKey } from './keyManager';
import { getTranscriptionPrompt } from './promptManagement';
import { parseGeminiResponse } from '../../utils/subtitle';
import { createSubtitleSchema, addResponseSchema } from '../../utils/schemaUtils';
import { addThinkingConfig } from '../../utils/thinkingBudgetUtils';
import { autoSplitSubtitles } from '../../utils/subtitle/splitUtils';
import { createRequestController, removeRequestController } from './requestManagement';

/**
 * Stream content generation from Gemini API
 * @param {File} file - The media file (already uploaded to Files API)
 * @param {string} fileUri - The uploaded file URI from Files API
 * @param {Object} options - Generation options
 * @param {Function} onChunk - Callback for each streaming chunk
 * @param {Function} onComplete - Callback when streaming is complete
 * @param {Function} onError - Callback for errors
 */
export const streamGeminiContent = async (file, fileUri, options = {}, onChunk, onComplete, onError) => {
  const { userProvidedSubtitles, modelId, videoMetadata, mediaResolution, autoSplitSubtitles: autoSplitEnabled, maxWordsPerSubtitle } = options;
  const MODEL = modelId || localStorage.getItem('gemini_model') || "gemini-2.5-flash";
  
  
  // Check if this is Gemini 2.5 Pro which might have specific requirements
  const isGemini25Pro = MODEL.includes('gemini-2.5-pro');
  if (isGemini25Pro) {
    console.log('[StreamingService] Using Gemini 2.5 Pro - checking for compatibility issues...');
  }
  
  const geminiApiKey = getNextAvailableKey();
  if (!geminiApiKey) {
    onError(new Error('No valid Gemini API key available. Please add at least one API key in Settings.'));
    return;
  }

  // Declare requestId and signal at function scope so they're accessible in catch block
  let requestId = null;
  let signal = null;

  try {
    // Determine content type
    const isAudio = file.type.startsWith('audio/');
    const contentType = isAudio ? 'audio' : 'video';

    // Get the transcription prompt
    const segmentInfo = options?.segmentInfo || {};
    const promptText = getTranscriptionPrompt(contentType, userProvidedSubtitles, { segmentInfo });

    // Create request data
    let requestData = {
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              file_data: {
                file_uri: fileUri,
                mime_type: file.type
              }
            },
            { text: promptText }
          ]
        }
      ]
    };

    // Add video metadata if provided
    if (videoMetadata && !isAudio) {
      console.log('[StreamingService] Adding video metadata:', JSON.stringify(videoMetadata, null, 2));
      requestData.contents[0].parts[0].video_metadata = videoMetadata; // Now at index 0 since video is first
      console.log('[StreamingService] Part with video_metadata:', JSON.stringify(requestData.contents[0].parts[0], null, 2));
    }

    // Add structured output schema
    const isUserProvided = userProvidedSubtitles && userProvidedSubtitles.trim() !== '';
    requestData = addResponseSchema(requestData, createSubtitleSchema(isUserProvided), isUserProvided);

    // Add thinking configuration if supported by the model
    requestData = addThinkingConfig(requestData, MODEL);

    // Add generation config with media resolution if provided
    if (mediaResolution) {
      if (!requestData.generationConfig) {
        requestData.generationConfig = {};
      }
      requestData.generationConfig.mediaResolution = mediaResolution;
    }

    console.log('[StreamingService] Starting streaming request with model:', MODEL);

    // Create request controller for abort support
    const controller = createRequestController();
    requestId = controller.requestId;
    signal = controller.signal;

    // Make streaming request
    console.log('[StreamingService] Request URL:', `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`);
    console.log('[StreamingService] Request body:', JSON.stringify(requestData, null, 2));
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': geminiApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
        signal: signal // Add abort signal
      }
    );

    console.log('[StreamingService] Response status:', response.status);
    console.log('[StreamingService] Response headers:', [...response.headers.entries()]);
    
    if (!response.ok) {
      removeRequestController(requestId);
      const errorData = await response.text();
      console.error('[StreamingService] Error response body:', errorData);
      throw new Error(`Gemini API error: ${response.status} - ${errorData}`);
    }

    // Process streaming response with options for early termination
    await processStreamingResponse(response, onChunk, onComplete, onError, options);
    
    // Clean up request controller after successful completion
    removeRequestController(requestId);

  } catch (error) {
    // Clean up request controller if it exists
    if (requestId) {
      removeRequestController(requestId);
    }
    console.error('[StreamingService] Error:', error);
    if (error.name === 'AbortError') {
      onError(new Error('Request was aborted'));
    } else {
      onError(error);
    }
  }
};

/**
 * Process the streaming response from Gemini API
 * @param {Response} response - Fetch response object
 * @param {Function} onChunk - Callback for each chunk
 * @param {Function} onComplete - Callback when complete
 * @param {Function} onError - Callback for errors
 * @param {Object} options - Additional options like segment info
 */
const processStreamingResponse = async (response, onChunk, onComplete, onError, options = {}) => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulatedText = '';
  let chunkCount = 0;
  
  // Extract auto-split options
  const { autoSplitSubtitles: autoSplitEnabled, maxWordsPerSubtitle } = options;
  
  // Extract segment end offset if provided
  // Note: The property is 'end', not 'endOffset'
  const segmentEndOffset = options?.segmentInfo?.end || options?.segmentInfo?.endOffset || null;
  let shouldTerminate = false;
  let lastValidSubtitleEndTime = 0;
  
  console.log(`[StreamingService] Segment processing initialized:`, {
    segmentStart: options?.segmentInfo?.start || 'not set',
    segmentEnd: segmentEndOffset || 'not set',
    duration: options?.segmentInfo?.duration || 'not set'
  });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Decode the chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });
      
      // Split by double newlines to get individual events
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || ''; // Keep the last incomplete event in buffer

      for (const event of events) {
        if (!event.trim()) continue;

        try {
          // Parse the SSE event
          const lines = event.split(/\r?\n/);
          let eventData = null;

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataContent = line.slice(6);
              if (dataContent === '[DONE]') {
                // Stream is complete
                console.log('[StreamingService] Stream completed');
                onComplete(accumulatedText);
                return;
              }
              
              try {
                eventData = JSON.parse(dataContent);
              } catch (parseError) {
                console.warn('[StreamingService] Failed to parse JSON:', dataContent);
                continue;
              }
            }
          }

          if (eventData) {
            // console.log('[StreamingService] Event data received:', JSON.stringify(eventData).substring(0, 200));
            
            // Check for error in the event data
            if (eventData.error) {
              console.error('[StreamingService] Error in event data:', eventData.error);
              onError(new Error(`Gemini API error: ${eventData.error.message || JSON.stringify(eventData.error)}`));
              return;
            }
            
            // Check if the response has no candidates (empty response)
            if (!eventData.candidates || eventData.candidates.length === 0) {
              console.warn('[StreamingService] No candidates in response:', JSON.stringify(eventData));
            }
          }
          
          if (eventData && eventData.candidates && eventData.candidates.length > 0) {
            const candidate = eventData.candidates[0];
            
            // Check for finish reasons that might indicate why no content was generated
            if (candidate.finishReason) {
              console.log('[StreamingService] Finish reason:', candidate.finishReason);
              if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
                console.warn('[StreamingService] Content blocked due to:', candidate.finishReason);
                if (candidate.safetyRatings) {
                  console.warn('[StreamingService] Safety ratings:', JSON.stringify(candidate.safetyRatings));
                }
              }
            }
            
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
              const textPart = candidate.content.parts[0];
              if (textPart.text) {
                chunkCount++;
                accumulatedText += textPart.text;
                
                // console.log(`[StreamingService] Chunk ${chunkCount}:`, textPart.text.substring(0, 100) + '...');
                
                // Try to parse accumulated text as subtitles
                try {
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

                const parsedSubtitles = parseGeminiResponse(mockResponse);
                
                // Check if we should terminate based on segment end offset
                if (segmentEndOffset !== null && parsedSubtitles && parsedSubtitles.length > 0) {
                  // console.log(`[StreamingService] Checking segment bounds: end offset = ${segmentEndOffset}s`);
                  // Find the last subtitle that's within the segment bounds
                  let validSubtitles = [];
                  let foundExceeding = false;
                  let foundHallucination = false;
                  
                  // Check for hallucination patterns
                  let invalidTimingCount = 0;
                  let repeatedTextCount = 0;
                  let lastText = null;
                  let uniformDurationCount = 0;
                  let lastDuration = null;
                  
                  // Track blocks of text to detect verse/chorus repetitions
                  let recentTextBlocks = [];
                  let blockRepetitionCount = 0;
                  
                  for (const subtitle of parsedSubtitles) {
                    // Check for excessive character repetition in text
                    if (subtitle.text) {
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
                          foundHallucination = true;
                          console.log(`[StreamingService] Detected hallucination: Character "${char}" repeated ${count} times`);
                          break;
                        } else if (count > 30) {
                          console.log(`[StreamingService] Allowing extended character "${char}" x${count} (possibly legitimate vocalization)`);
                        }
                      }
                      
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
                          foundHallucination = true;
                          console.log(`[StreamingService] Detected hallucination: "${originalRepeatedSection}" repeated ${Math.floor(repetitions)} times (>30 threshold)`);
                          break;
                        }
                        
                        // For patterns repeated 20-30 times, only allow if it contains actual text
                        // \p{L} = any letter from any language
                        const hasLetters = /[\p{L}]/u.test(repeatedPattern);
                        const looksLikeGibberish = /^[^\p{L}\p{N}\s]+$/u.test(repeatedPattern);
                        
                        if (!hasLetters || looksLikeGibberish) {
                          foundHallucination = true;
                          console.log(`[StreamingService] Detected hallucination: Non-text pattern "${originalRepeatedSection}" repeated ${Math.floor(repetitions)} times`);
                          break;
                        } else if (repetitions > 25) {
                          // Log warning for 25-30 repetitions but allow it
                          console.log(`[StreamingService] Warning: "${originalRepeatedSection}" repeated ${Math.floor(repetitions)} times (approaching threshold)`);
                        }
                      }
                      
                      // Check if more than 80% of the text is the same character
                      if (subtitle.text.length > 50) {
                        const charCounts = {};
                        for (const char of subtitle.text) {
                          charCounts[char] = (charCounts[char] || 0) + 1;
                        }
                        const maxCount = Math.max(...Object.values(charCounts));
                        if (maxCount / subtitle.text.length > 0.8) {
                          foundHallucination = true;
                          const dominantChar = Object.keys(charCounts).find(key => charCounts[key] === maxCount);
                          console.log(`[StreamingService] Detected hallucination: Text is ${Math.round(maxCount / subtitle.text.length * 100)}% character "${dominantChar}"`);
                          break;
                        }
                      }
                    }
                    
                    // Check for invalid timing (0,0 or both start and end are 0)
                    if (subtitle.start === 0 && subtitle.end === 0) {
                      invalidTimingCount++;
                      if (invalidTimingCount >= 3) {
                        foundHallucination = true;
                        console.log(`[StreamingService] Detected hallucination: Multiple subtitles with 0,0 timing`);
                        break;
                      }
                    }
                    
                    // Check for stuck timestamps (many subtitles with very similar times)
                    // This catches cases like multiple lines all at 01:36:09,517
                    // HOWEVER: Be very careful with music - repetitive lyrics can legitimately appear at similar times
                    if (lastValidSubtitleEndTime > 0) {
                      const timeDiff = Math.abs(subtitle.start - lastValidSubtitleEndTime);
                      // Only check for stuck timestamps if they're EXTREMELY close (< 0.1 seconds)
                      // AND the text repeats many times (5+), not just 3
                      if (timeDiff < 0.1 && recentTextBlocks.length > 5) {
                        const lastFewTexts = recentTextBlocks.slice(-5);
                        const uniqueTexts = [...new Set(lastFewTexts)];
                        // Only flag if ALL 5 recent texts are identical AND timestamps barely moved
                        if (uniqueTexts.length === 1 && lastFewTexts.length === 5 && timeDiff < 0.05) {
                          // Check if it looks like music/vocal content
                          const hasMusicalPattern = /[\p{L}]{2,}/u.test(uniqueTexts[0]);
                          if (!hasMusicalPattern) {
                            // Only flag non-musical content as hallucination
                            foundHallucination = true;
                            console.log(`[StreamingService] Detected hallucination: 5+ identical non-musical subtitles at stuck timestamp`);
                            console.log(`[StreamingService] Text: "${uniqueTexts[0]}" at ~${subtitle.start.toFixed(1)}s with time diff ${timeDiff.toFixed(3)}s`);
                            break;
                          } else {
                            // Log but don't terminate for musical content
                            console.log(`[StreamingService] Allowing repeated musical content: "${uniqueTexts[0].substring(0, 50)}..." at ~${subtitle.start.toFixed(1)}s`);
                          }
                        }
                      }
                    }
                    
                    // Track recent text blocks to detect verse/chorus repetitions
                    // Keep a sliding window of the last 20 subtitles
                    recentTextBlocks.push(subtitle.text);
                    if (recentTextBlocks.length > 20) {
                      recentTextBlocks.shift();
                    }
                    
                    // Check for block-level repetitions (e.g., same verse repeating)
                    // Look for patterns where a sequence of 5+ subtitles repeats
                    if (recentTextBlocks.length >= 10) {
                      const halfLength = Math.floor(recentTextBlocks.length / 2);
                      const firstHalf = recentTextBlocks.slice(0, halfLength).join('|');
                      const secondHalf = recentTextBlocks.slice(halfLength, halfLength * 2).join('|');
                      
                      if (firstHalf === secondHalf && halfLength >= 5) {
                        blockRepetitionCount++;
                        // Songs commonly have 4-8 repetitions of chorus/bridge sections
                        // Only flag as hallucination after 8+ identical block repetitions
                        if (blockRepetitionCount >= 8) { // Increased from 4 to allow more chorus repetitions
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
                    
                    // Check for repeated text (same text multiple times in a row)
                    // Be more lenient with repetitions as they might be legitimate (e.g., chorus, repeated dialogue)
                    if (lastText && subtitle.text === lastText) {
                      repeatedTextCount++;
                      
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
                          foundHallucination = true;
                          console.log(`[StreamingService] Detected hallucination: Text "${subtitle.text.substring(0, 50)}" repeated ${repeatedTextCount + 1} times`);
                          break;
                        } else {
                          console.log(`[StreamingService] Warning: Text "${subtitle.text.substring(0, 30)}..." repeated ${repeatedTextCount + 1} times (allowing as it contains words)`);
                        }
                      }
                    } else {
                      repeatedTextCount = 0;
                      lastText = subtitle.text;
                    }
                    
                    // Check for uniform durations (all subtitles have exact same duration)
                    const duration = subtitle.end - subtitle.start;
                    if (lastDuration !== null && Math.abs(duration - lastDuration) < 0.01) {
                      uniformDurationCount++;
                      if (uniformDurationCount >= 10) {
                        foundHallucination = true;
                        console.log(`[StreamingService] Detected hallucination: ${uniformDurationCount + 1} subtitles with identical duration ${duration.toFixed(2)}s`);
                        break;
                      }
                    } else {
                      uniformDurationCount = 0;
                    }
                    lastDuration = duration;
                    
                    // Check if subtitle exceeds segment end
                    if (subtitle.start > segmentEndOffset) {
                      // Found subtitle that exceeds segment end
                      foundExceeding = true;
                      console.log(`[StreamingService] Found subtitle exceeding segment end (${subtitle.start} > ${segmentEndOffset}), preparing to terminate...`);
                    } else if (subtitle.start > 0 || subtitle.end > 0) {
                      // Only add subtitles with valid timing that are within bounds
                      validSubtitles.push(subtitle);
                      lastValidSubtitleEndTime = Math.max(lastValidSubtitleEndTime, subtitle.end || subtitle.start);
                    }
                  }
                  
                  // If we found hallucination or subtitles exceeding the segment, terminate
                  if (foundHallucination || foundExceeding) {
                    shouldTerminate = true;
                    
                    // Send only valid subtitles
                    if (validSubtitles.length > 0) {
                      // Apply auto-split if enabled
                      let finalSubtitles = validSubtitles;
                      if (autoSplitEnabled && maxWordsPerSubtitle > 0) {
                        finalSubtitles = autoSplitSubtitles(validSubtitles, maxWordsPerSubtitle);
                        if (finalSubtitles.length > validSubtitles.length) {
                          console.log(`[StreamingService] Auto-split applied: ${validSubtitles.length} -> ${finalSubtitles.length} subtitles`);
                        }
                      }
                      
                      onChunk({
                        text: textPart.text,
                        accumulatedText,
                        subtitles: finalSubtitles,
                        chunkCount,
                        isComplete: false
                      });
                    }
                    
                    // Terminate the stream
                    if (foundHallucination) {
                      console.log(`[StreamingService] Terminating stream - detected hallucination patterns`);
                    } else {
                      console.log(`[StreamingService] Terminating stream - reached segment end offset at ${segmentEndOffset}`);
                    }
                    reader.cancel(); // Cancel the reader to stop receiving more data
                    onComplete(accumulatedText);
                    return;
                  } else {
                    // All subtitles are valid, apply auto-split if enabled
                    let finalSubtitles = validSubtitles;
                    if (autoSplitEnabled && maxWordsPerSubtitle > 0) {
                      finalSubtitles = autoSplitSubtitles(validSubtitles, maxWordsPerSubtitle);
                      if (finalSubtitles.length > validSubtitles.length) {
                        console.log(`[StreamingService] Auto-split applied: ${validSubtitles.length} -> ${finalSubtitles.length} subtitles`);
                      }
                    }
                    
                    onChunk({
                      text: textPart.text,
                      accumulatedText,
                      subtitles: finalSubtitles,
                      chunkCount,
                      isComplete: false
                    });
                  }
                } else if (parsedSubtitles && parsedSubtitles.length > 0) {
                  // No segment limit, apply auto-split if enabled
                  let finalSubtitles = parsedSubtitles;
                  if (autoSplitEnabled && maxWordsPerSubtitle > 0) {
                    finalSubtitles = autoSplitSubtitles(parsedSubtitles, maxWordsPerSubtitle);
                    if (finalSubtitles.length > parsedSubtitles.length) {
                      console.log(`[StreamingService] Auto-split applied: ${parsedSubtitles.length} -> ${finalSubtitles.length} subtitles`);
                    }
                  }
                  
                  onChunk({
                    text: textPart.text,
                    accumulatedText,
                    subtitles: finalSubtitles,
                    chunkCount,
                    isComplete: false
                  });
                } else {
                  // Call with raw text if parsing fails
                  onChunk({
                    text: textPart.text,
                    accumulatedText,
                    subtitles: [],
                    chunkCount,
                    isComplete: false
                  });
                }
                } catch (parseError) {
                  // Parsing failed - log details to understand what we're receiving
                  console.warn('[StreamingService] Parse error at chunk', chunkCount, ':', parseError.message);
                  
                  // Log a sample of the accumulated text to see what format we're getting
                  if (chunkCount % 100 === 0) { // Every 100 chunks, log a sample
                    console.log('[StreamingService] Sample of unparseable content at chunk', chunkCount, ':');
                    console.log('- Text length:', accumulatedText.length);
                    console.log('- Last 500 chars:', accumulatedText.slice(-500));
                    console.log('- Contains JSON markers:', {
                      hasOpenBracket: accumulatedText.includes('['),
                      hasCloseBracket: accumulatedText.includes(']'),
                      hasStartTime: accumulatedText.includes('startTime'),
                      hasText: accumulatedText.includes('text')
                    });
                  }
                  
                  // Continue accumulating - we'll try parsing again
                  onChunk({
                    text: textPart.text,
                    accumulatedText,
                    subtitles: [],
                    chunkCount,
                    isComplete: false
                  });
                }
              }
            }
          }
        } catch (eventError) {
          console.warn('[StreamingService] Error processing event:', eventError);
        }
      }
    }

    // Final processing
    console.log('[StreamingService] Stream ended, final text length:', accumulatedText.length);

    // If we didn't get a [DONE] signal, still complete with accumulated text
    if (accumulatedText.length > 0) {
      onComplete(accumulatedText);
    } else {
      onError(new Error('No content received from streaming response'));
    }

  } catch (streamError) {
    console.error('[StreamingService] Stream processing error:', streamError);
    onError(streamError);
  }
};

/**
 * Check if streaming is supported for the current model
 * @param {string} modelId - The model ID to check
 * @returns {boolean} - Whether streaming is supported
 */
export const isStreamingSupported = (modelId) => {
  const model = modelId || localStorage.getItem('gemini_model') || "gemini-2.5-flash";
  
  // Most Gemini models support streaming
  const supportedModels = [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite'
  ];
  
  return supportedModels.some(supported => model.includes(supported));
};
