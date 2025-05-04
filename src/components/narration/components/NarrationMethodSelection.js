import React from 'react';
import { useTranslation } from 'react-i18next';
import '../../../styles/narration/narrationMethodSelectionMaterial.css';

/**
 * Component for selecting the narration method (F5-TTS or Gemini)
 * @param {Object} props - Component props
 * @param {string} props.narrationMethod - Current narration method
 * @param {Function} props.setNarrationMethod - Function to set narration method
 * @param {boolean} props.isGenerating - Whether generation is in progress
 * @param {boolean} props.isF5Available - Whether F5-TTS is available
 * @param {boolean} props.isGeminiAvailable - Whether Gemini is available
 * @returns {JSX.Element} - Rendered component
 */
const NarrationMethodSelection = ({
  narrationMethod,
  setNarrationMethod,
  isGenerating,
  isF5Available = true,
  isGeminiAvailable = true
}) => {
  const { t } = useTranslation();

  const handleMethodChange = (method) => {
    if (!isGenerating) {
      setNarrationMethod(method);
      // Save to localStorage for persistence
      localStorage.setItem('narration_method', method);
    }
  };

  return (
    <div className="narration-row narration-method-row">
      <div className="row-label">
        <label>{t('narration.narrationMethod', 'Narration Method')}:</label>
      </div>
      <div className="row-content">
        <div className="narration-method-selection">
          <div className="radio-pill-group">
            <div className="radio-pill">
              <input
                type="radio"
                id="method-f5tts"
                name="narration-method"
                value="f5tts"
                checked={narrationMethod === 'f5tts'}
                onChange={() => handleMethodChange('f5tts')}
                disabled={isGenerating || !isF5Available}
              />
              <label htmlFor="method-f5tts" className={!isF5Available ? 'unavailable' : ''}>
                {t('narration.f5ttsMethod', 'F5-TTS')}
                <span className="method-description">
                  {isF5Available
                    ? t('narration.f5ttsDescription', '(Requires Python Server)')
                    : t('narration.f5ttsUnavailable', '(Unavailable - Run with npm run dev:cuda)')}
                </span>
              </label>
            </div>
            <div className="radio-pill">
              <input
                type="radio"
                id="method-gemini"
                name="narration-method"
                value="gemini"
                checked={narrationMethod === 'gemini'}
                onChange={() => handleMethodChange('gemini')}
                disabled={isGenerating || !isGeminiAvailable}
              />
              <label htmlFor="method-gemini" className={!isGeminiAvailable ? 'unavailable' : ''}>
                {t('narration.geminiMethod', 'Gemini')}
                <span className="method-description">
                  {isGeminiAvailable
                    ? t('narration.geminiDescription', '(npm run dev is enough)')
                    : t('narration.geminiUnavailable', '(Unavailable - Check API key in settings)')}
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NarrationMethodSelection;
