/**
 * Hook for managing aligned narration state
 */
import { useState, useRef, useCallback } from 'react';
import {
  setAlignedNarrationVolume as setAlignedNarrationVolumeService,
  cleanupAlignedNarration as cleanupAlignedNarrationService,
  getAlignedAudioElement as getAlignedAudioElementService,
  playAlignedNarration as playAlignedNarrationService
} from '../../../../services/alignedNarrationService';

/**
 * Hook for managing aligned narration state
 * @returns {Object} - Aligned narration state and handlers
 */
const useAlignedNarrationState = () => {
  // State for aligned narration
  const [isGeneratingAligned, setIsGeneratingAligned] = useState(false);
  const [alignedStatus, setAlignedStatus] = useState(null);
  const [isAlignedAvailable, setIsAlignedAvailable] = useState(false);

  // Refs for tracking state
  const lastVideoTimeRef = useRef(0);
  const isSeekingRef = useRef(false);
  const lastUpdateTimeRef = useRef(0);
  const lastGenerationResultsHashRef = useRef('');
  const lastSubtitleTimingsHashRef = useRef('');
  const regenerationTimeoutRef = useRef(null);
  const lastRegenerationTimeRef = useRef(0);

  // Memoize service functions to avoid dependency issues
  const playAlignedNarration = useCallback((currentTime, isPlaying) => {
    playAlignedNarrationService(currentTime, isPlaying);
  }, []);

  const setAlignedNarrationVolume = useCallback((volume) => {
    setAlignedNarrationVolumeService(volume);
  }, []);

  const cleanupAlignedNarration = useCallback((preserveAudioElement = true, preserveCache = true, force = false) => {
    cleanupAlignedNarrationService(preserveAudioElement, preserveCache, force);
  }, []);

  const getAlignedAudioElement = useCallback(() => {
    return getAlignedAudioElementService();
  }, []);

  return {
    // State
    isGeneratingAligned,
    setIsGeneratingAligned,
    alignedStatus,
    setAlignedStatus,
    isAlignedAvailable,
    setIsAlignedAvailable,

    // Refs
    lastVideoTimeRef,
    isSeekingRef,
    lastUpdateTimeRef,
    lastGenerationResultsHashRef,
    lastSubtitleTimingsHashRef,
    regenerationTimeoutRef,
    lastRegenerationTimeRef,

    // Service functions
    playAlignedNarration,
    setAlignedNarrationVolume,
    cleanupAlignedNarration,
    getAlignedAudioElement
  };
};

export default useAlignedNarrationState;
