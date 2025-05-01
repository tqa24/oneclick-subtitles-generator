import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Reference Audio Section component
 * @param {Object} props - Component props
 * @param {Object} props.referenceAudio - Reference audio object
 * @param {boolean} props.autoRecognize - Whether to auto-recognize voice
 * @param {Function} props.setAutoRecognize - Function to set auto-recognize
 * @param {boolean} props.isRecognizing - Whether voice recognition is in progress
 * @param {string} props.referenceText - Reference text
 * @param {Function} props.setReferenceText - Function to set reference text
 * @param {Function} props.clearReferenceAudio - Function to clear reference audio
 * @param {boolean} props.isRecording - Whether recording is in progress
 * @param {boolean} props.isExtractingSegment - Whether segment extraction is in progress
 * @returns {JSX.Element} - Rendered component
 */
const ReferenceAudioSection = ({
  referenceAudio,
  autoRecognize,
  setAutoRecognize,
  isRecognizing,
  referenceText,
  setReferenceText,
  clearReferenceAudio,
  isRecording,
  isExtractingSegment
}) => {
  const { t } = useTranslation();

  return (
    <div className="narration-row reference-audio-row">
      <div className="row-label">
        <label>{t('narration.referenceAudio', 'Văn bản tham chiếu')}:</label>
      </div>
      <div className="row-content">
        <div className="reference-audio-container">
          {/* Reference Content Row */}
          <div className="reference-content-row">
            {/* Reference Text */}
            <div className="reference-text-container">
              <textarea
                className="reference-text"
                value={referenceText}
                onChange={(e) => setReferenceText(e.target.value)}
                placeholder={t('narration.referenceTextPlaceholder', 'Enter text that matches the reference audio...')}
                rows={2}
                disabled={isRecognizing}
              />
              {isRecognizing && (
                <div className="status-message info recognizing-indicator">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  {t('narration.recognizing', 'Recognizing voice...')}
                </div>
              )}
            </div>

            {/* Auto-Recognition Switch */}
            <div className="switch-container">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={autoRecognize}
                  onChange={(e) => setAutoRecognize(e.target.checked)}
                  disabled={isRecording || isExtractingSegment || isRecognizing}
                />
                <span className="toggle-slider"></span>
              </label>
              <span>{t('narration.autoRecognize', 'Auto-recognize voice')}</span>
              <div className="help-icon-container" title={t('narration.autoRecognizeDescription', 'Automatically transcribe audio after recording or uploading')}>
                <svg className="help-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
            </div>
          </div>


        </div>
      </div>
    </div>
  );
};

export default ReferenceAudioSection;
