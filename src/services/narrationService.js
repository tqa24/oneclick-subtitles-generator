/**
 * Narration service for F5-TTS integration
 */

import { API_BASE_URL, SERVER_URL } from '../config';
import { toBase64 } from '../utils/fileUtils';
import { splitStreamEvents, processStreamEvent } from './narrationStreamParser';

// Re-export the audio handler wrappers so the module's public surface is unchanged.
export {
  uploadReferenceAudio,
  saveRecordedAudio,
  extractAudioSegment,
  getExampleAudioList,
  uploadExampleAudio
} from './narrationAudioHandlers';

// Re-export the service availability checks.
export {
  checkNarrationStatus,
  checkNarrationStatusWithRetry
} from './narrationStatusChecker';

/**
 * Save an audio blob to the server as base64 JSON; returns the saved filename.
 * Shared by the per-engine narration save paths (Chatterbox, Gemini, …).
 * @param {object} opts
 * @param {Blob} opts.audioBlob - the audio to persist
 * @param {string|number} opts.subtitleId - subtitle this audio belongs to
 * @param {string} opts.endpoint - server path, e.g. '/api/narration/save-chatterbox-audio'
 * @param {number} [opts.sampleRate] - sample rate hint for the server
 * @param {string} [opts.mimeType='audio/wav'] - mime type hint
 * @returns {Promise<string>} the saved filename
 */
export const saveBase64AudioToServer = async ({ audioBlob, subtitleId, endpoint, sampleRate, mimeType = 'audio/wav' }) => {
  const audioData = await toBase64(audioBlob);

  const response = await fetch(`${SERVER_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioData, subtitle_id: subtitleId, sampleRate, mimeType }),
  });

  if (!response.ok) {
    throw new Error(`Server responded with ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  if (data.success) {
    return data.filename;
  }
  throw new Error(data.error || 'Unknown error saving audio to server');
};

// Create a global AbortController for narration generation
let narrationAbortController = null;

// Flag to track if the narration service has been initialized
let narrationServiceInitialized = false;

/**
 * Cancel ongoing narration generation
 * @returns {boolean} - Whether cancellation was successful
 */
export const cancelNarrationGeneration = () => {
  if (narrationAbortController) {
    // Removed cancellation logging
    narrationAbortController.abort();
    narrationAbortController = null;
    return true;
  }
  return false;
};

/**
 * Clear all narration output files for fresh generation
 * @returns {Promise<boolean>} - Whether clearing was successful
 */
export const clearNarrationOutput = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/narration/clear-output`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      // Removed error logging
      return false;
    }

    // Just consume the response to avoid memory leaks, but don't store it
    await response.json();
    return true;
  } catch (error) {
    // Removed error logging
    return false;
  }
};

/**
 * Generate narration for subtitles with streaming response
 * @param {string} referenceAudio - Path to reference audio file
 * @param {string} referenceText - Reference text for the audio
 * @param {Array} subtitles - Array of subtitle objects
 * @param {Object} settings - Advanced settings for narration generation
 * @param {Function} onProgress - Callback for progress updates
 * @param {Function} onResult - Callback for each result
 * @param {Function} onError - Callback for errors
 * @param {Function} onComplete - Callback for completion
 * @returns {Promise<Object>} - Generation response
 */
export const generateNarration = async (
  referenceAudio,
  referenceText,
  subtitles,
  settings = {},
  onProgress = () => {},
  onResult = () => {},
  onError = () => {},
  onComplete = () => {}
) => {
  try {
    // Check if we should skip clearing the output directory
    // This is used for retrying a single narration to avoid deleting all other narrations
    const skipClearOutput = settings && settings.skipClearOutput === true;

    if (!skipClearOutput) {
      // Clear all narration output files before generating new ones
      await clearNarrationOutput();
    }

    // Initial progress message for waking up the server - only on first run
    // Send message keys instead of hardcoded text for proper localization
    if (!narrationServiceInitialized) {
      onProgress({ messageKey: 'initializingService' });
    } else {
      onProgress({ messageKey: 'preparingNarration' });
    }
    // Create a new AbortController for this request
    narrationAbortController = new AbortController();
    const signal = narrationAbortController.signal;

    // Create a fetch request with streaming response
    const response = await fetch(`${API_BASE_URL}/narration/generate`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        reference_audio: referenceAudio,
        reference_text: referenceText,
        subtitles: subtitles,
        settings: settings
      }),
      signal // Add the abort signal to the fetch request
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errorText}`);
    }

    // Check if the response is a stream
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/event-stream')) {
      // Handle streaming response

      // Create a reader for the response body
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const results = [];
      const callbacks = { onProgress, onResult, onError };

      // Process the stream
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode the chunk and add it to the buffer
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process complete events in the buffer
        const { events, rest } = splitStreamEvents(buffer);
        buffer = rest;

        for (const event of events) {
          const directive = processStreamEvent(event, callbacks, results);

          if (directive.action === 'return') {
            if (directive.markInitialized) {
              // Mark the narration service as initialized
              narrationServiceInitialized = true;
              onComplete(directive.value.results);
            }
            return directive.value;
          }
        }
      }

      // If we get here, the stream ended without a complete event
      onComplete(results);
      return { success: true, results };
    } else if (contentType && contentType.includes('application/json')) {
      // Handle regular JSON response (fallback)
      const data = await response.json();

      if (data.results) {
        // Call onResult for each result
        data.results.forEach((result, index) => {
          onResult(result, index + 1, data.results.length);
        });

        // Mark the narration service as initialized
        narrationServiceInitialized = true;

        // Call onComplete with all results
        onComplete(data.results);
      }

      return data;
    } else {
      // Handle unexpected content type
      await response.text(); // Read the response body to avoid memory leaks
      throw new Error(`Unexpected content type: ${contentType}`);
    }
  } catch (error) {
    // Clean up the AbortController
    narrationAbortController = null;

    // Check if this is an abort error
    if (error.name === 'AbortError') {
      const cancelError = new Error('Narration generation cancelled by user');
      cancelError.cancelled = true;
      onError(cancelError);
      return { success: false, cancelled: true, error: 'Cancelled by user' };
    }

    // Handle other errors
    onError(error);
    throw error;
  }
};

/**
 * Get audio file URL
 * @param {string} filename - Audio filename or path (can include subtitle directory)
 * @returns {string} - Audio file URL
 */
export const getAudioUrl = (filename) => {
  if (!filename) return '';

  // Handle both legacy filenames and new directory structure
  // The filename might already include the subtitle directory path
  return `${SERVER_URL}/api/narration/audio/${filename}`;
};
