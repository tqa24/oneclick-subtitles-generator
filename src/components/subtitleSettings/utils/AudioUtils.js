/**
 * Audio utilities for narration playback
 */

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

  // Stop any load timeouts
  if (audioElement._loadTimeoutId) {
    clearTimeout(audioElement._loadTimeoutId);
    audioElement._loadTimeoutId = null;
  }

  // Pause and unload the audio
  audioElement.pause();
  audioElement.src = '';
  audioElement.load();
};

/**
 * Create a server URL for a narration file
 * @param {Object|string} narration - Narration object or filename
 * @param {string} serverUrl - Server URL
 * @returns {string|null} - URL to the audio file or null if not available
 */
export const getAudioUrl = (narration, serverUrl) => {
  // Handle case where narration is just a filename string
  const filename = typeof narration === 'string'
    ? narration
    : (narration && narration.filename ? narration.filename : null);

  if (!filename) {
    console.error('Cannot get audio URL: narration has no filename', narration);
    return null;
  }

  // Ensure the server URL is properly formatted
  const baseUrl = serverUrl ?
    (serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl) :
    '';

  // AGGRESSIVE FIX: Add a timestamp or unique identifier to the URL to force a fresh request
  // This prevents browser caching issues
  const timestamp = (typeof narration === 'object' && narration._timestamp) ?
    narration._timestamp :
    Date.now();

  return `${baseUrl}/api/narration/audio/${filename}?t=${timestamp}`;
};
