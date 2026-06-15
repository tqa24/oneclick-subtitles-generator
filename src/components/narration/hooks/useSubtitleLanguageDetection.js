import { useState, useEffect } from 'react';
import { detectSubtitleLanguage } from '../../../services/gemini/languageDetectionService';

/**
 * Custom hook that wires up language-detection window events for subtitle sources.
 *
 * Listens for `language-detection-status/complete/error`, `translation-complete`,
 * and `translation-reset` events and keeps the original/translated detection state
 * in sync, calling the provided setters and `onLanguageDetected` callback.
 *
 * @param {Object} params
 * @param {string} params.subtitleSource - Current subtitle source ('original'|'translated')
 * @param {Array} params.translatedSubtitles - Translated subtitles
 * @param {Function} params.setOriginalLanguage - Setter for original language
 * @param {Function} params.setTranslatedLanguage - Setter for translated language
 * @param {Function} params.onLanguageDetected - Callback when language is detected
 * @param {Object} params.lastOriginalLanguageRef - Ref holding last detected original language
 * @param {Object} params.lastTranslatedLanguageRef - Ref holding last detected translated language
 * @returns {{ isDetectingOriginal: boolean, isDetectingTranslated: boolean }}
 */
const useSubtitleLanguageDetection = ({
  subtitleSource,
  translatedSubtitles,
  setOriginalLanguage,
  setTranslatedLanguage,
  onLanguageDetected,
  lastOriginalLanguageRef,
  lastTranslatedLanguageRef
}) => {
  const [isDetectingOriginal, setIsDetectingOriginal] = useState(false);
  const [isDetectingTranslated, setIsDetectingTranslated] = useState(false);

  // Listen for language detection events
  useEffect(() => {
    const handleDetectionStatus = (event) => {
      const { source } = event.detail;
      if (source === 'original') {
        setIsDetectingOriginal(true);
      } else if (source === 'translated') {
        setIsDetectingTranslated(true);
      }
    };

    const handleDetectionComplete = (event) => {
      const { result, source } = event.detail;

      if (source === 'original') {
        setIsDetectingOriginal(false);
        setOriginalLanguage(result);
        // keep stable ref so UI doesn't flash when user switches pills
        lastOriginalLanguageRef.current = result;

        // Always call the callback when language is detected, regardless of current selection
        // This ensures modals update their recommended sections
        if (onLanguageDetected) {
          onLanguageDetected(source, result);
        }
      } else if (source === 'translated') {
        setIsDetectingTranslated(false);
        setTranslatedLanguage(result);
        // keep stable ref so UI doesn't flash when user switches pills
        lastTranslatedLanguageRef.current = result;

        // Always call the callback when language is detected, regardless of current selection
        // This ensures modals update their recommended sections
        if (onLanguageDetected) {
          onLanguageDetected(source, result);
        }
      }
    };

    const handleDetectionError = (event) => {
      const { source } = event.detail;
      if (source === 'original') {
        setIsDetectingOriginal(false);
      } else if (source === 'translated') {
        setIsDetectingTranslated(false);
      }
    };

    // Listen for translation complete event to trigger language detection
    const handleTranslationComplete = () => {

      // If the user has selected translated subtitles, re-detect the language
      if (subtitleSource === 'translated' && translatedSubtitles && translatedSubtitles.length > 0) {

        setTranslatedLanguage(null); // Reset the language
        detectSubtitleLanguage(translatedSubtitles, 'translated');
      }
    };

    // Listen for translation reset event to clear translated language
    const handleTranslationReset = () => {
      // Just reset the translated language state, don't interfere with subtitle source
      setTranslatedLanguage(null);

      // Don't automatically switch subtitle source - let user control this manually
      // This prevents interference with the translation reset process
    };

    // Add event listeners
    window.addEventListener('language-detection-status', handleDetectionStatus);
    window.addEventListener('language-detection-complete', handleDetectionComplete);
    window.addEventListener('language-detection-error', handleDetectionError);
    window.addEventListener('translation-complete', handleTranslationComplete);
    window.addEventListener('translation-reset', handleTranslationReset);

    // Clean up event listeners
    return () => {
      window.removeEventListener('language-detection-status', handleDetectionStatus);
      window.removeEventListener('language-detection-complete', handleDetectionComplete);
      window.removeEventListener('language-detection-error', handleDetectionError);
      window.removeEventListener('translation-complete', handleTranslationComplete);
      window.removeEventListener('translation-reset', handleTranslationReset);
    };
  }, [subtitleSource, onLanguageDetected, translatedSubtitles, setOriginalLanguage, setTranslatedLanguage, lastOriginalLanguageRef, lastTranslatedLanguageRef]);

  return { isDetectingOriginal, isDetectingTranslated };
};

export default useSubtitleLanguageDetection;
