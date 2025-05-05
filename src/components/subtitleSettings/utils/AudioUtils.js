/**
 * Audio utilities for narration playback
 */
import { base64ToBlob } from './base64Utils';

/**
 * Create and configure an audio element for narration
 * @param {string} audioUrl - URL of the audio file
 * @param {number} volume - Volume level (0-1)
 * @param {Function} onLoadedMetadata - Callback when metadata is loaded
 * @param {Function} onError - Callback when error occurs
 * @param {Function} onPlay - Callback when audio starts playing
 * @param {Function} onEnded - Callback when audio ends
 * @returns {HTMLAudioElement} - Configured audio element
 */
export const createAudioElement = (audioUrl, volume, onLoadedMetadata, onError, onPlay, onEnded) => {
  const audio = new Audio(audioUrl);

  // Set volume immediately
  audio.volume = volume;

  // Add event listeners
  if (onLoadedMetadata) {
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
  }

  if (onError) {
    audio.addEventListener('error', onError);
  }

  if (onPlay) {
    audio.addEventListener('play', onPlay);
  }

  if (onEnded) {
    audio.addEventListener('ended', onEnded);
  }

  return audio;
};

/**
 * Clean up an audio element
 * @param {HTMLAudioElement} audioElement - Audio element to clean up
 */
export const cleanupAudioElement = (audioElement) => {
  if (!audioElement) return;

  // Remove all event listeners to prevent memory leaks
  audioElement.onloadedmetadata = null;
  audioElement.onplay = null;
  audioElement.onended = null;
  audioElement.onpause = null;
  audioElement.onerror = null;

  // Stop any safety timeouts
  if (audioElement._safetyTimeoutId) {
    clearTimeout(audioElement._safetyTimeoutId);
    audioElement._safetyTimeoutId = null;
  }

  // Pause and unload the audio
  audioElement.pause();
  audioElement.src = '';
  audioElement.load();
};

/**
 * Try direct playback from base64 audio data
 * @param {Object} narration - Narration object
 * @param {number} volume - Volume level (0-1)
 * @param {Function} onEnded - Callback when audio ends
 * @returns {HTMLAudioElement|null} - Audio element or null if failed
 */
export const tryDirectPlayback = (narration, volume, onEnded) => {
  if (!narration.audioData) return null;

  try {
    // Create a data URL from the base64 audio data
    const base64Audio = narration.audioData;
    const audioBlob = base64ToBlob(base64Audio, 'audio/wav');
    const blobUrl = URL.createObjectURL(audioBlob);

    // Create a new audio element
    const directAudio = new Audio(blobUrl);
    directAudio.volume = volume;

    // Add event listeners
    directAudio.addEventListener('ended', () => {
      console.log('Direct audio playback ended');
      if (onEnded) onEnded();
      URL.revokeObjectURL(blobUrl);
    });

    directAudio.addEventListener('error', (e) => {
      console.error('Error with direct audio playback:', e);
      URL.revokeObjectURL(blobUrl);
    });

    // Play the audio
    directAudio.play()
      .then(() => console.log('Direct audio playback started'))
      .catch(e => console.error('Failed to play direct audio:', e));

    return directAudio;
  } catch (error) {
    console.error('Error with direct playback:', error);
    return null;
  }
};
