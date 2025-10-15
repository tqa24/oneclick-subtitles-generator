import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ISO6391 from 'iso-639-1';
import CloseButton from '../../common/CloseButton';
import CustomDropdown from '../../common/CustomDropdown';
import '../../../styles/narration/VoiceSelectionModal.css';

const ManualLanguageSelectionModal = ({
  isOpen,
  onClose,
  onSave,
  initialLanguages = [],
  subtitleSource
}) => {
  const { t } = useTranslation();
  const [selectedLanguages, setSelectedLanguages] = useState(initialLanguages);
  const [recentlyChosenLanguages, setRecentlyChosenLanguages] = useState([]);

  // Load recently chosen languages from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('recentlyChosenLanguages');
    if (stored) {
      try {
        setRecentlyChosenLanguages(JSON.parse(stored));
      } catch (error) {
        console.error('Error parsing recently chosen languages:', error);
        setRecentlyChosenLanguages([]);
      }
    }
  }, []);

  // Save recently chosen languages to localStorage
  const saveRecentlyChosenLanguages = (languages) => {
    const updated = [languages, ...recentlyChosenLanguages.filter(lang => !languages.includes(lang))].slice(0, 5);
    setRecentlyChosenLanguages(updated);
    localStorage.setItem('recentlyChosenLanguages', JSON.stringify(updated));
  };

  // Create language options with recently chosen languages at the top
  const languageOptions = React.useMemo(() => {
    const allCodes = ISO6391.getAllCodes();
    const allOptions = allCodes.map(code => ({
      value: code,
      label: ISO6391.getName(code)
    }));

    // Recently chosen languages with special label
    const recentOptions = recentlyChosenLanguages.map(code => ({
      value: code,
      label: `${ISO6391.getName(code)} (Recently chosen)`
    }));

    // Other languages (excluding recently chosen ones)
    const otherOptions = allOptions.filter(option =>
      !recentlyChosenLanguages.includes(option.value)
    );

    return [...recentOptions, ...otherOptions];
  }, [recentlyChosenLanguages]);

  // Initialize selected languages when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedLanguages(initialLanguages.length > 0 ? [...initialLanguages] : ['']);
    }
  }, [isOpen, initialLanguages]);

  // Handle language selection change
  const handleLanguageChange = (index, value) => {
    const newLanguages = [...selectedLanguages];
    newLanguages[index] = value;
    setSelectedLanguages(newLanguages);

    // If this is the last dropdown and a language was selected, add a new empty dropdown
    if (index === selectedLanguages.length - 1 && value && !newLanguages.includes('')) {
      newLanguages.push('');
      setSelectedLanguages(newLanguages);
    }
  };

  // Remove a language dropdown
  const removeLanguage = (index) => {
    const newLanguages = selectedLanguages.filter((_, i) => i !== index);
    // Always allow removing, but ensure at least one empty slot exists for adding new languages
    if (newLanguages.length === 0 || newLanguages.every(lang => lang && lang.trim() !== '')) {
      newLanguages.push('');
    }
    setSelectedLanguages(newLanguages);
  };

  // Handle save
  const handleSave = () => {
    // Filter out empty selections and duplicates
    const validLanguages = selectedLanguages.filter(lang => lang && lang.trim() !== '');
    const uniqueLanguages = [...new Set(validLanguages)];

    // Save to recently chosen languages if there are any valid selections
    if (uniqueLanguages.length > 0) {
      saveRecentlyChosenLanguages(uniqueLanguages);
    }

    onSave(uniqueLanguages);
    onClose();
  };

  // Handle modal close without saving
  const handleClose = () => {
    setSelectedLanguages(initialLanguages.length > 0 ? [...initialLanguages] : ['']);
    onClose();
  };

  // Handle click outside modal
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (event.target.classList.contains('voice-modal-overlay')) {
        handleClose();
      }
    };

    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="voice-modal-overlay">
      <div className="voice-modal" style={{ maxWidth: '600px' }}>
        {/* Modal Header */}
        <div className="voice-modal-header">
          <h2>{t('narration.manualLanguageSelection', 'Manual Language Selection')}</h2>
          <div className="voice-count">
            {t('narration.selectLanguagesFor', 'Select languages for {{source}} subtitles', {
              source: subtitleSource === 'translated' ? t('narration.translated', 'translated') : t('narration.original', 'original')
            })}
          </div>
          <CloseButton onClick={handleClose} variant="modal" size="medium" />
        </div>

        {/* Modal Content */}
        <div className="voice-modal-content" style={{ padding: '20px' }}>
          <div className="manual-language-selection">
            <p style={{ marginBottom: '20px', color: '#666' }}>
              {t('narration.manualLanguageDescription', 'Select the languages present in your subtitles. Multiple languages will be displayed as separate badges.')}
            </p>

            <div className="language-dropdowns-container">
              {selectedLanguages.map((language, index) => (
                <div key={index} className="language-dropdown-wrapper">
                  <button
                    className="remove-language-btn"
                    onClick={() => removeLanguage(index)}
                    title={t('narration.removeLanguage', 'Remove this language')}
                  >
                    ✕
                  </button>

                  <CustomDropdown
                    value={language}
                    onChange={(value) => handleLanguageChange(index, value)}
                    options={languageOptions}
                    placeholder={t('narration.selectLanguage', 'Select language')}
                    className="manual-language-dropdown"
                  />
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="voice-modal-footer" style={{
          padding: '15px 20px',
          borderTop: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px'
        }}>
          <button
            className="cancel-btn"
            onClick={handleClose}
            style={{
              padding: '8px 16px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              background: 'white',
              cursor: 'pointer'
            }}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            className="save-btn"
            onClick={handleSave}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              background: '#007bff',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            {t('common.save', 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualLanguageSelectionModal;