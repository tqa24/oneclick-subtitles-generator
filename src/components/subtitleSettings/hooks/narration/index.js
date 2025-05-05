import { useState, useRef } from 'react';
import useNarrationState from './useNarrationState';
import useNarrationEvents from './useNarrationEvents';
import useNarrationPlayback from './useNarrationPlayback';
import useNarrationEffects from './useNarrationEffects';

/**
 * Custom hook for managing narration playback
 *
 * @param {Object} videoRef - Reference to the video element
 * @param {Array} originalNarrations - Original narration audio files
 * @param {Array} translatedNarrations - Translated narration audio files
 * @param {string} serverUrl - Server URL for audio files
 * @returns {Object} - Narration state and handlers
 */
const useNarration = (videoRef, originalNarrations = [], translatedNarrations = [], serverUrl) => {
  // Audio refs for narration playback
  const audioRefs = useRef({});
  const audioDurationsRef = useRef({});
  
  // Get basic narration state
  const narrationState = useNarrationState(originalNarrations, translatedNarrations);
  
  // Handle narration events
  const narrationEvents = useNarrationEvents(
    narrationState.setInternalOriginalNarrations,
    narrationState.setInternalTranslatedNarrations,
    narrationState.currentNarration,
    narrationState.setCurrentNarration,
    narrationState.narrationSource,
    audioRefs
  );
  
  // Handle narration playback
  const narrationPlayback = useNarrationPlayback(
    videoRef,
    narrationState.narrationVolume,
    narrationState.narrationSource,
    narrationState.currentNarration,
    narrationState.setCurrentNarration,
    audioRefs,
    audioDurationsRef,
    serverUrl
  );
  
  // Handle narration effects
  useNarrationEffects(
    videoRef,
    narrationState.videoVolume,
    narrationState.narrationVolume,
    audioRefs,
    narrationState.hasOriginalNarrations,
    narrationState.hasTranslatedNarrations,
    narrationState.currentNarration,
    narrationState.setNarrationSource
  );
  
  return {
    ...narrationState,
    playNarration: narrationPlayback.playNarration,
    audioRefs
  };
};

export default useNarration;
