import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FiX, FiCheck, FiAlertTriangle, FiZap, FiStar, FiAward, FiCpu, FiArrowRight } from 'react-icons/fi';
import '../styles/SegmentRetryModal.css';

/**
 * Modal component for retrying a segment with custom options
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Function called when modal is closed
 * @param {number} props.segmentIndex - Index of the segment to retry
 * @param {Array} props.segments - Array of segments
 * @param {Function} props.onRetry - Function called when retry is requested
 * @param {string} props.userProvidedSubtitles - User-provided subtitles for the whole media
 * @returns {JSX.Element} - Rendered component
 */
const SegmentRetryModal = ({
  isOpen,
  onClose,
  segmentIndex,
  segments,
  onRetry,
  userProvidedSubtitles = ''
}) => {
  const { t } = useTranslation();

  // Step management (1: model selection, 2: subtitle options)
  const [currentStep, setCurrentStep] = useState(1);

  // Model selection state
  const [selectedModel, setSelectedModel] = useState(localStorage.getItem('gemini_model') || 'gemini-2.0-flash');

  // Subtitle options state
  const [subtitlesOption, setSubtitlesOption] = useState('none');
  const [customSubtitles, setCustomSubtitles] = useState('');
  const textareaRef = useRef(null);

  // Model options with their icons and colors
  const modelOptions = [
    {
      id: 'gemini-2.5-pro-exp-03-25',
      name: t('models.gemini25Pro', 'Gemini 2.5 Pro'),
      description: t('models.bestAccuracy', 'Best accuracy'),
      icon: <FiStar className="model-icon star-icon" />,
      color: 'var(--md-tertiary)',
      bgColor: 'rgba(var(--md-tertiary-rgb), 0.1)'
    },
    {
      id: 'gemini-2.0-flash-thinking-exp-01-21',
      name: t('models.gemini20FlashThinking', 'Gemini 2.0 Flash Thinking'),
      description: t('models.highAccuracy', 'High accuracy'),
      icon: <FiAward className="model-icon award-icon" />,
      color: 'var(--md-secondary)',
      bgColor: 'rgba(var(--md-secondary-rgb), 0.1)'
    },
    {
      id: 'gemini-2.0-flash',
      name: t('models.gemini20Flash', 'Gemini 2.0 Flash'),
      description: t('models.balancedModel', 'Balanced'),
      icon: <FiZap className="model-icon zap-icon" />,
      color: 'var(--md-primary)',
      bgColor: 'rgba(var(--md-primary-rgb), 0.1)'
    },
    {
      id: 'gemini-2.0-flash-lite',
      name: t('models.gemini20FlashLite', 'Gemini 2.0 Flash Lite'),
      description: t('models.fastestModel', 'Fastest'),
      icon: <FiCpu className="model-icon cpu-icon" />,
      color: 'var(--success-color)',
      bgColor: 'rgba(var(--success-color-rgb), 0.1)'
    }
  ];

  useEffect(() => {
    if (isOpen) {
      // Reset to first step when modal opens
      setCurrentStep(1);
      // Set default model to current model
      setSelectedModel(localStorage.getItem('gemini_model') || 'gemini-2.0-flash');
      // Reset subtitle options
      setSubtitlesOption('none');
      setCustomSubtitles('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && textareaRef.current && subtitlesOption === 'custom' && currentStep === 2) {
      textareaRef.current.focus();
    }
  }, [isOpen, subtitlesOption, currentStep]);

  const handleModelSelect = (modelId) => {
    setSelectedModel(modelId);
  };

  const handleNextStep = () => {
    setCurrentStep(2);
  };

  const handleRetry = () => {
    const options = {
      modelId: selectedModel
    };

    // Add subtitles based on selected option
    if (subtitlesOption === 'custom' && customSubtitles.trim()) {
      options.userProvidedSubtitles = customSubtitles;
    }

    onRetry(segmentIndex, segments, options);
    onClose();
  };

  const handleOptionChange = (option) => {
    setSubtitlesOption(option);
  };

  const handleCustomSubtitlesChange = (e) => {
    setCustomSubtitles(e.target.value);
  };

  if (!isOpen) return null;

  return (
    <div className="segment-retry-modal-overlay" onClick={onClose}>
      <div className="segment-retry-modal" onClick={(e) => e.stopPropagation()}>
        <div className="segment-retry-modal-header">
          <h2>
            {currentStep === 1
              ? t('segmentRetry.selectModel', 'Select Model for Segment {{segmentNumber}}', { segmentNumber: segmentIndex + 1 })
              : t('segmentRetry.subtitleOptions', 'Subtitle Options for Segment {{segmentNumber}}', { segmentNumber: segmentIndex + 1 })}
          </h2>
          <div className="step-indicator">
            <span className={`step ${currentStep === 1 ? 'active' : 'completed'}`}>1</span>
            <span className="step-divider"></span>
            <span className={`step ${currentStep === 2 ? 'active' : ''}`}>2</span>
          </div>
          <button className="close-button" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="segment-retry-modal-content">
          {currentStep === 1 ? (
            /* Step 1: Model Selection */
            <div className="model-selection-step">
              <p className="explanation">
                {t('segmentRetry.modelExplanation', 'Select which Gemini model to use for retrying this segment. Different models offer different balances of accuracy and speed.')}
              </p>

              <div className="model-options-list">
                {modelOptions.map((model) => (
                  <div
                    key={model.id}
                    className={`model-option ${selectedModel === model.id ? 'selected' : ''}`}
                    onClick={() => handleModelSelect(model.id)}
                    style={{
                      '--model-color': model.color,
                      '--model-bg-color': model.bgColor
                    }}
                  >
                    <div className="model-option-radio">
                      <input
                        type="radio"
                        name="modelOption"
                        checked={selectedModel === model.id}
                        onChange={() => handleModelSelect(model.id)}
                        id={`model-${model.id}`}
                      />
                      <label htmlFor={`model-${model.id}`}></label>
                    </div>
                    <div className="model-option-icon">{model.icon}</div>
                    <div className="model-option-text">
                      <div className="model-option-name">{model.name}</div>
                      <div className="model-option-description">{model.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Step 2: Subtitle Options */
            <div className="subtitle-options-step">
              <p className="explanation">
                {t('segmentRetry.explanation',
                  'Choose how you want to retry this segment. You can provide subtitles to help Gemini focus ONLY on timing rather than transcription. When using provided subtitles, Gemini will use EXACTLY the text you provide, word for word, and all other settings are ignored.')}
              </p>

              <div className="subtitle-options">
                <h3>{t('segmentRetry.subtitlesOptions', 'Subtitles Options:')}</h3>

                <div className="option">
                  <label>
                    <input
                      type="radio"
                      name="subtitlesOption"
                      value="none"
                      checked={subtitlesOption === 'none'}
                      onChange={() => handleOptionChange('none')}
                    />
                    <span>{t('segmentRetry.noSubtitles', 'No subtitles (Gemini will transcribe from scratch)')}</span>
                  </label>
                </div>

                <div className="option">
                  <label>
                    <input
                      type="radio"
                      name="subtitlesOption"
                      value="custom"
                      checked={subtitlesOption === 'custom'}
                      onChange={() => handleOptionChange('custom')}
                    />
                    <span>
                      {t('segmentRetry.useCustomSubtitles', 'Use custom subtitles for this segment')}
                    </span>
                  </label>
                </div>

                {subtitlesOption === 'custom' && (
                  <div className="custom-subtitles">
                    <textarea
                      ref={textareaRef}
                      value={customSubtitles}
                      onChange={handleCustomSubtitlesChange}
                      placeholder={t('segmentRetry.customSubtitlesPlaceholder', 'Enter subtitles for this segment...')}
                      rows={5}
                    />
                    <div className="hint">
                      {t('segmentRetry.customSubtitlesHint', 'Enter the text you expect to hear in this segment. Gemini will use EXACTLY these words and focus ONLY on timing them correctly, ignoring all other settings.')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="segment-retry-modal-footer">
          <button className="cancel-button" onClick={onClose}>
            {t('segmentRetry.cancel', 'Cancel')}
          </button>

          {currentStep === 1 ? (
            <button className="next-button" onClick={handleNextStep}>
              {t('segmentRetry.next', 'Next')}
              <FiArrowRight className="next-icon" />
            </button>
          ) : (
            <button className="retry-button" onClick={handleRetry}>
              <FiCheck />
              {t('segmentRetry.retry', 'Retry Segment')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SegmentRetryModal;
