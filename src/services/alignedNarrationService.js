/**
 * Service for managing aligned narration audio
 */
import { SERVER_URL } from '../config';

// Cache for the aligned narration audio
let alignedNarrationCache = {
  blob: null,
  url: null,
  timestamp: null,
  subtitleTimestamps: {} // Store timestamps of subtitles to detect changes
};

// Audio element for playback
let alignedAudioElement = null;

/**
 * Generate aligned narration audio and store it in cache
 * @param {Array} generationResults - Array of narration results
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<string>} - URL to the aligned audio
 */
export const generateAlignedNarration = async (generationResults, onProgress = null) => {
  if (!generationResults || generationResults.length === 0) {
    console.error('No narration results to generate aligned audio');
    return null;
  }

  try {
    // Show progress if callback provided
    if (onProgress) {
      onProgress({ status: 'preparing', message: 'Preparing aligned narration...' });
    }

    // Prepare the data for the aligned narration
    const narrationData = generationResults
      .filter(result => result.success && result.filename)
      .map(result => {
        return {
          filename: result.filename,
          subtitle_id: result.subtitle_id,
          start: result.start || 0,
          end: result.end || 0,
          text: result.text || ''
        };
      });

    // Sort by subtitle ID to ensure correct order
    narrationData.sort((a, b) => a.subtitle_id - b.subtitle_id);

    console.log('Generating aligned narration for:', narrationData);

    // Store subtitle timestamps to detect changes
    const newSubtitleTimestamps = {};
    narrationData.forEach(item => {
      newSubtitleTimestamps[item.subtitle_id] = {
        start: item.start,
        end: item.end
      };
    });

    // Check if we already have a cached version with the same timestamps
    if (alignedNarrationCache.url && alignedNarrationCache.subtitleTimestamps) {
      const hasChanged = Object.keys(newSubtitleTimestamps).some(id => {
        const oldTimestamp = alignedNarrationCache.subtitleTimestamps[id];
        const newTimestamp = newSubtitleTimestamps[id];

        // If we don't have this subtitle in the cache, or the timestamps have changed
        return !oldTimestamp ||
               oldTimestamp.start !== newTimestamp.start ||
               oldTimestamp.end !== newTimestamp.end;
      });

      if (!hasChanged) {
        console.log('Using cached aligned narration - no timestamp changes detected');
        if (onProgress) {
          onProgress({ status: 'complete', message: 'Using cached aligned narration' });
        }
        return alignedNarrationCache.url;
      }
    }

    if (onProgress) {
      onProgress({ status: 'generating', message: 'Generating aligned narration...' });
    }

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

    // Verify that the blob is valid
    if (!blob || blob.size === 0) {
      throw new Error('Received empty audio data from server');
    }

    console.log(`Received aligned audio blob: type=${blob.type}, size=${blob.size} bytes`);

    // Clean up previous resources
    cleanupAlignedNarration();

    // Create a URL for the blob
    const url = URL.createObjectURL(blob);

    // Update the cache
    alignedNarrationCache = {
      blob,
      url,
      timestamp: Date.now(),
      subtitleTimestamps: newSubtitleTimestamps
    };

    console.log(`Created blob URL: ${url}`);

    if (onProgress) {
      onProgress({ status: 'complete', message: 'Aligned narration ready' });
    }

    return url;
  } catch (error) {
    console.error('Error generating aligned narration:', error);
    if (onProgress) {
      onProgress({ status: 'error', message: `Error: ${error.message}` });
    }
    return null;
  }
};

/**
 * Get the aligned narration audio element
 * @returns {HTMLAudioElement} - Audio element
 */
export const getAlignedAudioElement = () => {
  if (!alignedNarrationCache.url) {
    return null;
  }

  // Create the audio element only once and reuse it
  if (!alignedAudioElement) {
    console.log('Creating new aligned narration audio element');

    // Create a new audio element
    alignedAudioElement = new Audio(alignedNarrationCache.url);

    // Set preload to auto to ensure it loads completely
    alignedAudioElement.preload = 'auto';

    // Add minimal error handling
    alignedAudioElement.onerror = (event) => {
      console.error('Error with aligned narration audio:',
        alignedAudioElement.error ? alignedAudioElement.error.message : 'unknown error');
    };

    // Load the audio
    alignedAudioElement.load();

    console.log('Created aligned narration audio element with URL:', alignedNarrationCache.url);
  } else if (alignedAudioElement.src !== alignedNarrationCache.url) {
    // Only update the source if it has changed
    console.log('Updating aligned narration audio source');
    alignedAudioElement.src = alignedNarrationCache.url;
    alignedAudioElement.load();
  }

  return alignedAudioElement;
};

/**
 * Play aligned narration at the specified time
 * @param {number} currentTime - Current video time
 * @param {boolean} isPlaying - Whether the video is playing
 */
export const playAlignedNarration = (currentTime, isPlaying) => {
  const audio = getAlignedAudioElement();
  if (!audio) {
    return;
  }

  try {
    // Simple approach: just set the time and play/pause
    if (currentTime >= 0) {
      // Only update currentTime if it's significantly different to avoid unnecessary seeking
      if (Math.abs(audio.currentTime - currentTime) > 0.2) {
        audio.currentTime = currentTime;
      }
    }

    // Simply play or pause based on video state
    if (isPlaying && audio.paused) {
      audio.play().catch(error => {
        console.error('Error playing aligned narration:', error);
      });
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  } catch (error) {
    console.error('Error in playAlignedNarration:', error);
  }
};

/**
 * Set the volume of the aligned narration
 * @param {number} volume - Volume level (0-1)
 */
export const setAlignedNarrationVolume = (volume) => {
  const audio = getAlignedAudioElement();
  if (audio) {
    audio.volume = volume;
  }
};

/**
 * Clean up aligned narration resources
 */
export const cleanupAlignedNarration = () => {
  // Pause the audio if it's playing
  if (alignedAudioElement) {
    alignedAudioElement.pause();
  }

  // Revoke the URL to free up memory
  if (alignedNarrationCache.url) {
    URL.revokeObjectURL(alignedNarrationCache.url);
  }

  // Reset the cache
  alignedNarrationCache = {
    blob: null,
    url: null,
    timestamp: null,
    subtitleTimestamps: {}
  };

  // Clear the audio element reference
  alignedAudioElement = null;
};

/**
 * Check if aligned narration is available
 * @returns {boolean} - Whether aligned narration is available
 */
export const isAlignedNarrationAvailable = () => {
  return !!alignedNarrationCache.url;
};

/**
 * Get the URL of the aligned narration
 * @returns {string|null} - URL to the aligned audio or null if not available
 */
export const getAlignedNarrationUrl = () => {
  return alignedNarrationCache.url;
};
