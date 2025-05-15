import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { detectSubtitleLanguage } from '../../../services/gemini/languageDetectionService';
import '../../../styles/narration/subtitleSourceSelectionMaterial.css';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import InfoIcon from '@mui/icons-material/Info';
import SubtitleGroupingModal from './SubtitleGroupingModal';

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
 * @param {boolean} props.useGroupedSubtitles - Whether to use grouped subtitles for narration
 * @param {Function} props.setUseGroupedSubtitles - Function to set whether to use grouped subtitles
 * @param {boolean} props.isGroupingSubtitles - Whether subtitles are currently being grouped
 * @param {Array} props.originalSubtitles - Original subtitles
 * @param {Array} props.groupedSubtitles - Grouped subtitles
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
  onLanguageDetected,
  useGroupedSubtitles = false,
  setUseGroupedSubtitles = () => {},
  isGroupingSubtitles = false,
  groupedSubtitles = null
}) => {
  const { t } = useTranslation();

  // State for language detection and modal
  const [isDetectingOriginal, setIsDetectingOriginal] = useState(false);
  const [isDetectingTranslated, setIsDetectingTranslated] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Function to handle subtitle grouping toggle
  const handleGroupingToggle = (checked) => {
    setUseGroupedSubtitles(checked);
    // No need to set isGroupingSubtitles here as it will be handled by the useGeminiNarration hook
  };

  // Functions to handle modal
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  // Check if subtitles are available
  const hasTranslatedSubtitles = translatedSubtitles && translatedSubtitles.length > 0;
  const hasOriginalSubtitles = originalSubtitles && originalSubtitles.length > 0;
  const hasSubtitles = hasOriginalSubtitles || hasTranslatedSubtitles;

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

          {/* Subtitle Grouping Switch */}
          <div className="subtitle-grouping-switch" style={{ marginTop: '10px' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={useGroupedSubtitles}
                  onChange={(e) => handleGroupingToggle(e.target.checked)}
                  disabled={isGenerating || !subtitleSource || isGroupingSubtitles || !hasSubtitles}
                  color="primary"
                  size="small"
                />
              }
              label={
                <span style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>
                  {t('narration.groupSubtitles', 'Smartly group subtitles into fuller sentences for narration')}
                  {isGroupingSubtitles && (
                    <span className="loading-animation" style={{ marginLeft: '10px', display: 'inline-flex', alignItems: 'center' }}>
                      <span className="spinner-circle" style={{ width: '14px', height: '14px' }}></span>
                      <span style={{ marginLeft: '5px' }}>{t('narration.groupingSubtitles', 'Grouping...')}</span>
                    </span>
                  )}
                </span>
              }
            />

            {/* Show comparison button when grouped subtitles are available */}
            {useGroupedSubtitles && groupedSubtitles && groupedSubtitles.length > 0 && (
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center' }}>
                <Button
                  startIcon={<InfoIcon />}
                  onClick={openModal}
                  size="small"
                  variant="contained"
                  color="primary"
                >
                  {t('narration.viewGrouping', 'View Grouping')}
                </Button>
                <Typography variant="caption" color="textSecondary" style={{ marginLeft: '10px' }}>
                  {t('narration.groupedSubtitlesCount', 'Grouped {{original}} subtitles into {{grouped}} sentences', {
                    original: originalSubtitles?.length || 0,
                    grouped: groupedSubtitles?.length || 0
                  })}
                </Typography>
              </div>
            )}
          </div>

          {/* Subtitle Grouping Comparison Modal */}
          <SubtitleGroupingModal
            open={isModalOpen}
            onClose={closeModal}
            originalSubtitles={originalSubtitles}
            groupedSubtitles={groupedSubtitles}
          />
        </div>
      </div>
    </div>
  );
};

export default GeminiSubtitleSourceSelection;
