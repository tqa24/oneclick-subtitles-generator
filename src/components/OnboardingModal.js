import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PROMPT_PRESETS } from '../services/geminiService';
import LanguageSelector from './LanguageSelector';
import '../styles/OnboardingModal.css';

const OnboardingModal = ({ onComplete }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(1); // 1: Prompt selection, 2: Model selection
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('');
  const [canProceed, setCanProceed] = useState(false);

  // Available Gemini models
  const models = [
    { id: 'gemini-2.5-pro-exp-03-25', name: t('models.gemini25Pro', 'Gemini 2.5 Pro'), description: t('models.bestAccuracy', 'Best accuracy') },
    { id: 'gemini-2.0-flash-thinking-exp-01-21', name: t('models.gemini20FlashThinking', 'Gemini 2.0 Flash Thinking'), description: t('models.highAccuracy', 'High accuracy') },
    { id: 'gemini-2.0-flash', name: t('models.gemini20Flash', 'Gemini 2.0 Flash'), description: t('models.balancedModel', 'Balanced') },
    { id: 'gemini-2.0-flash-lite', name: t('models.gemini20FlashLite', 'Gemini 2.0 Flash Lite'), description: t('models.fastestModel', 'Fastest') }
  ];

  // Check if user can proceed to next step
  useEffect(() => {
    if (step === 1) {
      // For 'translate-vietnamese' preset, require target language
      if (selectedPresetId === 'translate-vietnamese') {
        setCanProceed(!!selectedPresetId && !!targetLanguage.trim());
      } else {
        setCanProceed(!!selectedPresetId);
      }
    } else if (step === 2) {
      setCanProceed(!!selectedModel);
    }
  }, [step, selectedPresetId, selectedModel, targetLanguage]);

  // Handle preset selection
  const handlePresetSelect = (presetId) => {
    setSelectedPresetId(presetId);
  };

  // Handle model selection
  const handleModelSelect = (modelId) => {
    setSelectedModel(modelId);
  };

  // Handle next step
  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      // Save selections to localStorage
      localStorage.setItem('selected_preset_id', selectedPresetId);
      localStorage.setItem('gemini_model', selectedModel);
      localStorage.setItem('onboarding_completed', 'true');

      // For translation preset, save the target language
      if (selectedPresetId === 'translate-vietnamese' && targetLanguage.trim()) {
        localStorage.setItem('translation_target_language', targetLanguage.trim());
      }

      // Notify parent component that onboarding is complete
      onComplete({
        presetId: selectedPresetId,
        model: selectedModel,
        targetLanguage: selectedPresetId === 'translate-vietnamese' ? targetLanguage.trim() : null
      });
    }
  };

  // Handle back button
  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    }
  };

  // Get preset title based on ID
  const getPresetTitle = (presetId) => {
    const preset = PROMPT_PRESETS.find(p => p.id === presetId);
    if (!preset) return presetId;

    switch (preset.id) {
      case 'general':
        return t('settings.presetGeneralPurpose', 'General purpose');
      case 'extract-text':
        return t('settings.presetExtractText', 'Extract text');
      case 'focus-spoken-words':
        return t('settings.presetFocusSpokenWords', 'Focus on Spoken Words');
      case 'focus-lyrics':
        return t('settings.presetFocusLyrics', 'Focus on Lyrics');
      case 'describe-video':
        return t('settings.presetDescribeVideo', 'Describe video');
      case 'translate-vietnamese':
        return t('settings.presetTranslateDirectly', 'Translate directly');
      case 'chaptering':
        return t('settings.presetChaptering', 'Chaptering');
      case 'diarize-speakers':
        return t('settings.presetIdentifySpeakers', 'Identify Speakers');
      default:
        return preset.title;
    }
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        <div className="onboarding-header">
          <div className="onboarding-header-top">
            <h2>{t('onboarding.title', 'Welcome to Subtitles Generator')}</h2>
            <div className="onboarding-language-selector">
              <LanguageSelector />
            </div>
          </div>
          <p className="onboarding-subtitle">
            {step === 1
              ? t('onboarding.promptSelectionSubtitle', 'First, let\'s select a prompt preset for your transcriptions')
              : t('onboarding.modelSelectionSubtitle', 'Now, let\'s select a Gemini model for your transcriptions')}
          </p>
        </div>

        <div className="onboarding-content">
          {step === 1 && (
            <div className="onboarding-prompt-selection">
              <p className="onboarding-instruction">
                {t('onboarding.promptSelectionInstruction', 'Choose a preset that best fits your needs. You can always change this later in the settings.')}
              </p>

              <div className="onboarding-presets-grid">
                {PROMPT_PRESETS.map(preset => (
                  <div
                    key={preset.id}
                    className={`onboarding-preset-card ${selectedPresetId === preset.id ? 'selected' : ''}`}
                    onClick={() => handlePresetSelect(preset.id)}
                  >
                    <h3>{getPresetTitle(preset.id)}</h3>
                    <p className="preset-description">{preset.prompt.substring(0, 100)}...</p>

                    {/* Target language input for translation preset */}
                    {selectedPresetId === preset.id && preset.id === 'translate-vietnamese' && (
                      <div className="target-language-container">
                        <label htmlFor="target-language-input">{t('translation.targetLanguage', 'Target Language')}:</label>
                        <input
                          id="target-language-input"
                          type="text"
                          className="target-language-input"
                          placeholder={t('translation.languagePlaceholder', 'Enter target language')}
                          value={targetLanguage}
                          onChange={(e) => setTargetLanguage(e.target.value)}
                          onClick={(e) => e.stopPropagation()} // Prevent card selection when clicking input
                        />
                        {!targetLanguage.trim() && (
                          <p className="language-required-message">
                            {t('translation.languageRequired', 'Please enter a target language')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="onboarding-model-selection">
              <p className="onboarding-instruction">
                {t('onboarding.modelSelectionInstruction', 'Choose a Gemini model. More accurate models may be slower. You can always change this later in the settings.')}
              </p>

              <div className="onboarding-models-grid">
                {models.map(model => (
                  <div
                    key={model.id}
                    className={`onboarding-model-card ${selectedModel === model.id ? 'selected' : ''}`}
                    onClick={() => handleModelSelect(model.id)}
                  >
                    <h3>{model.name}</h3>
                    <p className="model-description">{model.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="onboarding-footer">
          {step === 2 && (
            <button
              className="onboarding-back-btn"
              onClick={handleBack}
            >
              {t('onboarding.back', 'Back')}
            </button>
          )}

          <button
            className="onboarding-next-btn"
            onClick={handleNext}
            disabled={!canProceed}
          >
            {step === 1
              ? t('onboarding.next', 'Next')
              : t('onboarding.finish', 'Finish')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
