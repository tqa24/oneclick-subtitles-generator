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
        // Ensure we have valid timing information
        const start = typeof result.start === 'number' ? result.start : 0;
        const end = typeof result.end === 'number' ? result.end : (start + 5); // Default 5 seconds if no end time

        return {
          filename: result.filename,
          subtitle_id: result.subtitle_id,
          start: start,
          end: end,
          text: result.text || ''
        };
      });

    // Log the timing information for debugging
    console.log('Narration data with timing information:');
    narrationData.forEach(item => {
      console.log(`Subtitle ID: ${item.subtitle_id}, Start: ${item.start}s, End: ${item.end}s`);
    });

    // Sort by start time to ensure correct order (more reliable than subtitle ID)
    narrationData.sort((a, b) => a.start - b.start);

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
    alignedAudioElement = new Audio();

    // Set audio properties for better performance
    alignedAudioElement.preload = 'auto';
    alignedAudioElement.crossOrigin = 'anonymous'; // Helps with CORS issues

    // Add comprehensive error handling
    alignedAudioElement.onerror = (event) => {
      const errorMessage = alignedAudioElement.error
        ? `Code: ${alignedAudioElement.error.code}, Message: ${alignedAudioElement.error.message}`
        : 'unknown error';
      console.error('Error with aligned narration audio:', errorMessage);

      // Try to recover by reloading
      setTimeout(() => {
        console.log('Attempting to recover from audio error');
        if (alignedNarrationCache.url) {
          alignedAudioElement.src = alignedNarrationCache.url;
          alignedAudioElement.load();
        }
      }, 1000);
    };

    // Add stalled and waiting event handlers
    alignedAudioElement.onstalled = () => {
      console.warn('Audio playback stalled, attempting to resume');
      alignedAudioElement.load();
    };

    alignedAudioElement.onwaiting = () => {
      console.log('Audio is waiting for more data');
    };

    // Add successful load handler
    alignedAudioElement.oncanplaythrough = () => {
      console.log('Audio can play through without buffering');
    };

    // Set the source and load
    alignedAudioElement.src = alignedNarrationCache.url;
    alignedAudioElement.load();

    console.log('Created aligned narration audio element with URL:', alignedNarrationCache.url);
  } else if (alignedAudioElement.src !== alignedNarrationCache.url) {
    // Only update the source if it has changed
    console.log('Updating aligned narration audio source');

    // Pause first to avoid any playback issues during source change
    alignedAudioElement.pause();

    // Update source and reload
    alignedAudioElement.src = alignedNarrationCache.url;
    alignedAudioElement.load();

    // Reset any custom properties we might have set
    alignedAudioElement.seeking = false;
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
    // More robust approach with less frequent seeking
    if (currentTime >= 0) {
      // Only update currentTime if it's significantly different to avoid unnecessary seeking
      // Increased threshold to reduce seeking frequency
      const timeDifference = Math.abs(audio.currentTime - currentTime);
      const seekThreshold = 0.5; // Half a second threshold

      // Only seek if the time difference is significant or we're in a paused state
      // This reduces the number of seek operations during normal playback
      if (timeDifference > seekThreshold || !isPlaying) {
        console.log(`Seeking aligned audio to ${currentTime} (diff: ${timeDifference.toFixed(2)}s)`);

        // Set a flag to track seeking state
        audio.seeking = true;

        // Use a try-catch specifically for the seeking operation
        try {
          audio.currentTime = currentTime;
        } catch (seekError) {
          console.error('Error seeking aligned narration:', seekError);
          // If seeking fails, try to recover by reloading the audio
          if (alignedNarrationCache.url) {
            console.log('Attempting to recover from seek error by reloading audio');
            audio.src = alignedNarrationCache.url;
            audio.load();
            // After loading, try to set the time and play state again
            setTimeout(() => {
              try {
                audio.currentTime = currentTime;
                if (isPlaying) audio.play();
              } catch (e) {
                console.error('Recovery attempt failed:', e);
              }
            }, 100);
          }
        }
      }
    }

    // Handle play/pause state
    if (isPlaying && audio.paused) {
      // Add a small delay before playing if we just performed a seek
      // This helps avoid playback issues after seeking
      if (audio.seeking) {
        setTimeout(() => {
          audio.play().catch(error => {
            console.error('Error playing aligned narration:', error);
          });
          audio.seeking = false;
        }, 50);
      } else {
        audio.play().catch(error => {
          console.error('Error playing aligned narration:', error);
        });
      }
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
  // Properly clean up the audio element
  if (alignedAudioElement) {
    // First pause playback
    alignedAudioElement.pause();

    // Remove all event listeners to prevent memory leaks
    alignedAudioElement.oncanplaythrough = null;
    alignedAudioElement.onerror = null;
    alignedAudioElement.onstalled = null;
    alignedAudioElement.onwaiting = null;
    alignedAudioElement.onplay = null;
    alignedAudioElement.onpause = null;
    alignedAudioElement.ontimeupdate = null;
    alignedAudioElement.onseeking = null;
    alignedAudioElement.onseeked = null;

    // Clear the source
    alignedAudioElement.src = '';

    // Force browser to release resources
    try {
      alignedAudioElement.load();
    } catch (e) {
      console.warn('Error during audio cleanup:', e);
    }
  }

  // Revoke the URL to free up memory
  if (alignedNarrationCache.url) {
    try {
      URL.revokeObjectURL(alignedNarrationCache.url);
      console.log('Revoked object URL:', alignedNarrationCache.url);
    } catch (e) {
      console.warn('Error revoking object URL:', e);
    }
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

  console.log('Aligned narration resources cleaned up');
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
