/**
 * Gemini API Streaming Service
 * Handles streaming responses from Gemini API with real-time subtitle processing
 */

import { getNextAvailableKey } from './keyManager';
import { getTranscriptionPrompt } from './promptManagement';
import { parseGeminiResponse } from '../../utils/subtitle';
import { createSubtitleSchema, addResponseSchema } from '../../utils/schemaUtils';
import { addThinkingConfig } from '../../utils/thinkingBudgetUtils';

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
  const { userProvidedSubtitles, modelId, videoMetadata, mediaResolution } = options;
  const MODEL = modelId || localStorage.getItem('gemini_model') || "gemini-2.5-flash";
  
  // Log which model is being used for debugging
  console.log('[StreamingService] Model selected:', MODEL);
  
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
        body: JSON.stringify(requestData)
      }
    );

    console.log('[StreamingService] Response status:', response.status);
    console.log('[StreamingService] Response headers:', [...response.headers.entries()]);
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('[StreamingService] Error response body:', errorData);
      throw new Error(`Gemini API error: ${response.status} - ${errorData}`);
    }

    // Process streaming response with options for early termination
    await processStreamingResponse(response, onChunk, onComplete, onError, options);

  } catch (error) {
    console.error('[StreamingService] Error:', error);
    onError(error);
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
  
  // Extract segment end offset if provided
  const segmentEndOffset = options?.segmentInfo?.endOffset || null;
  let shouldTerminate = false;
  let lastValidSubtitleEndTime = 0;

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
            console.log('[StreamingService] Event data received:', JSON.stringify(eventData).substring(0, 200));
            
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
                
                console.log(`[StreamingService] Chunk ${chunkCount}:`, textPart.text.substring(0, 100) + '...');
                
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
                  // Find the last subtitle that's within the segment bounds
                  let validSubtitles = [];
                  let foundExceeding = false;
                  
                  for (const subtitle of parsedSubtitles) {
                    if (subtitle.start <= segmentEndOffset) {
                      validSubtitles.push(subtitle);
                      lastValidSubtitleEndTime = Math.max(lastValidSubtitleEndTime, subtitle.end || subtitle.start);
                    } else {
                      // Found subtitle that exceeds segment end
                      foundExceeding = true;
                      console.log(`[StreamingService] Found subtitle exceeding segment end (${subtitle.start} > ${segmentEndOffset}), preparing to terminate...`);
                    }
                  }
                  
                  // If we found subtitles exceeding the segment, terminate after this chunk
                  if (foundExceeding) {
                    shouldTerminate = true;
                    
                    // Send only valid subtitles
                    if (validSubtitles.length > 0) {
                      onChunk({
                        text: textPart.text,
                        accumulatedText,
                        subtitles: validSubtitles,
                        chunkCount,
                        isComplete: false
                      });
                    }
                    
                    // Terminate the stream
                    console.log(`[StreamingService] Terminating stream - reached segment end offset at ${segmentEndOffset}`);
                    reader.cancel(); // Cancel the reader to stop receiving more data
                    onComplete(accumulatedText);
                    return;
                  } else {
                    // All subtitles are valid, send them normally
                    onChunk({
                      text: textPart.text,
                      accumulatedText,
                      subtitles: validSubtitles,
                      chunkCount,
                      isComplete: false
                    });
                  }
                } else if (parsedSubtitles && parsedSubtitles.length > 0) {
                  // No segment limit, send all subtitles
                  onChunk({
                    text: textPart.text,
                    accumulatedText,
                    subtitles: parsedSubtitles,
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
                  // Parsing failed, but that's okay - we'll try again with more text
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
