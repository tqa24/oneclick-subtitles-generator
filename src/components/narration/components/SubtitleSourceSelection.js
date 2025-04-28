import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { detectSubtitleLanguage, getNarrationModelForLanguage } from '../../../services/gemini/languageDetectionService';
import { checkModelAvailabilityForLanguage, getAvailableModels } from '../../../services/modelAvailabilityService';
import '../../../styles/narration/modelDropdown.css';

/**
 * Subtitle Source Selection component
 * @param {Object} props - Component props
 * @param {string} props.subtitleSource - Current subtitle source
 * @param {Function} props.setSubtitleSource - Function to set subtitle source
 * @param {boolean} props.isGenerating - Whether generation is in progress
 * @param {Array} props.translatedSubtitles - Translated subtitles
 * @param {Array} props.originalSubtitles - Original subtitles
 * @param {Function} props.onLanguageDetected - Callback when language is detected
 * @returns {JSX.Element} - Rendered component
 */
const SubtitleSourceSelection = ({
  subtitleSource,
  setSubtitleSource,
  isGenerating,
  translatedSubtitles,
  originalSubtitles,
  onLanguageDetected
}) => {
  const { t } = useTranslation();
  const hasTranslatedSubtitles = translatedSubtitles && translatedSubtitles.length > 0;

  // State for language detection
  const [isDetectingOriginal, setIsDetectingOriginal] = useState(false);
  const [isDetectingTranslated, setIsDetectingTranslated] = useState(false);
  const [originalLanguage, setOriginalLanguage] = useState(null);
  const [translatedLanguage, setTranslatedLanguage] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [modelError, setModelError] = useState(null);
  const [isCheckingModel, setIsCheckingModel] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

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

    loadModels();
  }, []);

  // Detect changes in translated subtitles
  useEffect(() => {
    // If we already have translated subtitles and the user has selected translated source,
    // we should re-detect the language when the subtitles change
    if (translatedSubtitles &&
        translatedSubtitles.length > 0 &&
        subtitleSource === 'translated') {
      console.log('Translated subtitles changed, re-detecting language');
      setTranslatedLanguage(null); // Reset the language
      detectSubtitleLanguage(translatedSubtitles, 'translated');
    }
  }, [translatedSubtitles, subtitleSource]);

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

          // First use the fallback function to get a suggested model
          const suggestedModelId = getNarrationModelForLanguage(result.languageCode);

          // Then check if a model is actually available for this language
          setIsCheckingModel(true);
          try {
            const modelAvailability = await checkModelAvailabilityForLanguage(result.languageCode);
            setIsCheckingModel(false);

            if (modelAvailability.available) {
              // Use the available model
              setSelectedModel(modelAvailability.modelId);

              // Call the callback with the detected language and model
              if (onLanguageDetected) {
                onLanguageDetected(source, result, modelAvailability.modelId);
              }
            } else {
              // No model available, show error and use fallback
              setModelError(modelAvailability.error);
              setSelectedModel(suggestedModelId);

              // Call the callback with the detected language and fallback model
              if (onLanguageDetected) {
                onLanguageDetected(source, result, suggestedModelId, modelAvailability.error);
              }
            }
          } catch (error) {
            // Error checking model availability, use fallback
            setIsCheckingModel(false);
            setModelError(`Error checking model availability: ${error.message}`);
            setSelectedModel(suggestedModelId);

            // Call the callback with the detected language and fallback model
            if (onLanguageDetected) {
              onLanguageDetected(source, result, suggestedModelId, `Error checking model availability: ${error.message}`);
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

          // First use the fallback function to get a suggested model
          const suggestedModelId = getNarrationModelForLanguage(result.languageCode);

          // Then check if a model is actually available for this language
          setIsCheckingModel(true);
          try {
            const modelAvailability = await checkModelAvailabilityForLanguage(result.languageCode);
            setIsCheckingModel(false);

            if (modelAvailability.available) {
              // Use the available model
              setSelectedModel(modelAvailability.modelId);

              // Call the callback with the detected language and model
              if (onLanguageDetected) {
                onLanguageDetected(source, result, modelAvailability.modelId);
              }
            } else {
              // No model available, show error and use fallback
              setModelError(modelAvailability.error);
              setSelectedModel(suggestedModelId);

              // Call the callback with the detected language and fallback model
              if (onLanguageDetected) {
                onLanguageDetected(source, result, suggestedModelId, modelAvailability.error);
              }
            }
          } catch (error) {
            // Error checking model availability, use fallback
            setIsCheckingModel(false);
            setModelError(`Error checking model availability: ${error.message}`);
            setSelectedModel(suggestedModelId);

            // Call the callback with the detected language and fallback model
            if (onLanguageDetected) {
              onLanguageDetected(source, result, suggestedModelId, `Error checking model availability: ${error.message}`);
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
      console.log('Translation complete event detected');
      // If the user has selected translated subtitles, re-detect the language
      if (subtitleSource === 'translated' && translatedSubtitles && translatedSubtitles.length > 0) {
        console.log('Re-detecting language after translation complete');
        setTranslatedLanguage(null); // Reset the language
        detectSubtitleLanguage(translatedSubtitles, 'translated');
      }
    };

    // Listen for translation reset event to clear translated language
    const handleTranslationReset = () => {
      console.log('Translation reset event detected');
      // Reset the translated language state
      setTranslatedLanguage(null);

      // If the user had selected translated subtitles, switch to original
      if (subtitleSource === 'translated') {
        console.log('Switching to original subtitles after translation reset');
        setSubtitleSource('original');

        // If we have original language info, update the model
        if (originalLanguage) {
          const modelId = getNarrationModelForLanguage(originalLanguage.languageCode);
          setSelectedModel(modelId);

          // Call the callback with the detected language and model
          if (onLanguageDetected) {
            onLanguageDetected('original', originalLanguage, modelId);
          }
        }
      }
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
  }, [subtitleSource, onLanguageDetected, translatedSubtitles]);

  // Handle model selection change
  const handleModelChange = (event) => {
    const newModelId = event.target.value;
    setSelectedModel(newModelId);

    // Call the callback with the updated model
    if (onLanguageDetected) {
      const currentLanguage = subtitleSource === 'original' ? originalLanguage : translatedLanguage;
      if (currentLanguage) {
        onLanguageDetected(subtitleSource, currentLanguage, newModelId);
      }
    }
  };

  // Handle subtitle source change
  const handleSourceChange = async (source) => {
    // Only proceed if the source is different or we don't have language info yet
    if (source !== subtitleSource ||
        (source === 'original' && !originalLanguage) ||
        (source === 'translated' && !translatedLanguage)) {

      setSubtitleSource(source);
      setModelError(null); // Clear any previous errors

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
            const modelAvailability = await checkModelAvailabilityForLanguage(originalLanguage.languageCode);
            setIsCheckingModel(false);

            if (modelAvailability.available) {
              // Use the available model
              setSelectedModel(modelAvailability.modelId);

              // Call the callback with the detected language and model
              if (onLanguageDetected) {
                onLanguageDetected('original', originalLanguage, modelAvailability.modelId);
              }
            } else {
              // No model available, show error and use fallback
              const fallbackModelId = getNarrationModelForLanguage(originalLanguage.languageCode);
              setModelError(modelAvailability.error);
              setSelectedModel(fallbackModelId);

              // Call the callback with the detected language and fallback model
              if (onLanguageDetected) {
                onLanguageDetected('original', originalLanguage, fallbackModelId, modelAvailability.error);
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
            const modelAvailability = await checkModelAvailabilityForLanguage(translatedLanguage.languageCode);
            setIsCheckingModel(false);

            if (modelAvailability.available) {
              // Use the available model
              setSelectedModel(modelAvailability.modelId);

              // Call the callback with the detected language and model
              if (onLanguageDetected) {
                onLanguageDetected('translated', translatedLanguage, modelAvailability.modelId);
              }
            } else {
              // No model available, show error and use fallback
              const fallbackModelId = getNarrationModelForLanguage(translatedLanguage.languageCode);
              setModelError(modelAvailability.error);
              setSelectedModel(fallbackModelId);

              // Call the callback with the detected language and fallback model
              if (onLanguageDetected) {
                onLanguageDetected('translated', translatedLanguage, fallbackModelId, modelAvailability.error);
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

  // Helper to render language badge
  const renderLanguageBadge = (language) => {
    if (!language) return null;

    return (
      <span className={`language-badge ${language.isMultiLanguage ? 'multi' : ''}`}>
        {language.languageCode.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="narration-row subtitle-source-row">
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

          {selectedModel && (subtitleSource === 'original' ? originalLanguage : translatedLanguage) && !isCheckingModel && (
            <div className="selected-model">
              <span className="model-label">{t('narration.narrationModel', 'Narration Model')}:</span>

              {isLoadingModels ? (
                <span className="loading-animation">
                  <span className="spinner-circle"></span>
                  {t('narration.loadingModels', 'Loading models...')}
                </span>
              ) : (
                <select
                  className="model-dropdown"
                  value={selectedModel}
                  onChange={handleModelChange}
                  disabled={isGenerating}
                >
                  {availableModels.length > 0 ? (
                    <>
                      {/* Group 1: Models matching the detected language */}
                      <optgroup label={t('narration.matchingLanguageModels', 'Matching Language')}>
                        {availableModels
                          .filter(model => {
                            const currentLanguage = subtitleSource === 'original'
                              ? originalLanguage?.languageCode
                              : translatedLanguage?.languageCode;

                            return currentLanguage && (
                              model.language === currentLanguage ||
                              (Array.isArray(model.languages) && model.languages.includes(currentLanguage))
                            );
                          })
                          .map(model => (
                            <option key={model.id} value={model.id}>
                              {model.id} {model.language ? `(${model.language.toUpperCase()})` : ''}
                            </option>
                          ))
                        }
                      </optgroup>

                      {/* Group 2: All other models */}
                      <optgroup label={t('narration.otherModels', 'Other Models')}>
                        {availableModels
                          .filter(model => {
                            const currentLanguage = subtitleSource === 'original'
                              ? originalLanguage?.languageCode
                              : translatedLanguage?.languageCode;

                            return !currentLanguage || (
                              model.language !== currentLanguage &&
                              !(Array.isArray(model.languages) && model.languages.includes(currentLanguage))
                            );
                          })
                          .map(model => (
                            <option key={model.id} value={model.id}>
                              {model.id} {model.language ? `(${model.language.toUpperCase()})` : ''}
                            </option>
                          ))
                        }
                      </optgroup>
                    </>
                  ) : (
                    <option value={selectedModel}>{selectedModel}</option>
                  )}
                </select>
              )}

              {modelError && (
                <span className="model-error">
                  <span className="error-icon">⚠️</span>
                  {modelError}
                </span>
              )}
            </div>
          )}

          {modelError && !selectedModel && !isCheckingModel && (
            <div className="model-error-standalone">
              <span className="error-icon">⚠️</span>
              {modelError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubtitleSourceSelection;
