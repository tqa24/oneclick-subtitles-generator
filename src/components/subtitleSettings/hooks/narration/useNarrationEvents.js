import { useEffect } from 'react';
import { cleanupAudioElement } from '../../utils/AudioUtils';

/**
 * Hook to handle narration events
 *
 * @param {Function} setInternalOriginalNarrations - Setter for original narrations
 * @param {Function} setInternalTranslatedNarrations - Setter for translated narrations
 * @param {Object} currentNarration - Current narration being played
 * @param {Function} setCurrentNarration - Setter for current narration
 * @param {string} narrationSource - Source of narration (original/translated)
 * @param {Object} audioRefs - References to audio elements
 * @returns {Object} - Event handlers
 */
const useNarrationEvents = (
  setInternalOriginalNarrations,
  setInternalTranslatedNarrations,
  currentNarration,
  setCurrentNarration,
  narrationSource,
  audioRefs
) => {
  // Listen for narrations-updated and narration-retried events
  useEffect(() => {
    const handleNarrationsUpdated = (event) => {

      if (event.detail.source === 'original') {
        setInternalOriginalNarrations(event.detail.narrations);

        // If narrations were cleared (empty array), also clear any playing audio
        if (event.detail.narrations.length === 0) {

          // Stop any currently playing narration
          if (currentNarration && audioRefs.current[currentNarration.subtitle_id]) {
            audioRefs.current[currentNarration.subtitle_id].pause();
            setCurrentNarration(null);
          }
          // Clear audio refs to prevent playing old audio
          audioRefs.current = {};
        }
      } else {
        setInternalTranslatedNarrations(event.detail.narrations);

        // If narrations were cleared (empty array), also clear any playing audio
        if (event.detail.narrations.length === 0 && narrationSource === 'translated') {

          // Stop any currently playing narration
          if (currentNarration && audioRefs.current[currentNarration.subtitle_id]) {
            audioRefs.current[currentNarration.subtitle_id].pause();
            setCurrentNarration(null);
          }
        }
      }
    };

    // Handle narration retry events
    const handleNarrationRetried = (event) => {

      // narration is destructured but not used directly
      const { source, /* narration, */ narrations } = event.detail;

      // Update the appropriate narration array
      if (source === 'original') {
        setInternalOriginalNarrations(narrations);

      } else if (source === 'translated') {
        setInternalTranslatedNarrations(narrations);

      }

      // AGGRESSIVE FIX: Always clean up ALL audio elements when any narration is retried
      // This ensures that all audio elements are recreated with fresh URLs


      // Stop any currently playing narration
      if (currentNarration && audioRefs.current[currentNarration.subtitle_id]) {
        audioRefs.current[currentNarration.subtitle_id].pause();
      }

      // Clear current narration state
      setCurrentNarration(null);

      // Clean up all audio elements
      Object.keys(audioRefs.current).forEach(key => {
        const audio = audioRefs.current[key];
        if (audio) {

          cleanupAudioElement(audio);
        }
      });

      // Reset the audio refs object
      audioRefs.current = {};


    };

    // We're now using the narration-retried event for both Gemini and F5-TTS

    window.addEventListener('narrations-updated', handleNarrationsUpdated);
    window.addEventListener('narration-retried', handleNarrationRetried);

    // Also check localStorage on mount
    try {
      const storedOriginal = localStorage.getItem('originalNarrations');
      if (storedOriginal) {
        const parsed = JSON.parse(storedOriginal);
        if (parsed && parsed.length > 0) {
          setInternalOriginalNarrations(parsed);
        }
      }

      const storedTranslated = localStorage.getItem('translatedNarrations');
      if (storedTranslated) {
        const parsed = JSON.parse(storedTranslated);
        if (parsed && parsed.length > 0) {
          setInternalTranslatedNarrations(parsed);
        }
      }
    } catch (e) {
      console.error('Error loading narrations from localStorage:', e);
    }

    return () => {
      window.removeEventListener('narrations-updated', handleNarrationsUpdated);
      window.removeEventListener('narration-retried', handleNarrationRetried);
    };
  }, [
    currentNarration,
    narrationSource,
    setInternalOriginalNarrations,
    setInternalTranslatedNarrations,
    setCurrentNarration,
    audioRefs
  ]);

  return {};
};

export default useNarrationEvents;
