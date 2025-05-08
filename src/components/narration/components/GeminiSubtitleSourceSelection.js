import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { detectSubtitleLanguage } from '../../../services/gemini/languageDetectionService';
import '../../../styles/narration/subtitleSourceSelectionMaterial.css';

/**
 * Simplified subtitle source selection component for Gemini narration
 * @param {Object} props - Component props
 * @param {string} props.subtitleSource - Current subtitle source
 * @param {Function} props.setSubtitleSource - Function to set subtitle source
 * @param {boolean} props.isGenerating - Whether generation is in progress
 * @param {Array} props.translatedSubtitles - Translated subtitles
 * @param {Array} props.originalSubtitles - Original subtitles
 * @param {Object} props.originalLanguage - Original language information
 * @param {Object} props.translatedLanguage - Translated language information
 * @param {Function} props.setOriginalLanguage - Function to set original language
 * @param {Function} props.setTranslatedLanguage - Function to set translated language
 * @param {Function} props.onLanguageDetected - Callback when language is detected
 * @returns {JSX.Element} - Rendered component
 */
const GeminiSubtitleSourceSelection = ({
  subtitleSource,
  setSubtitleSource,
  isGenerating,
  translatedSubtitles,
  originalSubtitles,
  originalLanguage,
  translatedLanguage,
  setOriginalLanguage,
  setTranslatedLanguage,
  onLanguageDetected
}) => {
  const { t } = useTranslation();
  const hasTranslatedSubtitles = translatedSubtitles && translatedSubtitles.length > 0;

  // State for language detection
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

        // If this is the currently selected source, update
        if (subtitleSource === 'original' && onLanguageDetected) {
          onLanguageDetected(source, result);
        }
      } else if (source === 'translated') {
        setIsDetectingTranslated(false);
        setTranslatedLanguage(result);

        // If this is the currently selected source, update
        if (subtitleSource === 'translated' && onLanguageDetected) {
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

    // Add event listeners
    window.addEventListener('language-detection-status', handleDetectionStatus);
    window.addEventListener('language-detection-complete', handleDetectionComplete);
    window.addEventListener('language-detection-error', handleDetectionError);

    // Clean up event listeners
    return () => {
      window.removeEventListener('language-detection-status', handleDetectionStatus);
      window.removeEventListener('language-detection-complete', handleDetectionComplete);
      window.removeEventListener('language-detection-error', handleDetectionError);
    };
  }, [subtitleSource, onLanguageDetected, setOriginalLanguage, setTranslatedLanguage]);

  // Handle subtitle source change
  const handleSourceChange = async (source) => {
    // Only proceed if the source is different or we don't have language info yet
    if (source !== subtitleSource ||
        (source === 'original' && !originalLanguage) ||
        (source === 'translated' && !translatedLanguage)) {

      setSubtitleSource(source);

      // Detect language for the selected source
      if (source === 'original' && originalSubtitles && originalSubtitles.length > 0) {
        if (!originalLanguage) {
          // Only detect if we don't already have the language
          detectSubtitleLanguage(originalSubtitles, 'original');
        } else if (onLanguageDetected) {
          // We already have the language
          onLanguageDetected('original', originalLanguage);
        }
      } else if (source === 'translated' && translatedSubtitles && translatedSubtitles.length > 0) {
        if (!translatedLanguage) {
          // Only detect if we don't already have the language
          detectSubtitleLanguage(translatedSubtitles, 'translated');
        } else if (onLanguageDetected) {
          // We already have the language
          onLanguageDetected('translated', translatedLanguage);
        }
      }
    }
  };

  // Helper to render language badges
  const renderLanguageBadge = (language) => {
    if (!language) return null;

    // If it's a multi-language text, show badges for all detected languages
    if (language.isMultiLanguage && Array.isArray(language.secondaryLanguages) && language.secondaryLanguages.length > 0) {
      return (
        <div className="language-badge-container">
          {language.secondaryLanguages.map((langCode, index) => (
            <span key={index} className="language-badge multi">
              {langCode.toUpperCase()}
            </span>
          ))}
        </div>
      );
    }

    // Otherwise, just show the primary language
    return (
      <span className="language-badge">
        {language.languageCode.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="narration-row subtitle-source-row animated-row">
      <div className="row-label">
        <label>{t('narration.subtitleSource', 'Subtitle Source')}:</label>
      </div>
      <div className="row-content">
        <div className="subtitle-selection-container">
          <div className="radio-pill-group">
            <div className="radio-pill">
              <input
                type="radio"
                id="source-original"
                name="subtitle-source"
                value="original"
                checked={subtitleSource === 'original'}
                onChange={() => handleSourceChange('original')}
                disabled={isGenerating}
              />
              <label htmlFor="source-original">
                {isDetectingOriginal ? (
                  <span className="loading-animation">
                    <span className="spinner-circle"></span>
                    {t('narration.detectingLanguage', 'Detecting language...')}
                  </span>
                ) : (
                  <>
                    {t('narration.originalSubtitles', 'Original Subtitles')}
                    {originalLanguage && renderLanguageBadge(originalLanguage)}
                  </>
                )}
              </label>
            </div>
            <div className="radio-pill">
              <input
                type="radio"
                id="source-translated"
                name="subtitle-source"
                value="translated"
                checked={subtitleSource === 'translated'}
                onChange={() => handleSourceChange('translated')}
                disabled={isGenerating || !hasTranslatedSubtitles}
              />
              <label htmlFor="source-translated">
                {isDetectingTranslated ? (
                  <span className="loading-animation">
                    <span className="spinner-circle"></span>
                    {t('narration.detectingLanguage', 'Detecting language...')}
                  </span>
                ) : (
                  <>
                    {t('narration.translatedSubtitles', 'Translated Subtitles')}
                    {translatedLanguage && renderLanguageBadge(translatedLanguage)}
                    {!hasTranslatedSubtitles && (
                      <span className="unavailable-indicator">
                        {t('narration.unavailable', '(unavailable)')}
                      </span>
                    )}
                  </>
                )}
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeminiSubtitleSourceSelection;
