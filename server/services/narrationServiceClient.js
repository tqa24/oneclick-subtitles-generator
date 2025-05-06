/**
 * Client for communicating with the Python narration service
 */

// Import narration service configuration
const { NARRATION_PORT } = require('../startNarrationService');

/**
 * Check if the narration service is running with multiple attempts
 * @param {number} maxAttempts - Maximum number of connection attempts
 * @param {number} delayMs - Delay between attempts in milliseconds
 * @returns {Promise<Object>} - Status object with available, device, and gpu_info properties
 */
const checkService = async (maxAttempts = 20, delayMs = 10000) => {
  console.log(`Checking narration service with ${maxAttempts} attempts, ${delayMs}ms delay between attempts`);
  console.log(`This may take some time on first run as the Python server needs to initialize...`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxAttempts} to connect to narration service at http://localhost:${NARRATION_PORT}/api/narration/status`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`http://127.0.0.1:${NARRATION_PORT}/api/narration/status`, {
        signal: controller.signal,
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const statusData = await response.json();
        if (statusData.available) {
          console.log(`Narration service is available on attempt ${attempt}/${maxAttempts}! Device: ${statusData.device}`);
          return {
            available: true,
            device: statusData.device || 'cpu',
            gpu_info: statusData.gpu_info || {}
          };
        }
      }

      // If we reach here, the service is not available yet
      if (attempt < maxAttempts) {
        console.log(`Narration service not available on attempt ${attempt}/${maxAttempts}, waiting ${delayMs}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      if (attempt < maxAttempts) {
        console.log(`Error connecting to narration service on attempt ${attempt}/${maxAttempts}: ${error.message}`);
        console.log(`Waiting ${delayMs}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        console.log(`Failed to connect to narration service after ${maxAttempts} attempts: ${error.message}`);
      }
    }
  }

  console.log(`Narration service not available after ${maxAttempts} attempts`);
  return { available: false, device: 'none', gpu_info: {} };
};

/**
 * Fetch an audio file from the narration service
 * @param {string} filename - The filename to fetch
 * @returns {Promise<Object>} - Object containing the audio buffer and content type
 */
const fetchAudioFile = async (filename) => {
  const narrationUrl = `http://127.0.0.1:${NARRATION_PORT}/api/narration/audio/${filename}`;
  console.log(`Proxying to: ${narrationUrl}`);

  const response = await fetch(narrationUrl, {
    mode: 'cors',
    credentials: 'include',
    headers: {
      'Accept': '*/*'
    }
  });

  if (!response.ok) {
    console.error(`Error from narration service: ${response.status}`);
    throw new Error(`Audio file not found: ${response.status}`);
  }

  // Get the content type
  const contentType = response.headers.get('content-type');

  // Get the binary data
  const buffer = await response.arrayBuffer();

  return {
    buffer: Buffer.from(buffer),
    contentType
  };
};

/**
 * Generate narration using the narration service
 * @param {string} reference_audio - Reference audio filename
 * @param {string} reference_text - Reference text
 * @param {Array} subtitles - Array of subtitle objects
 * @param {Object} settings - Settings for narration generation
 * @param {Object} res - Express response object for streaming support
 * @returns {Promise<Object|null>} - Narration results or null if streaming
 */
// Import the enhanceF5TTSNarrations function
const { enhanceF5TTSNarrations } = require('../controllers/narration/audioFileController');

const generateNarration = async (reference_audio, reference_text, subtitles, settings, res) => {
  const narrationUrl = `http://127.0.0.1:${NARRATION_PORT}/api/narration/generate`;

  try {
    // Check the content type of the response to determine how to handle it
    const headResponse = await fetch(narrationUrl, {
      method: 'HEAD',
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*'
      }
    }).catch(() => null);

    // If the service supports streaming (SSE), use a pipe to forward the stream
    const isStreamingSupported = headResponse &&
      headResponse.headers.get('content-type') &&
      headResponse.headers.get('content-type').includes('text/event-stream');

    if (isStreamingSupported) {
      console.log('Narration service supports streaming, forwarding stream');

      // Forward the request to the F5-TTS service with streaming response
      const streamResponse = await fetch(narrationUrl, {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          reference_audio,
          reference_text,
          subtitles,
          settings: {
            ...settings,
            // Ensure the skipClearOutput flag is passed to the Python service
            skipClearOutput: settings && settings.skipClearOutput === true
          }
        })
      });

      if (!streamResponse.ok) {
        const errorText = await streamResponse.text();
        console.error(`Error from narration service: ${streamResponse.status} ${errorText}`);
        throw new Error(`Error from narration service: ${streamResponse.status} ${errorText}`);
      }

      // Set up the response headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Create a readable stream from the response body
      const reader = streamResponse.body.getReader();

      // Pipe the stream to the response
      const pipe = async () => {
        try {
          console.log('Starting to pipe streaming response to client');

          // Track all results for enhancement
          const allResults = [];

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              console.log('Stream complete');

              // Send a final enhanced complete event if we have results
              if (allResults.length > 0) {
                console.log(`Enhancing ${allResults.length} F5-TTS narration results with timing information`);
                const enhancedResults = enhanceF5TTSNarrations(allResults, subtitles);

                // Send the enhanced complete event
                const completeEvent = {
                  type: 'complete',
                  results: enhancedResults,
                  total: enhancedResults.length,
                  enhanced: true
                };

                const completeEventData = `data: ${JSON.stringify(completeEvent)}\n\n`;
                res.write(completeEventData);
              }

              res.end();
              break;
            }

            // Decode the chunk
            const chunk = new TextDecoder().decode(value);

            // Check if this is a result event
            try {
              // Parse each line that starts with "data: "
              const lines = chunk.split('\n');
              let modifiedChunk = '';

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  // Extract the JSON data
                  const jsonData = line.substring(6); // Remove "data: " prefix

                  try {
                    const eventData = JSON.parse(jsonData);

                    // If this is a result event, track the result
                    if (eventData.type === 'result' && eventData.result) {
                      allResults.push(eventData.result);

                      // Enhance the result with timing information
                      const enhancedResult = enhanceF5TTSNarrations([eventData.result], subtitles)[0];
                      eventData.result = enhancedResult;

                      // Add more detailed progress information
                      console.log(`Processing subtitle ${eventData.progress}/${eventData.total} (ID: ${eventData.result.subtitle_id})`);

                      // Add a progress event before the result to provide more detailed status
                      const progressEvent = {
                        type: 'progress',
                        message: `Processing subtitle ${eventData.progress}/${eventData.total} (ID: ${eventData.result.subtitle_id})`,
                        current: eventData.progress,
                        total: eventData.total,
                        subtitle_id: eventData.result.subtitle_id
                      };

                      // Write the progress event first
                      modifiedChunk += `data: ${JSON.stringify(progressEvent)}\n\n`;

                      // Then write the result event
                      modifiedChunk += `data: ${JSON.stringify(eventData)}\n\n`;
                      continue;
                    }

                    // If this is a complete event, enhance all results
                    if (eventData.type === 'complete' && eventData.results) {
                      console.log(`Enhancing ${eventData.results.length} F5-TTS narration results with timing information`);
                      eventData.results = enhanceF5TTSNarrations(eventData.results, subtitles);
                      eventData.enhanced = true;

                      // Replace the line with the enhanced data
                      modifiedChunk += `data: ${JSON.stringify(eventData)}\n\n`;
                      continue;
                    }
                  } catch (jsonError) {
                    // If JSON parsing fails, just use the original line
                    console.error(`Error parsing JSON in SSE chunk: ${jsonError.message}`);
                  }
                }

                // If we didn't modify this line, add it as-is
                modifiedChunk += line + '\n';
              }

              // Write the modified chunk
              res.write(modifiedChunk);
            } catch (parseError) {
              // If parsing fails, just forward the original chunk
              console.error(`Error processing SSE chunk: ${parseError.message}`);
              res.write(chunk);
            }

            // Flush the response to ensure it's sent immediately
            if (res.flush) {
              res.flush();
            }
          }
        } catch (error) {
          console.error('Error piping stream:', error);
          res.end();
        }
      };

      // Start piping
      pipe();

      // Return null to indicate that we're handling the response via streaming
      return null;
    }

    // If streaming is not supported, fall back to regular JSON response
    console.log('Narration service does not support streaming, using regular JSON response');

    // Forward the request to the F5-TTS service
    const response = await fetch(narrationUrl, {
      method: 'POST',
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        reference_audio,
        reference_text,
        subtitles,
        settings: {
          ...settings,
          // Ensure the skipClearOutput flag is passed to the Python service
          skipClearOutput: settings && settings.skipClearOutput === true
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error from narration service: ${response.status} ${errorText}`);
      throw new Error(`Error from narration service: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log(`Narration service returned ${result.results ? result.results.length : 0} results`);

    // Enhance F5-TTS narration results with timing information from subtitles
    if (result.results && result.results.length > 0) {
      console.log('Enhancing F5-TTS narration results with timing information');
      result.results = enhanceF5TTSNarrations(result.results, subtitles);
    }

    return result;
  } catch (error) {
    console.error(`Error using narration service: ${error.message}`);
    throw error;
  }
};

/**
 * Proxy a request to the narration service
 * @param {string} url - The URL path to proxy
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} - Response data
 */
const proxyRequest = async (url, options) => {
  const narrationUrl = `http://127.0.0.1:${NARRATION_PORT}/api/narration${url}`;

  try {
    // Add CORS options to the request
    const corsOptions = {
      ...options,
      mode: 'cors',
      credentials: 'include',
      headers: {
        ...options.headers,
        'Accept': options.headers?.['Accept'] || '*/*'
      }
    };

    const response = await fetch(narrationUrl, corsOptions);

    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      // Parse as JSON
      return await response.json();
    } else {
      // Not JSON, return the text
      return await response.text();
    }
  } catch (error) {
    console.error(`Error proxying to narration service: ${error.message}`);
    throw error;
  }
};

/**
 * Get the narration service port
 * @returns {number} - The narration service port
 */
const getNarrationPort = () => {
  return NARRATION_PORT;
};

module.exports = {
  checkService,
  fetchAudioFile,
  generateNarration,
  proxyRequest,
  getNarrationPort
};
