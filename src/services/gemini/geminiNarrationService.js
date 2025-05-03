/**
 * Gemini narration service for generating narration using Gemini API with WebSocket for audio
 */

import { GeminiWebSocketClient } from './geminiWebSocketClient';

// Cache for WebSocket clients to avoid creating multiple connections
const clientCache = {
  client: null,
  apiKey: null,
  connected: false,
  connecting: false,
  setupComplete: false,
  supportedModels: null
};

/**
 * List available Gemini models
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Array>} - List of available models
 */
export const listGeminiModels = async (apiKey) => {
  try {
    if (!apiKey) {
      apiKey = localStorage.getItem('gemini_api_key');
      if (!apiKey) {
        throw new Error('Gemini API key not found');
      }
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('Error listing Gemini models:', error);
    throw error;
  }
};

/**
 * Find a suitable model for audio generation
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<string>} - Model name
 */
export const findSuitableAudioModel = async (apiKey) => {
  try {
    // Known working model for WebSocket API with audio
    // Use the exact same model format as in the live-api-web-console
    const knownWorkingModel = 'models/gemini-2.0-flash-exp';

    // If we already have a list of supported models, check if our known working model is in it
    if (clientCache.supportedModels) {
      const knownModel = clientCache.supportedModels.find(model =>
        model.name.includes(knownWorkingModel)
      );

      if (knownModel) {
        console.log(`Using known WebSocket-compatible model: ${knownWorkingModel}`);
        // Return the full model path as used in the live-api-web-console
        return knownWorkingModel;
      }

      // If not, find any model that supports audio generation
      const audioModel = clientCache.supportedModels.find(model =>
        model.supportedGenerationMethods?.includes('generateContent') &&
        model.supportedGenerationMethods?.includes('streamGenerateContent')
      );

      if (audioModel) {
        console.log(`Using cached audio-capable model: ${audioModel.name}`);
        return audioModel.name; // Use the full model name with path
      }
    }

    // Otherwise, fetch the list of models
    const models = await listGeminiModels(apiKey);
    clientCache.supportedModels = models;

    // Log all models for debugging
    console.log('Available Gemini models:', models.map(m => ({
      name: m.name,
      displayName: m.displayName,
      supportedGenerationMethods: m.supportedGenerationMethods
    })));

    // First, check if our known working model is available
    const knownModel = models.find(model =>
      model.name.includes(knownWorkingModel)
    );

    if (knownModel) {
      console.log(`Using known WebSocket-compatible model: ${knownWorkingModel}`);
      // Return the full model path as used in the live-api-web-console
      return knownWorkingModel;
    }

    // Find models that support both generateContent and streamGenerateContent
    // These are likely to work with the WebSocket API
    const potentialModels = models.filter(model =>
      model.supportedGenerationMethods?.includes('generateContent') &&
      model.supportedGenerationMethods?.includes('streamGenerateContent')
    );

    if (potentialModels.length === 0) {
      throw new Error('No suitable models found for audio generation');
    }

    // Look for models with "live" in the name as they're more likely to support WebSocket
    const liveModel = potentialModels.find(model =>
      model.name.toLowerCase().includes('live')
    );

    if (liveModel) {
      // Use the full model name with path
      const modelName = liveModel.name;
      console.log(`Using live model: ${modelName}`);
      return modelName;
    }

    // Prefer models with "flash" in the name for faster generation
    const flashModel = potentialModels.find(model =>
      model.name.toLowerCase().includes('flash')
    );

    if (flashModel) {
      // Use the full model name with path
      const modelName = flashModel.name;
      console.log(`Using flash model: ${modelName}`);
      return modelName;
    }

    // Otherwise, use the first suitable model
    // Use the full model name with path
    const modelName = potentialModels[0].name;
    console.log(`Using model: ${modelName}`);
    return modelName;
  } catch (error) {
    console.error('Error finding suitable audio model:', error);
    // Fallback to our known working model with the full path
    return 'models/gemini-2.0-flash-exp';
  }
};

/**
 * Get or create a WebSocket client
 * @param {string} apiKey - Gemini API key
 * @param {string} modelName - Optional model name to use
 * @returns {Promise<GeminiWebSocketClient>} - WebSocket client
 */
const getWebSocketClient = async (apiKey, modelName = null) => {
  // If we already have a connected client with the same API key, return it
  if (clientCache.client && clientCache.apiKey === apiKey && clientCache.connected) {
    return clientCache.client;
  }

  // If we're in the process of connecting, wait for it to complete
  if (clientCache.connecting) {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (clientCache.connected && clientCache.setupComplete) {
          clearInterval(checkInterval);
          resolve(clientCache.client);
        } else if (!clientCache.connecting) {
          clearInterval(checkInterval);
          reject(new Error('Connection failed'));
        }
      }, 100);
    });
  }

  // Find a suitable model if not provided
  if (!modelName) {
    console.log('Finding suitable model for audio generation...');
    modelName = await findSuitableAudioModel(apiKey);
    console.log(`Selected model: ${modelName}`);
  }

  // Create a new client
  clientCache.connecting = true;
  clientCache.apiKey = apiKey;
  clientCache.client = new GeminiWebSocketClient(apiKey);

  // Set up event listeners
  clientCache.client.on('setupcomplete', () => {
    console.log('Gemini WebSocket setup complete');
    clientCache.setupComplete = true;
  });

  clientCache.client.on('close', (event) => {
    console.log(`Gemini WebSocket connection closed: ${event?.reason || 'No reason provided'}`);
    clientCache.connected = false;
    clientCache.setupComplete = false;
  });

  // Connect to the WebSocket API
  try {
    // Use the same configuration format as in the live-api-web-console
    const config = {
      model: modelName,
      generationConfig: {
        temperature: 0.2,
        topK: 32,
        topP: 0.95,
        maxOutputTokens: 1024,
        responseModalities: "audio",
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Aoede" // Default voice
            }
          },
        }
      },
      systemInstruction: {
        parts: [
          { text: "you are a narrator, when user tells you to read something only read it, do not say anything else" }
        ]
      }
    };

    console.log(`Connecting to Gemini WebSocket API with model: ${modelName}`);
    await clientCache.client.connect(config);
    clientCache.connected = true;
    clientCache.connecting = false;

    // Wait for setup to complete
    if (!clientCache.setupComplete) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Setup completion timeout'));
        }, 10000); // 10 second timeout

        clientCache.client.once('setupcomplete', () => {
          clearTimeout(timeout);
          resolve();
        });

        // Also listen for close events during setup
        const closeHandler = (event) => {
          clearTimeout(timeout);
          reject(new Error(`Connection closed during setup: ${event?.reason || 'No reason provided'}`));
        };

        clientCache.client.once('close', closeHandler);

        // Remove the close handler once setup is complete
        clientCache.client.once('setupcomplete', () => {
          clientCache.client.removeListener('close', closeHandler);
        });
      });
    }

    return clientCache.client;
  } catch (error) {
    clientCache.connecting = false;
    clientCache.connected = false;
    clientCache.setupComplete = false;
    throw error;
  }
};

/**
 * Generate narration for a subtitle using Gemini API with WebSocket for audio
 * @param {Object} subtitle - Subtitle object with text and id
 * @param {string} language - Language of the subtitle
 * @param {string} modelName - Optional model name to use
 * @returns {Promise<Object>} - Narration result
 */
export const generateGeminiNarration = async (subtitle, language, modelName = null) => {
  try {
    // Get API key from localStorage
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      throw new Error('Gemini API key not found');
    }

    // Create the prompt for narration
    const narrationPrompt = `Read this sentence in ${language}: "${subtitle.text}"`;

    // Get or create a WebSocket client
    console.log(`Getting WebSocket client for subtitle ${subtitle.id}: "${subtitle.text}"`);
    const client = await getWebSocketClient(apiKey, modelName);

    // Create a unique request ID for this subtitle
    const requestId = `subtitle_${subtitle.id}_${Date.now()}`;
    console.log(`Creating request ID: ${requestId} for subtitle: "${subtitle.text}"`);

    // Send the prompt and get the request ID
    console.log(`Sending prompt to Gemini for subtitle ${subtitle.id}: "${narrationPrompt}"`);
    const sentRequestId = client.send(
      { text: narrationPrompt },
      true, // turnComplete
      { subtitleId: subtitle.id, requestId }
    );

    console.log(`Sent request with ID ${sentRequestId} for subtitle ${subtitle.id}`);

    // Wait for the response
    console.log(`Waiting for response to request ${sentRequestId} for subtitle ${subtitle.id}`);
    const audioResult = await client.waitForResponse(sentRequestId, 60000);

    console.log(`Received response for request ${sentRequestId} for subtitle ${subtitle.id}`);

    // Return the result with audio data and metadata
    return {
      subtitle_id: subtitle.id,
      text: subtitle.text,
      audioData: audioResult.audioData, // Base64 encoded audio data
      mimeType: audioResult.mimeType,   // MIME type of the audio
      sampleRate: audioResult.sampleRate, // Sample rate of the audio
      success: !!audioResult.audioData,
      gemini: true // Flag to indicate this is a Gemini narration
    };
  } catch (error) {
    console.error(`Error generating Gemini narration for subtitle ${subtitle.id}:`, error);

    // No need to close the WebSocket client here as it's managed by the getWebSocketClient function
    // and will be reused for other requests

    return {
      subtitle_id: subtitle.id,
      text: subtitle.text,
      audioData: null,
      success: false,
      error: error.message,
      gemini: true
    };
  }
};

// Flag to track if generation has been cancelled
let isCancelled = false;

/**
 * Cancel ongoing narration generation
 */
export const cancelGeminiNarrations = () => {
  isCancelled = true;
  console.log('Narration generation cancelled');
};

/**
 * Generate narration for multiple subtitles using Gemini API
 * @param {Array} subtitles - Array of subtitle objects
 * @param {string} language - Language of the subtitles
 * @param {Function} onProgress - Callback for progress updates
 * @param {Function} onResult - Callback for each result
 * @param {Function} onError - Callback for errors
 * @param {Function} onComplete - Callback for completion
 * @param {string} modelName - Optional model name to use
 * @param {number} sleepTime - Time to sleep between requests in milliseconds
 * @returns {Promise<Object>} - Generation response
 */
export const generateGeminiNarrations = async (
  subtitles,
  language,
  onProgress = () => {},
  onResult = () => {},
  onError = () => {},
  onComplete = () => {},
  modelName = null,
  sleepTime = 1000
) => {
  // Reset cancellation flag
  isCancelled = false;
  try {
    // Initial progress message
    onProgress("Preparing to generate narration with Gemini...");

    const results = [];
    const total = subtitles.length;

    // Process subtitles one at a time to ensure proper audio generation
    // This is critical for Gemini narration to work correctly
    const batchSize = 1; // Process one subtitle at a time
    const batches = [];

    for (let i = 0; i < subtitles.length; i += batchSize) {
      batches.push(subtitles.slice(i, i + batchSize));
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      // Check if generation has been cancelled
      if (isCancelled) {
        console.log('Narration generation cancelled');
        onProgress('Narration generation cancelled');
        return { success: false, cancelled: true, results };
      }

      const batch = batches[batchIndex];

      // Update progress
      onProgress(`Generating narration batch ${batchIndex + 1}/${batches.length}...`);

      // Process each subtitle in the batch concurrently
      console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} subtitles`);
      const batchPromises = batch.map(subtitle => {
        console.log(`Adding subtitle ${subtitle.id} to batch: "${subtitle.text}"`);
        return generateGeminiNarration(subtitle, language, modelName);
      });

      // Wait for all narrations in this batch to complete
      const batchResults = await Promise.all(batchPromises);
      console.log(`Completed batch ${batchIndex + 1}/${batches.length}`);

      // Process each result
      for (const result of batchResults) {
        results.push(result);
        onResult(result, results.length, total);
      }

      // Check if generation has been cancelled
      if (isCancelled) {
        console.log('Narration generation cancelled after batch completion');
        onProgress('Narration generation cancelled');
        return { success: false, cancelled: true, results };
      }

      // Add a delay between batches to avoid rate limiting
      if (batchIndex < batches.length - 1) {
        console.log(`Adding delay of ${sleepTime}ms between batches...`);
        onProgress(`Waiting ${sleepTime/1000} seconds before next batch...`);
        await new Promise(resolve => setTimeout(resolve, sleepTime));
      }
    }

    // Complete the generation
    onProgress("Narration generation complete");
    onComplete(results);

    return { success: true, results };
  } catch (error) {
    console.error('Error generating Gemini narrations:', error);
    onError(error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if Gemini API is available
 * @returns {Promise<boolean>} - Whether Gemini API is available
 */
export const checkGeminiAvailability = async () => {
  try {
    // Check if API key is available
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      return {
        available: false,
        error: 'Gemini API key not found',
        message: 'Please set your Gemini API key in the settings'
      };
    }

    // Try to list models to check if the API key is valid
    try {
      const models = await listGeminiModels(apiKey);

      // Check if there are any models available
      if (!models || models.length === 0) {
        return {
          available: false,
          error: 'No Gemini models available',
          message: 'No Gemini models available with your API key'
        };
      }

      // Try to find a suitable model for audio generation
      const suitableModel = await findSuitableAudioModel(apiKey);

      if (!suitableModel) {
        return {
          available: false,
          error: 'No suitable models for audio generation',
          message: 'No suitable Gemini models found for audio generation'
        };
      }

      return {
        available: true,
        model: suitableModel
      };
    } catch (error) {
      return {
        available: false,
        error: `Gemini API error: ${error.message}`,
        message: 'Invalid Gemini API key or API access issue'
      };
    }
  } catch (error) {
    console.error('Error checking Gemini availability:', error);
    return {
      available: false,
      error: error.message,
      message: 'Error checking Gemini API availability'
    };
  }
};
