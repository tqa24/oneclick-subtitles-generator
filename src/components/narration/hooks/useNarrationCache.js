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
  t,
  setReferenceAudio,
  setReferenceText
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
          // Get the narrations and reference audio from the event
          const cachedNarrations = event.detail.narrations;
          const cachedReferenceAudio = event.detail.referenceAudio;

          // Get subtitles for enhancing narrations with timing information
          const subtitlesForEnhancement = originalSubtitles || subtitles || [];

          // Enhance F5-TTS narrations with timing information from subtitles
          const enhancedNarrations = enhanceF5TTSNarrations(cachedNarrations, subtitlesForEnhancement);

          // Log the enhanced narrations for debugging
          console.log('Enhanced F5-TTS narrations from cache:', enhancedNarrations);

          // Immediately update the generation results
          setGenerationResults(enhancedNarrations);

          // Restore reference audio if available
          if (cachedReferenceAudio && setReferenceAudio && setReferenceText) {
            setReferenceAudio(cachedReferenceAudio);
            setReferenceText(cachedReferenceAudio.text || '');
            console.log('Restored reference audio from F5-TTS cache');
          }

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

    // Handle Chatterbox narrations loaded from cache
    const handleChatterboxNarrationsLoadedFromCache = (event) => {
      if (event.detail && event.detail.narrations) {
        // Only update if we don't already have results
        if (!generationResults || generationResults.length === 0) {
          // Get the narrations and reference audio from the event
          const cachedNarrations = event.detail.narrations;
          const cachedReferenceAudio = event.detail.referenceAudio;

          // Immediately update the generation results
          setGenerationResults(cachedNarrations);

          // Restore reference audio if available
          if (cachedReferenceAudio && setReferenceAudio && setReferenceText) {
            setReferenceAudio(cachedReferenceAudio);
            setReferenceText(cachedReferenceAudio.text || '');
            console.log('Restored reference audio from Chatterbox cache');
          }

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

    // Add event listeners
    window.addEventListener('narrations-loaded-from-cache', handleNarrationsLoadedFromCache);
    window.addEventListener('f5tts-narrations-loaded-from-cache', handleF5TTSNarrationsLoadedFromCache);
    window.addEventListener('chatterbox-narrations-loaded-from-cache', handleChatterboxNarrationsLoadedFromCache);

    // Clean up
    return () => {
      window.removeEventListener('narrations-loaded-from-cache', handleNarrationsLoadedFromCache);
      window.removeEventListener('f5tts-narrations-loaded-from-cache', handleF5TTSNarrationsLoadedFromCache);
      window.removeEventListener('chatterbox-narrations-loaded-from-cache', handleChatterboxNarrationsLoadedFromCache);
    };
  }, [generationResults, setGenerationResults, setGenerationStatus, subtitleSource, originalSubtitles, subtitles, t, setReferenceAudio, setReferenceText]);

  // Check for cached Chatterbox narrations on mount
  useEffect(() => {
    // Only check cache if we don't have any generation results yet
    if (generationResults && generationResults.length > 0) return;

    try {
      // Get current media ID
      const getCurrentMediaId = () => {
        const currentVideoUrl = localStorage.getItem('current_youtube_url');
        const currentFileUrl = localStorage.getItem('current_file_url');

        if (currentVideoUrl) {
          // Extract video ID from YouTube URLs
          const match = currentVideoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
          return match ? match[1] : null;
        } else if (currentFileUrl) {
          return localStorage.getItem('current_file_cache_id');
        }
        return null;
      };

      const mediaId = getCurrentMediaId();
      if (!mediaId) return;

      // Check for cached Chatterbox narrations
      const cachedChatterboxData = localStorage.getItem('chatterbox_narrations_cache');
      if (cachedChatterboxData) {
        const cacheEntry = JSON.parse(cachedChatterboxData);

        // Check if cache is for current media
        if (cacheEntry.mediaId === mediaId && cacheEntry.narrations && cacheEntry.narrations.length > 0) {
          console.log('Found cached Chatterbox narrations, dispatching load event');

          // Dispatch event to load cached narrations
          window.dispatchEvent(new CustomEvent('chatterbox-narrations-loaded-from-cache', {
            detail: {
              narrations: cacheEntry.narrations,
              referenceAudio: cacheEntry.referenceAudio
            }
          }));
          return; // Exit early if we found Chatterbox cache
        }
      }

      // Check for cached F5-TTS narrations
      const cachedF5TTSData = localStorage.getItem('f5tts_narrations_cache');
      if (cachedF5TTSData) {
        const cacheEntry = JSON.parse(cachedF5TTSData);

        // Check if cache is for current media
        if (cacheEntry.mediaId === mediaId && cacheEntry.narrations && cacheEntry.narrations.length > 0) {
          console.log('Found cached F5-TTS narrations, dispatching load event');

          // Dispatch event to load cached narrations
          window.dispatchEvent(new CustomEvent('f5tts-narrations-loaded-from-cache', {
            detail: {
              narrations: cacheEntry.narrations,
              referenceAudio: cacheEntry.referenceAudio
            }
          }));
          return; // Exit early if we found narration cache
        }
      }

      // Check for standalone reference audio cache (when no narrations exist yet)
      const cachedReferenceAudioData = localStorage.getItem('reference_audio_cache');
      if (cachedReferenceAudioData) {
        const cacheEntry = JSON.parse(cachedReferenceAudioData);

        // Check if cache is for current media
        if (cacheEntry.mediaId === mediaId && cacheEntry.referenceAudio) {
          console.log('Found cached reference audio, restoring immediately');

          // Restore reference audio immediately
          if (setReferenceAudio && setReferenceText) {
            setReferenceAudio(cacheEntry.referenceAudio);
            setReferenceText(cacheEntry.referenceAudio.text || '');
            console.log('Restored standalone reference audio from cache');
          }
        }
      }
    } catch (error) {
      console.error('Error loading Chatterbox narrations from cache:', error);
    }
  }, [generationResults]);
};

export default useNarrationCache;
