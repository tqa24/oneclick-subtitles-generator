import React from 'react';
import { useTranslation } from 'react-i18next';
import '../../../styles/narration/narrationMethodSelectionMaterial.css';

/**
 * Component for selecting the narration method (F5-TTS, Chatterbox, Gemini, Edge TTS, or gTTS)
 * @param {Object} props - Component props
 * @param {string} props.narrationMethod - Current narration method
 * @param {Function} props.setNarrationMethod - Function to set narration method
 * @param {boolean} props.isGenerating - Whether generation is in progress
 * @param {boolean} props.isF5Available - Whether F5-TTS is available
 * @param {boolean} props.isChatterboxAvailable - Whether Chatterbox is available
 * @param {boolean} props.isGeminiAvailable - Whether Gemini is available
 * @param {boolean} props.isEdgeTTSAvailable - Whether Edge TTS is available
 * @param {boolean} props.isGTTSAvailable - Whether gTTS is available
 * @returns {JSX.Element} - Rendered component
 */
const NarrationMethodSelection = ({
  narrationMethod,
  setNarrationMethod,
  isGenerating,
  isF5Available = true,
  isChatterboxAvailable = true,
  isGeminiAvailable = true,
  isEdgeTTSAvailable = true,
  isGTTSAvailable = true
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
                {!isF5Available && (
                  <span className="method-description">
                    {t('narration.f5ttsUnavailable', '(Unavailable - Run with npm run dev:cuda)')}
                  </span>
                )}
              </label>
            </div>
            <div className="radio-pill">
              <input
                type="radio"
                id="method-chatterbox"
                name="narration-method"
                value="chatterbox"
                checked={narrationMethod === 'chatterbox'}
                onChange={() => handleMethodChange('chatterbox')}
                disabled={isGenerating || !isChatterboxAvailable}
              />
              <label htmlFor="method-chatterbox" className={!isChatterboxAvailable ? 'unavailable' : ''}>
                {t('narration.chatterboxMethod', 'Chatterbox')}
                {!isChatterboxAvailable && (
                  <span className="method-description">
                    {t('narration.chatterboxUnavailable', '(Unavailable - Run with npm run dev:cuda)')}
                  </span>
                )}
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
                {!isGeminiAvailable && (
                  <span className="method-description">
                    {t('narration.geminiUnavailable', '(Unavailable - Check API key in settings)')}
                  </span>
                )}
              </label>
            </div>
            <div className="radio-pill">
              <input
                type="radio"
                id="method-edge-tts"
                name="narration-method"
                value="edge-tts"
                checked={narrationMethod === 'edge-tts'}
                onChange={() => handleMethodChange('edge-tts')}
                disabled={isGenerating || !isEdgeTTSAvailable}
              />
              <label htmlFor="method-edge-tts" className={!isEdgeTTSAvailable ? 'unavailable' : ''}>
                {t('narration.edgeTTSMethod', 'Edge TTS')}
                {!isEdgeTTSAvailable && (
                  <span className="method-description">
                    {t('narration.edgeTTSUnavailable', '(Unavailable)')}
                  </span>
                )}
              </label>
            </div>
            <div className="radio-pill">
              <input
                type="radio"
                id="method-gtts"
                name="narration-method"
                value="gtts"
                checked={narrationMethod === 'gtts'}
                onChange={() => handleMethodChange('gtts')}
                disabled={isGenerating || !isGTTSAvailable}
              />
              <label htmlFor="method-gtts" className={!isGTTSAvailable ? 'unavailable' : ''}>
                {t('narration.gttsMethod', 'gTTS')}
                {!isGTTSAvailable && (
                  <span className="method-description">
                    {t('narration.gttsUnavailable', '(Unavailable)')}
                  </span>
                )}
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NarrationMethodSelection;
