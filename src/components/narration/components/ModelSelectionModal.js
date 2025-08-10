import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import CloseButton from '../../common/CloseButton';
import LoadingIndicator from '../../common/LoadingIndicator';
import '../../../styles/narration/narrationModelDropdown.css';

/**
 * Model Selection Modal Component
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Function called when modal is closed
 * @param {Array} props.availableModels - Array of available models
 * @param {boolean} props.isLoadingModels - Whether models are being loaded
 * @param {string} props.selectedModel - Currently selected model
 * @param {Function} props.onModelSelect - Function called when a model is selected
 * @param {string} props.subtitleSource - Current subtitle source ('original' or 'translated')
 * @param {Object} props.originalLanguage - Original language object
 * @param {Object} props.translatedLanguage - Translated language object
 * @param {Function} props.renderModelLanguages - Function to render model languages
 * @returns {JSX.Element|null} - Rendered component or null if not open
 */
const ModelSelectionModal = ({
  isOpen,
  onClose,
  availableModels,
  isLoadingModels,
  selectedModel,
  onModelSelect,
  subtitleSource,
  originalLanguage,
  translatedLanguage,
  renderModelLanguages
}) => {
  const { t } = useTranslation();
  const modalRef = useRef(null);

  // Handle ESC key to close
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  // Focus management
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  // Handle click outside to close
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleModelSelect = (modelId) => {
    onModelSelect(modelId);
    onClose();
  };

  if (!isOpen) return null;

  // Use ReactDOM.createPortal to render the modal outside the VideoRenderingSection's stacking context
  return ReactDOM.createPortal(
    <div className="model-selection-modal-overlay" onClick={handleOverlayClick}>
      <div
        className="model-selection-modal"
        ref={modalRef}
        tabIndex="-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="model-selection-modal-header">
          <h2>{t('narration.selectNarrationModel', 'Select narration model')}</h2>
          <CloseButton onClick={onClose} variant="modal" size="medium" />
        </div>
        <div className="model-selection-modal-content">
          {isLoadingModels ? (
            <div className="loading-animation modal-loading">
              <LoadingIndicator
                theme="dark"
                showContainer={false}
                size={24}
                className="model-loading-indicator"
              />
              <span>{t('narration.loadingModels', 'Loading models...')}</span>
            </div>
          ) : availableModels.length > 0 ? (
            <>
              <div className="model-selection-explanation">
                {t('narration.selectModelExplanation', 'Choose a narration model that supports your subtitle language for the best results.')}
              </div>
              
              {/* Group 1: Models matching the detected language */}
              <div className="model-group">
                <div className="model-group-label recommended-models-label">
                  {t('narration.matchingLanguageModels', 'Recommended Models')}
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
                      <div
                        key={model.id}
                        className={`model-option-card ${model.id === selectedModel ? 'selected' : ''}`}
                        onClick={() => handleModelSelect(model.id)}
                      >
                        <div className="model-option-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="m9 12 2 2 4-4"/>
                          </svg>
                        </div>
                        <div className="model-option-info">
                          <div className="model-option-name">{model.id}</div>
                          <div className="model-option-description">{renderModelLanguages(model)}</div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Group 2: All other models */}
              <div className="model-group">
                <div className="model-group-label">
                  {t('narration.otherModels', 'Other Available Models')}
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
                      <div
                        key={model.id}
                        className={`model-option-card ${model.id === selectedModel ? 'selected' : ''}`}
                        onClick={() => handleModelSelect(model.id)}
                      >
                        <div className="model-option-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                          </svg>
                        </div>
                        <div className="model-option-info">
                          <div className="model-option-name">{model.id}</div>
                          <div className="model-option-description">{renderModelLanguages(model)}</div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            </>
          ) : (
            <div className="no-models-message">
              <div className="model-option-card">
                <div className="model-option-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="m9 9 1.5 1.5L16 6"/>
                    <path d="M12 16h.01"/>
                  </svg>
                </div>
                <div className="model-option-info">
                  <div className="model-option-name">{selectedModel}</div>
                  <div className="model-option-description">{t('narration.noModelsAvailable', 'No other models available')}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body // Render directly into document.body to escape VideoRenderingSection's stacking context
  );
};

export default ModelSelectionModal;
