import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ISO6391 from 'iso-639-1';
import ReactDOM from 'react-dom';
import CloseButton from '../../common/CloseButton';
import '../../../styles/narration/ManualLanguageSelectionModal.css';

const ManualLanguageSelectionModal = ({
  isOpen,
  onClose,
  onSave,
  initialLanguages = [],
  subtitleSource
}) => {
  const { t } = useTranslation();
  const [selectedLanguages, setSelectedLanguages] = useState(['']);
  const [recentLanguages, setRecentLanguages] = useState([]);
  const [typingValues, setTypingValues] = useState({});

  // Load recent languages from localStorage and normalize to lowercase valid ISO-639-1 codes
  useEffect(() => {
    const stored = localStorage.getItem('recentlyChosenLanguages');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const allCodes = new Set(ISO6391.getAllCodes());
        const normalized = (Array.isArray(parsed) ? parsed : [])
          .map(c => (typeof c === 'string' ? c.toLowerCase() : ''))
          .filter(c => c && allCodes.has(c));
        setRecentLanguages(normalized);
      } catch (error) {
        console.error('Error parsing recent languages:', error);
        setRecentLanguages([]);
      }
    }
  }, []);

  // Initialize languages when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialLanguages.length > 0) {
        setSelectedLanguages([...initialLanguages, '']);
      } else {
        setSelectedLanguages(['']);
      }
      setTypingValues({});
    }
  }, [isOpen, initialLanguages]);

  // Get filtered suggestions based on typing
  const getFilteredSuggestions = (typingValue) => {
    if (!typingValue || typingValue.trim() === '') {
      return [];
    }

    const searchTerm = typingValue.toLowerCase();
    const allCodes = ISO6391.getAllCodes();

    return allCodes.filter(code => {
      const name = ISO6391.getName(code).toLowerCase();
      return name.includes(searchTerm) || code.toLowerCase().includes(searchTerm);
    }).slice(0, 10);
  };

  // Handle typing in input
  const handleTypingChange = (index, value) => {
    setTypingValues(prev => ({
      ...prev,
      [index]: value
    }));
  };

  // Handle language selection
  const handleLanguageSelect = (index, langCode) => {
    const newLanguages = [...selectedLanguages];
    newLanguages[index] = langCode;

    // Clear typing value
    setTypingValues(prev => ({
      ...prev,
      [index]: ''
    }));

    // Add new empty slot if this was the last one
    if (index === selectedLanguages.length - 1) {
      newLanguages.push('');
    }

    setSelectedLanguages(newLanguages);
  };

  // Handle clearing a language
  const handleClearLanguage = (index) => {
    const newLanguages = [...selectedLanguages];
    newLanguages[index] = '';
    setSelectedLanguages(newLanguages);
  };

  // Remove a language slot
  const removeLanguage = (index) => {
    const newLanguages = selectedLanguages.filter((_, i) => i !== index);
    if (newLanguages.length === 0 || !newLanguages.includes('')) {
      newLanguages.push('');
    }
    setSelectedLanguages(newLanguages);
  };

  // Save languages
  const handleSave = () => {
    const validLanguages = selectedLanguages.filter(lang => 
      lang && typeof lang === 'string' && lang.trim() !== ''
    );
    const uniqueLanguages = [...new Set(validLanguages)];

    // Save to recent languages
    if (uniqueLanguages.length > 0) {
      const updatedRecent = [
        ...uniqueLanguages,
        ...recentLanguages.filter(lang => !uniqueLanguages.includes(lang))
      ].slice(0, 5);
      
      setRecentLanguages(updatedRecent);
      localStorage.setItem('recentlyChosenLanguages', JSON.stringify(updatedRecent));
    }

    onSave(uniqueLanguages);
    onClose();
  };

  // Handle close
  const handleClose = () => {
    setSelectedLanguages(['']);
    setTypingValues({});
    onClose();
  };

  // Handle outside clicks and escape key
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="language-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="language-modal" role="dialog" aria-modal="true" tabIndex="-1" onClick={(e) => e.stopPropagation()}>
        <div className="language-modal-header">
          <h2>{t('narration.manualLanguageSelection', 'Manual Language Selection')}</h2>
          <div className="language-count">
            {t('narration.selectLanguagesFor', 'Select languages for {{source}} subtitles', {
              source: subtitleSource === 'translated' ? t('narration.translated', 'translated') : t('narration.original', 'original')
            })}
          </div>
          <CloseButton onClick={handleClose} variant="modal" size="medium" />
        </div>

        <div className="language-modal-content">
          <div className="manual-language-selection">

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

                  {language ? (
                    <div className="selected-language-badge">
                      <span>{ISO6391.getName(language)}</span>
                      <button onClick={() => handleClearLanguage(index)} className="clear-language-btn">✕</button>
                    </div>
                  ) : (
                    <div className="language-input-container">
                      <input
                        type="text"
                        value={typingValues[index] || ''}
                        onChange={(e) => handleTypingChange(index, e.target.value)}
                        placeholder={t('narration.typeLanguage', 'Type language')}
                        className="language-input"
                      />

                      {(typingValues[index] || recentLanguages.length > 0) && (
                        <div className="suggestions-container">
                          {typingValues[index] ? (
                            getFilteredSuggestions(typingValues[index]).map(code => (
                              <button
                                key={code}
                                onClick={() => handleLanguageSelect(index, code)}
                                className="suggestion-badge"
                              >
                                {ISO6391.getName(code)}
                              </button>
                            ))
                          ) : (
                            recentLanguages.slice(0, 5).map(code => (
                              <button
                                key={code}
                                onClick={() => handleLanguageSelect(index, code)}
                                className="suggestion-badge recent"
                              >
                                {ISO6391.getName(code)}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="language-modal-footer">
          <div className="modal-actions">
            <button className="btn-secondary" onClick={handleClose}>
              {t('common.cancel', 'Cancel')}
            </button>
            <button className="btn-primary" onClick={handleSave}>
              {t('common.save', 'Save')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ManualLanguageSelectionModal;
