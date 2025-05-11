/**
 * Manager for Gemini WebSocket clients
 */

import { GeminiWebSocketClient } from './GeminiWebSocketClient';
import { findSuitableAudioModel } from '../models/modelSelector';

// Cache for WebSocket clients to avoid creating multiple connections
const clientCache = {
  client: null,
  apiKey: null,
  connected: false,
  connecting: false,
  setupComplete: false,
  voiceName: null,
  languageCode: null
};

/**
 * Get or create a WebSocket client
 * @param {string} apiKey - Gemini API key
 * @param {string} modelName - Optional model name to use
 * @param {string} voiceName - Optional voice name to use
 * @param {string} languageCode - Optional language code for speech synthesis
 * @returns {Promise<GeminiWebSocketClient>} - WebSocket client
 */
export const getWebSocketClient = async (apiKey, modelName = null, voiceName = null, languageCode = null) => {
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

    modelName = await findSuitableAudioModel(apiKey);

  }

  // Create a new client
  clientCache.connecting = true;
  clientCache.apiKey = apiKey;
  clientCache.voiceName = voiceName; // Store the voice name
  clientCache.languageCode = languageCode; // Store the language code
  clientCache.client = new GeminiWebSocketClient(apiKey);

  // Set up event listeners
  clientCache.client.on('setupcomplete', () => {

    clientCache.setupComplete = true;
  });

  clientCache.client.on('close', (event) => {

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
