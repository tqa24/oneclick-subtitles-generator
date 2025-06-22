import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { detectSubtitleLanguage, getNarrationModelForLanguage } from '../../../services/gemini/languageDetectionService';
import {
  checkModelAvailabilityForLanguage,
  getAvailableModels,
  MODEL_LIST_CHANGED_EVENT
} from '../../../services/modelAvailabilityService';
import { FiChevronDown } from 'react-icons/fi';
import '../../../styles/narration/modelDropdown.css';
import '../../../styles/narration/languageBadges.css';
import '../../../styles/narration/narrationModelDropdown.css';
import '../../../styles/ModelDropdown.css';
import '../../../styles/narration/subtitleSourceSelectionMaterial.css';
import SubtitleGroupingModal from './SubtitleGroupingModal';

/**
 * Subtitle Source Selection component
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
 * @param {Array} props.groupedSubtitles - Grouped subtitles
 * @param {string} props.groupingIntensity - Intensity level for subtitle grouping
 * @param {Function} props.setGroupingIntensity - Function to set grouping intensity
 * @returns {JSX.Element} - Rendered component
 */
const SubtitleSourceSelection = ({
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
  groupedSubtitles = null,
  groupingIntensity = 'moderate',
  setGroupingIntensity = () => {}
}) => {
  const { t } = useTranslation();
  const hasTranslatedSubtitles = translatedSubtitles && translatedSubtitles.length > 0;
  const hasOriginalSubtitles = originalSubtitles && originalSubtitles.length > 0;
  const hasSubtitles = hasOriginalSubtitles || hasTranslatedSubtitles;

  // State for subtitle grouping modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Function to handle subtitle grouping toggle
  const handleGroupingToggle = async (checked) => {
    if (checked) {
      // Clear the user disabled flag since they're turning it back on
      try {
        localStorage.removeItem('user_disabled_grouping');
      } catch (error) {
        console.error('Error clearing user disabled grouping flag:', error);
      }

      // If turning on, check if we already have grouped subtitles
      if (groupedSubtitles && groupedSubtitles.length > 0) {
        // We already have grouped subtitles, just enable the toggle
        setUseGroupedSubtitles(true);
        return;
      }

      // No existing grouped subtitles, we need to group them
      try {
        // Set grouping state to true to show loading indicator
        if (typeof window.setIsGroupingSubtitles === 'function') {
          window.setIsGroupingSubtitles(true);
        }

        // We don't need to update the local isGroupingSubtitles prop
        // as it's handled by the parent component through window.setIsGroupingSubtitles

        // Import the subtitle grouping service
        const { groupSubtitlesForNarration } = await import('../../../services/gemini/subtitleGroupingService');

        // Get the appropriate subtitles based on the selected source
        const subtitlesToGroup = subtitleSource === 'translated' && hasTranslatedSubtitles
          ? translatedSubtitles
          : originalSubtitles;

        // Get the language code for the selected subtitles
        const languageCode = subtitleSource === 'translated' && translatedLanguage
          ? translatedLanguage.languageCode
          : originalLanguage?.languageCode || 'en';

        // Group the subtitles
        const result = await groupSubtitlesForNarration(
          subtitlesToGroup,
          languageCode,
          'gemini-2.5-flash-lite-preview-06-17',
          groupingIntensity
        );

        // Update the grouped subtitles
        if (result && result.success && result.groupedSubtitles) {
          // Update the grouped subtitles state in the parent component
          window.groupedSubtitles = result.groupedSubtitles;
          // If the parent component provided a function to update grouped subtitles, call it
          if (typeof window.setGroupedSubtitles === 'function') {
            window.setGroupedSubtitles(result.groupedSubtitles);
          }
          setUseGroupedSubtitles(true);
        } else {
          // If grouping failed, don't enable the toggle
          setUseGroupedSubtitles(false);
        }
      } catch (error) {
        console.error('Error grouping subtitles:', error);
        setUseGroupedSubtitles(false);
      } finally {
        // Reset grouping state after a short delay to ensure the UI updates properly
        setTimeout(() => {
          if (typeof window.setIsGroupingSubtitles === 'function') {
            window.setIsGroupingSubtitles(false);
          }
        }, 500);
      }
    } else {
      // If turning off, clear the grouping data and update the state
      setUseGroupedSubtitles(false);

      // Clear the grouped subtitles data
      window.groupedSubtitles = null;
      if (typeof window.setGroupedSubtitles === 'function') {
        window.setGroupedSubtitles(null);
      }

      // Set flag to prevent auto-loading from cache
      try {
        localStorage.setItem('user_disabled_grouping', 'true');
      } catch (error) {
        console.error('Error setting user disabled grouping flag:', error);
      }
    }
  };

  // Functions to handle modal
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  // State for language detection
  const [isDetectingOriginal, setIsDetectingOriginal] = useState(false);
  const [isDetectingTranslated, setIsDetectingTranslated] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [modelError, setModelError] = useState(null);
  const [isCheckingModel, setIsCheckingModel] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [userHasManuallySelectedModel, setUserHasManuallySelectedModel] = useState(false);

  // Load available models
  useEffect(() => {
    const loadModels = async () => {
      setIsLoadingModels(true);
      try {
        const { models } = await getAvailableModels();
        setAvailableModels(models || []);
      } catch (error) {
        console.error('Error loading models:', error);
        setAvailableModels([]);
      } finally {
        setIsLoadingModels(false);
      }
    };

    // Load models initially
    loadModels();

    // Listen for model list changes
    const handleModelListChanged = () => {

      loadModels();
    };

    // Add event listener
    window.addEventListener(MODEL_LIST_CHANGED_EVENT, handleModelListChanged);

    // Clean up event listener
    return () => {
      window.removeEventListener(MODEL_LIST_CHANGED_EVENT, handleModelListChanged);
    };
  }, []);

  // Detect changes in translated subtitles
  useEffect(() => {
    // If we already have translated subtitles and the user has selected translated source,
    // we should re-detect the language when the subtitles change
    if (translatedSubtitles &&
        translatedSubtitles.length > 0 &&
        subtitleSource === 'translated') {

      setTranslatedLanguage(null); // Reset the language
      detectSubtitleLanguage(translatedSubtitles, 'translated');
    }
  }, [translatedSubtitles, subtitleSource, setTranslatedLanguage]);

  // Handle model modal
  const openModelModal = () => setIsModelModalOpen(true);
  const closeModelModal = () => setIsModelModalOpen(false);

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

    const handleDetectionComplete = async (event) => {
      const { result, source } = event.detail;

      if (source === 'original') {
        setIsDetectingOriginal(false);
        setOriginalLanguage(result);

        // If this is the currently selected source, check model availability and update
        if (subtitleSource === 'original') {
          // Clear any previous errors
          setModelError(null);

          // Get all language codes to check (primary + secondary)
          const languagesToCheck = result.isMultiLanguage &&
            Array.isArray(result.secondaryLanguages) &&
            result.secondaryLanguages.length > 0
              ? result.secondaryLanguages
              : result.languageCode;

          // First use the fallback function to get a suggested model
          const suggestedModelId = getNarrationModelForLanguage(languagesToCheck);

          // Then check if a model is actually available for this language
          setIsCheckingModel(true);
          try {
            const modelAvailability = await checkModelAvailabilityForLanguage(languagesToCheck);
            setIsCheckingModel(false);

            if (modelAvailability.available) {
              // Only auto-select if user hasn't manually chosen a model
              let modelId = selectedModel;
              if (!userHasManuallySelectedModel) {
                modelId = modelAvailability.modelId;
                setSelectedModel(modelId);
              }

              // Call the callback with the detected language and model
              if (onLanguageDetected) {
                onLanguageDetected(source, result, modelId);
              }
            } else {
              // No model available, show error and use fallback
              // Use a more user-friendly error message with language name
              const languageName = result.languageName || result.languageCode;
              const customError = t('narration.modelNotAvailableError', 'Please download at least one model that supports {{language}} from the Narration Model Management tab in Settings.', { language: languageName });
              setModelError(customError);

              // Only auto-select fallback if user hasn't manually chosen a model
              let modelId = selectedModel;
              if (!userHasManuallySelectedModel) {
                modelId = suggestedModelId;
                setSelectedModel(modelId);
              }

              // Call the callback with the detected language and fallback model
              if (onLanguageDetected) {
                onLanguageDetected(source, result, modelId, customError);
              }
            }
          } catch (error) {
            // Error checking model availability, use fallback
            setIsCheckingModel(false);
            setModelError(`Error checking model availability: ${error.message}`);

            // Only auto-select fallback if user hasn't manually chosen a model
            let modelId = selectedModel;
            if (!userHasManuallySelectedModel) {
              modelId = suggestedModelId;
              setSelectedModel(modelId);
            }

            // Call the callback with the detected language and fallback model
            if (onLanguageDetected) {
              onLanguageDetected(source, result, modelId, `Error checking model availability: ${error.message}`);
            }
          }
        }
      } else if (source === 'translated') {
        setIsDetectingTranslated(false);
        setTranslatedLanguage(result);

        // If this is the currently selected source, check model availability and update
        if (subtitleSource === 'translated') {
          // Clear any previous errors
          setModelError(null);

          // Get all language codes to check (primary + secondary)
          const languagesToCheck = result.isMultiLanguage &&
            Array.isArray(result.secondaryLanguages) &&
            result.secondaryLanguages.length > 0
              ? result.secondaryLanguages
              : result.languageCode;

          // First use the fallback function to get a suggested model
          const suggestedModelId = getNarrationModelForLanguage(languagesToCheck);

          // Then check if a model is actually available for this language
          setIsCheckingModel(true);
          try {
            const modelAvailability = await checkModelAvailabilityForLanguage(languagesToCheck);
            setIsCheckingModel(false);

            if (modelAvailability.available) {
              // Only auto-select if user hasn't manually chosen a model
              let modelId = selectedModel;
              if (!userHasManuallySelectedModel) {
                modelId = modelAvailability.modelId;
                setSelectedModel(modelId);
              }

              // Call the callback with the detected language and model
              if (onLanguageDetected) {
                onLanguageDetected(source, result, modelId);
              }
            } else {
              // No model available, show error and use fallback
              // Use a more user-friendly error message with language name
              const languageName = result.languageName || result.languageCode;
              const customError = t('narration.modelNotAvailableError', 'Please download at least one model that supports {{language}} from the Narration Model Management tab in Settings.', { language: languageName });
              setModelError(customError);

              // Only auto-select fallback if user hasn't manually chosen a model
              let modelId = selectedModel;
              if (!userHasManuallySelectedModel) {
                modelId = suggestedModelId;
                setSelectedModel(modelId);
              }

              // Call the callback with the detected language and fallback model
              if (onLanguageDetected) {
                onLanguageDetected(source, result, modelId, customError);
              }
            }
          } catch (error) {
            // Error checking model availability, use fallback
            setIsCheckingModel(false);
            setModelError(`Error checking model availability: ${error.message}`);

            // Only auto-select fallback if user hasn't manually chosen a model
            let modelId = selectedModel;
            if (!userHasManuallySelectedModel) {
              modelId = suggestedModelId;
              setSelectedModel(modelId);
            }

            // Call the callback with the detected language and fallback model
            if (onLanguageDetected) {
              onLanguageDetected(source, result, modelId, `Error checking model availability: ${error.message}`);
            }
          }
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
  }, [subtitleSource, onLanguageDetected, translatedSubtitles, t, originalLanguage, setOriginalLanguage, setSubtitleSource, setTranslatedLanguage]);

  // We're using an inline function for the button click handler

  // Handle model selection
  const handleModelSelect = (modelId) => {
    // Close the modal immediately
    setIsModelModalOpen(false);

    // Set the selected model
    setSelectedModel(modelId);

    // Mark that user has manually selected a model
    setUserHasManuallySelectedModel(true);

    // Call the callback with the updated model
    if (onLanguageDetected) {
      const currentLanguage = subtitleSource === 'original' ? originalLanguage : translatedLanguage;
      if (currentLanguage) {
        onLanguageDetected(subtitleSource, currentLanguage, modelId);
      }
    }
  };

  // We no longer need the handleModelChange function as we're using the new dropdown

  // Handle subtitle source change
  const handleSourceChange = async (source) => {
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
        } else {
          // We already have the language, check model availability
          setIsCheckingModel(true);

          try {
            // Check if a model is available for this language
            const languagesToCheck = originalLanguage.isMultiLanguage &&
              Array.isArray(originalLanguage.secondaryLanguages) &&
              originalLanguage.secondaryLanguages.length > 0
                ? originalLanguage.secondaryLanguages
                : originalLanguage.languageCode;

            const modelAvailability = await checkModelAvailabilityForLanguage(languagesToCheck);
            setIsCheckingModel(false);

            if (modelAvailability.available) {
              // Only auto-select if user hasn't manually chosen a model
              let modelId = selectedModel;
              if (!userHasManuallySelectedModel) {
                modelId = modelAvailability.modelId;
                setSelectedModel(modelId);
              }

              // Call the callback with the detected language and model
              if (onLanguageDetected) {
                onLanguageDetected('original', originalLanguage, modelId);
              }
            } else {
              // No model available, show error and use fallback
              const fallbackModelId = getNarrationModelForLanguage(originalLanguage.languageCode);

              // Use a more user-friendly error message with language name
              const languageName = originalLanguage.languageName || originalLanguage.languageCode;
              const customError = t('narration.modelNotAvailableError', 'Please download at least one model that supports {{language}} from the Narration Model Management tab in Settings.', { language: languageName });
              setModelError(customError);

              // Only auto-select fallback if user hasn't manually chosen a model
              let modelId = selectedModel;
              if (!userHasManuallySelectedModel) {
                modelId = fallbackModelId;
                setSelectedModel(modelId);
              }

              // Call the callback with the detected language and fallback model
              if (onLanguageDetected) {
                onLanguageDetected('original', originalLanguage, modelId, customError);
              }
            }
          } catch (error) {
            // Error checking model availability, use fallback
            setIsCheckingModel(false);
            const fallbackModelId = getNarrationModelForLanguage(originalLanguage.languageCode);
            setModelError(`Error checking model availability: ${error.message}`);

            setSelectedModel(fallbackModelId);

            // Call the callback with the detected language and fallback model
            if (onLanguageDetected) {
              onLanguageDetected('original', originalLanguage, fallbackModelId, `Error checking model availability: ${error.message}`);
            }
          }
        }
      } else if (source === 'translated' && translatedSubtitles && translatedSubtitles.length > 0) {
        if (!translatedLanguage) {
          // Only detect if we don't already have the language
          detectSubtitleLanguage(translatedSubtitles, 'translated');
        } else {
          // We already have the language, check model availability
          setIsCheckingModel(true);

          try {
            // Check if a model is available for this language
            const languagesToCheck = translatedLanguage.isMultiLanguage &&
              Array.isArray(translatedLanguage.secondaryLanguages) &&
              translatedLanguage.secondaryLanguages.length > 0
                ? translatedLanguage.secondaryLanguages
                : translatedLanguage.languageCode;

            const modelAvailability = await checkModelAvailabilityForLanguage(languagesToCheck);
            setIsCheckingModel(false);

            if (modelAvailability.available) {
              // Auto-select the best available model for this language
              setSelectedModel(modelAvailability.modelId);

              // Call the callback with the detected language and model
              if (onLanguageDetected) {
                onLanguageDetected('translated', translatedLanguage, modelAvailability.modelId);
              }
            } else {
              // No model available, show error and use fallback
              const fallbackModelId = getNarrationModelForLanguage(translatedLanguage.languageCode);

              // Use a more user-friendly error message with language name
              const languageName = translatedLanguage.languageName || translatedLanguage.languageCode;
              const customError = t('narration.modelNotAvailableError', 'Please download at least one model that supports {{language}} from the Narration Model Management tab in Settings.', { language: languageName });
              setModelError(customError);
              setSelectedModel(fallbackModelId);

              // Call the callback with the detected language and fallback model
              if (onLanguageDetected) {
                onLanguageDetected('translated', translatedLanguage, fallbackModelId, customError);
              }
            }
          } catch (error) {
            // Error checking model availability, use fallback
            setIsCheckingModel(false);
            const fallbackModelId = getNarrationModelForLanguage(translatedLanguage.languageCode);
            setModelError(`Error checking model availability: ${error.message}`);

            setSelectedModel(fallbackModelId);

            // Call the callback with the detected language and fallback model
            if (onLanguageDetected) {
              onLanguageDetected('translated', translatedLanguage, fallbackModelId, `Error checking model availability: ${error.message}`);
            }
          }
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

  // Helper to render model languages in dropdown
  const renderModelLanguages = (model) => {
    // If model has multiple languages
    if (Array.isArray(model.languages) && model.languages.length > 0) {
      return `(${model.languages.map(lang => lang.toUpperCase()).join(', ')})`;
    }
    // If model has a single language
    else if (model.language) {
      return `(${model.language.toUpperCase()})`;
    }
    // If no language information is available
    return '';
  };

  return (
    <>
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

            {/* Model information and error messages */}
            {isCheckingModel && (
              <div className="model-checking">
                <span className="spinner-circle"></span>
                <span>{t('narration.checkingModelAvailability', 'Checking model availability...')}</span>
              </div>
            )}

            <div className="model-dropdown-container narration-model-dropdown-container">
                <button
                  className="model-dropdown-btn narration-model-dropdown-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openModelModal();
                  }}
                  title={t('narration.selectNarrationModel', 'Select narration model')}
                  disabled={isGenerating}
                >
                  <span className="model-dropdown-label">{t('narration.narrationModel', 'Model')}:</span>
                  <span className="model-dropdown-selected">
                    <span className="model-name">{selectedModel}</span>
                  </span>
                  <FiChevronDown size={14} className="dropdown-icon" />
                </button>



                {modelError && (
                  <div className="model-error">
                    <span className="error-icon">⚠️</span>
                    <span>{modelError}</span>
                  </div>
                )}
              </div>

            {modelError && !selectedModel && !isCheckingModel && (
              <div className="model-error-standalone">
                <span className="error-icon">⚠️</span>
                <span>{modelError}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subtitle Grouping as a separate row */}
      <div className="narration-row subtitle-grouping-row animated-row">
        <div className="row-label">
          <label>{t('narration.subtitleGrouping', 'Subtitle Grouping')}:</label>
        </div>
        <div className="row-content">
          <div className="subtitle-grouping-container">
            {/* Grouping Intensity Dropdown */}
            <div
              className="grouping-intensity-container"
              data-tooltip={t('narration.intensityChangeTooltip', 'Changing intensity will require regrouping')}
            >
              <label htmlFor="grouping-intensity" className="grouping-intensity-label">
                {t('narration.groupingIntensity', 'Grouping Intensity')}:
              </label>
              <select
                id="grouping-intensity"
                className="grouping-intensity-select"
                value={groupingIntensity}
                onChange={(e) => setGroupingIntensity(e.target.value)}
                disabled={isGenerating || !subtitleSource || isGroupingSubtitles || !hasSubtitles || useGroupedSubtitles}
              >
                <option value="minimal">{t('narration.intensityMinimal', 'Minimal')}</option>
                <option value="light">{t('narration.intensityLight', 'Light')}</option>
                <option value="balanced">{t('narration.intensityBalanced', 'Balanced')}</option>
                <option value="moderate">{t('narration.intensityModerate', 'Moderate')}</option>
                <option value="enhanced">{t('narration.intensityEnhanced', 'Enhanced')}</option>
                <option value="aggressive">{t('narration.intensityAggressive', 'Aggressive')}</option>
              </select>
            </div>

            {/* Toggle Switch */}
            <div className="toggle-switch-container">
              <label className="toggle-switch" htmlFor="subtitle-grouping">
                <input
                  type="checkbox"
                  id="subtitle-grouping"
                  checked={useGroupedSubtitles}
                  onChange={(e) => handleGroupingToggle(e.target.checked)}
                  disabled={isGenerating || !subtitleSource || isGroupingSubtitles || !hasSubtitles}
                />
                <span className="toggle-slider"></span>
              </label>
              <span className="toggle-label">
                {t('narration.groupSubtitles', 'Smartly group subtitles into fuller sentences for narration')}
                {isGroupingSubtitles && (
                  <span className="loading-animation" style={{ marginLeft: '10px', display: 'inline-flex', alignItems: 'center' }}>
                    <span className="spinner-circle" style={{ width: '14px', height: '14px' }}></span>
                    <span style={{ marginLeft: '5px' }}>{t('narration.groupingSubtitles', 'Grouping...')}</span>
                  </span>
                )}
              </span>
            </div>

            {/* Show comparison button when grouped subtitles are available */}
            {useGroupedSubtitles && groupedSubtitles && groupedSubtitles.length > 0 && (
              <div className="grouping-info-container">
                <button
                  className="pill-button view-grouping-button"
                  onClick={openModal}
                >
                  <svg className="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  {t('narration.viewGrouping', 'View Grouping')}
                </button>
                <span className="grouping-stats">
                  {t('narration.groupedSubtitlesCount', 'Grouped {{original}} subtitles into {{grouped}} sentences', {
                    original: originalSubtitles?.length || 0,
                    grouped: groupedSubtitles?.length || 0
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Model Selection Modal */}
      {isModelModalOpen && (
        <div className="modal-overlay" onClick={closeModelModal}>
          <div className="modal-content model-selection-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('narration.selectNarrationModel', 'Select narration model')}</h3>
              <button className="modal-close-btn" onClick={closeModelModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {isLoadingModels ? (
                <div className="loading-animation modal-loading">
                  <span className="spinner-circle"></span>
                  <span>{t('narration.loadingModels', 'Loading models...')}</span>
                </div>
              ) : availableModels.length > 0 ? (
                <>
                  {/* Group 1: Models matching the detected language */}
                  <div className="model-group">
                    <div className="model-group-label">
                      {t('narration.matchingLanguageModels', 'Matching Language')}
                    </div>
                    <div className="model-options-grid">
                      {availableModels
                        .filter(model => {
                          const currentLanguageObj = subtitleSource === 'original'
                            ? originalLanguage
                            : translatedLanguage;

                          if (!currentLanguageObj) return false;

                          // Get all language codes to check (primary + secondary)
                          const languagesToCheck = currentLanguageObj.isMultiLanguage &&
                            Array.isArray(currentLanguageObj.secondaryLanguages) &&
                            currentLanguageObj.secondaryLanguages.length > 0
                              ? currentLanguageObj.secondaryLanguages // Use all languages if multi-language
                              : [currentLanguageObj.languageCode]; // Just use primary language

                          // Check if model supports any of the detected languages
                          return languagesToCheck.some(langCode =>
                            model.language === langCode ||
                            (Array.isArray(model.languages) && model.languages.includes(langCode))
                          );
                        })
                        .map(model => (
                          <button
                            key={model.id}
                            className={`model-option-card ${model.id === selectedModel ? 'selected' : ''}`}
                            onClick={() => handleModelSelect(model.id)}
                          >
                            <div className="model-option-name">{model.id}</div>
                            <div className="model-option-description">{renderModelLanguages(model)}</div>
                          </button>
                        ))
                      }
                    </div>
                  </div>

                  {/* Group 2: All other models */}
                  <div className="model-group">
                    <div className="model-group-label">
                      {t('narration.otherModels', 'Other Models')}
                    </div>
                    <div className="model-options-grid">
                      {availableModels
                        .filter(model => {
                          const currentLanguageObj = subtitleSource === 'original'
                            ? originalLanguage
                            : translatedLanguage;

                          if (!currentLanguageObj) return true;

                          // Get all language codes to check (primary + secondary)
                          const languagesToCheck = currentLanguageObj.isMultiLanguage &&
                            Array.isArray(currentLanguageObj.secondaryLanguages) &&
                            currentLanguageObj.secondaryLanguages.length > 0
                              ? currentLanguageObj.secondaryLanguages // Use all languages if multi-language
                              : [currentLanguageObj.languageCode]; // Just use primary language

                          // Check if model does NOT support any of the detected languages
                          return !languagesToCheck.some(langCode =>
                            model.language === langCode ||
                            (Array.isArray(model.languages) && model.languages.includes(langCode))
                          );
                        })
                        .map(model => (
                          <button
                            key={model.id}
                            className={`model-option-card ${model.id === selectedModel ? 'selected' : ''}`}
                            onClick={() => handleModelSelect(model.id)}
                          >
                            <div className="model-option-name">{model.id}</div>
                            <div className="model-option-description">{renderModelLanguages(model)}</div>
                          </button>
                        ))
                      }
                    </div>
                  </div>
                </>
              ) : (
                <div className="no-models-message">
                  <div className="model-option-name">{selectedModel}</div>
                  <div className="model-option-description">{t('narration.noModelsAvailable', 'No other models available')}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Subtitle Grouping Comparison Modal */}
      <SubtitleGroupingModal
        open={isModalOpen}
        onClose={closeModal}
        originalSubtitles={subtitleSource === 'translated' && hasTranslatedSubtitles ? translatedSubtitles : originalSubtitles}
        groupedSubtitles={groupedSubtitles}
        subtitleSource={subtitleSource}
      />
    </>
  );
};

export default SubtitleSourceSelection;
