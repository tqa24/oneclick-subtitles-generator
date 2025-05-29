import { useEffect } from 'react';
import { enhanceF5TTSNarrations } from '../../../utils/narrationEnhancer';

/**
 * Custom hook for managing narration cache operations
 * @param {Object} params - Parameters
 * @param {Array} params.generationResults - Current generation results
 * @param {Function} params.setGenerationResults - Function to set generation results
 * @param {Function} params.setGenerationStatus - Function to set generation status
 * @param {string} params.subtitleSource - Selected subtitle source
 * @param {Array} params.originalSubtitles - Original subtitles
 * @param {Array} params.translatedSubtitles - Translated subtitles
 * @param {Array} params.subtitles - Fallback subtitles
 * @param {Function} params.t - Translation function
 */
const useNarrationCache = ({
  generationResults,
  setGenerationResults,
  setGenerationStatus,
  subtitleSource,
  originalSubtitles,
  translatedSubtitles,
  subtitles,
  t
}) => {
  // Listen for narrations loaded from cache event
  useEffect(() => {
    const handleNarrationsLoadedFromCache = (event) => {
      if (event.detail && event.detail.narrations) {
        // Only update if we don't already have results
        if (!generationResults || generationResults.length === 0) {
          // Get the narrations from the event
          const cachedNarrations = event.detail.narrations;

          // Immediately update the generation results
          setGenerationResults(cachedNarrations);

          // Show a status message
          setGenerationStatus(t('narration.loadedFromCache', 'Loaded narrations from previous session'));

          // Update global narration references
          if (subtitleSource === 'original') {
            window.originalNarrations = [...cachedNarrations];
          } else {
            window.translatedNarrations = [...cachedNarrations];
          }

          // Dispatch a custom event to notify other components
          const updateEvent = new CustomEvent('narrations-updated', {
            detail: {
              source: subtitleSource,
              narrations: cachedNarrations,
              fromCache: true
            }
          });
          window.dispatchEvent(updateEvent);

          // Force a re-render after a short delay to ensure the UI updates
          setTimeout(() => {
            setGenerationStatus(t('narration.loadedFromCacheComplete', 'Successfully loaded narrations from previous session'));
          }, 200);
        }
      }
    };

    // Handle F5-TTS narrations loaded from cache
    const handleF5TTSNarrationsLoadedFromCache = (event) => {
      if (event.detail && event.detail.narrations) {
        // Only update if we don't already have results
        if (!generationResults || generationResults.length === 0) {
          // Get the narrations from the event
          const cachedNarrations = event.detail.narrations;

          // Get subtitles for enhancing narrations with timing information
          const subtitlesForEnhancement = originalSubtitles || subtitles || [];

          // Enhance F5-TTS narrations with timing information from subtitles
          const enhancedNarrations = enhanceF5TTSNarrations(cachedNarrations, subtitlesForEnhancement);

          // Log the enhanced narrations for debugging
          console.log('Enhanced F5-TTS narrations from cache:', enhancedNarrations);

          // Immediately update the generation results
          setGenerationResults(enhancedNarrations);

          // Show a status message
          setGenerationStatus(t('narration.loadedFromCache', 'Loaded narrations from previous session'));

          // Update global narration references
          if (subtitleSource === 'original') {
            window.originalNarrations = [...enhancedNarrations];
          } else {
            window.translatedNarrations = [...enhancedNarrations];
          }

          // Dispatch a custom event to notify other components
          const updateEvent = new CustomEvent('narrations-updated', {
            detail: {
              source: subtitleSource,
              narrations: enhancedNarrations,
              fromCache: true
            }
          });
          window.dispatchEvent(updateEvent);

          // Force a re-render after a short delay to ensure the UI updates
          setTimeout(() => {
            setGenerationStatus(t('narration.loadedFromCacheComplete', 'Successfully loaded narrations from previous session'));
          }, 200);
        }
      }
    };

    // Add event listeners
    window.addEventListener('narrations-loaded-from-cache', handleNarrationsLoadedFromCache);
    window.addEventListener('f5tts-narrations-loaded-from-cache', handleF5TTSNarrationsLoadedFromCache);

    // Clean up
    return () => {
      window.removeEventListener('narrations-loaded-from-cache', handleNarrationsLoadedFromCache);
      window.removeEventListener('f5tts-narrations-loaded-from-cache', handleF5TTSNarrationsLoadedFromCache);
    };
  }, [generationResults, setGenerationResults, setGenerationStatus, subtitleSource, originalSubtitles, subtitles, t]);
};

export default useNarrationCache;
