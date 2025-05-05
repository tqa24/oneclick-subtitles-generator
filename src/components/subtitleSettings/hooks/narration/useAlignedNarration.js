import { useState, useEffect, useRef, useCallback } from 'react';
import {
  generateAlignedNarration as generateAlignedNarrationService,
  playAlignedNarration as playAlignedNarrationService,
  setAlignedNarrationVolume as setAlignedNarrationVolumeService,
  cleanupAlignedNarration as cleanupAlignedNarrationService,
  isAlignedNarrationAvailable,
  getAlignedAudioElement
} from '../../../../services/alignedNarrationService';

/**
 * Hook to manage aligned narration playback
 *
 * @param {Object} videoRef - Reference to the video element
 * @param {Array} generationResults - Array of narration results
 * @param {number} narrationVolume - Volume level for narration
 * @param {boolean} useAlignedMode - Whether to use aligned narration mode
 * @returns {Object} - Aligned narration state and handlers
 */
const useAlignedNarration = (
  videoRef,
  generationResults,
  narrationVolume,
  useAlignedMode
) => {
  const [isGeneratingAligned, setIsGeneratingAligned] = useState(false);
  const [alignedStatus, setAlignedStatus] = useState(null);
  const [isAlignedAvailable, setIsAlignedAvailable] = useState(false);
  const lastVideoTimeRef = useRef(0);
  const isSeekingRef = useRef(false);

  // Memoize functions to avoid dependency issues
  const playAlignedNarration = useCallback((currentTime, isPlaying) => {
    playAlignedNarrationService(currentTime, isPlaying);
  }, []);

  const setAlignedNarrationVolume = useCallback((volume) => {
    setAlignedNarrationVolumeService(volume);
  }, []);

  const cleanupAlignedNarration = useCallback(() => {
    cleanupAlignedNarrationService();
  }, []);

  // Generate aligned narration when needed
  useEffect(() => {
    // Only generate if aligned mode is enabled and we have narration results
    if (useAlignedMode && generationResults && generationResults.length > 0) {
      // Only generate if we don't already have aligned narration
      if (!isAlignedAvailable || !isAlignedNarrationAvailable()) {
        // Generate the aligned narration
        const generateAlignedAudio = async () => {
          try {
            setIsGeneratingAligned(true);
            setAlignedStatus({ status: 'generating', message: 'Generating aligned narration...' });

            // Generate the aligned narration
            await generateAlignedNarrationService(generationResults, setAlignedStatus);

            // Update state
            setIsAlignedAvailable(true);
            setIsGeneratingAligned(false);

            // If the video is playing, start playing the aligned narration
            if (videoRef?.current && !videoRef.current.paused) {
              playAlignedNarration(videoRef.current.currentTime, true);
            }
          } catch (error) {
            console.error('Error generating aligned narration:', error);
            setAlignedStatus({ status: 'error', message: `Error: ${error.message}` });
            setIsGeneratingAligned(false);
          }
        };

        generateAlignedAudio();
      }
    }
  }, [
    useAlignedMode,
    generationResults,
    isAlignedAvailable,
    videoRef,
    setIsGeneratingAligned,
    setAlignedStatus,
    setIsAlignedAvailable,
    playAlignedNarration
  ]);

  // Update volume when it changes
  useEffect(() => {
    setAlignedNarrationVolume(narrationVolume);
  }, [narrationVolume, setAlignedNarrationVolume]);

  // Handle toggling aligned narration mode
  useEffect(() => {
    if (useAlignedMode) {
      console.log('Aligned narration mode enabled');

      // If aligned narration is available and video is playing, start playing aligned narration
      if (isAlignedAvailable && videoRef?.current && !videoRef.current.paused) {
        const currentTime = videoRef.current.currentTime;
        playAlignedNarration(currentTime, true);
      }
    } else {
      console.log('Aligned narration mode disabled');

      // When disabling aligned mode, completely stop the aligned narration
      if (isAlignedAvailable) {
        console.log('Stopping aligned narration completely');

        // First pause it
        playAlignedNarration(0, false);

        // Then reset the audio element to ensure it's completely stopped
        const audio = getAlignedAudioElement();
        if (audio) {
          audio.pause();
          audio.currentTime = 0;

          // Remove event listeners to prevent any accidental playback
          audio.onplay = null;
          audio.onpause = null;
          audio.ontimeupdate = null;
          audio.onseeking = null;
          audio.onseeked = null;
        }
      }
    }
  }, [useAlignedMode, isAlignedAvailable, videoRef, playAlignedNarration]);

  // Force regeneration of aligned narration
  const regenerateAlignedNarration = useCallback(async () => {
    // Prevent multiple simultaneous generation attempts
    if (isGeneratingAligned) {
      console.log('Already generating aligned narration, skipping duplicate request');
      return;
    }

    // Check if we have narration results to work with
    if (!generationResults || generationResults.length === 0) {
      console.error('Cannot generate aligned narration: no narration results available');
      setAlignedStatus({
        status: 'error',
        message: 'No narration results available for alignment'
      });
      return;
    }

    try {
      // Update state
      setIsGeneratingAligned(true);
      setIsAlignedAvailable(false);
      setAlignedStatus({
        status: 'preparing',
        message: 'Preparing aligned narration...'
      });

      // Clean up existing resources
      cleanupAlignedNarration();

      // Generate the aligned narration
      await generateAlignedNarrationService(generationResults, setAlignedStatus);

      // Update state
      setIsAlignedAvailable(true);

      // If the video is playing, start playing the aligned narration
      if (videoRef?.current && !videoRef.current.paused) {
        playAlignedNarration(videoRef.current.currentTime, true);
      }
    } catch (error) {
      console.error('Error generating aligned narration:', error);
      setAlignedStatus({
        status: 'error',
        message: `Error: ${error.message}`
      });
    } finally {
      setIsGeneratingAligned(false);
    }
  }, [
    isGeneratingAligned,
    generationResults,
    setIsGeneratingAligned,
    setIsAlignedAvailable,
    cleanupAlignedNarration,
    setAlignedStatus,
    videoRef,
    playAlignedNarration
  ]);

  // Handle video timeupdate to sync aligned narration
  useEffect(() => {
    // Simplified event handlers
    const handleTimeUpdate = () => {
      if (!videoRef?.current || !useAlignedMode || !isAlignedAvailable) return;

      const currentTime = videoRef.current.currentTime;
      const isPlaying = !videoRef.current.paused;

      // Update the aligned narration to match the video
      playAlignedNarration(currentTime, isPlaying);
    };

    const handleSeeking = () => {
      // Just mark that we're seeking - no need to do anything else
      isSeekingRef.current = true;
    };

    const handleSeeked = () => {
      if (!videoRef?.current || !useAlignedMode || !isAlignedAvailable) return;

      const currentTime = videoRef.current.currentTime;
      const isPlaying = !videoRef.current.paused;

      // Update the aligned narration to match the video after seeking
      playAlignedNarration(currentTime, isPlaying);

      isSeekingRef.current = false;
    };

    const handlePlay = () => {
      if (!videoRef?.current || !useAlignedMode || !isAlignedAvailable) return;

      const currentTime = videoRef.current.currentTime;
      playAlignedNarration(currentTime, true);
    };

    const handlePause = () => {
      if (!videoRef?.current || !useAlignedMode || !isAlignedAvailable) return;

      // Just pause the audio without changing the time
      playAlignedNarration(videoRef.current.currentTime, false);
    };

    // Add event listeners to video
    if (videoRef && videoRef.current && useAlignedMode) {
      videoRef.current.addEventListener('timeupdate', handleTimeUpdate);
      videoRef.current.addEventListener('seeking', handleSeeking);
      videoRef.current.addEventListener('seeked', handleSeeked);
      videoRef.current.addEventListener('play', handlePlay);
      videoRef.current.addEventListener('pause', handlePause);
    }

    return () => {
      // Clean up event listeners
      if (videoRef && videoRef.current) {
        videoRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        videoRef.current.removeEventListener('seeking', handleSeeking);
        videoRef.current.removeEventListener('seeked', handleSeeked);
        videoRef.current.removeEventListener('play', handlePlay);
        videoRef.current.removeEventListener('pause', handlePause);
      }
    };
  }, [
    videoRef,
    useAlignedMode,
    isAlignedAvailable,
    playAlignedNarration
  ]);

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      cleanupAlignedNarration();
    };
  }, [cleanupAlignedNarration]);

  return {
    isGeneratingAligned,
    alignedStatus,
    isAlignedAvailable,
    regenerateAlignedNarration
  };
};

export default useAlignedNarration;
