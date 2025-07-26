/**
 * Utility functions for video preview functionality
 */

/**
 * Format time in seconds to MM:SS format
 * @param {number} timeInSeconds - Time in seconds
 * @returns {string} Formatted time string
 */
export const formatTime = (timeInSeconds) => {
  if (!timeInSeconds || isNaN(timeInSeconds)) return '0:00';
  
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

/**
 * Calculate progress percentage
 * @param {number} current - Current value
 * @param {number} total - Total value
 * @returns {number} Progress percentage (0-100)
 */
export const calculateProgress = (current, total) => {
  if (!total || total === 0) return 0;
  return Math.max(0, Math.min(100, (current / total) * 100));
};

/**
 * Throttle function calls
 * @param {Function} func - Function to throttle
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Throttled function
 */
export const throttle = (func, delay) => {
  let timeoutId;
  let lastExecTime = 0;
  
  return function (...args) {
    const currentTime = Date.now();
    
    if (currentTime - lastExecTime > delay) {
      func.apply(this, args);
      lastExecTime = currentTime;
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
        lastExecTime = Date.now();
      }, delay - (currentTime - lastExecTime));
    }
  };
};

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, delay) => {
  let timeoutId;
  
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
};

/**
 * Check if a URL is a YouTube URL
 * @param {string} url - URL to check
 * @returns {boolean} True if YouTube URL
 */
export const isYouTubeUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return url.includes('youtube.com') || url.includes('youtu.be');
};

/**
 * Check if a URL is a blob URL
 * @param {string} url - URL to check
 * @returns {boolean} True if blob URL
 */
export const isBlobUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('blob:');
};

/**
 * Get video element dimensions
 * @param {HTMLVideoElement} videoElement - Video element
 * @returns {object} Dimensions object with width and height
 */
export const getVideoDimensions = (videoElement) => {
  if (!videoElement) return { width: 0, height: 0 };
  
  return {
    width: videoElement.videoWidth || videoElement.clientWidth,
    height: videoElement.videoHeight || videoElement.clientHeight
  };
};

/**
 * Check if video element is in fullscreen
 * @returns {boolean} True if in fullscreen
 */
export const isInFullscreen = () => {
  return !!(document.fullscreenElement ||
           document.webkitFullscreenElement ||
           document.mozFullScreenElement ||
           document.msFullscreenElement);
};

/**
 * Get fullscreen element
 * @returns {Element|null} Fullscreen element or null
 */
export const getFullscreenElement = () => {
  return document.fullscreenElement ||
         document.webkitFullscreenElement ||
         document.mozFullScreenElement ||
         document.msFullscreenElement ||
         null;
};

/**
 * Request fullscreen for an element
 * @param {Element} element - Element to make fullscreen
 * @returns {Promise} Promise that resolves when fullscreen is entered
 */
export const requestFullscreen = (element) => {
  if (!element) return Promise.reject(new Error('No element provided'));
  
  if (element.requestFullscreen) {
    return element.requestFullscreen();
  } else if (element.webkitRequestFullscreen) {
    return element.webkitRequestFullscreen();
  } else if (element.mozRequestFullScreen) {
    return element.mozRequestFullScreen();
  } else if (element.msRequestFullscreen) {
    return element.msRequestFullscreen();
  }
  
  return Promise.reject(new Error('Fullscreen not supported'));
};

/**
 * Exit fullscreen
 * @returns {Promise} Promise that resolves when fullscreen is exited
 */
export const exitFullscreen = () => {
  if (document.exitFullscreen) {
    return document.exitFullscreen();
  } else if (document.webkitExitFullscreen) {
    return document.webkitExitFullscreen();
  } else if (document.mozCancelFullScreen) {
    return document.mozCancelFullScreen();
  } else if (document.msExitFullscreen) {
    return document.msExitFullscreen();
  }
  
  return Promise.reject(new Error('Exit fullscreen not supported'));
};

/**
 * Calculate timeline position from mouse/touch event
 * @param {Event} event - Mouse or touch event
 * @param {Element} timelineElement - Timeline element
 * @param {number} duration - Video duration
 * @returns {number} Time position in seconds
 */
export const calculateTimelinePosition = (event, timelineElement, duration) => {
  if (!timelineElement || !duration) return 0;
  
  const rect = timelineElement.getBoundingClientRect();
  const clientX = event.clientX || (event.touches && event.touches[0]?.clientX) || 0;
  const clickX = clientX - rect.left;
  const percentage = Math.max(0, Math.min(1, clickX / rect.width));
  
  return percentage * duration;
};

/**
 * Calculate volume from mouse/touch event on volume slider
 * @param {Event} event - Mouse or touch event
 * @param {Element} volumeElement - Volume slider element
 * @returns {number} Volume level (0-1)
 */
export const calculateVolumeFromEvent = (event, volumeElement) => {
  if (!volumeElement) return 0;
  
  const rect = volumeElement.getBoundingClientRect();
  const clientY = event.clientY || (event.touches && event.touches[0]?.clientY) || 0;
  const clickY = clientY - rect.top;
  const percentage = Math.max(0, Math.min(1, (rect.height - clickY) / rect.height));
  
  return percentage;
};

/**
 * Get buffered ranges for a video element
 * @param {HTMLVideoElement} videoElement - Video element
 * @returns {Array} Array of buffered ranges
 */
export const getBufferedRanges = (videoElement) => {
  if (!videoElement || !videoElement.buffered) return [];
  
  const ranges = [];
  for (let i = 0; i < videoElement.buffered.length; i++) {
    ranges.push({
      start: videoElement.buffered.start(i),
      end: videoElement.buffered.end(i)
    });
  }
  
  return ranges;
};

/**
 * Calculate buffered progress percentage
 * @param {HTMLVideoElement} videoElement - Video element
 * @returns {number} Buffered progress percentage (0-100)
 */
export const calculateBufferedProgress = (videoElement) => {
  if (!videoElement || !videoElement.buffered || !videoElement.duration) return 0;
  
  const buffered = videoElement.buffered;
  if (buffered.length === 0) return 0;
  
  const bufferedEnd = buffered.end(buffered.length - 1);
  return (bufferedEnd / videoElement.duration) * 100;
};

/**
 * Check if video can play
 * @param {HTMLVideoElement} videoElement - Video element
 * @returns {boolean} True if video can play
 */
export const canVideoPlay = (videoElement) => {
  if (!videoElement) return false;
  
  return videoElement.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA;
};

/**
 * Get video playback state
 * @param {HTMLVideoElement} videoElement - Video element
 * @returns {object} Playback state object
 */
export const getVideoPlaybackState = (videoElement) => {
  if (!videoElement) {
    return {
      isPlaying: false,
      isPaused: true,
      isEnded: false,
      isSeeking: false,
      currentTime: 0,
      duration: 0,
      volume: 1,
      muted: false,
      playbackRate: 1
    };
  }
  
  return {
    isPlaying: !videoElement.paused && !videoElement.ended,
    isPaused: videoElement.paused,
    isEnded: videoElement.ended,
    isSeeking: videoElement.seeking,
    currentTime: videoElement.currentTime,
    duration: videoElement.duration || 0,
    volume: videoElement.volume,
    muted: videoElement.muted,
    playbackRate: videoElement.playbackRate
  };
};

/**
 * Set video playback rate with validation
 * @param {HTMLVideoElement} videoElement - Video element
 * @param {number} rate - Playback rate
 */
export const setVideoPlaybackRate = (videoElement, rate) => {
  if (!videoElement) return;
  
  const validRate = Math.max(0.25, Math.min(4, rate));
  videoElement.playbackRate = validRate;
};

/**
 * Set video volume with validation
 * @param {HTMLVideoElement} videoElement - Video element
 * @param {number} volume - Volume level (0-1)
 */
export const setVideoVolume = (videoElement, volume) => {
  if (!videoElement) return;
  
  const validVolume = Math.max(0, Math.min(1, volume));
  videoElement.volume = validVolume;
  videoElement.muted = validVolume === 0;
};
