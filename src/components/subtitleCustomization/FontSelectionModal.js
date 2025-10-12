import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { groupFontsByCategory, getFontSupportFlags, getFontSampleText } from './fontOptions';
import CloseButton from '../common/CloseButton';
import CustomDropdown from '../common/CustomDropdown';
import '../../styles/subtitle-customization/FontSelectionModal.css';

// Debounce hook for search input
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const FontSelectionModal = ({ isOpen, onClose, selectedFont, onFontSelect }) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [modalHeight, setModalHeight] = useState('auto');
  const [googleFonts, setGoogleFonts] = useState([]);
  const [googleFontsLoading, setGoogleFontsLoading] = useState(false);
  const [googleFontsError, setGoogleFontsError] = useState(null);
  const [showGoogleFonts, setShowGoogleFonts] = useState(false);
  const modalRef = useRef(null);
  const searchInputRef = useRef(null);
  const contentRef = useRef(null);

  // Debounce search term for Google Fonts API
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Search Google Fonts API
  const searchGoogleFonts = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setGoogleFonts([]);
      setShowGoogleFonts(false);
      return;
    }

    setGoogleFontsLoading(true);
    setGoogleFontsError(null);

    try {
      const response = await fetch(`/api/fonts/search?q=${encodeURIComponent(query)}&limit=20`);
      const data = await response.json();

      if (data.success) {
        setGoogleFonts(data.fonts);
        setShowGoogleFonts(data.fonts.length > 0);
      } else {
        setGoogleFontsError(data.error || 'Failed to search fonts');
        setGoogleFonts([]);
        setShowGoogleFonts(false);
      }
    } catch (error) {
      console.error('Google Fonts search error:', error);
      setGoogleFontsError('Network error while searching fonts');
      setGoogleFonts([]);
      setShowGoogleFonts(false);
    } finally {
      setGoogleFontsLoading(false);
    }
  }, []);

  // Trigger Google Fonts search when debounced search term changes
  useEffect(() => {
    searchGoogleFonts(debouncedSearchTerm);
  }, [debouncedSearchTerm, searchGoogleFonts]);


  // Calculate and set modal height for smooth transitions
  const updateModalHeight = useCallback(() => {
    if (modalRef.current && contentRef.current && isOpen) {
      // Get the natural height of the content
      const modalElement = modalRef.current;
      const currentHeight = modalElement.offsetHeight;
      
      // Temporarily set to auto to measure natural height
      modalElement.style.height = 'auto';
      const naturalHeight = modalElement.offsetHeight;
      
      // Set back to current height immediately (no visual change)
      modalElement.style.height = `${currentHeight}px`;
      
      // Force a reflow by reading offsetHeight
      // eslint-disable-next-line no-unused-expressions
      void modalElement.offsetHeight;
      
      // Now transition to the new height
      modalElement.style.height = `${naturalHeight}px`;
    }
  }, [isOpen]);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
      // Set initial height on open
      setTimeout(() => {
        if (modalRef.current) {
          modalRef.current.style.height = 'auto';
          const height = modalRef.current.offsetHeight;
          modalRef.current.style.height = `${height}px`;
        }
      }, 50);
    }
  }, [isOpen]);
  
  // Update height when content changes
  useEffect(() => {
    if (isOpen) {
      // Small delay to let DOM update
      const timer = setTimeout(() => {
        updateModalHeight();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [searchTerm, selectedCategory, isOpen, updateModalHeight]);

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
    if (typeof font === 'string') {
      // Local font
      onFontSelect(font);
    } else {
      // Google Font
      onFontSelect(font.value);
    }
    onClose();
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSelectedCategory('All');
  };

  return (
    <div className="font-modal-overlay">
      <div className="font-modal" ref={modalRef} style={{ height: modalHeight }}>
        {/* Modal Header */}
        <div className="font-modal-header">
          <h2>{t('fontModal.selectFont', 'Select Font')}</h2>
          <div className="font-count">
            {t('fontModal.fontsAvailable', '{{count}} fonts available', {
              count: Object.values(filteredGroups).flat().length + (showGoogleFonts ? googleFonts.length : 0)
            })}
          </div>
          <CloseButton onClick={onClose} variant="modal" size="large" />
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
            <CustomDropdown
              value={selectedCategory}
              onChange={(value) => setSelectedCategory(value)}
              options={categories.map(category => ({
                value: category,
                label: getCategoryName(category)
              }))}
              placeholder={t('fontModal.selectCategory', 'Select Category')}
            />
          </div>
        </div>

        {/* Font Grid */}
        <div className="font-modal-content" ref={contentRef}>
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

          {/* Google Fonts Section */}
          {showGoogleFonts && (
            <div className="font-category-section">
              <h3 className="font-category-title">Google Fonts</h3>
              <div className="font-grid">
                {googleFontsLoading ? (
                  <div className="loading-indicator">Searching fonts...</div>
                ) : googleFontsError ? (
                  <div className="error-message">{googleFontsError}</div>
                ) : (
                  googleFonts.map((font) => (
                    <div
                      key={font.family}
                      className={`font-card ${font.family === selectedFont ? 'selected' : ''}`}
                      onClick={() => handleFontSelect({ value: font.family, label: font.family, group: 'Google Fonts' })}
                    >
                      <div className="font-info">
                        <span className="font-name">{font.family}</span>
                        <div className="font-meta">
                          <span className="font-category">Google Fonts</span>
                        </div>
                      </div>
                      <div
                        className="font-preview-text"
                        style={{ fontFamily: font.family }}
                        title="AaBbCc"
                      >
                        AaBbCc
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {Object.keys(filteredGroups).length === 0 && !showGoogleFonts && (
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


      </div>
    </div>
  );
};

export default FontSelectionModal;
