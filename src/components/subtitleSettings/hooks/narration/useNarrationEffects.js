import { useEffect } from 'react';

/**
 * Hook to handle narration side effects
 * 
 * @param {Object} videoRef - Reference to the video element
 * @param {number} videoVolume - Volume level for video
 * @param {number} narrationVolume - Volume level for narration
 * @param {Object} audioRefs - References to audio elements
 * @param {boolean} hasOriginalNarrations - Whether original narrations are available
 * @param {boolean} hasTranslatedNarrations - Whether translated narrations are available
 * @param {Object} currentNarration - Current narration being played
 * @param {Function} setNarrationSource - Setter for narration source
 */
const useNarrationEffects = (
  videoRef,
  videoVolume,
  narrationVolume,
  audioRefs,
  hasOriginalNarrations,
  hasTranslatedNarrations,
  currentNarration,
  setNarrationSource
) => {
  // Set narration source based on available narrations
  useEffect(() => {
    // If original narrations are available, set source to original
    if (hasOriginalNarrations) {
      setNarrationSource('original');
      console.log('useNarration: Setting narration source to original');
    }
    // If original narrations are not available but translated narrations are, set source to translated
    else if (!hasOriginalNarrations && hasTranslatedNarrations) {
      setNarrationSource('translated');
      console.log('useNarration: Setting narration source to translated');
    }
    // If no narrations are available, don't set any source
    else {
      setNarrationSource('');
      console.log('useNarration: No narrations available, clearing narration source');

      // Also stop any currently playing narration
      if (currentNarration && audioRefs.current[currentNarration.subtitle_id]) {
        audioRefs.current[currentNarration.subtitle_id].pause();
      }
    }
  }, [
    hasOriginalNarrations, 
    hasTranslatedNarrations, 
    currentNarration, 
    setNarrationSource, 
    audioRefs
  ]);

  // Update video volume when it changes
  useEffect(() => {
    if (videoRef && videoRef.current) {
      videoRef.current.volume = videoVolume;
    }
  }, [videoVolume, videoRef]);

  // Update all audio volumes when narration volume changes
  useEffect(() => {
    Object.values(audioRefs.current).forEach(audio => {
      audio.volume = narrationVolume;
    });
  }, [narrationVolume, audioRefs]);
};

export default useNarrationEffects;
