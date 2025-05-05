/**
 * Gemini WebSocket client for audio generation
 * Based on the MultimodalLiveClient from live-api-web-console
 */

import { EventEmitter } from 'events';
import { blobToJSON } from '../utils/blobUtils';
import { 
  base64ToArrayBuffer, 
  convertPcmBase64ToWavBase64 
} from '../utils/audioUtils';

/**
 * Client for connecting to Gemini WebSocket API
 */
export class GeminiWebSocketClient extends EventEmitter {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
    this.ws = null;
    // Use the exact same URL format as in the live-api-web-console
    this.url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    this.config = null;

    // Track active requests
    this.activeRequests = new Map();
    this.requestCounter = 0;
  }

  /**
   * Connect to the WebSocket API
   * @param {Object} config - Configuration for the session
   * @returns {Promise<boolean>} - Whether connection was successful
   */
  connect(config) {
    this.config = config;

    // Log the configuration being used
    console.log('Connecting with config:', JSON.stringify({
      model: config.model,
      responseModalities: config.generationConfig?.responseModalities,
      voiceName: config.generationConfig?.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName
    }));

    const ws = new WebSocket(this.url);

    // Set a timeout for the connection
    const connectionTimeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close();
        console.error('WebSocket connection timeout');
        this.emit('error', new Error('WebSocket connection timeout'));
      }
    }, 10000); // 10 second timeout

    ws.addEventListener('message', async (evt) => {
      if (evt.data instanceof Blob) {
        this.receive(evt.data);
      } else {
        console.log('Non-blob message received:', evt);
      }
    });

    return new Promise((resolve, reject) => {
      const onError = (ev) => {
        clearTimeout(connectionTimeout);
        this.disconnect(ws);
        const message = `Could not connect to "${this.url}"`;
        console.error(`WebSocket error: ${message}`, ev);
        reject(new Error(message));
      };

      ws.addEventListener('error', onError);

      ws.addEventListener('open', () => {
        clearTimeout(connectionTimeout);

        if (!this.config) {
          reject('Invalid config sent to connect()');
          return;
        }

        console.log('Connected to Gemini WebSocket API');
        this.emit('open');

        this.ws = ws;

        // Send setup message
        const setupMessage = {
          setup: this.config
        };
        this._sendDirect(setupMessage);
        console.log('Setup message sent');

        ws.removeEventListener('error', onError);

        ws.addEventListener('close', (ev) => {
          this.disconnect(ws);
          let reason = ev.reason || '';
          console.log(`WebSocket disconnected ${reason ? `with reason: ${reason}` : ''}`);
          this.emit('close', ev);
        });

        resolve(true);
      });
    });
  }

  /**
   * Disconnect from the WebSocket API
   * @param {WebSocket} ws - WebSocket to disconnect
   * @returns {boolean} - Whether disconnection was successful
   */
  disconnect(ws) {
    if ((!ws || this.ws === ws) && this.ws) {
      this.ws.close();
      this.ws = null;
      console.log('Disconnected from Gemini WebSocket API');
      return true;
    }
    return false;
  }

  /**
   * Wait for a response to a specific request
   * @param {string} requestId - Request ID to wait for
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<Object>} - Response data
   */
  waitForResponse(requestId, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
      // Check if we already have a response
      const requestInfo = this.activeRequests.get(requestId);
      if (!requestInfo) {
        return reject(new Error(`No request found with ID ${requestId}`));
      }

      if (requestInfo.completed && requestInfo.responseData) {
        return resolve(requestInfo.responseData);
      }

      // Initialize audio data collection
      let audioChunks = [];
      let mimeType = null;
      let sampleRate = 24000; // Default sample rate
      let turnCompleteReceived = false;

      // Set up a timeout for the initial response
      const initialTimeout = setTimeout(() => {
        this.removeListener('message', messageHandler);
        reject(new Error(`Timeout waiting for initial response to request ${requestId}`));
      }, timeoutMs);

      // Set up a timeout for turn completion
      let turnCompleteTimeout = null;

      // Set up a message handler
      const messageHandler = (response) => {
        // Reset the initial timeout on any message
        clearTimeout(initialTimeout);

        // Check if this is a turn complete event
        if (response.serverContent && response.serverContent.turnComplete) {
          console.log(`Turn complete received for request ${requestId}`);
          turnCompleteReceived = true;

          // If we have audio data, resolve after a short delay to ensure we've received all chunks
          if (audioChunks.length > 0) {
            turnCompleteTimeout = setTimeout(() => {
              // Combine all audio chunks
              const combinedAudioData = audioChunks.join('');
              console.log(`Combined audio data: ${combinedAudioData.length} bytes for request ${requestId}`);

              // Convert PCM base64 to WAV base64 immediately
              try {
                console.log(`Converting PCM to WAV for request ${requestId}`);

                // Log a sample of the PCM data for debugging
                if (combinedAudioData.length > 20) {
                  console.log(`PCM data sample: ${combinedAudioData.substring(0, 20)}...`);
                } else {
                  console.log(`PCM data: ${combinedAudioData}`);
                }

                const wavAudioData = convertPcmBase64ToWavBase64(combinedAudioData, sampleRate);
                console.log(`Converted to WAV format: ${wavAudioData.length} bytes for request ${requestId}`);

                // Verify the WAV data starts with RIFF header
                try {
                  const headerChars = atob(wavAudioData.substring(0, 8));
                  console.log(`WAV header check in response: ${headerChars}`);
                  if (!headerChars.startsWith('RIFF')) {
                    console.warn(`WAV data does not start with RIFF header for request ${requestId}`);
                  }
                } catch (headerError) {
                  console.error(`Error checking WAV header for request ${requestId}:`, headerError);
                }

                // Store the response data with WAV format
                const responseData = {
                  audioData: wavAudioData,
                  mimeType: 'audio/wav', // Update MIME type to WAV
                  sampleRate: sampleRate,
                  originalMimeType: mimeType, // Keep the original MIME type for reference
                  conversionTimestamp: Date.now() // Add a timestamp for debugging
                };

                // Update the request info
                requestInfo.responseData = responseData;
                requestInfo.completed = true;
                this.activeRequests.set(requestId, requestInfo);

                // Clean up
                this.removeListener('message', messageHandler);

                // Resolve with the response data
                resolve(responseData);
              } catch (error) {
                console.error(`Error converting PCM to WAV for request ${requestId}:`, error);

                // If conversion fails, return the original PCM data
                const responseData = {
                  audioData: combinedAudioData,
                  mimeType: mimeType,
                  sampleRate: sampleRate,
                  conversionError: error.message
                };

                // Update the request info
                requestInfo.responseData = responseData;
                requestInfo.completed = true;
                this.activeRequests.set(requestId, requestInfo);

                // Clean up
                this.removeListener('message', messageHandler);

                // Resolve with the response data
                resolve(responseData);
              }
            }, 500); // Wait 500ms after turn complete to ensure we've received all chunks
          }
          return;
        }

        // Check if this is a model turn with audio
        if (response.serverContent && response.serverContent.modelTurn) {
          const parts = response.serverContent.modelTurn.parts || [];

          // Extract audio parts
          const audioParts = parts.filter(
            (p) => p.inlineData && p.inlineData.mimeType &&
                  (p.inlineData.mimeType.startsWith('audio/') ||
                   p.inlineData.mimeType.includes('audio/pcm'))
          );

          if (audioParts.length > 0) {
            console.log(`Found ${audioParts.length} audio parts for request ${requestId}`);

            // Process all audio parts
            for (const part of audioParts) {
              const audioData = part.inlineData.data;

              // Store the MIME type if not already set
              if (!mimeType) {
                mimeType = part.inlineData.mimeType;

                // Extract sample rate from mime type if available
                if (mimeType.includes('rate=')) {
                  const rateMatch = mimeType.match(/rate=(\d+)/);
                  if (rateMatch && rateMatch[1]) {
                    sampleRate = parseInt(rateMatch[1], 10);
                    console.log(`Detected sample rate: ${sampleRate}Hz for request ${requestId}`);
                  }
                }
              }

              // Add this chunk to our collection
              audioChunks.push(audioData);
              console.log(`Added audio chunk: ${audioData.length} bytes, total chunks: ${audioChunks.length} for request ${requestId}`);
            }

            // If turn complete was already received, resolve now
            if (turnCompleteReceived && turnCompleteTimeout) {
              clearTimeout(turnCompleteTimeout);

              // Combine all audio chunks
              const combinedAudioData = audioChunks.join('');
              console.log(`Combined audio data: ${combinedAudioData.length} bytes for request ${requestId}`);

              // Convert PCM base64 to WAV base64 immediately
              try {
                console.log(`Converting PCM to WAV for request ${requestId}`);

                // Log a sample of the PCM data for debugging
                if (combinedAudioData.length > 20) {
                  console.log(`PCM data sample: ${combinedAudioData.substring(0, 20)}...`);
                } else {
                  console.log(`PCM data: ${combinedAudioData}`);
                }

                const wavAudioData = convertPcmBase64ToWavBase64(combinedAudioData, sampleRate);
                console.log(`Converted to WAV format: ${wavAudioData.length} bytes for request ${requestId}`);

                // Verify the WAV data starts with RIFF header
                try {
                  const headerChars = atob(wavAudioData.substring(0, 8));
                  console.log(`WAV header check in response: ${headerChars}`);
                  if (!headerChars.startsWith('RIFF')) {
                    console.warn(`WAV data does not start with RIFF header for request ${requestId}`);
                  }
                } catch (headerError) {
                  console.error(`Error checking WAV header for request ${requestId}:`, headerError);
                }

                // Store the response data with WAV format
                const responseData = {
                  audioData: wavAudioData,
                  mimeType: 'audio/wav', // Update MIME type to WAV
                  sampleRate: sampleRate,
                  originalMimeType: mimeType, // Keep the original MIME type for reference
                  conversionTimestamp: Date.now() // Add a timestamp for debugging
                };

                // Update the request info
                requestInfo.responseData = responseData;
                requestInfo.completed = true;
                this.activeRequests.set(requestId, requestInfo);

                // Clean up
                this.removeListener('message', messageHandler);

                // Resolve with the response data
                resolve(responseData);
              } catch (error) {
                console.error(`Error converting PCM to WAV for request ${requestId}:`, error);

                // If conversion fails, return the original PCM data
                const responseData = {
                  audioData: combinedAudioData,
                  mimeType: mimeType,
                  sampleRate: sampleRate,
                  conversionError: error.message
                };

                // Update the request info
                requestInfo.responseData = responseData;
                requestInfo.completed = true;
                this.activeRequests.set(requestId, requestInfo);

                // Clean up
                this.removeListener('message', messageHandler);

                // Resolve with the response data
                resolve(responseData);
              }
            }
          }
        }
      };

      // Listen for messages
      this.on('message', messageHandler);
    });
  }

  /**
   * Process incoming messages from the WebSocket
   * @param {Blob} blob - Message data
   */
  async receive(blob) {
    try {
      const response = await blobToJSON(blob);
      if (!response) {
        console.log('Received empty or invalid JSON response');
        return;
      }

      // Log the raw response for debugging
      console.log('Received WebSocket message:', JSON.stringify(response, null, 2));

      // Emit the raw message for custom handlers
      this.emit('message', response);

      // Handle tool call messages
      if (response.toolCall) {
        console.log('Tool call received:', response.toolCall);
        this.emit('toolcall', response.toolCall);
        return;
      }

      // Handle tool call cancellation messages
      if (response.toolCallCancellation) {
        console.log('Tool call cancellation received:', response.toolCallCancellation);
        this.emit('toolcallcancellation', response.toolCallCancellation);
        return;
      }

      // Handle setup complete messages
      if (response.setupComplete) {
        console.log('Setup complete');
        this.emit('setupcomplete');
        return;
      }

      // Handle error messages
      if (response.error) {
        console.error('Error received from Gemini API:', response.error);
        this.emit('error', new Error(response.error.message || 'Unknown error from Gemini API'));
        return;
      }

      // Handle content messages
      if (response.serverContent) {
        const { serverContent } = response;

        // Handle interruption
        if (serverContent.interrupted) {
          console.log('Generation interrupted');
          this.emit('interrupted');
          return;
        }

        // Handle turn completion
        if (serverContent.turnComplete) {
          console.log('Turn complete');
          this.emit('turncomplete');
        }

        // Handle model turn with audio
        if (serverContent.modelTurn) {
          let parts = serverContent.modelTurn.parts || [];
          console.log('Received model turn with parts:', parts);

          // Extract audio parts
          const audioParts = parts.filter(
            (p) => p.inlineData && p.inlineData.mimeType &&
                  (p.inlineData.mimeType.startsWith('audio/') ||
                   p.inlineData.mimeType.includes('audio/pcm'))
          );

          console.log(`Found ${audioParts.length} audio parts`);

          // Process audio data
          for (const part of audioParts) {
            if (part.inlineData && part.inlineData.data) {
              const audioData = part.inlineData.data; // Base64 encoded audio
              const mimeType = part.inlineData.mimeType;
              console.log(`Processing audio data of type ${mimeType}`);

              // Extract sample rate from mime type if available
              let sampleRate = 24000; // Default sample rate
              if (mimeType.includes('rate=')) {
                const rateMatch = mimeType.match(/rate=(\d+)/);
                if (rateMatch && rateMatch[1]) {
                  sampleRate = parseInt(rateMatch[1], 10);
                  console.log(`Detected sample rate: ${sampleRate}Hz`);
                }
              }

              const audioBuffer = base64ToArrayBuffer(audioData);
              this.emit('audio', audioData, audioBuffer, mimeType, sampleRate);
            }
          }

          // Extract text parts
          const textParts = parts.filter(p => p.text);
          if (textParts.length > 0) {
            const textContent = textParts.map(p => p.text).join(' ');
            console.log(`Received text content: ${textContent}`);
            this.emit('text', textContent);
          }

          // Emit the full content
          this.emit('content', serverContent);
        }
      } else {
        console.log('Unmatched message received:', response);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      this.emit('error', error);
    }
  }

  /**
   * Send a message to the WebSocket API
   * @param {Array|Object} parts - Content parts to send
   * @param {boolean} turnComplete - Whether this is the end of the turn
   * @param {Object} options - Additional options
   * @returns {string} - Request ID
   */
  send(parts, turnComplete = true, options = {}) {
    // Format parts correctly
    parts = Array.isArray(parts) ? parts : [parts];

    // Create a unique request ID
    const requestId = options.requestId || `req_${++this.requestCounter}_${Date.now()}`;

    // Create the content object with the correct structure
    const content = {
      role: 'user',
      parts
    };

    // Create the clientContent request with the correct structure
    // This matches the format used in the live-api-web-console
    const clientContentRequest = {
      clientContent: {
        turns: [content],
        turnComplete
      }
    };

    // Store the request in our active requests map
    this.activeRequests.set(requestId, {
      request: clientContentRequest,
      timestamp: Date.now(),
      options,
      responseData: null,
      completed: false
    });

    // Send the request
    this._sendDirect(clientContentRequest);
    console.log(`Message sent with ID ${requestId}:`, JSON.stringify(clientContentRequest, null, 2));

    return requestId;
  }

  /**
   * Send a message directly to the WebSocket
   * @param {Object} request - Message to send
   * @private
   */
  _sendDirect(request) {
    if (!this.ws) {
      throw new Error('WebSocket is not connected');
    }
    const str = JSON.stringify(request);
    this.ws.send(str);
  }
}
