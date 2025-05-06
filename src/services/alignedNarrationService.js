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

    // Validate that all narrations have proper timing and adjust if needed
    for (let i = 0; i < narrationData.length; i++) {
      const item = narrationData[i];

      // Ensure each narration has a reasonable duration (at least 1 second)
      if (item.end - item.start < 1) {
        console.warn(`Narration for subtitle ${item.subtitle_id} has too short duration (${item.end - item.start}s), extending to 1s`);
        item.end = item.start + 1;
      }

      // For the last narration, ensure it has enough time to be heard completely
      // This fixes the issue where the last narration can't be heard
      if (i === narrationData.length - 1) {
        console.log(`Ensuring last narration (subtitle ${item.subtitle_id}) has enough time to be heard`);
        // Add an extra 2 seconds to the end time of the last narration
        item.end += 2;
      }
    }

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

    // Skip cleanup to avoid stuttering - we'll just create a new URL
    // If there's an old URL, revoke it directly without full cleanup
    if (alignedNarrationCache.url) {
      try {
        URL.revokeObjectURL(alignedNarrationCache.url);
        console.log('Revoked previous object URL');
      } catch (e) {
        console.warn('Error revoking previous object URL:', e);
      }
    }

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

    // Initialize the audio element if it doesn't exist
    if (!alignedAudioElement) {
      console.log('Initializing audio element after generating aligned narration');
      try {
        alignedAudioElement = new Audio();
        alignedAudioElement.preload = 'auto';
        alignedAudioElement.crossOrigin = 'anonymous';
        alignedAudioElement.src = url;
        alignedAudioElement.load();
        console.log('Successfully initialized audio element');
      } catch (error) {
        console.error('Error initializing audio element:', error);
        // Continue even if there's an error, as we can try to create the audio element later
      }
    }

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
  // Check if we have a URL in the cache
  if (!alignedNarrationCache.url) {
    console.warn('No aligned narration URL available in cache');
    return null;
  }

  // Create the audio element only once and reuse it
  if (!alignedAudioElement) {
    console.log('Creating new aligned narration audio element');

    try {
      // Create a new audio element
      alignedAudioElement = new Audio();

      // Set audio properties for better performance
      alignedAudioElement.preload = 'auto';
      alignedAudioElement.crossOrigin = 'anonymous'; // Helps with CORS issues

      // Add comprehensive error handling
      alignedAudioElement.onerror = () => {
        const errorMessage = alignedAudioElement?.error
          ? `Code: ${alignedAudioElement.error.code}, Message: ${alignedAudioElement.error.message}`
          : 'unknown error';
        console.error('Error with aligned narration audio:', errorMessage);

        // Try to recover by reloading
        setTimeout(() => {
          console.log('Attempting to recover from audio error');
          if (alignedNarrationCache.url && alignedAudioElement) {
            alignedAudioElement.src = alignedNarrationCache.url;
            alignedAudioElement.load();
          }
        }, 1000);
      };

      // Add stalled and waiting event handlers
      alignedAudioElement.onstalled = () => {
        console.warn('Audio playback stalled, attempting to resume');
        if (alignedAudioElement) {
          alignedAudioElement.load();
        }
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
    } catch (error) {
      console.error('Error creating audio element:', error);
      return null;
    }
  } else {
    // Check if the audio element has a valid source
    if (!alignedAudioElement.src || alignedAudioElement.src === '' || alignedAudioElement.src === 'about:blank') {
      console.log('Audio element exists but has no source, updating source');

      if (alignedNarrationCache.url) {
        try {
          alignedAudioElement.src = alignedNarrationCache.url;
          alignedAudioElement.load();
          console.log('Updated audio element source with cached URL');
        } catch (error) {
          console.error('Error setting audio source from cache:', error);
        }
      } else {
        console.warn('No URL in cache to set as audio source');
      }
    } else if (alignedAudioElement.src !== alignedNarrationCache.url && alignedNarrationCache.url) {
      // Only update the source if it has changed and we have a new URL
      console.log('Updating aligned narration audio source');

      try {
        // Pause first to avoid any playback issues during source change
        alignedAudioElement.pause();

        // Update source and reload
        alignedAudioElement.src = alignedNarrationCache.url;
        alignedAudioElement.load();

        // Reset any custom properties we might have set
        alignedAudioElement._customSeeking = false;
      } catch (error) {
        console.error('Error updating audio element source:', error);

        // Try to recreate the audio element if updating fails
        try {
          alignedAudioElement = new Audio();
          alignedAudioElement.preload = 'auto';
          alignedAudioElement.crossOrigin = 'anonymous';
          alignedAudioElement.src = alignedNarrationCache.url;
          alignedAudioElement.load();
          console.log('Recreated aligned narration audio element after error');
        } catch (recreateError) {
          console.error('Failed to recreate audio element:', recreateError);
          return null;
        }
      }
    }
  }

  return alignedAudioElement;
};

/**
 * Play aligned narration at the specified time
 * @param {number} currentTime - Current video time
 * @param {boolean} isPlaying - Whether the video is playing
 * @returns {boolean} - Whether playback was successful
 */
export const playAlignedNarration = (currentTime, isPlaying) => {
  console.log(`playAlignedNarration called with currentTime=${currentTime}, isPlaying=${isPlaying}`);
  console.log(`Cache status: URL=${alignedNarrationCache.url ? 'available' : 'not available'}, blob=${alignedNarrationCache.blob ? 'available' : 'not available'}`);

  // Try to get the audio element
  const audio = getAlignedAudioElement();

  // If no audio element is available, try to create one if we have a URL
  if (!audio) {
    if (alignedNarrationCache.url) {
      console.warn('No audio element available for aligned narration, attempting to create one');

      // Try to create a new audio element
      try {
        alignedAudioElement = new Audio();
        alignedAudioElement.preload = 'auto';
        alignedAudioElement.crossOrigin = 'anonymous';
        alignedAudioElement.src = alignedNarrationCache.url;
        alignedAudioElement.load();
        console.log('Created new audio element for aligned narration');

        // Add basic event listeners for debugging
        alignedAudioElement.oncanplay = () => console.log('Audio can play');
        alignedAudioElement.oncanplaythrough = () => console.log('Audio can play through without buffering');
        alignedAudioElement.onerror = () => {
          const errorMessage = alignedAudioElement?.error
            ? `Code: ${alignedAudioElement.error.code}, Message: ${alignedAudioElement.error.message}`
            : 'unknown error';
          console.error('Error with aligned narration audio:', errorMessage);
        };

        // Call this function again with the new audio element
        return playAlignedNarration(currentTime, isPlaying);
      } catch (error) {
        console.error('Failed to create new audio element for aligned narration:', error);
        return false;
      }
    } else {
      console.warn('No audio element or URL available for aligned narration');
      return false;
    }
  }

  try {
    // More robust approach with less frequent seeking
    if (currentTime >= 0) {
      // Only update currentTime if it's significantly different to avoid unnecessary seeking
      // Increased threshold to reduce seeking frequency
      const timeDifference = Math.abs(audio.currentTime - currentTime);
      const seekThreshold = 0.3; // Reduced threshold for more accurate sync

      // Log the current state for debugging, but only for significant differences
      // to reduce console spam during normal playback
      if (timeDifference > 0.5) {
        console.log(`Aligned audio time: ${audio.currentTime.toFixed(2)}s, Video time: ${currentTime.toFixed(2)}s, Diff: ${timeDifference.toFixed(2)}s`);
      }

      // Only seek if the time difference is significant or we're in a paused state
      // This reduces the number of seek operations during normal playback
      // Increased threshold to further reduce seeking frequency
      if (timeDifference > seekThreshold || !isPlaying) {
        // Don't log every seek during normal playback to reduce console spam
        if (timeDifference > 1.0 || !isPlaying) {
          console.log(`Seeking aligned audio to ${currentTime.toFixed(2)}s (diff: ${timeDifference.toFixed(2)}s)`);
        }

        // Set a flag to track our custom seeking state
        // Use a different name to avoid conflict with the built-in seeking property
        audio._customSeeking = true;

        // Use a try-catch specifically for the seeking operation
        try {
          // Ensure the time is within the valid range for the audio
          const safeTime = Math.max(0, currentTime);
          audio.currentTime = safeTime;

          // Log the actual time after seeking for debugging
          console.log(`After seeking, aligned audio time is now: ${audio.currentTime.toFixed(2)}s`);
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
      console.log(`Starting aligned narration playback at ${currentTime}s`);

      // Add a small delay before playing if we just performed a seek
      // This helps avoid playback issues after seeking
      if (audio._customSeeking) {
        setTimeout(() => {
          console.log('Playing after seek delay');
          audio.play().catch(error => {
            console.error('Error playing aligned narration:', error);

            // Try to recover by reloading and playing again
            if (alignedNarrationCache.url) {
              console.log('Attempting to recover from play error by reloading audio');
              audio.src = alignedNarrationCache.url;
              audio.load();
              setTimeout(() => {
                try {
                  audio.currentTime = currentTime;
                  audio.play();
                } catch (e) {
                  console.error('Recovery attempt failed:', e);
                }
              }, 100);
            }
          });
          audio._customSeeking = false;
        }, 50);
      } else {
        audio.play().catch(error => {
          console.error('Error playing aligned narration:', error);

          // Try to recover by reloading and playing again
          if (alignedNarrationCache.url) {
            console.log('Attempting to recover from play error by reloading audio');
            audio.src = alignedNarrationCache.url;
            audio.load();
            setTimeout(() => {
              try {
                audio.currentTime = currentTime;
                audio.play();
              } catch (e) {
                console.error('Recovery attempt failed:', e);
              }
            }, 100);
          }
        });
      }
    } else if (!isPlaying && !audio.paused) {
      console.log(`Pausing aligned narration at ${currentTime}s`);
      audio.pause();
    } else if (isPlaying && !audio.paused) {
      // Already playing, just log for debugging
      console.log(`Aligned narration already playing at ${audio.currentTime}s (requested: ${currentTime}s)`);
    }
  } catch (error) {
    console.error('Error in playAlignedNarration:', error);
    return false;
  }

  // If we got here, playback was successful
  return true;
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
 * @param {boolean} preserveAudioElement - Whether to preserve the audio element for reuse
 * @param {boolean} preserveCache - Whether to preserve the cache (URL and blob)
 */
export const cleanupAlignedNarration = (preserveAudioElement = false, preserveCache = false) => {
  // ALWAYS preserve both audio element and cache during normal operation
  // Only clean up when explicitly told not to preserve (like when unmounting)
  preserveAudioElement = true;
  preserveCache = true;

  // Skip cleanup entirely during normal operation to avoid stuttering
  if (alignedAudioElement) {
    console.log('Skipping unnecessary cleanup to avoid stuttering');
    return;
  }

  console.log(`Cleaning up aligned narration resources (preserveAudioElement: ${preserveAudioElement}, preserveCache: ${preserveCache})`);

  // Store the current cache if we're preserving it
  const oldCache = preserveCache ? { ...alignedNarrationCache } : null;

  // Properly clean up the audio element
  if (alignedAudioElement) {
    try {
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

      // Only clear the source if we're not preserving the cache
      if (!preserveCache) {
        alignedAudioElement.src = '';
        alignedAudioElement.load();
      }
    } catch (e) {
      console.warn('Error during audio cleanup:', e);
    }
  }

  // Revoke the URL to free up memory, but only if we're not preserving the cache
  if (!preserveCache && alignedNarrationCache.url) {
    try {
      URL.revokeObjectURL(alignedNarrationCache.url);
      console.log('Revoked object URL:', alignedNarrationCache.url);
    } catch (e) {
      console.warn('Error revoking object URL:', e);
    }
  }

  // Reset the cache, but restore it if we're preserving it
  if (preserveCache && oldCache) {
    // Keep the existing cache
    console.log('Preserving aligned narration cache');
  } else {
    // Reset the cache
    alignedNarrationCache = {
      blob: null,
      url: null,
      timestamp: null,
      subtitleTimestamps: {}
    };
  }

  // Only clear the audio element reference if we're not preserving it
  if (!preserveAudioElement) {
    alignedAudioElement = null;
  }

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
