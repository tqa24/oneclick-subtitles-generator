import { detectSubtitleLanguage } from '../../../services/gemini/languageDetectionService';

/**
 * Handle a subtitle source change (original <-> translated).
 *
 * Switches the source, clears model error/manual-selection state, and triggers
 * language detection for the newly selected source when needed.
 *
 * @param {string} source - The newly selected source ('original' | 'translated')
 * @param {Object} params
 * @param {string} params.subtitleSource - Current subtitle source
 * @param {Object} params.originalLanguage - Detected original language
 * @param {Object} params.translatedLanguage - Detected translated language
 * @param {Array} params.originalSubtitles - Original subtitles
 * @param {Array} params.translatedSubtitles - Translated subtitles
 * @param {Function} params.setSubtitleSource - Setter for subtitle source
 * @param {Function} params.setModelError - Setter for model error
 * @param {Function} params.setUserHasManuallySelectedModel - Setter for manual model flag
 * @param {Function} params.onLanguageDetected - Callback when language is known
 * @returns {Promise<void>}
 */
export const handleSourceChange = async (source, {
  subtitleSource,
  originalLanguage,
  translatedLanguage,
  originalSubtitles,
  translatedSubtitles,
  setSubtitleSource,
  setModelError,
  setUserHasManuallySelectedModel,
  onLanguageDetected
}) => {
  // Only proceed if the source is different or we don't have language info yet
  if (source !== subtitleSource ||
      (source === 'original' && !originalLanguage) ||
      (source === 'translated' && !translatedLanguage)) {

    setSubtitleSource(source);
    setModelError(null); // Clear any previous errors

    // Reset the manual selection flag when switching subtitle sources
    // This allows automatic model selection for the new source
    setUserHasManuallySelectedModel(false);

    // Detect language for the selected source
    if (source === 'original' && originalSubtitles && originalSubtitles.length > 0) {
      if (!originalLanguage) {
        // Only detect if we don't already have the language
        detectSubtitleLanguage(originalSubtitles, 'original');
      } else if (onLanguageDetected) {
        // We already have the language, just call the callback
        onLanguageDetected('original', originalLanguage);
      }
    } else if (source === 'translated' && translatedSubtitles && translatedSubtitles.length > 0) {
      if (!translatedLanguage) {
        // Only detect if we don't already have the language
        detectSubtitleLanguage(translatedSubtitles, 'translated');
      } else if (onLanguageDetected) {
        // We already have the language, just call the callback
        onLanguageDetected('translated', translatedLanguage);
      }
    }
  }
};

/**
 * Handle saving a manually selected language for a source.
 *
 * Clears or sets the language for the manual source, builds a manual language
 * descriptor for one or more languages, and fires the `onLanguageDetected` callback.
 *
 * @param {Array<string>} languages - Selected language codes (first is primary)
 * @param {Object} params
 * @param {string} params.manualLanguageSource - 'original' | 'translated' | null
 * @param {Function} params.setOriginalLanguage - Setter for original language
 * @param {Function} params.setTranslatedLanguage - Setter for translated language
 * @param {Function} params.onLanguageDetected - Callback when language is set
 * @returns {void}
 */
export const handleManualLanguageSave = (languages, {
  manualLanguageSource,
  setOriginalLanguage,
  setTranslatedLanguage,
  onLanguageDetected
}) => {
  if (!manualLanguageSource) return;

  // If no languages selected, clear the language selection
  if (!languages || languages.length === 0) {
    if (manualLanguageSource === 'original') {
      setOriginalLanguage(null);
    } else if (manualLanguageSource === 'translated') {
      setTranslatedLanguage(null);
    }
    return;
  }

  // Create a manual language object
  const manualLanguage = {
    languageCode: languages[0] || 'unknown',
    secondaryLanguages: languages.length > 1 ? languages.slice(1) : [],
    isMultiLanguage: languages.length > 1,
    isManualSelection: true,
    confidence: 1.0 // Manual selection has full confidence
  };

  // Set the language based on source
  if (manualLanguageSource === 'original') {
    setOriginalLanguage(manualLanguage);
  } else if (manualLanguageSource === 'translated') {
    setTranslatedLanguage(manualLanguage);
  }

  // Call the callback if provided
  if (onLanguageDetected) {
    onLanguageDetected(manualLanguageSource, manualLanguage);
  }
};
