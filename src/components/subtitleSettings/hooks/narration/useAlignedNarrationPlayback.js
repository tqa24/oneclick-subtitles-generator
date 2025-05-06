/**
 * Hook for handling aligned narration playback
 */
import { useEffect } from 'react';

/**
 * Hook for handling aligned narration playback
 * @param {Object} params - Parameters
 * @param {Object} params.videoRef - Reference to the video element
 * @param {boolean} params.useAlignedMode - Whether to use aligned narration mode
 * @param {Object} params.state - State from useAlignedNarrationState
 * @returns {Object} - Playback handlers
 */
const useAlignedNarrationPlayback = ({
  videoRef,
  useAlignedMode,
  state
}) => {
  const {
    isAlignedAvailable,
    lastVideoTimeRef,
    isSeekingRef,
    lastUpdateTimeRef,
    playAlignedNarration,
    getAlignedAudioElement
  } = state;

  // Sync video and audio playback
  useEffect(() => {
    if (!videoRef?.current || !useAlignedMode) {
      return;
    }

    // Constants for throttling updates
    const updateIntervalMs = 500; // Minimum time between updates during normal playback (increased from 250ms)

    // Improved event handlers with throttling for better performance
    const handleTimeUpdate = () => {
      if (!videoRef?.current || !useAlignedMode || !isAlignedAvailable) return;

      // Skip updates that are too frequent during normal playback
      const now = Date.now();
      if (!isSeekingRef.current && now - lastUpdateTimeRef.current < updateIntervalMs) {
        return;
      }

      const currentTime = videoRef.current.currentTime;
      const isPlaying = !videoRef.current.paused;

      // Store the last video time for comparison
      lastVideoTimeRef.current = currentTime;
      lastUpdateTimeRef.current = now;

      // Update the aligned narration to match the video
      playAlignedNarration(currentTime, isPlaying);
    };

    const handleSeeking = () => {
      if (!videoRef?.current || !useAlignedMode || !isAlignedAvailable) return;

      // Set seeking flag to true
      isSeekingRef.current = true;

      // We don't update audio position during seeking to avoid stuttering
      console.log('Video seeking, waiting for seeked event');
    };

    const handleSeeked = () => {
      if (!videoRef?.current || !useAlignedMode || !isAlignedAvailable) return;

      const currentTime = videoRef.current.currentTime;
      const isPlaying = !videoRef.current.paused;

      // Store the last video time
      lastVideoTimeRef.current = currentTime;
      lastUpdateTimeRef.current = Date.now();

      // Update the aligned narration to match the video after seeking
      // This is a critical sync point, so we always update here
      console.log(`Video seeked to ${currentTime.toFixed(2)}s, syncing audio`);
      playAlignedNarration(currentTime, isPlaying);

      // Reset seeking state
      isSeekingRef.current = false;
    };

    const handlePlay = () => {
      if (!videoRef?.current || !useAlignedMode || !isAlignedAvailable) return;

      const currentTime = videoRef.current.currentTime;
      lastUpdateTimeRef.current = Date.now();

      console.log(`Video play at ${currentTime.toFixed(2)}s`);
      playAlignedNarration(currentTime, true);
    };

    const handlePause = () => {
      if (!videoRef?.current || !useAlignedMode || !isAlignedAvailable) return;

      // Pause the audio without changing the time
      const currentTime = videoRef.current.currentTime;
      console.log(`Video paused at ${currentTime.toFixed(2)}s`);
      playAlignedNarration(currentTime, false);
    };

    // Handle rate change events to keep audio in sync with video speed
    const handleRateChange = () => {
      if (!videoRef?.current || !useAlignedMode || !isAlignedAvailable) return;

      // Get the audio element and match its playback rate to the video
      const audio = getAlignedAudioElement();
      if (audio) {
        const newRate = videoRef.current.playbackRate;

        // Only update if the rate has actually changed
        if (audio.playbackRate !== newRate) {
          const currentTime = videoRef.current.currentTime;
          const isPlaying = !videoRef.current.paused;
          console.log(`Video playback rate changed to ${newRate}, updating audio`);

          // Update audio playback rate
          audio.playbackRate = newRate;

          // Only sync position if there's a significant difference
          const timeDifference = Math.abs(audio.currentTime - currentTime);
          if (timeDifference > 0.3) {
            playAlignedNarration(currentTime, isPlaying);
          }
        }
      }
    };

    // Add event listeners to the video element
    videoRef.current.addEventListener('timeupdate', handleTimeUpdate);
    videoRef.current.addEventListener('seeking', handleSeeking);
    videoRef.current.addEventListener('seeked', handleSeeked);
    videoRef.current.addEventListener('play', handlePlay);
    videoRef.current.addEventListener('pause', handlePause);
    videoRef.current.addEventListener('ratechange', handleRateChange);

    // Clean up event listeners
    return () => {
      if (videoRef && videoRef.current) {
        videoRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        videoRef.current.removeEventListener('seeking', handleSeeking);
        videoRef.current.removeEventListener('seeked', handleSeeked);
        videoRef.current.removeEventListener('play', handlePlay);
        videoRef.current.removeEventListener('pause', handlePause);
        videoRef.current.removeEventListener('ratechange', handleRateChange);
      }
    };
  }, [
    videoRef,
    useAlignedMode,
    isAlignedAvailable,
    playAlignedNarration,
    getAlignedAudioElement,
    lastVideoTimeRef,
    isSeekingRef,
    lastUpdateTimeRef
  ]);

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
  }, [useAlignedMode, isAlignedAvailable, videoRef, playAlignedNarration, getAlignedAudioElement]);

  return {};
};

export default useAlignedNarrationPlayback;
