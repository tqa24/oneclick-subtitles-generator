import { cleanupAudioElement, tryDirectPlayback } from '../../utils/AudioUtils';
import { findSubtitleData, getLatestNarration, calculateAudioStartTime } from './narrationUtils';

/**
 * Hook to handle narration playback
 * 
 * @param {Object} videoRef - Reference to the video element
 * @param {number} narrationVolume - Volume level for narration
 * @param {string} narrationSource - Source of narration (original/translated)
 * @param {Object} currentNarration - Current narration being played
 * @param {Function} setCurrentNarration - Setter for current narration
 * @param {Object} audioRefs - References to audio elements
 * @param {Object} audioDurationsRef - References to audio durations
 * @param {string} serverUrl - Server URL for audio files
 * @returns {Object} - Playback functions
 */
const useNarrationPlayback = (
  videoRef,
  narrationVolume,
  narrationSource,
  currentNarration,
  setCurrentNarration,
  audioRefs,
  audioDurationsRef,
  serverUrl
) => {
  /**
   * Play a specific narration
   * @param {Object} narration - Narration to play
   */
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
      const subtitleData = findSubtitleData(narration);
      
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

    // Get the latest version of the narration
    const latestNarration = getLatestNarration(narration, narrationSource);

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

    // Calculate the start time for audio playback
    const audioStartTime = calculateAudioStartTime(videoRef, latestNarration, audioDuration);
    
    // Set the audio start time
    if (audioStartTime > 0) {
      audioElement.currentTime = audioStartTime;
      console.log('Setting audio currentTime to:', audioStartTime);
    } else {
      audioElement.currentTime = 0;
      console.log('Starting audio from beginning');
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

  return { playNarration };
};

export default useNarrationPlayback;
