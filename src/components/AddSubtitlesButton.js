import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiCheck, FiX } from 'react-icons/fi';
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
  disabled = false
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
      }, 2000); // Reset after 2 seconds
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
            {/* Static Gemini icons for decoration */}
            <div className="gemini-icon-container">
            <div className="gemini-mini-icon random-1 size-sm">
              <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </div>
            <div className="gemini-mini-icon random-3 size-md">
              <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </div>
          </div>

          {isProcessing ? (
            <span className="processing-text-container">
              <span className="processing-gemini-icon">
                <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </span>
              <span className="processing-text">
                {t('subtitlesInput.processing', 'Processing...')}
              </span>
              <span className="processing-dots"></span>
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
        <SubtitlesInputModal
          initialText={subtitlesText}
          onSave={handleSaveSubtitles}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};

export default AddSubtitlesButton;
