import React, { useState, useRef, useEffect } from 'react';
import CloseButton from '../../common/CloseButton';
import '../../../styles/narration/VoiceSelectionModal.css'; // Reuse the same CSS

const LanguageSelectionModal = ({ isOpen, onClose, languages, selectedLanguage, onLanguageSelect, detectedLanguage, t }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const modalRef = useRef(null);
  const searchInputRef = useRef(null);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Handle click outside modal and ESC key
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
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
  }, [isOpen, onClose]);

  // Get recommended language based on detected language
  const getRecommendedLanguage = () => {
    if (!detectedLanguage?.languageCode) return null;

    return languages.find(lang => lang.code === detectedLanguage.languageCode);
  };

  // Get other languages (not recommended)
  const getOtherLanguages = () => {
    if (!detectedLanguage?.languageCode) return languages;

    return languages.filter(lang => lang.code !== detectedLanguage.languageCode);
  };

  // Group other languages alphabetically by first letter
  const groupedLanguages = getOtherLanguages().reduce((acc, language) => {
    const firstLetter = language.name.charAt(0).toUpperCase();
    if (!acc[firstLetter]) {
      acc[firstLetter] = [];
    }
    acc[firstLetter].push(language);
    return acc;
  }, {});

  // Sort languages within each group alphabetically
  Object.keys(groupedLanguages).forEach(letter => {
    groupedLanguages[letter].sort((a, b) => a.name.localeCompare(b.name));
  });

  // Get filtered recommended language
  const getFilteredRecommendedLanguage = () => {
    const recommendedLanguage = getRecommendedLanguage();
    if (!recommendedLanguage || (selectedCategory !== 'All' && selectedCategory !== 'Recommended')) {
      return null;
    }

    const matchesSearch = recommendedLanguage.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         recommendedLanguage.code.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch ? recommendedLanguage : null;
  };

  // Get unique first letters for category filter (including Recommended if applicable)
  const availableCategories = [
    'All',
    ...(detectedLanguage?.languageCode ? ['Recommended'] : []),
    ...Object.keys(groupedLanguages).sort()
  ];

  // Filter languages based on search term and category
  const filteredGroups = Object.entries(groupedLanguages).reduce((acc, [letter, languageList]) => {
    if (selectedCategory !== 'All' && letter !== selectedCategory) {
      return acc;
    }

    const filteredLanguages = languageList.filter(language =>
      language.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      language.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filteredLanguages.length > 0) {
      acc[letter] = filteredLanguages;
    }
    return acc;
  }, {});

  const handleLanguageSelect = (language) => {
    onLanguageSelect(language.code);
    onClose();
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSelectedCategory('All');
  };

  if (!isOpen) return null;

  return (
    <div className="voice-modal-overlay">
      <div className="voice-modal" ref={modalRef}>
        {/* Modal Header */}
        <div className="voice-modal-header">
          <h2>{t('narration.selectLanguage', 'Select Language')}</h2>
          <div className="voice-count">
            {t('narration.languagesAvailable', '{{count}} languages available', {
              count: (getFilteredRecommendedLanguage() ? 1 : 0) + Object.values(filteredGroups).flat().length
            })}
          </div>
          <CloseButton onClick={onClose} variant="modal" size="medium" />
        </div>

        {/* Search and Filter Controls */}
        <div className="voice-modal-controls">
          <div className="voice-search-container">
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t('narration.searchLanguages', 'Search languages...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="voice-search-input"
            />
            {(searchTerm || selectedCategory !== 'All') && (
              <button className="clear-search" onClick={clearSearch}>
                {t('narration.clear', 'Clear')}
              </button>
            )}
          </div>

          <div className="voice-category-filter">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="voice-category-select"
            >
              {availableCategories.map(category => (
                <option key={category} value={category}>
                  {category === 'All'
                    ? t('narration.allCategories', 'All')
                    : category === 'Recommended'
                    ? t('narration.recommendedLanguage', 'Recommended for {{language}}', {
                        language: detectedLanguage?.languageName || detectedLanguage?.languageCode
                      })
                    : category
                  }
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Language Grid */}
        <div className="voice-modal-content">
          {/* Recommended Language Section */}
          {detectedLanguage?.languageCode && getFilteredRecommendedLanguage() && (
            <div className="voice-category-section">
              <h3 className="voice-category-title recommended">
                {t('narration.recommendedLanguage', 'Recommended for {{language}}', {
                  language: detectedLanguage.languageName || detectedLanguage.languageCode
                })}
              </h3>
              <div className="voice-grid">
                <div
                  className={`voice-card ${getFilteredRecommendedLanguage().code === selectedLanguage ? 'selected' : ''}`}
                  onClick={() => handleLanguageSelect(getFilteredRecommendedLanguage())}
                >
                  <div className="voice-info">
                    <span className="voice-name">{getFilteredRecommendedLanguage().name}</span>
                    <div className="voice-meta">
                      <span className="voice-locale">{getFilteredRecommendedLanguage().code}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Other Languages Sections */}
          {Object.entries(filteredGroups).map(([letter, languageList]) => (
            <div key={letter} className="voice-category-section">
              <h3 className="voice-category-title">{letter}</h3>
              <div className="voice-grid">
                {languageList.map(language => (
                  <div
                    key={language.code}
                    className={`voice-card ${language.code === selectedLanguage ? 'selected' : ''}`}
                    onClick={() => handleLanguageSelect(language)}
                  >
                    <div className="voice-info">
                      <span className="voice-name">{language.name}</span>
                      <div className="voice-meta">
                        <span className="voice-locale">{language.code}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* No Results */}
          {!getFilteredRecommendedLanguage() && Object.keys(filteredGroups).length === 0 && (
            <div className="no-results">
              <div className="no-results-icon">🔍</div>
              <h3>{t('narration.noLanguagesFound', 'No languages found')}</h3>
              <p>{t('narration.adjustSearch', 'Try adjusting your search terms or category filter.')}</p>
              <button className="clear-filters-btn" onClick={clearSearch}>
                {t('narration.clearFilters', 'Clear Filters')}
              </button>
            </div>
          )}
        </div>


      </div>
    </div>
  );
};

export default LanguageSelectionModal;
