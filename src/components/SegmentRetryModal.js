import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FiX, FiCheck, FiAlertTriangle } from 'react-icons/fi';
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
  // Default to 'none', options are 'none' or 'custom'
  const [subtitlesOption, setSubtitlesOption] = useState('none');
  const [customSubtitles, setCustomSubtitles] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen && textareaRef.current && subtitlesOption === 'custom') {
      textareaRef.current.focus();
    }
  }, [isOpen, subtitlesOption]);

  const handleRetry = () => {
    const options = {};

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
          <h2>{t('segmentRetry.title', 'Retry Segment {{segmentNumber}}', { segmentNumber: segmentIndex + 1 })}</h2>
          <button className="close-button" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="segment-retry-modal-content">
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

            {/* Initial subtitles option removed */}

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
                  <span className="simplified-mode-badge">
                    {t('segmentRetry.simplifiedMode', 'Simplified Mode')}
                  </span>
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

        <div className="segment-retry-modal-footer">
          <button className="cancel-button" onClick={onClose}>
            {t('segmentRetry.cancel', 'Cancel')}
          </button>
          <button className="retry-button" onClick={handleRetry}>
            <FiCheck />
            {t('segmentRetry.retry', 'Retry Segment')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SegmentRetryModal;
