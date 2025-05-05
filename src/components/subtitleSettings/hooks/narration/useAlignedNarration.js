import { useState, useEffect, useRef, useCallback } from 'react';
import {
  generateAlignedNarration as generateAlignedNarrationService,
  playAlignedNarration as playAlignedNarrationService,
  setAlignedNarrationVolume as setAlignedNarrationVolumeService,
  cleanupAlignedNarration as cleanupAlignedNarrationService,
  isAlignedNarrationAvailable,
  getAlignedAudioElement as getAlignedAudioElementService
} from '../../../../services/alignedNarrationService';

// Utility function to create a deep hash of an object for comparison
const createHash = (obj) => {
  if (!obj) return 'null';

  // For arrays, hash each element and join
  if (Array.isArray(obj)) {
    return obj.map(item => createHash(item)).join('|');
  }

  // For objects, sort keys and hash each key-value pair
  if (typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .map(key => {
        // Only include specific properties we care about for comparison
        if (['id', 'subtitle_id', 'start', 'end', 'filename', 'success'].includes(key)) {
          return `${key}:${createHash(obj[key])}`;
        }
        return '';
      })
      .filter(Boolean)
      .join('|');
  }

  // For primitives, convert to string
  return String(obj);
};

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

  // Refs to track changes in narration results and subtitle timings
  const lastGenerationResultsHashRef = useRef('');
  const lastSubtitleTimingsHashRef = useRef('');
  const regenerationTimeoutRef = useRef(null);
  const lastRegenerationTimeRef = useRef(0);

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

  const getAlignedAudioElement = useCallback(() => {
    return getAlignedAudioElementService();
  }, []);

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

      // Get all subtitles from the video for timing information
      const allSubtitles = [];

      // Try to get subtitles from window.subtitles (main source)
      if (window.subtitles && Array.isArray(window.subtitles)) {
        console.log('Using window.subtitles for timing information');
        allSubtitles.push(...window.subtitles);
      }

      // Also try original and translated subtitles
      if (window.originalSubtitles && Array.isArray(window.originalSubtitles)) {
        console.log('Using window.originalSubtitles for timing information');
        allSubtitles.push(...window.originalSubtitles);
      }

      if (window.translatedSubtitles && Array.isArray(window.translatedSubtitles)) {
        console.log('Using window.translatedSubtitles for timing information');
        allSubtitles.push(...window.translatedSubtitles);
      }

      // Create a map for faster lookup
      const subtitleMap = {};
      allSubtitles.forEach(sub => {
        if (sub.id !== undefined) {
          subtitleMap[sub.id] = sub;
        }
      });

      // Add timing information to each narration result
      const enhancedResults = generationResults.map(result => {
        const subtitle = subtitleMap[result.subtitle_id];

        // If we found a matching subtitle, use its timing
        if (subtitle && typeof subtitle.start === 'number' && typeof subtitle.end === 'number') {
          console.log(`Found timing for subtitle ${result.subtitle_id}: ${subtitle.start}s - ${subtitle.end}s`);
          return {
            ...result,
            start: subtitle.start,
            end: subtitle.end
          };
        }

        // Otherwise, keep existing timing or use defaults
        return {
          ...result,
          start: result.start || 0,
          end: result.end || (result.start ? result.start + 5 : 5)
        };
      });

      console.log('Enhanced narration results with timing information:', enhancedResults);

      // Generate the aligned narration with the enhanced results
      await generateAlignedNarrationService(enhancedResults, setAlignedStatus);

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

            // First, ensure each narration result has the correct timing information
            // We need to find the corresponding subtitle for each narration result
            // This is critical for proper alignment

            // Get all subtitles from the video
            const allSubtitles = [];

            // Try to get subtitles from window.subtitles (main source)
            if (window.subtitles && Array.isArray(window.subtitles)) {
              console.log('Using window.subtitles for timing information');
              allSubtitles.push(...window.subtitles);
            }

            // Also try original and translated subtitles
            if (window.originalSubtitles && Array.isArray(window.originalSubtitles)) {
              console.log('Using window.originalSubtitles for timing information');
              allSubtitles.push(...window.originalSubtitles);
            }

            if (window.translatedSubtitles && Array.isArray(window.translatedSubtitles)) {
              console.log('Using window.translatedSubtitles for timing information');
              allSubtitles.push(...window.translatedSubtitles);
            }

            // Create a map for faster lookup
            const subtitleMap = {};
            allSubtitles.forEach(sub => {
              if (sub.id !== undefined) {
                subtitleMap[sub.id] = sub;
              }
            });

            // Add timing information to each narration result
            const enhancedResults = generationResults.map(result => {
              const subtitle = subtitleMap[result.subtitle_id];

              // If we found a matching subtitle, use its timing
              if (subtitle && typeof subtitle.start === 'number' && typeof subtitle.end === 'number') {
                console.log(`Found timing for subtitle ${result.subtitle_id}: ${subtitle.start}s - ${subtitle.end}s`);
                return {
                  ...result,
                  start: subtitle.start,
                  end: subtitle.end
                };
              }

              // Otherwise, keep existing timing or use defaults
              return {
                ...result,
                start: result.start || 0,
                end: result.end || (result.start ? result.start + 5 : 5)
              };
            });

            console.log('Enhanced narration results with timing information:', enhancedResults);

            // Generate the aligned narration with the enhanced results
            await generateAlignedNarrationService(enhancedResults, setAlignedStatus);

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

  // Listen for subtitle timing changes via custom events
  useEffect(() => {
    // Skip if aligned mode is not enabled
    if (!useAlignedMode) {
      return;
    }

    // Function to handle subtitle timing changes
    const handleSubtitleTimingChange = () => {
      console.log('Subtitle timing change event detected');

      // Clear any existing timeout
      if (regenerationTimeoutRef.current) {
        clearTimeout(regenerationTimeoutRef.current);
      }

      // Debounce regeneration to avoid excessive regeneration during rapid changes
      // Only regenerate if it's been at least 2 seconds since the last regeneration
      const now = Date.now();
      const timeSinceLastRegeneration = now - lastRegenerationTimeRef.current;
      const debounceDelay = Math.max(0, 2000 - timeSinceLastRegeneration);

      console.log(`Scheduling regeneration in ${debounceDelay}ms due to subtitle timing change event`);

      regenerationTimeoutRef.current = setTimeout(async () => {
        console.log('Auto-regenerating aligned narration due to subtitle timing change event');

        // Update the last regeneration time
        lastRegenerationTimeRef.current = Date.now();

        try {
          // Regenerate the aligned narration
          await regenerateAlignedNarration();

          // After regeneration is complete, check if the video is playing
          // and explicitly start playing the aligned narration
          if (videoRef?.current && !videoRef.current.paused && isAlignedAvailable) {
            console.log('Video is playing, starting aligned narration playback after event-triggered regeneration');
            const currentTime = videoRef.current.currentTime;

            // Force a small delay to ensure the audio is loaded
            setTimeout(() => {
              playAlignedNarration(currentTime, true);

              // Also get the audio element and set its playback rate to match the video
              const audio = getAlignedAudioElement();
              if (audio && videoRef.current) {
                audio.playbackRate = videoRef.current.playbackRate;
              }
            }, 100);
          }
        } catch (error) {
          console.error('Error during event-triggered regeneration:', error);
        }
      }, debounceDelay);
    };

    // Listen for custom events that might be dispatched when subtitle timings change
    window.addEventListener('subtitle-timing-changed', handleSubtitleTimingChange);
    window.addEventListener('subtitles-updated', handleSubtitleTimingChange);

    // Clean up event listeners
    return () => {
      window.removeEventListener('subtitle-timing-changed', handleSubtitleTimingChange);
      window.removeEventListener('subtitles-updated', handleSubtitleTimingChange);

      if (regenerationTimeoutRef.current) {
        clearTimeout(regenerationTimeoutRef.current);
      }
    };
  }, [useAlignedMode, regenerateAlignedNarration, videoRef, isAlignedAvailable, playAlignedNarration, getAlignedAudioElement]);

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

  // Track the last time we updated the audio position
  const lastUpdateTimeRef = useRef(0);

  // Handle video timeupdate to sync aligned narration
  useEffect(() => {
    // Minimum time between updates in milliseconds
    const updateIntervalMs = 500; // Only update every 500ms during normal playback

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
      // Mark that we're seeking
      isSeekingRef.current = true;

      // When seeking starts, immediately pause the audio to prevent
      // it from continuing to play at the wrong position
      if (useAlignedMode && isAlignedAvailable) {
        playAlignedNarration(videoRef.current.currentTime, false);
      }
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
      console.log(`Video paused at ${videoRef.current.currentTime.toFixed(2)}s`);
      playAlignedNarration(videoRef.current.currentTime, false);
    };

    // Handle rate change events to keep audio in sync with video speed
    const handleRateChange = () => {
      if (!videoRef?.current || !useAlignedMode || !isAlignedAvailable) return;

      // Get the audio element and match its playback rate to the video
      const audio = getAlignedAudioElement();
      if (audio) {
        const newRate = videoRef.current.playbackRate;
        console.log(`Video playback rate changed to ${newRate}, updating audio`);

        // Update audio playback rate
        audio.playbackRate = newRate;

        // Also sync position since rate changes can cause sync issues
        playAlignedNarration(videoRef.current.currentTime, !videoRef.current.paused);
      }
    };

    // Add event listeners to video
    if (videoRef && videoRef.current && useAlignedMode) {
      videoRef.current.addEventListener('timeupdate', handleTimeUpdate);
      videoRef.current.addEventListener('seeking', handleSeeking);
      videoRef.current.addEventListener('seeked', handleSeeked);
      videoRef.current.addEventListener('play', handlePlay);
      videoRef.current.addEventListener('pause', handlePause);
      videoRef.current.addEventListener('ratechange', handleRateChange);
    }

    return () => {
      // Clean up event listeners
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
    getAlignedAudioElement
  ]);

  // Auto-regenerate aligned narration when narration results or subtitle timings change
  useEffect(() => {
    // Skip if aligned mode is not enabled
    if (!useAlignedMode) {
      return;
    }

    // Skip if we're already generating
    if (isGeneratingAligned) {
      return;
    }

    // Skip if we don't have any narration results
    if (!generationResults || generationResults.length === 0) {
      return;
    }

    // Get all subtitles for timing information
    const allSubtitles = [];

    // Try to get subtitles from window.subtitles (main source)
    if (window.subtitles && Array.isArray(window.subtitles)) {
      allSubtitles.push(...window.subtitles);
    }

    // Also try original and translated subtitles
    if (window.originalSubtitles && Array.isArray(window.originalSubtitles)) {
      allSubtitles.push(...window.originalSubtitles);
    }

    if (window.translatedSubtitles && Array.isArray(window.translatedSubtitles)) {
      allSubtitles.push(...window.translatedSubtitles);
    }

    // Create hashes for comparison
    const currentGenerationResultsHash = createHash(generationResults);
    const currentSubtitleTimingsHash = createHash(allSubtitles);

    // Check if anything has changed
    const hasGenerationResultsChanged = currentGenerationResultsHash !== lastGenerationResultsHashRef.current;
    const hasSubtitleTimingsChanged = currentSubtitleTimingsHash !== lastSubtitleTimingsHashRef.current;

    // Update the hash refs
    lastGenerationResultsHashRef.current = currentGenerationResultsHash;
    lastSubtitleTimingsHashRef.current = currentSubtitleTimingsHash;

    // If nothing has changed, skip regeneration
    if (!hasGenerationResultsChanged && !hasSubtitleTimingsChanged) {
      return;
    }

    console.log('Detected changes in narration results or subtitle timings');

    // Clear any existing timeout
    if (regenerationTimeoutRef.current) {
      clearTimeout(regenerationTimeoutRef.current);
    }

    // Debounce regeneration to avoid excessive regeneration during rapid changes
    // Only regenerate if it's been at least 2 seconds since the last regeneration
    const now = Date.now();
    const timeSinceLastRegeneration = now - lastRegenerationTimeRef.current;
    const debounceDelay = Math.max(0, 2000 - timeSinceLastRegeneration);

    console.log(`Scheduling regeneration in ${debounceDelay}ms`);

    regenerationTimeoutRef.current = setTimeout(async () => {
      console.log('Auto-regenerating aligned narration due to changes');

      // Update the last regeneration time
      lastRegenerationTimeRef.current = Date.now();

      try {
        // Regenerate the aligned narration
        await regenerateAlignedNarration();

        // After regeneration is complete, check if the video is playing
        // and explicitly start playing the aligned narration
        if (videoRef?.current && !videoRef.current.paused && isAlignedAvailable) {
          console.log('Video is playing, starting aligned narration playback after regeneration');
          const currentTime = videoRef.current.currentTime;

          // Force a small delay to ensure the audio is loaded
          setTimeout(() => {
            playAlignedNarration(currentTime, true);

            // Also get the audio element and set its playback rate to match the video
            const audio = getAlignedAudioElement();
            if (audio && videoRef.current) {
              audio.playbackRate = videoRef.current.playbackRate;
            }
          }, 100);
        }
      } catch (error) {
        console.error('Error during auto-regeneration:', error);
      }
    }, debounceDelay);

    // Clean up the timeout when the component unmounts or when dependencies change
    return () => {
      if (regenerationTimeoutRef.current) {
        clearTimeout(regenerationTimeoutRef.current);
      }
    };
  }, [useAlignedMode, isGeneratingAligned, generationResults, regenerateAlignedNarration, videoRef, isAlignedAvailable, playAlignedNarration, getAlignedAudioElement]);

  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      // Clear any existing timeout
      if (regenerationTimeoutRef.current) {
        clearTimeout(regenerationTimeoutRef.current);
      }

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
