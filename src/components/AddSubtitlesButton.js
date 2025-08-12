import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiCheck, FiX } from 'react-icons/fi';
import LoadingIndicator from './common/LoadingIndicator';
import '../styles/AddSubtitlesButton.css';
import SubtitlesInputModal from './SubtitlesInputModal';

/**
 * Button component for adding pre-written subtitles without timings
 * @param {Object} props - Component props
 * @param {Function} props.onSubtitlesAdd - Function called when subtitles are added
 * @param {boolean} props.hasSubtitles - Whether subtitles have been added
 * @param {string} props.subtitlesText - The current subtitles text
 * @param {boolean} props.disabled - Whether the button is disabled
 * @returns {JSX.Element} - Rendered component
 */
const AddSubtitlesButton = ({
  onSubtitlesAdd,
  hasSubtitles = false,
  subtitlesText = '',
  disabled = false,
  onGenerateBackground
}) => {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleButtonClick = () => {
    if (hasSubtitles) {
      // If subtitles are already added, show the modal to edit them
      setShowModal(true);
    } else {
      // If no subtitles yet, show the modal to add them
      setShowModal(true);
    }
  };

  // Add processing animation when subtitles are being saved
  useEffect(() => {
    if (isProcessing) {
      const timer = setTimeout(() => {
        setIsProcessing(false);
      }, 500); // Reset after 500ms
      return () => clearTimeout(timer);
    }
  }, [isProcessing]);

  const handleSaveSubtitles = (text) => {
    setIsProcessing(true); // Start processing animation
    onSubtitlesAdd(text);
    setShowModal(false);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleClearSubtitles = (e) => {
    e.stopPropagation(); // Prevent button click from triggering
    setIsProcessing(true); // Start processing animation
    onSubtitlesAdd(''); // Clear subtitles by passing empty string
    setTimeout(() => setIsProcessing(false), 500); // Short animation
  };

  return (
    <>
      <div className="add-subtitles-buttons-group">
        <div className="add-subtitles-button-container">
          <button
            className={`add-subtitles-button ${hasSubtitles ? 'has-subtitles' : ''} ${isProcessing ? 'processing' : ''}`}
            onClick={handleButtonClick}
            disabled={disabled || isProcessing}
            title={hasSubtitles
              ? t('subtitlesInput.editSubtitles', 'Edit provided subtitles')
              : t('subtitlesInput.addSubtitles', 'Add your own subtitles without timings')}
          >
            {/* Dynamic Gemini effects container - populated by particle system */}
            <div className="gemini-icon-container"></div>

          {isProcessing ? (
            <span className="processing-text-container">
              <LoadingIndicator
                theme="dark"
                showContainer={false}
                size={16}
                className="subtitles-processing-loading"
              />
              <span className="processing-text">
                {t('subtitlesInput.processing', 'Processing...')}
              </span>
            </span>
          ) : hasSubtitles ? (
            <>
              <FiCheck className="icon" />
              <span>{t('subtitlesInput.subtitlesAdded', 'Subtitles added')}</span>
            </>
          ) : (
            <>
              <FiPlus className="icon" />
              <span>{t('subtitlesInput.addSubtitles', 'Add subtitles')}</span>
            </>
          )}
        </button>
        </div>

        {/* Separate clear button */}
        {hasSubtitles && !isProcessing && (
          <button
            className="clear-subtitles-button"
            onClick={handleClearSubtitles}
            title={t('subtitlesInput.clearSubtitles', 'Clear subtitles')}
            data-tooltip={t('subtitlesInput.clearSubtitles', 'Clear subtitles')}
            aria-label={t('subtitlesInput.clearSubtitles', 'Clear subtitles')}
            disabled={disabled}
          >
            <FiX size={18} />
          </button>
        )}
      </div>

      {showModal && (
        <>

          <SubtitlesInputModal
            initialText={subtitlesText}
            onSave={handleSaveSubtitles}
            onClose={handleCloseModal}
            onGenerateBackground={onGenerateBackground}
          />
        </>
      )}
    </>
  );
};

export default AddSubtitlesButton;
