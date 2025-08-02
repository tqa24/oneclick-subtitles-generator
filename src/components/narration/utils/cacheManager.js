/**
 * Cache management utilities for narration
 * Handles clearing browser caches and server-side files when generating fresh narrations
 */

import { SERVER_URL } from '../../../config';

/**
 * Clear all narration-related caches and files
 * This should be called at the beginning of each generate narration handler
 * to ensure a clean state and prevent range request errors
 * @param {Function} setGenerationResults - Function to clear UI generation results
 */
export const clearNarrationCachesAndFiles = async (setGenerationResults = null) => {
  console.log('Clearing narration caches and files for fresh generation...');

  try {
    // 1. Clear localStorage caches for all narration methods
    const cacheKeys = [
      'f5tts_narrations_cache',
      'chatterbox_narrations_cache', 
      'gemini_narrations_cache',
      'edge_tts_narrations_cache',
      'gtts_narrations_cache'
    ];

    cacheKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        console.log(`Cleared localStorage cache: ${key}`);
      }
    });

    // 2. Clear window global narration references
    if (window.originalNarrations) {
      window.originalNarrations = [];
      console.log('Cleared window.originalNarrations');
    }
    if (window.translatedNarrations) {
      window.translatedNarrations = [];
      console.log('Cleared window.translatedNarrations');
    }
    if (window.groupedNarrations) {
      window.groupedNarrations = [];
      console.log('Cleared window.groupedNarrations');
    }
    if (window.useGroupedSubtitles !== undefined) {
      window.useGroupedSubtitles = false;
      console.log('Reset window.useGroupedSubtitles to false');
    }

    // 3. Clear browser cache for narration audio files
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          if (cacheName.includes('narration') || cacheName.includes('audio')) {
            await caches.delete(cacheName);
            console.log(`Cleared browser cache: ${cacheName}`);
          }
        }
      } catch (error) {
        console.warn('Could not clear browser caches:', error);
      }
    }

    // 4. Call server API to clear narration output files
    try {
      const response = await fetch(`${SERVER_URL}/api/narration/clear-output`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        console.log('Successfully cleared server narration files');
      } else {
        console.warn('Server file clearing returned non-OK status:', response.status);
      }
    } catch (error) {
      console.warn('Could not clear server files:', error);
      // Don't throw error - generation can continue even if file clearing fails
    }

    // 5. Clear UI generation results if setter function is provided
    if (setGenerationResults) {
      setGenerationResults([]);
      console.log('Cleared UI generation results');
    }

    console.log('Cache and file clearing completed');
  } catch (error) {
    console.error('Error during cache and file clearing:', error);
    // Don't throw error - generation should continue even if clearing fails
  }
};

/**
 * Clear only browser-side caches (for lighter clearing when server files should be preserved)
 */
export const clearBrowserCaches = () => {
  console.log('Clearing browser-side narration caches...');

  // Clear localStorage caches
  const cacheKeys = [
    'f5tts_narrations_cache',
    'chatterbox_narrations_cache', 
    'gemini_narrations_cache',
    'edge_tts_narrations_cache',
    'gtts_narrations_cache'
  ];

  cacheKeys.forEach(key => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      console.log(`Cleared localStorage cache: ${key}`);
    }
  });

  // Clear window global references
  if (window.originalNarrations) {
    window.originalNarrations = [];
  }
  if (window.translatedNarrations) {
    window.translatedNarrations = [];
  }
  if (window.groupedNarrations) {
    window.groupedNarrations = [];
  }
  if (window.useGroupedSubtitles !== undefined) {
    window.useGroupedSubtitles = false;
  }

  console.log('Browser cache clearing completed');
};
