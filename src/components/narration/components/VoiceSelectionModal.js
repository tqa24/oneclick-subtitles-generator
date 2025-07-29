import React, { useState, useRef, useEffect } from 'react';
import '../../../styles/narration/VoiceSelectionModal.css';

const VoiceSelectionModal = ({ isOpen, onClose, voices, selectedVoice, onVoiceSelect, detectedLanguage, t }) => {
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

  // Handle click outside modal
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Group voices alphabetically by language
  const groupedVoices = voices.reduce((acc, voice) => {
    const language = voice.locale.split('-')[0].toUpperCase();
    if (!acc[language]) {
      acc[language] = [];
    }
    acc[language].push(voice);
    return acc;
  }, {});

  // Sort voices within each language group alphabetically
  Object.keys(groupedVoices).forEach(language => {
    groupedVoices[language].sort((a, b) => a.short_name.localeCompare(b.short_name));
  });

  // Get unique languages for category filter
  const availableLanguages = ['All', ...Object.keys(groupedVoices).sort()];

  // Filter voices based on search term and category
  const filteredGroups = Object.entries(groupedVoices).reduce((acc, [language, voiceList]) => {
    if (selectedCategory !== 'All' && language !== selectedCategory) {
      return acc;
    }

    const filteredVoices = voiceList.filter(voice =>
      voice.short_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      voice.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      voice.gender.toLowerCase().includes(searchTerm.toLowerCase()) ||
      voice.locale.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filteredVoices.length > 0) {
      acc[language] = filteredVoices;
    }
    return acc;
  }, {});

  const handleVoiceSelect = (voice) => {
    onVoiceSelect(voice.name);
    onClose();
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSelectedCategory('All');
  };

  const getLanguageName = (languageCode) => {
    const languageNames = {
      'EN': 'English',
      'ES': 'Spanish',
      'FR': 'French',
      'DE': 'German',
      'IT': 'Italian',
      'PT': 'Portuguese',
      'RU': 'Russian',
      'JA': 'Japanese',
      'KO': 'Korean',
      'ZH': 'Chinese',
      'AR': 'Arabic',
      'HI': 'Hindi',
      'NL': 'Dutch',
      'SV': 'Swedish',
      'NO': 'Norwegian',
      'DA': 'Danish',
      'FI': 'Finnish',
      'PL': 'Polish',
      'TR': 'Turkish',
      'TH': 'Thai',
      'VI': 'Vietnamese'
    };
    return languageNames[languageCode] || languageCode;
  };

  if (!isOpen) return null;

  return (
    <div className="voice-modal-overlay">
      <div className="voice-modal" ref={modalRef}>
        {/* Modal Header */}
        <div className="voice-modal-header">
          <h2>{t('narration.selectVoice', 'Select Voice')}</h2>
          <button className="voice-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Search and Filter Controls */}
        <div className="voice-modal-controls">
          <div className="voice-search-container">
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t('narration.searchVoices', 'Search voices...')}
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
              {availableLanguages.map(language => (
                <option key={language} value={language}>
                  {language === 'All' ? t('narration.allLanguages', 'All Languages') : getLanguageName(language)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Voice Grid */}
        <div className="voice-modal-content">
          {Object.entries(filteredGroups).map(([language, voiceList]) => (
            <div key={language} className="voice-category-section">
              <h3 className="voice-category-title">{getLanguageName(language)}</h3>
              <div className="voice-grid">
                {voiceList.map(voice => (
                  <div
                    key={voice.name}
                    className={`voice-card ${voice.name === selectedVoice ? 'selected' : ''}`}
                    onClick={() => handleVoiceSelect(voice)}
                  >
                    <div className="voice-info">
                      <span className="voice-name">{voice.short_name}</span>
                      <div className="voice-meta">
                        <span className="voice-gender">{voice.gender}</span>
                        <span className="voice-locale">{voice.locale}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {Object.keys(filteredGroups).length === 0 && (
            <div className="no-results">
              <div className="no-results-icon">🔍</div>
              <h3>{t('narration.noVoicesFound', 'No voices found')}</h3>
              <p>{t('narration.adjustSearch', 'Try adjusting your search terms or language filter.')}</p>
              <button className="clear-filters-btn" onClick={clearSearch}>
                {t('narration.clearFilters', 'Clear Filters')}
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="voice-modal-footer">
          <div className="voice-count">
            {t('narration.voicesAvailable', '{{count}} voices available', { 
              count: Object.values(filteredGroups).flat().length 
            })}
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose}>
              {t('narration.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceSelectionModal;
