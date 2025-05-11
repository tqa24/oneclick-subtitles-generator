/**
 * Hook for handling aligned narration events
 */
import { useEffect } from 'react';
// These imports are used in the commented-out code but not in the active code
// import { createHash, getAllSubtitles, createSubtitleMap, enhanceNarrationWithTiming } from './alignedNarrationUtils';

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
    // These variables are used in the commented-out code but not in the active code
    // isGeneratingAligned,
    // isAlignedAvailable,
    // lastGenerationResultsHashRef,
    // lastSubtitleTimingsHashRef,
    regenerationTimeoutRef,
    lastRegenerationTimeRef,
    // playAlignedNarration,
    // getAlignedAudioElement
  } = state;

  // Listen for manual refresh narration button events only
  useEffect(() => {
    // Skip if aligned mode is not enabled
    if (!useAlignedMode) {
      return;
    }

    // Function to handle manual refresh narration button click
    const handleManualRefreshNarration = (event) => {


      // Clear any existing timeout
      if (regenerationTimeoutRef.current) {
        clearTimeout(regenerationTimeoutRef.current);
      }

      // Force immediate regeneration without any debounce or cooldown
      try {


        // Reset the last regeneration time
        lastRegenerationTimeRef.current = 0;

        // Reset the aligned narration cache completely
        if (typeof window.resetAlignedNarration === 'function') {

          window.resetAlignedNarration();
        }

        // Regenerate the aligned narration immediately
        regenerateAlignedNarration();
      } catch (error) {
        console.error('Error during manual regeneration:', error);
      }
    };

    // Listen only for the subtitle-timing-changed event with action=manual-refresh
    // This is triggered by the "Refresh Narration" button in VideoPreview.js
    window.addEventListener('subtitle-timing-changed', (event) => {
      if (event.detail && event.detail.action === 'manual-refresh') {
        handleManualRefreshNarration(event);
      }
    });

    // Store the timeout ID in a variable to avoid closure issues
    const timeoutId = regenerationTimeoutRef.current;

    // Clean up event listeners
    return () => {
      window.removeEventListener('subtitle-timing-changed', (event) => {
        if (event.detail && event.detail.action === 'manual-refresh') {
          handleManualRefreshNarration(event);
        }
      });

      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [
    useAlignedMode,
    regenerateAlignedNarration,
    regenerationTimeoutRef,
    lastRegenerationTimeRef
  ]);

  // We've removed the automatic regeneration useEffect
  // Only manual regeneration through the "Refresh Narration" button is now supported

  return {};
};

export default useAlignedNarrationEvents;
