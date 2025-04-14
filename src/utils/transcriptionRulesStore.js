/**
 * Store for transcription rules
 * This file is used to avoid circular dependencies between videoProcessor.js and geminiService.js
 * and to persist transcription rules for the current video
 */

// Store transcription rules globally
let globalTranscriptionRules = null;

// LocalStorage key for transcription rules (legacy - will be removed)
const TRANSCRIPTION_RULES_KEY = 'transcription_rules';

// Current cache ID for the video being processed
let currentCacheId = null;

/**
 * Set the current cache ID for the video being processed
 * @param {string} cacheId - Cache ID for the current video
 */
export const setCurrentCacheId = (cacheId) => {
  currentCacheId = cacheId;
  console.log('Current cache ID set to:', cacheId);
};

/**
 * Get the current cache ID
 * @returns {string} Current cache ID
 */
export const getCurrentCacheId = () => {
  return currentCacheId;
};

/**
 * Set global transcription rules
 * @param {Object} rules - Transcription rules
 */
export const setTranscriptionRules = async (rules) => {
  globalTranscriptionRules = rules;

  // Save to cache if we have a cache ID
  if (rules && currentCacheId) {
    try {
      const response = await fetch('http://localhost:3004/api/save-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cacheId: currentCacheId,
          rules
        })
      });

      const result = await response.json();
      if (result.success) {
        console.log('Transcription rules saved to cache for ID:', currentCacheId);
      } else {
        console.error('Failed to save transcription rules to cache:', result.error);
      }
    } catch (error) {
      console.error('Error saving transcription rules to cache:', error);
    }
  } else if (rules) {
    // Fallback to localStorage if no cache ID is available
    try {
      localStorage.setItem(TRANSCRIPTION_RULES_KEY, JSON.stringify(rules));
      console.log('Transcription rules saved to localStorage (fallback)');
    } catch (error) {
      console.error('Error saving transcription rules to localStorage:', error);
    }
  } else {
    // If rules are null, remove from localStorage
    localStorage.removeItem(TRANSCRIPTION_RULES_KEY);
    console.log('Transcription rules removed from localStorage');
  }
};

/**
 * Get global transcription rules
 * @returns {Object} Transcription rules
 */
export const getTranscriptionRules = async () => {
  // If rules are in memory, return them
  if (globalTranscriptionRules) {
    return globalTranscriptionRules;
  }

  // Try to load from cache if we have a cache ID
  if (currentCacheId) {
    try {
      const response = await fetch(`http://localhost:3004/api/rules/${currentCacheId}`);
      const data = await response.json();

      if (data.exists && data.rules) {
        globalTranscriptionRules = data.rules; // Update in-memory rules
        console.log('Transcription rules loaded from cache for ID:', currentCacheId);
        return data.rules;
      }
    } catch (error) {
      console.error('Error loading transcription rules from cache:', error);
    }
  }

  // Fallback to localStorage
  try {
    const savedRules = localStorage.getItem(TRANSCRIPTION_RULES_KEY);
    if (savedRules) {
      const parsedRules = JSON.parse(savedRules);
      globalTranscriptionRules = parsedRules; // Update in-memory rules
      console.log('Transcription rules loaded from localStorage (fallback)');
      return parsedRules;
    }
  } catch (error) {
    console.error('Error loading transcription rules from localStorage:', error);
  }

  return null;
};

/**
 * Get transcription rules synchronously (for components that can't use async/await)
 * @returns {Object} Transcription rules from memory or localStorage
 */
export const getTranscriptionRulesSync = () => {
  // If rules are in memory, return them
  if (globalTranscriptionRules) {
    return globalTranscriptionRules;
  }

  // Fallback to localStorage
  try {
    const savedRules = localStorage.getItem(TRANSCRIPTION_RULES_KEY);
    if (savedRules) {
      const parsedRules = JSON.parse(savedRules);
      globalTranscriptionRules = parsedRules; // Update in-memory rules
      console.log('Transcription rules loaded from localStorage (sync fallback)');
      return parsedRules;
    }
  } catch (error) {
    console.error('Error loading transcription rules from localStorage:', error);
  }

  return null;
};

/**
 * Clear transcription rules from memory, cache, and localStorage
 */
export const clearTranscriptionRules = async () => {
  globalTranscriptionRules = null;

  // Clear from localStorage
  localStorage.removeItem(TRANSCRIPTION_RULES_KEY);

  // Clear from cache if we have a cache ID
  if (currentCacheId) {
    try {
      // We don't have a direct API to delete a specific rule,
      // but we can overwrite it with an empty object
      const response = await fetch('http://localhost:3004/api/save-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cacheId: currentCacheId,
          rules: {}
        })
      });

      const result = await response.json();
      if (result.success) {
        console.log('Transcription rules cleared from cache for ID:', currentCacheId);
      }
    } catch (error) {
      console.error('Error clearing transcription rules from cache:', error);
    }
  }

  console.log('Transcription rules cleared from memory, cache, and localStorage');
};
