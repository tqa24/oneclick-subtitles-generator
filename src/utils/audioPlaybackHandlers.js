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
        console.log('Playback request superseded by a newer request');
        return;
      }

      // Create audio element with the server URL from config
      // Ensure the URL is properly formatted with no double slashes
      const baseUrl = SERVER_URL.endsWith('/') ? SERVER_URL.slice(0, -1) : SERVER_URL;
      const audioUrl = `${baseUrl}/api/narration/audio/${result.filename}`;
      console.log(`Playing audio from server URL: ${audioUrl}`);

      // Log additional information for debugging
      console.log(`Audio file details:`, {
        filename: result.filename,
        subtitle_id: result.subtitle_id,
        serverUrl: baseUrl,
        fullUrl: audioUrl,
        configServerUrl: SERVER_URL
      });

      // Create a new audio element
      const audioElement = new Audio();

      // Set up event listeners before setting the source
      console.log('Setting up audio element event listeners');

      // Add a canplaythrough event to know when the audio is ready to play
      audioElement.addEventListener('canplaythrough', () => {
        console.log(`Audio can play through without buffering for subtitle ${result.subtitle_id}`);
      });

      // Add a loadeddata event to know when the audio data is loaded
      audioElement.addEventListener('loadeddata', () => {
        console.log(`Audio data loaded for subtitle ${result.subtitle_id}`);
      });

      // Set volume and other properties
      audioElement.volume = 1.0; // Full volume
      audioElement.crossOrigin = 'anonymous'; // Try with CORS settings

      // Set the source after setting up event listeners
      audioElement.src = audioUrl;

      // Set up event listeners
      audioElement.addEventListener('ended', () => {
        console.log(`Audio playback ended for subtitle ${result.subtitle_id}`);
        // Only clear the currently playing if it's still this subtitle
        if (currentlyPlaying === result.subtitle_id) {
          console.log(`Clearing currently playing state for subtitle ${result.subtitle_id}`);
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
            console.log(`File existence check: ${response.status} ${response.statusText}`);
            if (!response.ok) {
              console.error(`Audio file not found: ${audioUrl}`);
            } else {
              console.log(`Audio file exists, trying to fetch content`);
              // Try to fetch the actual content
              return fetch(audioUrl)
                .then(contentResponse => {
                  console.log(`Content fetch status: ${contentResponse.status} ${contentResponse.statusText}`);
                  return contentResponse.blob();
                })
                .then(blob => {
                  console.log(`Fetched audio blob: type=${blob.type}, size=${blob.size} bytes`);

                  // Try to play using the blob URL
                  if (blob.size > 0) {
                    console.log(`Trying to play using blob URL`);
                    const blobUrl = URL.createObjectURL(blob);

                    // Create a new audio element with the blob URL
                    const blobAudioElement = new Audio(blobUrl);
                    blobAudioElement.volume = 1.0;

                    // Play the audio
                    blobAudioElement.play()
                      .then(() => {
                        console.log(`Blob audio playback started for subtitle ${result.subtitle_id}`);

                        // Create a player object
                        const player = {
                          stop: () => {
                            console.log(`Stopping blob audio playback for subtitle ${result.subtitle_id}`);
                            blobAudioElement.pause();
                            URL.revokeObjectURL(blobUrl);
                          }
                        };

                        // Set up ended event
                        blobAudioElement.addEventListener('ended', () => {
                          console.log(`Blob audio playback ended for subtitle ${result.subtitle_id}`);
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
          console.log(`Clearing currently playing state for subtitle ${result.subtitle_id} due to error`);
          setCurrentlyPlaying(null);
          setActiveAudioPlayer(null);
        }
      });

      // Add a backup timeout in case the ended event doesn't fire
      audioElement.addEventListener('loadedmetadata', () => {
        const audioDuration = audioElement.duration;
        if (audioDuration && audioDuration > 0) {
          const timeoutMs = (audioDuration * 1000) + 500; // Add 500ms buffer
          console.log(`Setting backup timeout for ${timeoutMs}ms for subtitle ${result.subtitle_id}`);
          setTimeout(() => {
            if (currentlyPlaying === result.subtitle_id) {
              console.log(`Backup timeout: clearing playing state for subtitle ${result.subtitle_id}`);
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
          console.log(`Already attempted playback for subtitle ${result.subtitle_id}, skipping`);
          return;
        }

        playAttempted = true;
        console.log(`Attempting to play audio for subtitle ${result.subtitle_id}`);

        // Check if this is still the current playback request
        if (currentPlaybackId !== playbackId) {
          console.log('Playback request superseded by a newer request');
          return;
        }

        // Create a visible audio element with controls for debugging
        const visibleAudioElement = document.createElement('audio');
        visibleAudioElement.src = audioUrl;
        visibleAudioElement.volume = 1.0;
        visibleAudioElement.controls = true; // Show controls for debugging
        visibleAudioElement.style.position = 'absolute';
        visibleAudioElement.style.bottom = '10px';
        visibleAudioElement.style.right = '10px';
        visibleAudioElement.style.zIndex = '9999';
        visibleAudioElement.style.width = '300px';

        // Add a label
        const label = document.createElement('div');
        label.textContent = `Subtitle ${result.subtitle_id}`;
        label.style.position = 'absolute';
        label.style.bottom = '40px';
        label.style.right = '10px';
        label.style.zIndex = '9999';
        label.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        label.style.color = 'white';
        label.style.padding = '5px';
        label.style.borderRadius = '3px';

        // Append to body
        document.body.appendChild(label);
        document.body.appendChild(visibleAudioElement);

        // Set up ended event
        visibleAudioElement.addEventListener('ended', () => {
          console.log(`Visible audio playback ended for subtitle ${result.subtitle_id}`);
          if (currentlyPlaying === result.subtitle_id) {
            setCurrentlyPlaying(null);
            setActiveAudioPlayer(null);
          }
          // Remove from DOM
          if (document.body.contains(visibleAudioElement)) {
            document.body.removeChild(visibleAudioElement);
          }
          if (document.body.contains(label)) {
            document.body.removeChild(label);
          }
        });

        // Create a player object
        const player = {
          stop: () => {
            console.log(`Stopping visible audio playback for subtitle ${result.subtitle_id}`);
            visibleAudioElement.pause();
            if (document.body.contains(visibleAudioElement)) {
              document.body.removeChild(visibleAudioElement);
            }
            if (document.body.contains(label)) {
              document.body.removeChild(label);
            }
          }
        };

        setActiveAudioPlayer(player);

        // Play the audio with user interaction
        visibleAudioElement.play()
          .then(() => {
            console.log(`Visible audio playback started for subtitle ${result.subtitle_id}`);
          })
          .catch(error => {
            console.error(`Error playing visible audio for subtitle ${result.subtitle_id}:`, error);
            // Add a play button for user interaction
            const playButton = document.createElement('button');
            playButton.textContent = 'Play Audio';
            playButton.style.position = 'absolute';
            playButton.style.bottom = '70px';
            playButton.style.right = '10px';
            playButton.style.zIndex = '9999';
            playButton.style.padding = '10px';
            playButton.style.backgroundColor = '#4CAF50';
            playButton.style.color = 'white';
            playButton.style.border = 'none';
            playButton.style.borderRadius = '5px';
            playButton.style.cursor = 'pointer';

            playButton.addEventListener('click', () => {
              visibleAudioElement.play()
                .then(() => {
                  console.log(`Visible audio playback started after button click for subtitle ${result.subtitle_id}`);
                  document.body.removeChild(playButton);
                })
                .catch(buttonError => {
                  console.error(`Error playing visible audio after button click for subtitle ${result.subtitle_id}:`, buttonError);
                });
            });

            document.body.appendChild(playButton);
          });
      };

      // Try to play immediately
      tryPlayAudio();

      // Store the audio element in the ref for external access
      if (audioRef && audioRef.current) {
        audioRef.current.src = audioUrl;

        // Make sure we have an ended event handler
        const handleAudioEnded = () => {
          console.log(`HTML Audio element ended for subtitle ${result.subtitle_id}`);
          if (currentlyPlaying === result.subtitle_id) {
            console.log(`Clearing currently playing state for subtitle ${result.subtitle_id}`);
            setCurrentlyPlaying(null);
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
      console.log(`Downloading audio from server URL: ${audioUrl}`);

      // Log additional information for debugging
      console.log(`Audio file details for download:`, {
        filename: result.filename,
        subtitle_id: result.subtitle_id,
        serverUrl: baseUrl,
        fullUrl: audioUrl,
        configServerUrl: SERVER_URL
      });

      // Create download link
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = `narration_${result.subtitle_id}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      console.log(`Downloaded WAV file for subtitle ${result.subtitle_id}`);
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
