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
      console.log('useNarration - Received narrations-updated event:', event.detail);
      if (event.detail.source === 'original') {
        setInternalOriginalNarrations(event.detail.narrations);

        // If narrations were cleared (empty array), also clear any playing audio
        if (event.detail.narrations.length === 0) {
          console.log('useNarration - Original narrations cleared, stopping any playing audio');
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
          console.log('useNarration - Translated narrations cleared, stopping any playing audio');
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
      console.log('useNarration - Received narration-retried event:', event.detail);
      const { source, narration, narrations } = event.detail;

      // Update the appropriate narration array
      if (source === 'original') {
        setInternalOriginalNarrations(narrations);
        console.log('useNarration - Updated original narrations with retried narration:', narration);

        // If we're currently playing the retried narration, stop it so it can be replaced
        if (currentNarration && currentNarration.subtitle_id === narration.subtitle_id) {
          console.log('useNarration - Currently playing narration was retried, stopping playback');
          if (audioRefs.current[narration.subtitle_id]) {
            audioRefs.current[narration.subtitle_id].pause();
          }

          // Properly clean up the old audio element
          const oldAudio = audioRefs.current[narration.subtitle_id];
          if (oldAudio) {
            cleanupAudioElement(oldAudio);
          }

          // Remove the old audio reference so it will be recreated with the new audio
          delete audioRefs.current[narration.subtitle_id];

          // Clear current narration state
          setCurrentNarration(null);
        }
      } else if (source === 'translated') {
        setInternalTranslatedNarrations(narrations);
        console.log('useNarration - Updated translated narrations with retried narration:', narration);

        // If we're currently playing the retried narration, stop it so it can be replaced
        if (currentNarration && currentNarration.subtitle_id === narration.subtitle_id) {
          console.log('useNarration - Currently playing narration was retried, stopping playback');
          if (audioRefs.current[narration.subtitle_id]) {
            audioRefs.current[narration.subtitle_id].pause();
          }

          // Properly clean up the old audio element
          const oldAudio = audioRefs.current[narration.subtitle_id];
          if (oldAudio) {
            cleanupAudioElement(oldAudio);
          }

          // Remove the old audio reference so it will be recreated with the new audio
          delete audioRefs.current[narration.subtitle_id];

          // Clear current narration state
          setCurrentNarration(null);
        }
      }
    };

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
