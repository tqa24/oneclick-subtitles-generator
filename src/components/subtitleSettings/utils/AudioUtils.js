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
 * Create a server URL for a narration file
 * @param {Object} narration - Narration object
 * @param {string} serverUrl - Server URL
 * @returns {string|null} - URL to the audio file or null if not available
 */
export const getAudioUrl = (narration, serverUrl) => {
  if (!narration || !narration.filename) {
    console.error('Cannot get audio URL: narration has no filename', narration);
    return null;
  }

  return `${serverUrl}/api/narration/audio/${narration.filename}`;
};
