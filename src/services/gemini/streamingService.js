/**
 * Gemini API Streaming Service
 * Handles streaming responses from Gemini API with real-time subtitle processing
 */

import { getNextAvailableKey } from './keyManager';
import { getTranscriptionPrompt } from './promptManagement';
import { parseGeminiResponse } from '../../utils/subtitle';
import { createSubtitleSchema, addResponseSchema } from '../../utils/schemaUtils';

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
            { text: promptText },
            {
              file_data: {
                file_uri: fileUri,
                mime_type: file.type
              }
            }
          ]
        }
      ]
    };

    // Add video metadata if provided
    if (videoMetadata && !isAudio) {
      requestData.contents[0].parts[1].video_metadata = videoMetadata;
    }

    // Add structured output schema
    const isUserProvided = userProvidedSubtitles && userProvidedSubtitles.trim() !== '';
    requestData = addResponseSchema(requestData, createSubtitleSchema(isUserProvided), isUserProvided);

    // Add generation config with media resolution if provided
    if (mediaResolution) {
      if (!requestData.generationConfig) {
        requestData.generationConfig = {};
      }
      requestData.generationConfig.mediaResolution = mediaResolution;
    }

    console.log('[StreamingService] Starting streaming request with model:', MODEL);

    // Make streaming request
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

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorData}`);
    }

    // Process streaming response
    await processStreamingResponse(response, onChunk, onComplete, onError);

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
 */
const processStreamingResponse = async (response, onChunk, onComplete, onError) => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulatedText = '';
  let chunkCount = 0;

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

          if (eventData && eventData.candidates && eventData.candidates.length > 0) {
            const candidate = eventData.candidates[0];
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
                  if (parsedSubtitles && parsedSubtitles.length > 0) {
                    // Call the chunk callback with parsed subtitles
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
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash-thinking-exp-01-21',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
  ];
  
  return supportedModels.some(supported => model.includes(supported));
};
