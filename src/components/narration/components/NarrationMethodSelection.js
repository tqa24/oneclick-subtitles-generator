import React from 'react';
import { useTranslation } from 'react-i18next';
import '../../../styles/narration/narrationMethodSelectionMaterial.css';
import HelpIcon from '../../common/HelpIcon';


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
              <label htmlFor="method-f5tts" className={`method-f5tts ${!isF5Available ? 'unavailable' : ''}`}>
                <span className="voice-clone-badge">Voice Clone</span>
                <span className="method-icon">
                  <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>graphic_eq</span>
                </span>
                {t('narration.f5ttsMethod', 'F5-TTS')}
                {!isF5Available && (
                  <HelpIcon className="method-help-icon" title={t('narration.f5ttsUnavailable', '(Unavailable - Run with npm run dev:cuda)')} />
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
              <label htmlFor="method-chatterbox" className={`method-chatterbox ${!isChatterboxAvailable ? 'unavailable' : ''}`}>
                <span className="voice-clone-badge">Voice Clone</span>
                <span className="method-icon">
                  <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>chat</span>
                </span>
                {t('narration.chatterboxMethod', 'Chatterbox')}
                {!isChatterboxAvailable && (
                  <HelpIcon className="method-help-icon" title={t('narration.chatterboxUnavailable', '(Unavailable - Run with npm run dev:cuda)')} />
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
              <label htmlFor="method-gemini" className={`method-gemini ${!isGeminiAvailable ? 'unavailable' : ''}`}>
                <span className="method-icon">
                  <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>mic</span>
                </span>
                {t('narration.geminiMethod', 'Gemini Live API')}
                {!isGeminiAvailable && (
                  <HelpIcon className="method-help-icon" title={t('narration.geminiUnavailable', '(Unavailable - Check API key in settings)')} />
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
              <label htmlFor="method-edge-tts" className={`method-edge-tts ${!isEdgeTTSAvailable ? 'unavailable' : ''}`}>
                <span className="method-icon">
                  <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>chat_bubble</span>
                </span>
                {t('narration.edgeTTSMethod', 'Edge TTS')}
                {!isEdgeTTSAvailable && (
                  <HelpIcon className="method-help-icon" title={t('narration.edgeTTSUnavailable', '(Unavailable)')} />
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
              <label htmlFor="method-gtts" className={`method-gtts ${!isGTTSAvailable ? 'unavailable' : ''}`}>
                <span className="method-icon">
                  <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>record_voice_over</span>
                </span>
                {t('narration.gttsMethod', 'gTTS')}
                {!isGTTSAvailable && (
                  <HelpIcon className="method-help-icon" title={t('narration.gttsUnavailable', '(Unavailable)')} />
                )}
              </label>
            </div>
            <div className="radio-pill">
              <input
                type="radio"
                id="method-ms-vibevoice"
                name="narration-method"
                value="ms-vibevoice"
                checked={false}
                onChange={() => {}}
                disabled={true}
              />
              <label htmlFor="method-ms-vibevoice" className="method-ms-vibevoice unavailable">
                <span className="voice-clone-badge">Voice Clone</span>
                <span className="method-icon">
                  <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>mic</span>
                </span>
                {t('narration.msVibeVoiceMethod', 'MS VibeVoice')} ({t('narration.comingSoon', 'coming soon')})
              </label>
            </div>
            <div className="radio-pill">
              <input
                type="radio"
                id="method-gemini-native"
                name="narration-method"
                value="gemini-native"
                checked={false}
                onChange={() => {}}
                disabled={true}
              />
              <label htmlFor="method-gemini-native" className="method-gemini-native unavailable">
                <span className="method-icon">
                  <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>mic</span>
                </span>
                {t('narration.geminiNativeDialogMethod', 'Gemini Native Dialog')} ({t('narration.comingSoon', 'coming soon')})
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NarrationMethodSelection;
