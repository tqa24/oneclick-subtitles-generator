/**
 * Event-stream parsing helpers for narration generation.
 *
 * The server streams Server-Sent-Event-style chunks ("data: <json>\n\n").
 * `splitStreamEvents` extracts complete events from a rolling buffer and
 * `processStreamEvent` parses a single event and dispatches the appropriate
 * callback, returning a directive that tells the caller whether to keep
 * reading or to terminate the generation with a specific return value.
 *
 * The directives let the parsing logic live here without owning parent state:
 * the caller still owns the `results` accumulator, the `narrationServiceInitialized`
 * flag, and the final return value of `generateNarration`.
 */

/**
 * Split the rolling decoder buffer into complete events, returning the parsed
 * events and the leftover (incomplete) buffer tail.
 * @param {string} buffer - accumulated decoded text
 * @returns {{ events: string[], rest: string }}
 */
export const splitStreamEvents = (buffer) => {
  const events = buffer.split('\n\n');
  const rest = events.pop() || ''; // Keep the last incomplete event in the buffer
  return { events, rest };
};

/**
 * Process a single raw event from the stream.
 *
 * Mirrors the original inline switch byte-for-byte. The returned directive's
 * `action` is one of:
 *   - 'continue': nothing special; keep processing the stream.
 *   - 'markInitialized': the caller should set narrationServiceInitialized = true.
 *   - 'return': the caller should immediately return `directive.value` from
 *     generateNarration (used for the 'complete' event and fatal model errors).
 *
 * @param {string} event - a single raw event string (may include the 'data: ' prefix)
 * @param {Object} callbacks - { onProgress, onResult, onError }
 * @param {Array} results - the caller-owned accumulator (mutated in place)
 * @returns {{ action: 'continue' | 'markInitialized' | 'return', value?: Object }}
 */
export const processStreamEvent = (event, callbacks, results) => {
  const { onProgress, onResult, onError } = callbacks;

  if (!(event.trim() && event.startsWith('data: '))) {
    return { action: 'continue' };
  }

  try {
    // Parse the JSON data
    let data;
    try {
      data = JSON.parse(event.substring(6));
    } catch (parseError) {
      return { action: 'continue' };
    }

    // Handle different event types
    if (!data || !data.type) {
      return { action: 'continue' };
    }

    try {
      switch (data.type) {
        case 'progress':
          if (data.message || data.message_key) {
            // Handle both message strings and message keys for localization
            const progressData = {
              message: data.message,
              messageKey: data.message_key,
              current: data.current || 0,
              total: data.total || 0,
              subtitle_id: data.subtitle_id,
              subtitle_text: data.subtitle_text
            };
            onProgress(progressData);
          }
          break;

        case 'result':
          if (data.result) {
            // Add the result to our results array
            results.push(data.result);

            // Call onResult to immediately update the UI with this result
            // This ensures each result is shown as soon as it's received
            onResult(data.result, data.progress || results.length, data.total || 0);
          }
          break;

        case 'error':
          if (data.result) {
            onError(data.result);
          } else if (data.error) {
            onError(data.error);
            // If this is a model initialization error, stop processing
            if (data.error.includes('F5-TTS model initialization failed') ||
                data.error.includes('Error initializing F5-TTS') ||
                data.error.includes('Model is not available')) {
              return { action: 'return', value: { success: false, error: data.error } };
            }
          } else {
            onError('Unknown error occurred');
          }
          break;

        case 'complete':
          // Mark the narration service as initialized and return the results
          return {
            action: 'return',
            markInitialized: true,
            value: { success: true, results: data.results || results }
          };

        default:
          // Handle unknown event types
          console.warn(`Unknown event type received: ${data.type}`);
          break;
      }
    } catch (eventError) {
      // Silently handle event errors
    }
  } catch (error) {
    // Silently handle parsing errors
  }

  return { action: 'continue' };
};
