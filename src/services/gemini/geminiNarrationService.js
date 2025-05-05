/**
 * Gemini narration service for generating narration using Gemini API with WebSocket for audio
 */

import { GeminiWebSocketClient } from './geminiWebSocketClient';
import { SERVER_URL } from '../../config';

/**
 * Available Gemini voices
 * @type {Array<Object>}
 */
export const GEMINI_VOICES = [
  { id: 'Aoede', name: 'Aoede', gender: 'Female' },
  { id: 'Puck', name: 'Puck', gender: 'Male' },
  { id: 'Charon', name: 'Charon', gender: 'Male' },
  { id: 'Kore', name: 'Kore', gender: 'Female' },
  { id: 'Fenrir', name: 'Fenrir', gender: 'Male' },
  { id: 'Leda', name: 'Leda', gender: 'Female' },
  { id: 'Orus', name: 'Orus', gender: 'Male' },
  { id: 'Zephyr', name: 'Zephyr', gender: 'Female' }
];

/**
 * Mapping of language codes to Gemini-compatible language codes
 * @type {Object}
 */
export const GEMINI_LANGUAGE_CODES = {
  // Common language codes
  'de': 'de-DE', // German
  'en': 'en-US', // English (default to US)
  'es': 'es-ES', // Spanish (default to Spain)
  'fr': 'fr-FR', // French (default to France)
  'hi': 'hi-IN', // Hindi
  'pt': 'pt-BR', // Portuguese (default to Brazil)
  'ar': 'ar-XA', // Arabic
  'id': 'id-ID', // Indonesian
  'it': 'it-IT', // Italian
  'ja': 'ja-JP', // Japanese
  'tr': 'tr-TR', // Turkish
  'vi': 'vi-VN', // Vietnamese
  'bn': 'bn-IN', // Bengali
  'gu': 'gu-IN', // Gujarati
  'kn': 'kn-IN', // Kannada
  'ml': 'ml-IN', // Malayalam
  'mr': 'mr-IN', // Marathi
  'ta': 'ta-IN', // Tamil
  'te': 'te-IN', // Telugu
  'nl': 'nl-NL', // Dutch
  'ko': 'ko-KR', // Korean
  'cmn': 'cmn-CN', // Mandarin Chinese
  'zh': 'cmn-CN', // Chinese (map to Mandarin)
  'pl': 'pl-PL', // Polish
  'ru': 'ru-RU', // Russian
  'th': 'th-TH', // Thai

  // Specific regional codes (already in correct format)
  'de-DE': 'de-DE', // German (Germany)
  'en-AU': 'en-AU', // English (Australia)
  'en-GB': 'en-GB', // English (United Kingdom)
  'en-IN': 'en-IN', // English (India)
  'en-US': 'en-US', // English (United States)
  'es-US': 'es-US', // Spanish (United States)
  'es-ES': 'es-ES', // Spanish (Spain)
  'fr-FR': 'fr-FR', // French (France)
  'fr-CA': 'fr-CA', // French (Canada)
  'hi-IN': 'hi-IN', // Hindi (India)
  'pt-BR': 'pt-BR', // Portuguese (Brazil)
  'ar-XA': 'ar-XA', // Arabic (Generic)
  'id-ID': 'id-ID', // Indonesian (Indonesia)
  'it-IT': 'it-IT', // Italian (Italy)
  'ja-JP': 'ja-JP', // Japanese (Japan)
  'tr-TR': 'tr-TR', // Turkish (Turkey)
  'vi-VN': 'vi-VN', // Vietnamese (Vietnam)
  'bn-IN': 'bn-IN', // Bengali (India)
  'gu-IN': 'gu-IN', // Gujarati (India)
  'kn-IN': 'kn-IN', // Kannada (India)
  'ml-IN': 'ml-IN', // Malayalam (India)
  'mr-IN': 'mr-IN', // Marathi (India)
  'ta-IN': 'ta-IN', // Tamil (India)
  'te-IN': 'te-IN', // Telugu (India)
  'nl-NL': 'nl-NL', // Dutch (Netherlands)
  'ko-KR': 'ko-KR', // Korean (South Korea)
  'cmn-CN': 'cmn-CN', // Mandarin Chinese (China)
  'pl-PL': 'pl-PL', // Polish (Poland)
  'ru-RU': 'ru-RU', // Russian (Russia)
  'th-TH': 'th-TH'  // Thai (Thailand)
};

/**
 * Convert a language code to a Gemini-compatible language code
 * @param {string} languageCode - Language code to convert
 * @returns {string} - Gemini-compatible language code
 */
export const getGeminiLanguageCode = (languageCode) => {
  if (!languageCode) {
    return 'en-US'; // Default to English (US) if no language code is provided
  }

  // Normalize the language code to lowercase
  const normalizedCode = languageCode.toLowerCase();

  // Check if the exact code exists in our mapping
  if (GEMINI_LANGUAGE_CODES[normalizedCode]) {
    return GEMINI_LANGUAGE_CODES[normalizedCode];
  }

  // If not, try to match just the language part (before the hyphen)
  const languagePart = normalizedCode.split('-')[0];
  if (GEMINI_LANGUAGE_CODES[languagePart]) {
    return GEMINI_LANGUAGE_CODES[languagePart];
  }

  // If all else fails, default to English (US)
  console.warn(`No Gemini language code found for "${languageCode}", defaulting to en-US`);
  return 'en-US';
};

// Cache for WebSocket clients to avoid creating multiple connections
const clientCache = {
  client: null,
  apiKey: null,
  connected: false,
  connecting: false,
  setupComplete: false,
  supportedModels: null,
  voiceName: null,
  languageCode: null
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
 * @param {string} voiceName - Optional voice name to use
 * @param {string} languageCode - Optional language code for speech synthesis
 * @returns {Promise<GeminiWebSocketClient>} - WebSocket client
 */
const getWebSocketClient = async (apiKey, modelName = null, voiceName = null, languageCode = null) => {
  // Get the voice name from localStorage if not provided
  if (!voiceName) {
    voiceName = localStorage.getItem('gemini_voice') || 'Aoede'; // Default to Aoede if not set
  }

  // Default language code to English if not provided
  if (!languageCode) {
    languageCode = 'en-US';
  }

  // If we already have a connected client with the same API key, voice, and language, return it
  if (clientCache.client &&
      clientCache.apiKey === apiKey &&
      clientCache.connected &&
      clientCache.voiceName === voiceName &&
      clientCache.languageCode === languageCode) {
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
  clientCache.voiceName = voiceName; // Store the voice name
  clientCache.languageCode = languageCode; // Store the language code
  clientCache.client = new GeminiWebSocketClient(apiKey);

  // Set up event listeners
  clientCache.client.on('setupcomplete', () => {
    console.log(`Gemini WebSocket setup complete with voice: ${voiceName}`);
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
              voiceName: voiceName // Use the selected voice
            }
          },
          languageCode: languageCode // Set the language code for speech synthesis
        }
      },
      systemInstruction: {
        parts: [
          { text: "You are a narrator. When asked to read a text, YOU MUST ONLY READ IT OUT LOUD AND DO NOT ASK BACK ANY QUESTIONS." }
        ]
      }
    };

    console.log(`Using voice: ${voiceName} for Gemini narration`);

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
 * @param {string} voiceName - Optional voice name to use
 * @returns {Promise<Object>} - Narration result
 */
export const generateGeminiNarration = async (subtitle, language, modelName = null, voiceName = null) => {
  try {
    // Get API key from localStorage
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      throw new Error('Gemini API key not found');
    }

    // Convert the language code to a Gemini-compatible format
    const geminiLanguageCode = getGeminiLanguageCode(language);
    console.log(`Converting language code "${language}" to Gemini format: "${geminiLanguageCode}"`);

    // Create the prompt for narration - explicitly instruct to speak in the target language
    const narrationPrompt = `READ the following text. DO NOT ASK ME ANYTHING FOLLOW UP, just read it exactly as written: "${subtitle.text}"`;

    // Get or create a WebSocket client
    console.log(`Getting WebSocket client for subtitle ${subtitle.id}: "${subtitle.text}" with voice: ${voiceName || 'default'} and language: ${geminiLanguageCode}`);
    const client = await getWebSocketClient(apiKey, modelName, voiceName, geminiLanguageCode);

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
 * @param {string} voiceName - Optional voice name to use
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
  sleepTime = 10000,
  voiceName = null
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
        console.log(`Adding subtitle ${subtitle.id} to batch: "${subtitle.text}" with voice: ${voiceName || 'default'}`);
        return generateGeminiNarration(subtitle, language, modelName, voiceName);
      });

      // Wait for all narrations in this batch to complete
      const batchResults = await Promise.all(batchPromises);
      console.log(`Completed batch ${batchIndex + 1}/${batches.length}`);

      // Process each result and automatically save to server
      for (const result of batchResults) {
        // If the result has audio data, save it to the server automatically
        if (result.success && result.audioData) {
          try {
            console.log(`Automatically saving audio for subtitle ${result.subtitle_id} to server...`);

            // Send the audio data to the server
            const response = await fetch(`${SERVER_URL}/api/narration/save-gemini-audio`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                audioData: result.audioData,
                subtitle_id: result.subtitle_id,
                sampleRate: result.sampleRate || 24000,
                mimeType: result.mimeType || 'audio/pcm' // Include MIME type
              })
            });

            if (response.ok) {
              const data = await response.json();
              if (data.success) {
                console.log(`Successfully saved audio to server: ${data.filename}`);
                // Update the result with the filename
                result.filename = data.filename;

                // Dispatch an event to notify other components that narrations have been updated
                const event = new CustomEvent('narrations-updated', {
                  detail: {
                    source: 'original', // Assuming Gemini narrations are for original subtitles
                    narrations: [...results, result]
                  }
                });
                window.dispatchEvent(event);
              } else {
                console.error(`Error saving audio to server: ${data.error}`);
              }
            } else {
              console.error(`Server returned ${response.status}: ${response.statusText}`);
            }
          } catch (error) {
            console.error(`Error saving audio to server for subtitle ${result.subtitle_id}:`, error);
          }
        }

        // Add the result to the results array
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
