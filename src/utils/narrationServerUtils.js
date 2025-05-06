/**
 * Utility functions for narration server interactions
 */

import { SERVER_URL } from '../config';
import { base64ToArrayBuffer } from './audioConversionUtils';

/**
 * Save audio data to server
 * @param {Object} result - Narration result object
 * @param {Object} savedToServer - Object tracking saved files
 * @param {Function} setSavedToServer - State setter for savedToServer
 * @param {Array} generationResults - All generation results
 * @returns {Promise<string|null>} - Filename if saved successfully, null otherwise
 */
export const saveAudioToServer = async (result, savedToServer, setSavedToServer, generationResults) => {
  // If already saved, don't save again
  if (savedToServer[result.subtitle_id]) {
    console.log(`Audio for subtitle ${result.subtitle_id} already saved to server`);
    return savedToServer[result.subtitle_id];
  }

  if (result.audioData) {
    try {
      console.log(`Saving audio for subtitle ${result.subtitle_id} to server...`);
      console.log(`Audio data length: ${result.audioData.length} characters`);
      console.log(`Sample rate: ${result.sampleRate || 24000}Hz`);

      // Validate the audio data
      try {
        // Test decode to make sure it's valid base64
        const testBuffer = base64ToArrayBuffer(result.audioData);
        console.log(`Test decode successful, buffer size: ${testBuffer.byteLength} bytes`);
      } catch (decodeError) {
        console.error(`Error validating audio data: ${decodeError.message}`);
        throw new Error(`Invalid audio data: ${decodeError.message}`);
      }

      // Send the audio data to the server
      const response = await fetch(`${SERVER_URL}/api/narration/save-gemini-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioData: result.audioData,
          subtitle_id: result.subtitle_id,
          sampleRate: result.sampleRate || 24000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Server error response: ${errorText}`);
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        console.log(`Successfully saved audio to server: ${data.filename}`);
        // Update the result with the filename
        result.filename = data.filename;

        // Update the savedToServer state
        setSavedToServer(prev => ({
          ...prev,
          [result.subtitle_id]: data.filename
        }));

        // Dispatch an event to notify other components that narrations have been updated
        const event = new CustomEvent('narrations-updated', {
          detail: {
            source: 'original', // Assuming Gemini narrations are for original subtitles
            narrations: generationResults.map(r => ({
              ...r,
              filename: r.subtitle_id === result.subtitle_id ? data.filename : (savedToServer[r.subtitle_id] || r.filename)
            }))
          }
        });
        window.dispatchEvent(event);

        return data.filename;
      } else {
        throw new Error(data.error || 'Unknown error saving audio to server');
      }
    } catch (error) {
      console.error(`Error saving audio to server for subtitle ${result.subtitle_id}:`, error);
      return null;
    }
  }
  return null;
};

/**
 * Download aligned narration audio (one file)
 * @param {Array} generationResults - Array of narration results
 * @param {Function} t - Translation function
 * @returns {Promise<void>}
 */
export const downloadAlignedAudio = async (generationResults, t) => {
  // Check if we have any generation results
  if (!generationResults || generationResults.length === 0) {
    alert(t('narration.noResults', 'No narration results to download'));
    return;
  }

  // Create a loading indicator with improved styling
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'loading-indicator';
  loadingIndicator.style.position = 'fixed';
  loadingIndicator.style.top = '50%';
  loadingIndicator.style.left = '50%';
  loadingIndicator.style.transform = 'translate(-50%, -50%)';
  loadingIndicator.style.padding = '20px';
  loadingIndicator.style.background = 'rgba(0, 0, 0, 0.8)';
  loadingIndicator.style.color = 'white';
  loadingIndicator.style.borderRadius = '8px';
  loadingIndicator.style.zIndex = '9999';
  loadingIndicator.style.textAlign = 'center';
  loadingIndicator.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
  loadingIndicator.style.minWidth = '250px';

  loadingIndicator.innerHTML = `
    <div class="loading-spinner" style="
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top: 4px solid white;
      width: 40px;
      height: 40px;
      margin: 0 auto 15px auto;
      animation: spin 1s linear infinite;
    "></div>
    <div class="loading-text" style="
      font-size: 16px;
      font-weight: bold;
    ">${t('narration.preparingDownload', 'Preparing aligned narration file...')}</div>
  `;

  // Add the animation keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  // Add the loading indicator to the document
  document.body.appendChild(loadingIndicator);

  console.log('Loading indicator created and added to document');

  try {
    // Get all subtitles from the video for timing information
    const allSubtitles = [];

    // Try to get subtitles from window.subtitles (main source)
    if (window.subtitles && Array.isArray(window.subtitles)) {
      console.log('Using window.subtitles for timing information');
      allSubtitles.push(...window.subtitles);
    }

    // Also try original and translated subtitles
    if (window.originalSubtitles && Array.isArray(window.originalSubtitles)) {
      console.log('Using window.originalSubtitles for timing information');
      allSubtitles.push(...window.originalSubtitles);
    }

    if (window.translatedSubtitles && Array.isArray(window.translatedSubtitles)) {
      console.log('Using window.translatedSubtitles for timing information');
      allSubtitles.push(...window.translatedSubtitles);
    }

    // Create a map for faster lookup
    const subtitleMap = {};
    allSubtitles.forEach(sub => {
      if (sub.id !== undefined) {
        subtitleMap[sub.id] = sub;
      }
    });

    console.log('Found subtitle timing information for IDs:', Object.keys(subtitleMap));

    // Prepare the data for the aligned narration with correct timing
    const narrationData = generationResults
      .filter(result => result.success && (result.audioData || result.filename))
      .map(result => {
        // Find the corresponding subtitle for timing information
        const subtitle = subtitleMap[result.subtitle_id];

        // If we found a matching subtitle, use its timing
        if (subtitle && typeof subtitle.start === 'number' && typeof subtitle.end === 'number') {
          console.log(`Found timing for subtitle ${result.subtitle_id}: ${subtitle.start}s - ${subtitle.end}s`);
          return {
            filename: result.filename || `gemini_narration_${result.subtitle_id}.wav`,
            subtitle_id: result.subtitle_id,
            start: subtitle.start,
            end: subtitle.end,
            text: result.text || ''
          };
        }

        // Otherwise, use existing timing or defaults
        return {
          filename: result.filename || `gemini_narration_${result.subtitle_id}.wav`,
          subtitle_id: result.subtitle_id,
          start: result.start || 0,
          end: result.end || (result.start ? result.start + 5 : 5),
          text: result.text || ''
        };
      });

    // Sort by start time to ensure correct order
    narrationData.sort((a, b) => a.start - b.start);

    console.log('Generating aligned narration for:', narrationData);

    // Create a download link
    const downloadUrl = `${SERVER_URL}/api/narration/download-aligned`;

    // Use fetch API to download the file
    console.log('Fetching:', downloadUrl);

    // Update loading indicator text
    loadingIndicator.querySelector('.loading-text').textContent = t('narration.sendingRequest', 'Sending request to server...');

    let response;
    try {
      response = await fetch(downloadUrl, {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'audio/wav'
        },
        body: JSON.stringify({ narrations: narrationData })
      });

      console.log('Response received:', response.status, response.statusText);
      console.log('Response headers:', [...response.headers.entries()]);
    } catch (fetchError) {
      console.error('Network error during fetch:', fetchError);
      throw new Error(`Network error: ${fetchError.message}`);
    }

    // Check if the response is successful
    if (!response.ok) {
      // Try to parse error message if it's JSON
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error: ${response.status} ${response.statusText}`);
      } catch (jsonError) {
        // If it's not JSON, use the status text
        throw new Error(`Failed to download aligned audio: ${response.status} ${response.statusText}`);
      }
    }

    // Update loading indicator text
    loadingIndicator.querySelector('.loading-text').textContent = t('narration.processingResponse', 'Processing audio data...');

    // Get the blob from the response
    let blob;
    try {
      blob = await response.blob();
      console.log(`Received blob: type=${blob.type}, size=${blob.size} bytes`);

      // Validate the blob
      if (!blob || blob.size === 0) {
        throw new Error('Received empty audio data from server');
      }
    } catch (blobError) {
      console.error('Error processing response blob:', blobError);
      throw new Error(`Error processing audio data: ${blobError.message}`);
    }

    // Update loading indicator text
    loadingIndicator.querySelector('.loading-text').textContent = t('narration.preparingDownload', 'Preparing download...');

    // Create a URL for the blob
    let url;
    try {
      url = URL.createObjectURL(blob);
      console.log('Created blob URL:', url);
    } catch (urlError) {
      console.error('Error creating blob URL:', urlError);
      throw new Error(`Error creating download: ${urlError.message}`);
    }

    // Create a temporary anchor element
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aligned_narration.wav';
    a.style.display = 'none';
    document.body.appendChild(a);

    // Update loading indicator text
    loadingIndicator.querySelector('.loading-text').textContent = t('narration.startingDownload', 'Starting download...');

    // Trigger the download
    try {
      a.click();
      console.log('Download triggered successfully');
    } catch (clickError) {
      console.error('Error triggering download:', clickError);
      throw new Error(`Error starting download: ${clickError.message}`);
    }

    // Clean up
    try {
      setTimeout(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
        if (url) {
          URL.revokeObjectURL(url);
        }
        console.log('Download cleanup completed');
      }, 1000); // Increased timeout to ensure download starts
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
      // Don't throw here, as the download might still be working
    }
  } catch (error) {
    console.error('Error downloading aligned audio:', error);

    // Update loading indicator to show error
    try {
      if (loadingIndicator && document.body.contains(loadingIndicator)) {
        loadingIndicator.querySelector('.loading-text').textContent = t('narration.downloadError', 'Error downloading audio');
        loadingIndicator.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
      }
    } catch (uiError) {
      console.error('Error updating loading indicator:', uiError);
    }

    // Show error message to user
    alert(t('narration.downloadError', `Error downloading aligned audio file: ${error.message}`));

    // Short delay before removing the loading indicator to ensure the user sees the error
    await new Promise(resolve => setTimeout(resolve, 1500));
  } finally {
    // Remove loading indicator and style element
    try {
      // Remove the loading indicator
      if (loadingIndicator && document.body.contains(loadingIndicator)) {
        document.body.removeChild(loadingIndicator);
        console.log('Loading indicator removed');
      }

      // Remove the style element (animation keyframes)
      if (style && document.head.contains(style)) {
        document.head.removeChild(style);
        console.log('Animation style element removed');
      }
    } catch (cleanupError) {
      console.error('Error during final cleanup:', cleanupError);
    }
  }
};
