import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiPlus, FiCheck } from 'react-icons/fi';
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

  const handleButtonClick = () => {
    if (hasSubtitles) {
      // If subtitles are already added, show the modal to edit them
      setShowModal(true);
    } else {
      // If no subtitles yet, show the modal to add them
      setShowModal(true);
    }
  };

  const handleSaveSubtitles = (text) => {
    onSubtitlesAdd(text);
    setShowModal(false);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  return (
    <>
      <button
        className={`add-subtitles-button ${hasSubtitles ? 'has-subtitles' : ''}`}
        onClick={handleButtonClick}
        disabled={disabled}
        title={hasSubtitles 
          ? t('subtitlesInput.editSubtitles', 'Edit provided subtitles') 
          : t('subtitlesInput.addSubtitles', 'Add your own subtitles without timings')}
      >
        {hasSubtitles ? (
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
