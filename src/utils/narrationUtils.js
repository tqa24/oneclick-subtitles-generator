/**
 * Utility functions for handling narration data
 */

import { getAudioUrl } from '../services/narrationService';

/**
 * Enhance narration data loaded from localStorage with additional fields needed for aligned narration
 * @param {Array} narrationData - Basic narration data from localStorage
 * @returns {Array} - Enhanced narration data with all necessary fields
 */
export const enhanceNarrationDataFromStorage = (narrationData) => {
  if (!narrationData || !Array.isArray(narrationData) || narrationData.length === 0) {
    return [];
  }

  return narrationData.map(item => {
    // Create a base object with all the essential fields
    const enhancedItem = {
      ...item,
      // Add additional fields needed for aligned narration
      url: item.filename ? getAudioUrl(item.filename) : null,
      // Add default values for fields that might be missing
      start: item.start || 0,
      end: item.end || 0,
      // Add empty audioData if not present (needed for some operations)
      audioData: item.audioData || null,
      // Add default values for other potentially missing fields
      sampleRate: item.sampleRate || 24000,
      mimeType: item.mimeType || 'audio/wav'
    };

    return enhancedItem;
  });
};

/**
 * Load narrations from localStorage and enhance them with additional fields
 * @param {string} source - Source of narrations ('original' or 'translated')
 * @returns {Array} - Enhanced narration data
 */
export const loadNarrationsFromStorage = (source = 'original') => {
  try {
    const storageKey = source === 'original' ? 'originalNarrations' : 'translatedNarrations';
    const storedData = localStorage.getItem(storageKey);
    
    if (!storedData) {
      return [];
    }
    
    const parsedData = JSON.parse(storedData);
    if (!parsedData || !Array.isArray(parsedData) || parsedData.length === 0) {
      return [];
    }
    
    // Enhance the data with additional fields
    return enhanceNarrationDataFromStorage(parsedData);
  } catch (error) {
    console.error(`Error loading ${source} narrations from localStorage:`, error);
    return [];
  }
};
