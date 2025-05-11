/**
 * Utility functions for audio playback handlers in components
 */

import { SERVER_URL } from '../config';

/**
 * Play audio from base64 data
 * @param {Object} result - Narration result object
 * @param {number|null} currentlyPlaying - ID of currently playing audio
 * @param {Function} setCurrentlyPlaying - State setter for currentlyPlaying
 * @param {Object|null} activeAudioPlayer - Active audio player
 * @param {Function} setActiveAudioPlayer - State setter for activeAudioPlayer
 * @param {React.RefObject} audioRef - Reference to audio element
 * @param {Function} t - Translation function
 * @returns {Promise<void>}
 */
export const playAudio = async (
  result,
  currentlyPlaying,
  setCurrentlyPlaying,
  activeAudioPlayer,
  setActiveAudioPlayer,
  audioRef,
  t
) => {
  // Create a unique ID for this playback request to prevent race conditions
  const playbackId = Date.now();
  const currentPlaybackId = playbackId;

  if (currentlyPlaying === result.subtitle_id) {
    // If already playing this audio, stop it
    if (activeAudioPlayer) {
      try {
        activeAudioPlayer.stop();
      } catch (error) {
        console.warn('Error stopping active audio player:', error);
      }
      setActiveAudioPlayer(null);
    }
    setCurrentlyPlaying(null);
    return;
  }

  // Stop any currently playing audio
  if (activeAudioPlayer) {
    try {
      activeAudioPlayer.stop();
    } catch (error) {
      console.warn('Error stopping active audio player:', error);
    }
    setActiveAudioPlayer(null);
  }

  // Set the current playing ID immediately to prevent race conditions
  setCurrentlyPlaying(result.subtitle_id);

  // We no longer use base64 audio data directly
  // Instead, we always use the server-saved WAV files
  if (result.filename) {
    try {
      // Check if this is still the current playback request
      if (currentPlaybackId !== playbackId) {

        return;
      }

      // Create audio element with the server URL from config
      // Ensure the URL is properly formatted with no double slashes
      const baseUrl = SERVER_URL.endsWith('/') ? SERVER_URL.slice(0, -1) : SERVER_URL;
      const audioUrl = `${baseUrl}/api/narration/audio/${result.filename}`;

      // Create a new audio element
      const audioElement = new Audio();

      // Set up event listeners before setting the source


      // Add a canplaythrough event to know when the audio is ready to play
      audioElement.addEventListener('canplaythrough', () => {

      });

      // Add a loadeddata event to know when the audio data is loaded
      audioElement.addEventListener('loadeddata', () => {

      });

      // Set volume and other properties
      audioElement.volume = 1.0; // Full volume
      audioElement.crossOrigin = 'anonymous'; // Try with CORS settings

      // Set the source after setting up event listeners
      audioElement.src = audioUrl;

      // Set up event listeners
      audioElement.addEventListener('ended', () => {

        // Only clear the currently playing if it's still this subtitle
        if (currentlyPlaying === result.subtitle_id) {

          setCurrentlyPlaying(null);
          setActiveAudioPlayer(null);
        }
      });

      audioElement.addEventListener('error', (e) => {
        console.error(`Error playing audio for subtitle ${result.subtitle_id}:`, e);

        // Log detailed error information
        const errorDetails = {
          code: audioElement.error ? audioElement.error.code : 'unknown',
          message: audioElement.error ? audioElement.error.message : 'unknown error',
          audioUrl: audioUrl,
          filename: result.filename,
          subtitle_id: result.subtitle_id
        };
        console.error('Audio error details:', errorDetails);

        // Try to fetch the file directly to check if it exists
        fetch(audioUrl, { method: 'HEAD' })
          .then(response => {

            if (!response.ok) {
              console.error(`Audio file not found: ${audioUrl}`);
            } else {

              // Try to fetch the actual content
              return fetch(audioUrl)
                .then(contentResponse => {

                  return contentResponse.blob();
                })
                .then(blob => {


                  // Try to play using the blob URL
                  if (blob.size > 0) {

                    const blobUrl = URL.createObjectURL(blob);

                    // Create a new audio element with the blob URL
                    const blobAudioElement = new Audio(blobUrl);
                    blobAudioElement.volume = 1.0;

                    // Play the audio
                    blobAudioElement.play()
                      .then(() => {


                        // Create a player object
                        const player = {
                          stop: () => {

                            blobAudioElement.pause();
                            URL.revokeObjectURL(blobUrl);
                          }
                        };

                        // Set up ended event
                        blobAudioElement.addEventListener('ended', () => {

                          if (currentlyPlaying === result.subtitle_id) {
                            setCurrentlyPlaying(null);
                            setActiveAudioPlayer(null);
                          }
                          URL.revokeObjectURL(blobUrl);
                        });

                        setActiveAudioPlayer(player);
                      })
                      .catch(blobError => {
                        console.error(`Error playing blob audio for subtitle ${result.subtitle_id}:`, blobError);
                        URL.revokeObjectURL(blobUrl);
                      });
                  }
                });
            }
          })
          .catch(fetchError => {
            console.error(`Error checking file existence: ${fetchError.message}`);
          });

        // Only clear the currently playing if it's still this subtitle
        if (currentlyPlaying === result.subtitle_id) {

          setCurrentlyPlaying(null);
          setActiveAudioPlayer(null);
        }
      });

      // Add a backup timeout in case the ended event doesn't fire
      audioElement.addEventListener('loadedmetadata', () => {
        const audioDuration = audioElement.duration;
        if (audioDuration && audioDuration > 0) {
          const timeoutMs = (audioDuration * 1000) + 500; // Add 500ms buffer

          setTimeout(() => {
            if (currentlyPlaying === result.subtitle_id) {

              setCurrentlyPlaying(null);
              setActiveAudioPlayer(null);
            }
          }, timeoutMs);
        }
      });

      // Flag to track if we've already tried to play
      let playAttempted = false;

      // Function to try playing the audio - only once
      const tryPlayAudio = () => {
        // Only attempt to play once
        if (playAttempted) {

          return;
        }

        playAttempted = true;


        // Check if this is still the current playback request
        if (currentPlaybackId !== playbackId) {

          return;
        }

        // Create a hidden audio element for playback
        const hiddenAudioElement = new Audio(audioUrl);
        hiddenAudioElement.volume = 1.0;
        // Add a data attribute to identify this audio element
        hiddenAudioElement.dataset.narrationId = result.subtitle_id;

        // Set up ended event
        hiddenAudioElement.addEventListener('ended', () => {

          if (currentlyPlaying === result.subtitle_id) {
            setCurrentlyPlaying(null);
            setActiveAudioPlayer(null);

            // Force UI update by dispatching a custom event that React components can listen for
            const customEvent = new CustomEvent('narrationEnded', {
              detail: { subtitleId: result.subtitle_id }
            });
            document.dispatchEvent(customEvent);
          }
        });

        // Create a player object
        const player = {
          stop: () => {


            // First, remove all event listeners to prevent any callbacks
            hiddenAudioElement.oncanplay = null;
            hiddenAudioElement.onloadeddata = null;
            hiddenAudioElement.onended = null;
            hiddenAudioElement.onerror = null;

            // Then pause the audio
            try {
              hiddenAudioElement.pause();

              // Reset the audio element to prevent any further events
              hiddenAudioElement.currentTime = 0;
              hiddenAudioElement.src = '';
            } catch (error) {
              console.warn(`Error while stopping audio for subtitle ${result.subtitle_id}:`, error);
            }

            // Dispatch an ended event to ensure UI is updated
            const endedEvent = new Event('ended');
            hiddenAudioElement.dispatchEvent(endedEvent);

            // Also dispatch our custom event for React components
            const customEvent = new CustomEvent('narrationEnded', {
              detail: { subtitleId: result.subtitle_id }
            });
            document.dispatchEvent(customEvent);
          }
        };

        setActiveAudioPlayer(player);

        // Use the canplay event to ensure the audio is ready before playing
        hiddenAudioElement.oncanplay = () => {
          // Check if this is still the current playback request
          if (currentPlaybackId !== playbackId) {

            return;
          }

          // Play the audio with better error handling
          let playPromise;
          try {
            // Store the promise to handle it properly
            playPromise = hiddenAudioElement.play();

            // Only add the promise handlers if it's actually a promise
            // (this helps with older browsers)
            if (playPromise !== undefined) {
              playPromise
                .then(() => {

                })
                .catch(error => {
                  // Check if this is an AbortError (play interrupted by pause)
                  if (error.name === 'AbortError') {

                  } else {
                    console.error(`Error playing audio for subtitle ${result.subtitle_id}:`, error);
                    // Clear the currently playing state on error
                    if (currentlyPlaying === result.subtitle_id) {
                      setCurrentlyPlaying(null);
                      setActiveAudioPlayer(null);
                    }
                  }
                });
            }
          } catch (error) {
            console.error(`Exception trying to play audio for subtitle ${result.subtitle_id}:`, error);
            // Clear the currently playing state on error
            if (currentlyPlaying === result.subtitle_id) {
              setCurrentlyPlaying(null);
              setActiveAudioPlayer(null);
            }
          }
        };
      };

      // Try to play immediately
      tryPlayAudio();

      // Store the audio element in the ref for external access
      if (audioRef && audioRef.current) {
        audioRef.current.src = audioUrl;
        // Add a data attribute to identify this audio element
        audioRef.current.dataset.narrationId = result.subtitle_id;

        // Make sure we have an ended event handler
        const handleAudioEnded = () => {

          if (currentlyPlaying === result.subtitle_id) {

            setCurrentlyPlaying(null);
            setActiveAudioPlayer(null);

            // Dispatch our custom event for React components
            const customEvent = new CustomEvent('narrationEnded', {
              detail: { subtitleId: result.subtitle_id }
            });
            document.dispatchEvent(customEvent);
          }
        };

        // Remove any existing ended event listener and add a new one
        audioRef.current.removeEventListener('ended', handleAudioEnded);
        audioRef.current.addEventListener('ended', handleAudioEnded);
      }
    } catch (error) {
      console.error(`Error processing audio data for subtitle ${result.subtitle_id}:`, error);
      // Only clear the currently playing if it's still this subtitle
      if (currentlyPlaying === result.subtitle_id) {
        setCurrentlyPlaying(null);
      }
      alert(t('narration.processingError', 'Error processing audio data'));
    }
  }
};

/**
 * Download audio as WAV file
 * @param {Object} result - Narration result object
 * @param {Function} t - Translation function
 * @returns {Promise<void>}
 */
export const downloadAudio = async (result, t) => {
  try {
    if (result.filename) {
      // Use the server URL from config to download the file
      // Ensure the URL is properly formatted with no double slashes
      const baseUrl = SERVER_URL.endsWith('/') ? SERVER_URL.slice(0, -1) : SERVER_URL;
      const audioUrl = `${baseUrl}/api/narration/audio/${result.filename}`;


      // Create download link
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = `narration_${result.subtitle_id}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);


    } else {
      console.error('No filename available for download');
      alert(t('narration.downloadError', 'No audio file available for download'));
    }
  } catch (error) {
    console.error('Error downloading audio file:', error);
    alert(t('narration.downloadError', 'Error downloading audio file'));
  }
};

/**
 * Download all audio files
 * @param {Array} generationResults - Array of narration results
 * @param {Function} t - Translation function
 */
export const downloadAllAudio = (generationResults, t) => {
  // Download each audio file individually
  generationResults.forEach(result => {
    if (result.success && result.filename) {
      downloadAudio(result, t);
    }
  });
};
