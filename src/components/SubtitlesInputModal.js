import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FiX } from 'react-icons/fi';
import '../styles/SubtitlesInputModal.css';

/**
 * Modal component for inputting subtitles without timings
 * @param {Object} props - Component props
 * @param {string} props.initialText - Initial text for the textarea
 * @param {Function} props.onSave - Function called when subtitles are saved
 * @param {Function} props.onClose - Function called when modal is closed
 * @returns {JSX.Element} - Rendered component
 */
const SubtitlesInputModal = ({ initialText = '', onSave, onClose }) => {
  const { t } = useTranslation();
  const [text, setText] = useState(initialText);
  const textareaRef = useRef(null);

  // Focus the textarea when the modal opens
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleSave = () => {
    onSave(text);
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e) => {
    // Ctrl+Enter or Cmd+Enter to save
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    // Escape to close
    else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="subtitles-input-modal-overlay" onClick={onClose}>
      <div className="subtitles-input-modal" onClick={(e) => e.stopPropagation()}>
        <div className="subtitles-input-modal-header">
          <h2>{t('subtitlesInput.title', 'Add Your Subtitles')}</h2>
          <button className="close-button" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <div className="subtitles-input-modal-content">
          <p className="explanation">
            {t('subtitlesInput.explanation',
              'Paste your subtitles here without timings. When you generate subtitles, the system will focus on matching these texts with the audio and creating accurate timings. Each line will be treated as a separate subtitle.')}
          </p>

          <div className="example">
            <h3>{t('subtitlesInput.exampleTitle', 'Example:')}</h3>
            <pre>
              {t('subtitlesInput.example',
                'Hello, welcome to our tutorial.\nToday we will learn about machine learning.\nLet\'s get started!')}
            </pre>
          </div>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={t('subtitlesInput.placeholder', 'Enter your subtitles here...')}
            rows={10}
          />

          <div className="keyboard-shortcuts">
            <span>{t('subtitlesInput.keyboardShortcuts', 'Keyboard shortcuts:')}</span>
            <span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> {t('subtitlesInput.toSave', 'to save')}</span>
            <span><kbd>Esc</kbd> {t('subtitlesInput.toCancel', 'to cancel')}</span>
          </div>
        </div>

        <div className="subtitles-input-modal-footer">
          <button className="cancel-button" onClick={onClose}>
            {t('subtitlesInput.cancel', 'Cancel')}
          </button>
          <button className="save-button" onClick={handleSave}>
            {t('subtitlesInput.save', 'Save Subtitles')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubtitlesInputModal;
