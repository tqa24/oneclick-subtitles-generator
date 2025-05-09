/**
 * Functions for generating narration using Gemini API
 */

import { SERVER_URL } from '../../../config';
import { getWebSocketClient } from '../client/clientManager';
import { getGeminiLanguageCode } from '../utils/languageUtils';

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

      // Always update on first batch, last batch, and every 10% in between
      const progressPercent = Math.round((batchIndex / batches.length) * 100);
      onProgress(`Generating narrations... (${progressPercent}% complete)`);

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

    // Check if we have any results at all
    if (results.length === 0) {
      // No results were generated, likely due to a connection error
      const error = new Error("No narrations were generated. There may have been a connection issue with Gemini.");
      onError(error);
      return { success: false, error: error.message, results: [] };
    }

    // Check if we have fewer results than expected
    if (results.length < subtitles.length) {
      // Some results were generated, but not all
      onProgress(`Narration generation incomplete. Generated ${results.length} of ${subtitles.length} narrations.`);
      onComplete(results);
      return {
        success: true,
        incomplete: true,
        results,
        message: `Generation was interrupted. Only ${results.length} of ${subtitles.length} narrations were generated.`
      };
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
