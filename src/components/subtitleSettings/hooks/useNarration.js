import { useState, useEffect, useRef } from 'react';
import { cleanupAudioElement, tryDirectPlayback } from '../utils/AudioUtils';

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
  // State for narration menu
  const [showNarrationMenu, setShowNarrationMenu] = useState(false);
  const [narrationSource, setNarrationSource] = useState('');
  const [narrationVolume, setNarrationVolume] = useState(0.8);
  const [videoVolume, setVideoVolume] = useState(0.3);

  // Audio refs for narration playback
  const audioRefs = useRef({});
  const audioDurationsRef = useRef({});
  const [currentNarration, setCurrentNarration] = useState(null);
  // Reference for tracking last logged time (used in index.js)

  // State to track narrations internally
  const [internalOriginalNarrations, setInternalOriginalNarrations] = useState(originalNarrations || []);
  const [internalTranslatedNarrations, setInternalTranslatedNarrations] = useState(translatedNarrations || []);

  // Update internal state when props change
  useEffect(() => {
    if (originalNarrations && originalNarrations.length > 0) {
      setInternalOriginalNarrations(originalNarrations);
    }
    if (translatedNarrations && translatedNarrations.length > 0) {
      setInternalTranslatedNarrations(translatedNarrations);
    }
  }, [originalNarrations, translatedNarrations]);

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
          audioDurationsRef.current = {};
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
          delete audioDurationsRef.current[narration.subtitle_id];

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
          delete audioDurationsRef.current[narration.subtitle_id];

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
  }, [currentNarration, narrationSource]);

  // Check if any narrations are available
  const hasOriginalNarrations = internalOriginalNarrations.length > 0;
  const hasTranslatedNarrations = internalTranslatedNarrations.length > 0;
  const hasAnyNarrations = hasOriginalNarrations || hasTranslatedNarrations;

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
        setCurrentNarration(null);
      }
    }
  }, [hasOriginalNarrations, hasTranslatedNarrations, currentNarration]);

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
  }, [narrationVolume]);

  // Play a specific narration
  const playNarration = async (narration) => {
    console.log('Playing narration:', narration);

    // If we're already playing this narration, don't restart it
    if (currentNarration && currentNarration.subtitle_id === narration.subtitle_id) {
      console.log(`Already playing narration ${narration.subtitle_id}, not restarting`);
      return;
    }

    // Validate narration object
    if (!narration || !narration.subtitle_id) {
      console.error('Invalid narration object:', narration);
      return;
    }

    // Check if the narration has a filename
    if (!narration.filename) {
      console.error('Narration has no filename:', narration);

      // Try to find the narration in the global arrays and get the filename
      let updatedNarration = null;

      if (narrationSource === 'original' && window.originalNarrations) {
        updatedNarration = window.originalNarrations.find(n => n.subtitle_id === narration.subtitle_id);
      } else if (narrationSource === 'translated' && window.translatedNarrations) {
        updatedNarration = window.translatedNarrations.find(n => n.subtitle_id === narration.subtitle_id);
      }

      if (updatedNarration && updatedNarration.filename) {
        console.log(`Found updated narration with filename in global array:`, updatedNarration);
        narration = updatedNarration;
      } else {
        console.error('Could not find updated narration with filename in global arrays');
        console.log('window.originalNarrations:', window.originalNarrations);
        console.log('window.translatedNarrations:', window.translatedNarrations);
        return;
      }
    }

    // Store the subtitle data with the narration for reference
    if (!narration.subtitleData) {
      // Try to find the matching subtitle
      let subtitleData;
      if (window.subtitlesData && Array.isArray(window.subtitlesData)) {
        subtitleData = window.subtitlesData.find(sub => sub.id === narration.subtitle_id);
      }
      if (!subtitleData && window.originalSubtitles && Array.isArray(window.originalSubtitles)) {
        subtitleData = window.originalSubtitles.find(sub => sub.id === narration.subtitle_id);
      }
      if (!subtitleData && window.translatedSubtitles && Array.isArray(window.translatedSubtitles)) {
        subtitleData = window.translatedSubtitles.find(sub => sub.id === narration.subtitle_id);
      }

      if (subtitleData) {
        narration.subtitleData = subtitleData;
        console.log('Added subtitle data to narration:', subtitleData);
      } else {
        console.warn('Could not find subtitle data for narration:', narration);
      }
    }

    // Stop any currently playing narration
    if (currentNarration && audioRefs.current[currentNarration.subtitle_id]) {
      console.log('Stopping current narration:', currentNarration.subtitle_id);
      audioRefs.current[currentNarration.subtitle_id].pause();
    }

    // Set the current narration
    setCurrentNarration(narration);

    // Check if we need to get the latest version of the narration
    let latestNarration = narration;

    // Get the latest narration data from the appropriate source
    if (narrationSource === 'original' && window.originalNarrations) {
      const updatedNarration = window.originalNarrations.find(n => n.subtitle_id === narration.subtitle_id);
      if (updatedNarration) {
        latestNarration = updatedNarration;
        console.log('Using latest version of original narration:', latestNarration);
      }
    } else if (narrationSource === 'translated' && window.translatedNarrations) {
      const updatedNarration = window.translatedNarrations.find(n => n.subtitle_id === narration.subtitle_id);
      if (updatedNarration) {
        latestNarration = updatedNarration;
        console.log('Using latest version of translated narration:', latestNarration);
      }
    }

    // Always recreate the audio element for retried narrations to ensure we're using the latest version
    // Check if this is a retried narration by comparing the filename with what we might have in audioRefs
    const existingAudio = audioRefs.current[latestNarration.subtitle_id];
    const isRetried = existingAudio && existingAudio.src &&
                     !existingAudio.src.includes(latestNarration.filename);

    if (isRetried) {
      console.log(`Detected retried narration for ${latestNarration.subtitle_id}, recreating audio element`);

      // Clean up the old audio element
      if (existingAudio) {
        cleanupAudioElement(existingAudio);

        // Remove the reference
        delete audioRefs.current[latestNarration.subtitle_id];
      }
    }

    // Get or create audio element for this narration
    if (!audioRefs.current[latestNarration.subtitle_id]) {
      const audioUrl = `${serverUrl}/api/narration/audio/${latestNarration.filename}`;
      console.log('Creating new audio element for URL:', audioUrl);

      // Create a new audio element with event handlers
      const audio = new Audio(audioUrl);

      // Set volume immediately
      audio.volume = narrationVolume;
      console.log(`Setting initial audio volume to: ${narrationVolume} for narration ${latestNarration.subtitle_id}`);

      // Add enhanced error handling
      audio.addEventListener('error', async (e) => {
        console.error('Audio error:', e);
        console.error('Audio error code:', audio.error?.code);
        console.error('Audio error message:', audio.error?.message);

        // Clear current narration if there's an error
        if (currentNarration && currentNarration.subtitle_id === latestNarration.subtitle_id) {
          console.log(`Clearing current narration state for ${latestNarration.subtitle_id} due to error`);
          setCurrentNarration(null);
        }

        // Try alternative URL if this is a Gemini narration with audioData
        if (latestNarration.gemini && latestNarration.audioData) {
          console.log('Trying to play directly from audioData for Gemini narration');
          const directAudio = tryDirectPlayback(latestNarration, narrationVolume, () => {
            console.log(`Direct audio finished playing for narration ${latestNarration.subtitle_id}`);
            setCurrentNarration(null);
          });

          if (directAudio) {
            // Replace the audio reference
            audioRefs.current[latestNarration.subtitle_id] = directAudio;
          }
        }
      });

      // Store the audio duration once it's loaded
      audio.addEventListener('loadedmetadata', () => {
        console.log('Audio loaded metadata, duration:', audio.duration);
        audioDurationsRef.current[latestNarration.subtitle_id] = audio.duration;

        // Set volume again after metadata is loaded
        audio.volume = narrationVolume;
        console.log(`Setting audio volume after metadata to: ${narrationVolume} for narration ${latestNarration.subtitle_id}`);
      });

      // Add play event listener
      audio.addEventListener('play', () => {
        console.log(`Audio started playing for narration ${latestNarration.subtitle_id} with volume ${audio.volume}`);
      });

      // Add ended event listener
      audio.addEventListener('ended', () => {
        console.log(`Audio finished playing for narration ${latestNarration.subtitle_id}`);
        if (currentNarration && currentNarration.subtitle_id === latestNarration.subtitle_id) {
          console.log(`Clearing current narration state for ${latestNarration.subtitle_id}`);
          setCurrentNarration(null);
        }
      });

      // Add a safety timeout to ensure the narration state is cleared
      // even if the ended event doesn't fire for some reason
      audio.addEventListener('play', () => {
        const duration = audio.duration || 10; // Default to 10 seconds if duration is unknown
        const safetyTimeout = setTimeout(() => {
          if (currentNarration && currentNarration.subtitle_id === latestNarration.subtitle_id) {
            console.log(`Safety timeout: clearing current narration state for ${latestNarration.subtitle_id}`);
            setCurrentNarration(null);
          }
        }, (duration * 1000) + 1000); // Add 1 second buffer

        // Store the timeout ID on the audio element so we can clear it if needed
        audio._safetyTimeoutId = safetyTimeout;
      });

      // Clear the safety timeout if the audio is paused or ended
      audio.addEventListener('pause', () => {
        if (audio._safetyTimeoutId) {
          clearTimeout(audio._safetyTimeoutId);
          audio._safetyTimeoutId = null;
        }
      });

      audioRefs.current[latestNarration.subtitle_id] = audio;
    } else {
      console.log('Using existing audio element for narration:', latestNarration.subtitle_id);
    }

    // Play the narration
    const audioElement = audioRefs.current[latestNarration.subtitle_id];

    // Set volume again before playing
    audioElement.volume = narrationVolume;
    console.log(`Setting audio volume before play to: ${narrationVolume} for narration ${latestNarration.subtitle_id}`);

    // If we have the subtitle midpoint and audio duration, calculate the start time
    const audioDuration = audioDurationsRef.current[latestNarration.subtitle_id];
    console.log('Audio duration:', audioDuration);

    // Find the subtitle start time
    let subtitleStart = 0;
    if (latestNarration.subtitleData) {
      subtitleStart = typeof latestNarration.subtitleData.start === 'number' ?
        latestNarration.subtitleData.start : parseFloat(latestNarration.subtitleData.start);
    } else {
      // Try to find the subtitle data
      let subtitleData;
      if (window.subtitlesData && Array.isArray(window.subtitlesData)) {
        subtitleData = window.subtitlesData.find(sub => sub.id === latestNarration.subtitle_id);
      }
      if (!subtitleData && window.originalSubtitles && Array.isArray(window.originalSubtitles)) {
        subtitleData = window.originalSubtitles.find(sub => sub.id === latestNarration.subtitle_id);
      }
      if (!subtitleData && window.translatedSubtitles && Array.isArray(window.translatedSubtitles)) {
        subtitleData = window.translatedSubtitles.find(sub => sub.id === latestNarration.subtitle_id);
      }

      if (subtitleData) {
        subtitleStart = typeof subtitleData.start === 'number' ?
          subtitleData.start : parseFloat(subtitleData.start);
      }
    }

    if (audioDuration) {
      // Simply calculate how far we are from the subtitle start
      const videoCurrentTime = videoRef.current.currentTime;
      const timeFromSubtitleStart = videoCurrentTime - subtitleStart;

      // If we're already past the subtitle start, set audio position accordingly
      // Otherwise, start from the beginning of the audio
      const audioStartTime = Math.max(0, timeFromSubtitleStart);

      console.log('Calculated audio start time:', audioStartTime, 'from video time:', videoCurrentTime, 'and subtitle start:', subtitleStart);

      // Ensure the start time is within valid bounds
      if (audioStartTime >= 0 && audioStartTime < audioDuration) {
        audioElement.currentTime = audioStartTime;
        console.log('Setting audio currentTime to:', audioStartTime);
      } else {
        audioElement.currentTime = 0;
        console.log('Audio start time out of bounds, setting to 0');
      }
    } else {
      audioElement.currentTime = 0;
      console.log('No subtitle midpoint or audio duration, starting from beginning');
    }

    // Try to play the audio
    try {
      // Log detailed information before attempting to play
      console.log('About to play audio:', {
        audioElement: audioElement,
        src: audioElement.src,
        volume: audioElement.volume,
        readyState: audioElement.readyState,
        networkState: audioElement.networkState,
        error: audioElement.error
      });

      // Check if the audio is in a playable state
      if (audioElement.readyState < 2) { // HAVE_CURRENT_DATA = 2
        console.log('Audio not ready yet, waiting for loadeddata event');

        // Set up a one-time event listener for when the audio is ready
        const loadHandler = () => {
          console.log('Audio loaded data, now attempting to play');
          audioElement.play()
            .then(() => console.log('Audio playback started successfully'))
            .catch(error => {
              console.error('Error playing audio:', error);

              // Try direct playback as a last resort
              if (latestNarration.gemini && latestNarration.audioData) {
                const directAudio = tryDirectPlayback(latestNarration, narrationVolume, () => {
                  setCurrentNarration(null);
                });

                if (directAudio) {
                  // Replace the audio reference
                  audioRefs.current[latestNarration.subtitle_id] = directAudio;
                }
              }
            });
          audioElement.removeEventListener('loadeddata', loadHandler);
        };

        audioElement.addEventListener('loadeddata', loadHandler);

        // Set a timeout in case the loadeddata event never fires
        setTimeout(() => {
          if (audioElement.readyState < 2) {
            console.log('Timeout waiting for audio to load, trying to play anyway');
            audioElement.removeEventListener('loadeddata', loadHandler);
            audioElement.play()
              .then(() => console.log('Audio playback started after timeout'))
              .catch(error => {
                console.error('Error playing audio after timeout:', error);

                // Try direct playback as a last resort
                if (latestNarration.gemini && latestNarration.audioData) {
                  const directAudio = tryDirectPlayback(latestNarration, narrationVolume, () => {
                    setCurrentNarration(null);
                  });

                  if (directAudio) {
                    // Replace the audio reference
                    audioRefs.current[latestNarration.subtitle_id] = directAudio;
                  }
                }
              });
          }
        }, 3000);
      } else {
        // Audio is ready, play it now
        audioElement.play()
          .then(() => console.log('Audio playback started successfully'))
          .catch(error => {
            console.error('Error playing audio:', error);

            // Try direct playback as a last resort
            if (latestNarration.gemini && latestNarration.audioData) {
              const directAudio = tryDirectPlayback(latestNarration, narrationVolume, () => {
                setCurrentNarration(null);
              });

              if (directAudio) {
                // Replace the audio reference
                audioRefs.current[latestNarration.subtitle_id] = directAudio;
              }
            }
          });
      }
    } catch (error) {
      console.error('Exception trying to play audio:', error);

      // Try direct playback from audioData as a last resort
      if (latestNarration.gemini && latestNarration.audioData) {
        const directAudio = tryDirectPlayback(latestNarration, narrationVolume, () => {
          setCurrentNarration(null);
        });

        if (directAudio) {
          // Replace the audio reference
          audioRefs.current[latestNarration.subtitle_id] = directAudio;
        }
      }
    }
  };

  return {
    showNarrationMenu,
    setShowNarrationMenu,
    narrationSource,
    setNarrationSource,
    narrationVolume,
    setNarrationVolume,
    videoVolume,
    setVideoVolume,
    currentNarration,
    setCurrentNarration,
    internalOriginalNarrations,
    internalTranslatedNarrations,
    hasOriginalNarrations,
    hasTranslatedNarrations,
    hasAnyNarrations,
    playNarration,
    audioRefs
  };
};

export default useNarration;
