import { useEffect } from 'react';
import { generateSubtitleHash } from '../utils/subtitle/subtitleHash';
import { getCurrentMediaId } from '../utils/mediaId';

// Constant for the localStorage translation cache key
export const TRANSLATION_CACHE_KEY = 'translated_subtitles_cache';

/**
 * Save a set of translations to the localStorage cache keyed by media + subtitle hash.
 * @param {Array} subtitles - Source subtitles used to derive the cache key
 * @param {Array} translations - Translated subtitles to persist
 */
export const saveTranslationsToCache = (subtitles, translations) => {
  try {
    // Get current media ID
    const mediaId = getCurrentMediaId();
    if (mediaId) {
      // Generate a hash of the subtitles
      const subtitleHash = generateSubtitleHash(subtitles);

      // Create cache entry
      const cacheEntry = {
        mediaId,
        subtitleHash,
        timestamp: Date.now(),
        translations
      };

      // Save to localStorage
      localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(cacheEntry));
    }
  } catch (error) {
    console.error('Error saving translations to cache:', error);
  }
};

/**
 * Clear the translation cache from localStorage.
 */
export const clearTranslationCache = () => {
  try {
    localStorage.removeItem(TRANSLATION_CACHE_KEY);
    console.log('Translation cache cleared');
  } catch (error) {
    console.error('Error clearing translation cache:', error);
  }
};

/**
 * Custom hook that loads translations from the localStorage cache on mount/changes.
 * Composes into the main translation hook by receiving the parent state it needs.
 * @param {Object} params
 * @param {Array} params.subtitles - Subtitles to translate
 * @param {Array|null} params.translatedSubtitles - Current translated subtitles (skip load if set)
 * @param {boolean} params.wasManuallyReset - Whether translation was manually reset
 * @param {Function} params.onTranslationComplete - Callback when translation is complete
 * @param {Function} params.setTranslatedSubtitles - Setter for translated subtitles
 * @param {Function} params.setLoadedFromCache - Setter for the loaded-from-cache flag
 * @param {Function} params.setTranslationStatus - Setter for the translation status message
 * @param {Function} params.t - i18n translation function
 */
export const useTranslationCaching = ({
  subtitles,
  translatedSubtitles,
  wasManuallyReset,
  onTranslationComplete,
  setTranslatedSubtitles,
  setLoadedFromCache,
  setTranslationStatus,
  t
}) => {
  // Load translations from cache on component mount
  useEffect(() => {
    // Only try to load from cache if we don't have results yet and have subtitles to translate
    if (translatedSubtitles || !subtitles || subtitles.length === 0) return;

    // Don't load from cache if translation was manually reset
    if (wasManuallyReset) {
      console.log('Translation was manually reset, not loading from cache');
      return;
    }

    try {
      // Get current media ID
      const mediaId = getCurrentMediaId();

      if (!mediaId) {
        return;
      }

      // Generate a hash of the subtitles
      const subtitleHash = generateSubtitleHash(subtitles);

      // Get cache entry
      const cacheEntryJson = localStorage.getItem(TRANSLATION_CACHE_KEY);
      if (!cacheEntryJson) {
        return;
      }

      const cacheEntry = JSON.parse(cacheEntryJson);

      // More lenient cache matching - prioritize media ID over subtitle hash
      // This allows translations to persist even with minor subtitle edits
      if (cacheEntry.mediaId !== mediaId) {
        return;
      }

      // If subtitle hash doesn't match, still load but log it for debugging
      if (cacheEntry.subtitleHash !== subtitleHash) {
        console.log('Translation cache: Loading despite subtitle changes (less strict mode)');
      }

      // Check if we have translations
      if (!cacheEntry.translations || !cacheEntry.translations.length) {
        return;
      }

      // Set loading state first
      setLoadedFromCache(true);

      // Use a small timeout to ensure the loading state is rendered
      setTimeout(() => {
        // Set the translated subtitles
        setTranslatedSubtitles(cacheEntry.translations);

        // Call the callback
        if (onTranslationComplete) {
          onTranslationComplete(cacheEntry.translations);
        }

        // Dispatch a custom event to notify other components that translation is complete
        window.dispatchEvent(new CustomEvent('translation-complete', {
          detail: {
            translatedSubtitles: cacheEntry.translations,
            loadedFromCache: true
          }
        }));

        // Show a status message
        setTranslationStatus(t('translation.loadedFromCache', 'Translations loaded from cache'));
      }, 100);
    } catch (error) {
      console.error('Error loading translations from cache:', error);
    }
  }, [subtitles, translatedSubtitles, onTranslationComplete, t, wasManuallyReset, setLoadedFromCache, setTranslatedSubtitles, setTranslationStatus]);
};
