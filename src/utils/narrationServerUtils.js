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

  // Create a loading indicator
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'loading-indicator';
  loadingIndicator.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-text">${t('narration.preparingDownload', 'Preparing aligned narration file...')}</div>
  `;
  document.body.appendChild(loadingIndicator);

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
    const response = await fetch(downloadUrl, {
      method: 'POST',
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'audio/wav'
      },
      body: JSON.stringify({ narrations: narrationData })
    });

    // Check if the response is successful
    if (!response.ok) {
      throw new Error(`Failed to download aligned audio: ${response.statusText}`);
    }

    // Get the blob from the response
    const blob = await response.blob();

    // Create a URL for the blob
    const url = URL.createObjectURL(blob);

    // Create a temporary anchor element
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aligned_narration.wav';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (error) {
    console.error('Error downloading aligned audio:', error);
    alert(t('narration.downloadError', `Error downloading aligned audio file: ${error.message}`));
  } finally {
    // Remove loading indicator
    document.body.removeChild(loadingIndicator);
  }
};
