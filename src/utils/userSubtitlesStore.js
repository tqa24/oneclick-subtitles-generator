/**
 * Store for user-provided subtitles
 * This file is used to manage user-provided subtitles and persist them for the current video
 */

// Store user-provided subtitles globally
let globalUserSubtitles = null;

// LocalStorage key for user-provided subtitles (legacy - will be removed)
const USER_SUBTITLES_KEY = 'user_provided_subtitles';

// Current cache ID for the video being processed
let currentCacheId = null;

/**
 * Set the current cache ID for the video being processed
 * @param {string} cacheId - Cache ID for the current video
 */
export const setCurrentCacheId = (cacheId) => {
  currentCacheId = cacheId;
  console.log('User subtitles store: Current cache ID set to:', cacheId);
};

/**
 * Get the current cache ID
 * @returns {string} Current cache ID
 */
export const getCurrentCacheId = () => {
  return currentCacheId;
};

/**
 * Set global user-provided subtitles
 * @param {string} subtitlesText - User-provided subtitles text
 */
export const setUserProvidedSubtitles = async (subtitlesText) => {
  globalUserSubtitles = subtitlesText;

  // Save to cache if we have a cache ID
  if (subtitlesText && currentCacheId) {
    try {
      const response = await fetch('http://localhost:3004/api/save-user-subtitles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cacheId: currentCacheId,
          subtitlesText
        })
      });

      const result = await response.json();
      if (result.success) {
        console.log('User-provided subtitles saved to cache for ID:', currentCacheId);
      } else {
        console.error('Failed to save user-provided subtitles to cache:', result.error);
      }
    } catch (error) {
      console.error('Error saving user-provided subtitles to cache:', error);
    }
  } else if (subtitlesText) {
    // Fallback to localStorage if no cache ID is available
    try {
      localStorage.setItem(USER_SUBTITLES_KEY, subtitlesText);
      console.log('User-provided subtitles saved to localStorage (fallback)');
    } catch (error) {
      console.error('Error saving user-provided subtitles to localStorage:', error);
    }
  } else {
    // If subtitlesText is null or empty, remove from localStorage
    localStorage.removeItem(USER_SUBTITLES_KEY);
    console.log('User-provided subtitles removed from localStorage');
  }
};

/**
 * Get global user-provided subtitles
 * @returns {string} User-provided subtitles text
 */
export const getUserProvidedSubtitles = async () => {
  // If subtitles are in memory, return them
  if (globalUserSubtitles) {
    return globalUserSubtitles;
  }

  // Try to load from cache if we have a cache ID
  if (currentCacheId) {
    try {
      const response = await fetch(`http://localhost:3004/api/user-subtitles/${currentCacheId}`);
      const data = await response.json();
      
      if (data.exists && data.subtitlesText) {
        globalUserSubtitles = data.subtitlesText; // Update in-memory subtitles
        console.log('User-provided subtitles loaded from cache for ID:', currentCacheId);
        return data.subtitlesText;
      }
    } catch (error) {
      console.error('Error loading user-provided subtitles from cache:', error);
    }
  }

  // Fallback to localStorage
  try {
    const savedSubtitles = localStorage.getItem(USER_SUBTITLES_KEY);
    if (savedSubtitles) {
      globalUserSubtitles = savedSubtitles; // Update in-memory subtitles
      console.log('User-provided subtitles loaded from localStorage (fallback)');
      return savedSubtitles;
    }
  } catch (error) {
    console.error('Error loading user-provided subtitles from localStorage:', error);
  }

  return '';
};

/**
 * Get user-provided subtitles synchronously (for components that can't use async/await)
 * @returns {string} User-provided subtitles text from memory or localStorage
 */
export const getUserProvidedSubtitlesSync = () => {
  // If subtitles are in memory, return them
  if (globalUserSubtitles) {
    return globalUserSubtitles;
  }

  // Fallback to localStorage
  try {
    const savedSubtitles = localStorage.getItem(USER_SUBTITLES_KEY);
    if (savedSubtitles) {
      globalUserSubtitles = savedSubtitles; // Update in-memory subtitles
      console.log('User-provided subtitles loaded from localStorage (sync fallback)');
      return savedSubtitles;
    }
  } catch (error) {
    console.error('Error loading user-provided subtitles from localStorage:', error);
  }

  return '';
};

/**
 * Clear user-provided subtitles from memory, cache, and localStorage
 */
export const clearUserProvidedSubtitles = async () => {
  globalUserSubtitles = null;
  
  // Clear from localStorage
  localStorage.removeItem(USER_SUBTITLES_KEY);
  
  // Clear from cache if we have a cache ID
  if (currentCacheId) {
    try {
      // We don't have a direct API to delete a specific subtitle,
      // but we can overwrite it with an empty string
      const response = await fetch('http://localhost:3004/api/save-user-subtitles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cacheId: currentCacheId,
          subtitlesText: ''
        })
      });

      const result = await response.json();
      if (result.success) {
        console.log('User-provided subtitles cleared from cache for ID:', currentCacheId);
      }
    } catch (error) {
      console.error('Error clearing user-provided subtitles from cache:', error);
    }
  }
  
  console.log('User-provided subtitles cleared from memory, cache, and localStorage');
};
