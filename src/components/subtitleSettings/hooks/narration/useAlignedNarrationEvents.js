/**
 * Hook for handling aligned narration events
 */
import { useEffect } from 'react';
import { createHash, getAllSubtitles, createSubtitleMap, enhanceNarrationWithTiming } from './alignedNarrationUtils';

/**
 * Hook for handling aligned narration events
 * @param {Object} params - Parameters
 * @param {Object} params.videoRef - Reference to the video element
 * @param {Array} params.generationResults - Array of narration results
 * @param {boolean} params.useAlignedMode - Whether to use aligned narration mode
 * @param {Object} params.state - State from useAlignedNarrationState
 * @param {Function} params.regenerateAlignedNarration - Function to regenerate aligned narration
 * @returns {Object} - Event handlers
 */
const useAlignedNarrationEvents = ({
  videoRef,
  generationResults,
  useAlignedMode,
  state,
  regenerateAlignedNarration
}) => {
  const {
    isGeneratingAligned,
    isAlignedAvailable,
    lastGenerationResultsHashRef,
    lastSubtitleTimingsHashRef,
    regenerationTimeoutRef,
    lastRegenerationTimeRef,
    playAlignedNarration,
    getAlignedAudioElement
  } = state;

  // Listen for subtitle timing changes via custom events
  useEffect(() => {
    // Skip if aligned mode is not enabled
    if (!useAlignedMode) {
      return;
    }

    // Function to handle subtitle timing changes
    const handleSubtitleTimingChange = () => {
      console.log('Subtitle timing change event detected');

      // Skip regeneration if video is playing to avoid interrupting playback
      if (videoRef?.current && !videoRef.current.paused && isAlignedAvailable) {
        console.log('Skipping event-triggered regeneration during playback to avoid interruption');
        return;
      }

      // Clear any existing timeout
      if (regenerationTimeoutRef.current) {
        clearTimeout(regenerationTimeoutRef.current);
      }

      // Use a very short debounce to be immediately responsive to narration retries
      const debounceDelay = 100; // 100ms debounce (reduced from 2s)

      // Set a timeout to regenerate after the debounce period
      regenerationTimeoutRef.current = setTimeout(async () => {
        try {
          console.log('Regenerating aligned narration due to subtitle timing change');

          // For narration retries, use an extremely short cooldown
          // to be immediately responsive to user actions
          const now = Date.now();
          if (now - lastRegenerationTimeRef.current < 500) { // 0.5 second cooldown (reduced from 2s)
            console.log('Skipping regeneration due to cooldown period');
            return;
          }

          // Update last regeneration time
          lastRegenerationTimeRef.current = now;

          // Regenerate the aligned narration
          await regenerateAlignedNarration();

          // After regeneration is complete, check if the video is playing
          // and explicitly start playing the aligned narration
          if (videoRef?.current && !videoRef.current.paused && isAlignedAvailable) {
            console.log('Video is playing, starting aligned narration playback after event-triggered regeneration');
            const currentTime = videoRef.current.currentTime;
            const playbackRate = videoRef.current.playbackRate;

            // Force a small delay to ensure the audio is loaded
            setTimeout(() => {
              playAlignedNarration(currentTime, true);

              // Also get the audio element and set its playback rate to match the video
              const audio = getAlignedAudioElement();
              if (audio && videoRef?.current) {
                audio.playbackRate = playbackRate;
              }
            }, 100);
          }
        } catch (error) {
          console.error('Error during event-triggered regeneration:', error);
        }
      }, debounceDelay);
    };

    // Function to handle narration retry events
    const handleNarrationRetried = (event) => {
      console.log('Narration retry event detected - forcing immediate regeneration', event.detail);

      // Clear any existing timeout
      if (regenerationTimeoutRef.current) {
        clearTimeout(regenerationTimeoutRef.current);
      }

      // Force immediate regeneration without debounce or cooldown
      // This ensures the aligned narration is updated immediately after a retry
      try {
        console.log('Forcing immediate regeneration due to narration retry');

        // Reset the last regeneration time to ensure cooldown doesn't block this
        lastRegenerationTimeRef.current = 0;

        // Reset the aligned narration cache completely
        // This is a direct call to the service to ensure we don't use any cached data
        if (typeof window.resetAlignedNarration === 'function') {
          console.log('Resetting aligned narration cache before regeneration');
          window.resetAlignedNarration();
        }

        // Regenerate the aligned narration immediately
        regenerateAlignedNarration();
      } catch (error) {
        console.error('Error during forced regeneration:', error);
      }
    };

    // Listen for custom events that might be dispatched when subtitle timings change
    window.addEventListener('subtitle-timing-changed', handleSubtitleTimingChange);
    window.addEventListener('subtitles-updated', handleSubtitleTimingChange);
    window.addEventListener('narration-retried', handleNarrationRetried);
    window.addEventListener('narrations-updated', handleNarrationRetried);

    // Clean up event listeners
    return () => {
      window.removeEventListener('subtitle-timing-changed', handleSubtitleTimingChange);
      window.removeEventListener('subtitles-updated', handleSubtitleTimingChange);
      window.removeEventListener('narration-retried', handleNarrationRetried);
      window.removeEventListener('narrations-updated', handleNarrationRetried);

      if (regenerationTimeoutRef.current) {
        clearTimeout(regenerationTimeoutRef.current);
      }
    };
  }, [
    useAlignedMode,
    regenerateAlignedNarration,
    videoRef,
    isAlignedAvailable,
    playAlignedNarration,
    getAlignedAudioElement,
    regenerationTimeoutRef,
    lastRegenerationTimeRef,
    // These dependencies are important for the event handlers
    generationResults,
    isGeneratingAligned
  ]);

  // Auto-regenerate aligned narration when narration results or subtitle timings change
  useEffect(() => {
    // Skip if aligned mode is not enabled
    if (!useAlignedMode) {
      return;
    }

    // Skip if we're already generating
    if (isGeneratingAligned) {
      return;
    }

    // Skip if we don't have any narration results
    if (!generationResults || generationResults.length === 0) {
      return;
    }

    // Get all subtitles for timing information
    const allSubtitles = getAllSubtitles();

    // Create a hash of the current generation results and subtitle timings
    const currentGenerationResultsHash = createHash(generationResults);
    const currentSubtitleTimingsHash = createHash(allSubtitles);

    // Check if anything has changed
    const generationResultsChanged = currentGenerationResultsHash !== lastGenerationResultsHashRef.current;
    const subtitleTimingsChanged = currentSubtitleTimingsHash !== lastSubtitleTimingsHashRef.current;

    // Only update the hash refs if this is the first time or if there are actual changes
    // This prevents unnecessary updates during normal playback
    if (lastGenerationResultsHashRef.current === '' || generationResultsChanged) {
      lastGenerationResultsHashRef.current = currentGenerationResultsHash;
    }

    if (lastSubtitleTimingsHashRef.current === '' || subtitleTimingsChanged) {
      lastSubtitleTimingsHashRef.current = currentSubtitleTimingsHash;
    }

    // If nothing has changed, skip regeneration
    if (!generationResultsChanged && !subtitleTimingsChanged) {
      return;
    }

    // Skip regeneration if video is playing to avoid interrupting playback
    // Only regenerate if video is paused or if this is the first generation
    if (videoRef?.current && !videoRef.current.paused && isAlignedAvailable) {
      console.log('Skipping regeneration during playback to avoid interruption');
      return;
    }

    console.log('Detected changes in narration results or subtitle timings');

    // Clear any existing timeout
    if (regenerationTimeoutRef.current) {
      clearTimeout(regenerationTimeoutRef.current);
    }

    // Use a very short debounce to be immediately responsive
    const debounceDelay = 100; // 100ms debounce (reduced from 2s)

    // Set a timeout to regenerate after the debounce period
    regenerationTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('Auto-regenerating aligned narration');

        // Prevent regeneration if we've recently regenerated
        // Use an extremely short cooldown period (0.5 seconds) to be immediately responsive
        const now = Date.now();
        if (now - lastRegenerationTimeRef.current < 500) { // 0.5 second cooldown (reduced from 2s)
          console.log('Skipping auto-regeneration due to cooldown period');
          return;
        }

        // Update last regeneration time
        lastRegenerationTimeRef.current = now;

        // Regenerate the aligned narration
        await regenerateAlignedNarration();

        // After regeneration is complete, check if the video is playing
        // and explicitly start playing the aligned narration
        if (videoRef?.current && !videoRef.current.paused && isAlignedAvailable) {
          console.log('Video is playing, starting aligned narration playback after regeneration');
          const currentTime = videoRef.current.currentTime;
          const playbackRate = videoRef.current.playbackRate;

          // Force a small delay to ensure the audio is loaded
          setTimeout(() => {
            playAlignedNarration(currentTime, true);

            // Also get the audio element and set its playback rate to match the video
            const audio = getAlignedAudioElement();
            if (audio && videoRef?.current) {
              audio.playbackRate = playbackRate;
            }
          }, 100);
        }
      } catch (error) {
        console.error('Error during auto-regeneration:', error);
      }
    }, debounceDelay);

    // Clean up the timeout when the component unmounts or when dependencies change
    return () => {
      if (regenerationTimeoutRef.current) {
        clearTimeout(regenerationTimeoutRef.current);
      }
    };
  }, [
    useAlignedMode,
    isGeneratingAligned,
    generationResults,
    regenerateAlignedNarration,
    videoRef,
    isAlignedAvailable,
    playAlignedNarration,
    getAlignedAudioElement,
    lastGenerationResultsHashRef,
    lastSubtitleTimingsHashRef,
    regenerationTimeoutRef,
    lastRegenerationTimeRef
  ]);

  return {};
};

export default useAlignedNarrationEvents;
