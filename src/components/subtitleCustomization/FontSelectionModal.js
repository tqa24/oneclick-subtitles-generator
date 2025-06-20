import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { groupFontsByCategory, getFontSupportFlags, getFontSampleText } from './fontOptions';
import './FontSelectionModal.css';

const FontSelectionModal = ({ isOpen, onClose, selectedFont, onFontSelect }) => {
  const { t } = useTranslation();
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

  // Handle escape key and outside clicks
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const groupedFonts = groupFontsByCategory();
  const categories = ['All', ...Object.keys(groupedFonts)];

  // Get translated category name
  const getCategoryName = (category) => {
    if (category === 'All') return t('fontModal.allCategories', 'All');
    return t(`fontModal.category${category}`, category);
  };

  // Filter fonts based on search term and category
  const filteredGroups = Object.entries(groupedFonts).reduce((acc, [group, fonts]) => {
    if (selectedCategory !== 'All' && group !== selectedCategory) {
      return acc;
    }

    const filteredFonts = fonts.filter(font =>
      font.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      font.group.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filteredFonts.length > 0) {
      acc[group] = filteredFonts;
    }
    return acc;
  }, {});

  const handleFontSelect = (font) => {
    onFontSelect(font.value);
    onClose();
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSelectedCategory('All');
  };

  return (
    <div className="font-modal-overlay">
      <div className="font-modal" ref={modalRef}>
        {/* Modal Header */}
        <div className="font-modal-header">
          <h2>{t('fontModal.selectFont', 'Select Font')}</h2>
          <button className="font-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Search and Filter Controls */}
        <div className="font-modal-controls">
          <div className="font-search-container">
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t('fontModal.searchPlaceholder', 'Search fonts...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="font-search-input"
            />
            {(searchTerm || selectedCategory !== 'All') && (
              <button className="clear-search" onClick={clearSearch}>
                {t('fontModal.clear', 'Clear')}
              </button>
            )}
          </div>

          <div className="font-category-filter">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="category-select"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {getCategoryName(category)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Font Grid */}
        <div className="font-modal-content">
          {Object.entries(filteredGroups).map(([group, fonts]) => (
            <div key={group} className="font-category-section">
              <h3 className="font-category-title">{getCategoryName(group)}</h3>
              <div className="font-grid">
                {fonts.map(font => (
                  <div
                    key={font.value}
                    className={`font-card ${font.value === selectedFont ? 'selected' : ''}`}
                    onClick={() => handleFontSelect(font)}
                  >
                    <div className="font-info">
                      <span className="font-name">{font.label}</span>
                      <div className="font-meta">
                        <span className="font-category">{font.group}</span>
                        <span className="font-flags">
                          {getFontSupportFlags(font)}
                        </span>
                      </div>
                    </div>
                    <div
                      className="font-preview-text"
                      style={{ fontFamily: font.value }}
                      title={getFontSampleText(font)}
                    >
                      {getFontSampleText(font)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {Object.keys(filteredGroups).length === 0 && (
            <div className="no-results">
              <div className="no-results-icon">🔍</div>
              <h3>{t('fontModal.noFontsFound', 'No fonts found')}</h3>
              <p>{t('fontModal.adjustSearch', 'Try adjusting your search terms or category filter.')}</p>
              <button className="clear-filters-btn" onClick={clearSearch}>
                {t('fontModal.clearFilters', 'Clear Filters')}
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="font-modal-footer">
          <div className="font-count">
            {t('fontModal.fontsAvailable', '{{count}} fonts available', { count: Object.values(filteredGroups).flat().length })}
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose}>
              {t('fontModal.cancel', 'Cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FontSelectionModal;
