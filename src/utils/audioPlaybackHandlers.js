/**
 * Utility functions for audio playback handlers in components
 */

import { base64ToArrayBuffer } from './audioConversionUtils';
import { createWavFromPcmForDownload } from './wavFileUtils';
import { playPcmWithAudioAPI } from './audioPlaybackUtils';

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

  // Create audio source from base64 data
  if (result.audioData) {
    try {
      // Convert PCM data to audio format for browser playback
      const pcmData = base64ToArrayBuffer(result.audioData);
      // Use the sample rate from the audio data if available, otherwise default to 24000Hz
      const sampleRate = result.sampleRate || 24000;
      console.log(`Using sample rate: ${sampleRate}Hz for audio playback of subtitle ${result.subtitle_id}`);

      // Check if this is still the current playback request
      if (currentPlaybackId !== playbackId) {
        console.log('Playback request superseded by a newer request');
        return;
      }

      // Try direct Web Audio API playback for better quality
      try {
        console.log(`Playing audio for subtitle ${result.subtitle_id} using Web Audio API...`);
        const player = playPcmWithAudioAPI(pcmData, sampleRate);

        // Check if this is still the current playback request
        if (currentPlaybackId !== playbackId) {
          console.log('Playback request superseded by a newer request');
          try {
            player.stop();
          } catch (error) {
            console.warn('Error stopping player:', error);
          }
          return;
        }

        // Set up ended event
        player.source.onended = () => {
          console.log(`Audio playback ended for subtitle ${result.subtitle_id}`);
          // Only clear the currently playing if it's still this subtitle
          if (currentlyPlaying === result.subtitle_id) {
            console.log(`Clearing currently playing state for subtitle ${result.subtitle_id}`);
            setCurrentlyPlaying(null);
            setActiveAudioPlayer(null);
          }
        };

        // Add a backup timeout in case the ended event doesn't fire
        const audioDuration = player.getDuration();
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

        // Start playback
        await player.play();

        // Check if this is still the current playback request
        if (currentPlaybackId !== playbackId) {
          console.log('Playback request superseded by a newer request');
          try {
            player.stop();
          } catch (error) {
            console.warn('Error stopping player:', error);
          }
          return;
        }

        setActiveAudioPlayer(player);
        console.log(`Playing audio with duration: ${player.getDuration()} seconds for subtitle ${result.subtitle_id}`);
      } catch (webAudioError) {
        console.warn(`Web Audio API method failed for subtitle ${result.subtitle_id}, falling back to HTML Audio element:`, webAudioError);

        // Check if this is still the current playback request
        if (currentPlaybackId !== playbackId) {
          console.log('Playback request superseded by a newer request');
          return;
        }

        // Fallback to HTML Audio element with WAV file
        const wavBlob = createWavFromPcmForDownload(pcmData, sampleRate);
        const audioUrl = URL.createObjectURL(wavBlob);

        // Set up the audio element
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

        // Add a backup timeout in case the ended event doesn't fire
        const audioDuration = audioRef.current.duration || 5; // Default to 5 seconds if duration is not available
        const timeoutMs = (audioDuration * 1000) + 500; // Add 500ms buffer
        console.log(`Setting backup timeout for HTML Audio: ${timeoutMs}ms for subtitle ${result.subtitle_id}`);
        setTimeout(() => {
          if (currentlyPlaying === result.subtitle_id) {
            console.log(`Backup timeout for HTML Audio: clearing playing state for subtitle ${result.subtitle_id}`);
            setCurrentlyPlaying(null);
          }
        }, timeoutMs);

        // Play the audio
        audioRef.current.play()
          .then(() => {
            // Check if this is still the current playback request
            if (currentPlaybackId !== playbackId) {
              console.log('Playback request superseded by a newer request');
              audioRef.current.pause();
              return;
            }

            console.log(`HTML Audio playback started for subtitle ${result.subtitle_id}`);
          })
          .catch(err => {
            console.error(`Error playing audio with fallback method for subtitle ${result.subtitle_id}:`, err);
            // Only clear the currently playing if it's still this subtitle
            if (currentlyPlaying === result.subtitle_id) {
              setCurrentlyPlaying(null);
            }
            alert(t('narration.playbackError', 'Error playing audio'));
          });
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
  if (result.audioData) {
    try {
      // Convert PCM data to WAV format for download
      const pcmData = base64ToArrayBuffer(result.audioData);
      // Use the sample rate from the audio data if available, otherwise default to 24000Hz
      const sampleRate = result.sampleRate || 24000;
      console.log(`Using sample rate: ${sampleRate}Hz for audio download`);

      // Use the specialized download method for better compatibility
      const wavBlob = createWavFromPcmForDownload(pcmData, sampleRate);

      // Create download link
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `narration_${result.subtitle_id}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log(`Downloaded WAV file for subtitle ${result.subtitle_id}`);
    } catch (error) {
      console.error('Error creating WAV file for download:', error);
      alert(t('narration.downloadError', 'Error creating WAV file for download'));
    }
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
    if (result.success && result.audioData) {
      downloadAudio(result, t);
    }
  });
};
