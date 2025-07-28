import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SERVER_URL } from '../../../config';
import { FiChevronDown } from 'react-icons/fi';
import '../../../styles/narration/narrationAdvancedSettingsRedesign.css';
import '../../../styles/narration/narrationModelDropdown.css';

/**
 * gTTS Controls component for language selection and speech parameters
 * @param {Object} props - Component props
 * @param {string} props.selectedLanguage - Currently selected language
 * @param {Function} props.setSelectedLanguage - Function to set selected language
 * @param {string} props.tld - Current top-level domain for accent
 * @param {Function} props.setTld - Function to set TLD
 * @param {boolean} props.slow - Whether to speak slowly
 * @param {Function} props.setSlow - Function to set slow speech
 * @param {boolean} props.isGenerating - Whether generation is in progress
 * @param {Object} props.detectedLanguage - Detected language from subtitles
 * @returns {JSX.Element} - Rendered component
 */
const GTTSControls = ({
  selectedLanguage,
  setSelectedLanguage,
  tld,
  setTld,
  slow,
  setSlow,
  isGenerating,
  detectedLanguage
}) => {
  const { t } = useTranslation();
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);

  // Load available languages on component mount
  useEffect(() => {
    const loadLanguages = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${SERVER_URL}/api/narration/gtts/languages`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setLanguages(data.languages || []);

        // Auto-select language based on detected language
        if (!selectedLanguage && data.languages && data.languages.length > 0) {
          let languageToSelect = 'en'; // Default to English

          if (detectedLanguage?.languageCode) {
            // Try to find a language that matches the detected language
            const matchingLanguage = data.languages.find(lang =>
              lang.code === detectedLanguage.languageCode
            );

            if (matchingLanguage) {
              languageToSelect = matchingLanguage.code;
            }
          }

          setSelectedLanguage(languageToSelect);
        }
      } catch (err) {
        console.error('Error loading gTTS languages:', err);
        setError('Failed to load languages');
      } finally {
        setLoading(false);
      }
    };

    loadLanguages();
  }, [selectedLanguage, setSelectedLanguage, detectedLanguage]);

  // Handle language selection change
  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setSelectedLanguage(newLanguage);
  };

  // Handle TLD change
  const handleTldChange = (e) => {
    const newTld = e.target.value;
    setTld(newTld);
  };

  // Handle slow speech toggle
  const handleSlowChange = (e) => {
    const newSlow = e.target.checked;
    setSlow(newSlow);
  };

  // Common TLD options for different accents
  const tldOptions = [
    { value: 'com', label: t('narration.tldCom', 'Global (.com)') },
    { value: 'com.au', label: t('narration.tldAu', 'Australian (.com.au)') },
    { value: 'co.uk', label: t('narration.tldUk', 'British (.co.uk)') },
    { value: 'us', label: t('narration.tldUs', 'American (.us)') },
    { value: 'ca', label: t('narration.tldCa', 'Canadian (.ca)') },
    { value: 'co.in', label: t('narration.tldIn', 'Indian (.co.in)') },
    { value: 'ie', label: t('narration.tldIe', 'Irish (.ie)') },
    { value: 'co.za', label: t('narration.tldZa', 'South African (.co.za)') },
    { value: 'com.br', label: t('narration.tldBr', 'Brazilian (.com.br)') },
    { value: 'pt', label: t('narration.tldPt', 'Portuguese (.pt)') },
    { value: 'es', label: t('narration.tldEs', 'Spanish (.es)') },
    { value: 'com.mx', label: t('narration.tldMx', 'Mexican (.com.mx)') },
    { value: 'fr', label: t('narration.tldFr', 'French (.fr)') }
  ];

  // Handle language modal
  const openLanguageModal = () => setIsLanguageModalOpen(true);
  const closeLanguageModal = () => setIsLanguageModalOpen(false);

  // Handle language selection
  const handleLanguageSelect = (languageCode) => {
    setIsLanguageModalOpen(false);
    setSelectedLanguage(languageCode);
  };

  // Get selected language details
  const selectedLanguageDetails = languages.find(lang => lang.code === selectedLanguage);

  return (
    <div className="gtts-controls">
      {/* Language Selection */}
      <div className="narration-row gtts-control-row animated-row">
        <div className="row-label">
          <label>{t('narration.gttsLanguage', 'Giọng thuyết minh')}:</label>
        </div>
        <div className="row-content">
          {loading ? (
            <div className="loading-message">
              {t('narration.loadingLanguages', 'Loading languages...')}
            </div>
          ) : error ? (
            <div className="error-message">
              {t('narration.languageLoadError', 'Error loading languages: {{error}}', { error })}
            </div>
          ) : (
            <div className="model-dropdown-container narration-model-dropdown-container">
              <button
                className="model-dropdown-btn narration-model-dropdown-btn"
                title={t('narration.selectLanguage', 'Select narration voice')}
                onClick={openLanguageModal}
                disabled={isGenerating}
              >
                <span className="model-dropdown-label">{t('narration.voiceLabel', 'Giọng thuyết minh')}:</span>
                <span className="model-dropdown-selected">
                  <span className="model-name">
                    {selectedLanguageDetails ?
                      `${selectedLanguageDetails.name} (${selectedLanguageDetails.code})` :
                      selectedLanguage || t('narration.selectLanguage', 'Select language')
                    }
                  </span>
                </span>
                <FiChevronDown className="dropdown-icon" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Top-Level Domain (Accent) */}
      <div className="narration-row gtts-control-row animated-row">
        <div className="row-label">
          <label htmlFor="gtts-tld">{t('narration.gttsTld', 'Accent/Region')}:</label>
        </div>
        <div className="row-content">
          <select
            id="gtts-tld"
            value={tld}
            onChange={handleTldChange}
            disabled={isGenerating}
            className="grouping-intensity-select"
          >
            {tldOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Slow Speech Toggle */}
      <div className="narration-row gtts-control-row animated-row">
        <div className="row-label">
          <label htmlFor="gtts-slow">{t('narration.gttsSlow', 'Slow Speech')}:</label>
        </div>
        <div className="row-content">
          <div className="checkbox-container">
            <input
              type="checkbox"
              id="gtts-slow"
              checked={slow}
              onChange={handleSlowChange}
              disabled={isGenerating}
              className="slow-checkbox"
            />
            <label htmlFor="gtts-slow" className="checkbox-label">
              {t('narration.gttsSlowDescription', 'Speak more slowly for better clarity')}
            </label>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="narration-row gtts-info-row">
        <div className="row-content">
          <div className="info-message">
            <span className="info-icon">ℹ️</span>
            {t('narration.gttsInfo', 'gTTS uses Google Translate\'s text-to-speech service. Different regions provide different accents for supported languages.')}
          </div>
        </div>
      </div>

      {/* Language-specific TLD recommendations */}
      {selectedLanguage === 'en' && (
        <div className="narration-row gtts-tip-row">
          <div className="row-content">
            <div className="tip-message">
              <span className="tip-icon">💡</span>
              {t('narration.gttsEnglishTip', 'For English: Use .com.au for Australian, .co.uk for British, .us for American accent.')}
            </div>
          </div>
        </div>
      )}

      {selectedLanguage === 'es' && (
        <div className="narration-row gtts-tip-row">
          <div className="row-content">
            <div className="tip-message">
              <span className="tip-icon">💡</span>
              {t('narration.gttsSpanishTip', 'For Spanish: Use .es for Spain, .com.mx for Mexican accent.')}
            </div>
          </div>
        </div>
      )}

      {selectedLanguage === 'pt' && (
        <div className="narration-row gtts-tip-row">
          <div className="row-content">
            <div className="tip-message">
              <span className="tip-icon">💡</span>
              {t('narration.gttsPortugueseTip', 'For Portuguese: Use .com.br for Brazilian, .pt for European accent.')}
            </div>
          </div>
        </div>
      )}

      {selectedLanguage === 'fr' && (
        <div className="narration-row gtts-tip-row">
          <div className="row-content">
            <div className="tip-message">
              <span className="tip-icon">💡</span>
              {t('narration.gttsFrenchTip', 'For French: Use .fr for France, .ca for Canadian accent.')}
            </div>
          </div>
        </div>
      )}

      {/* Language Selection Modal */}
      {isLanguageModalOpen && (
        <div className="modal-overlay" onClick={closeLanguageModal}>
          <div className="model-selection-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('narration.selectLanguage', 'Select narration voice')}</h3>
              <button className="modal-close-btn" onClick={closeLanguageModal}>×</button>
            </div>
            <div className="modal-content">
              {languages.length > 0 ? (
                <>
                  {/* Recommended language based on detected language */}
                  {detectedLanguage?.languageCode && (
                    <>
                      <div className="model-section">
                        <h4 className="model-section-title">
                          {t('narration.recommendedLanguage', 'Recommended for {{language}}', {
                            language: detectedLanguage.languageName || detectedLanguage.languageCode
                          })}
                        </h4>
                        <div className="model-options-grid">
                          {languages
                            .filter(lang => lang.code === detectedLanguage.languageCode)
                            .map(language => (
                              <button
                                key={language.code}
                                className={`model-option-card ${language.code === selectedLanguage ? 'selected' : ''}`}
                                onClick={() => handleLanguageSelect(language.code)}
                              >
                                <div className="model-option-name">{language.name}</div>
                                <div className="model-option-description">{language.code}</div>
                              </button>
                            ))
                          }
                        </div>
                      </div>

                      {/* Other languages */}
                      <div className="model-section">
                        <h4 className="model-section-title">
                          {t('narration.otherLanguages', 'Other languages')}
                        </h4>
                        <div className="model-options-grid">
                          {languages
                            .filter(lang => lang.code !== detectedLanguage.languageCode)
                            .slice(0, 20) // Limit to first 20 to avoid overwhelming UI
                            .map(language => (
                              <button
                                key={language.code}
                                className={`model-option-card ${language.code === selectedLanguage ? 'selected' : ''}`}
                                onClick={() => handleLanguageSelect(language.code)}
                              >
                                <div className="model-option-name">{language.name}</div>
                                <div className="model-option-description">{language.code}</div>
                              </button>
                            ))
                          }
                        </div>
                      </div>
                    </>
                  )}

                  {/* If no language detected, show all languages */}
                  {!detectedLanguage?.languageCode && (
                    <div className="model-section">
                      <h4 className="model-section-title">
                        {t('narration.availableLanguages', 'Available languages')}
                      </h4>
                      <div className="model-options-grid">
                        {languages.slice(0, 30).map(language => (
                          <button
                            key={language.code}
                            className={`model-option-card ${language.code === selectedLanguage ? 'selected' : ''}`}
                            onClick={() => handleLanguageSelect(language.code)}
                          >
                            <div className="model-option-name">{language.name}</div>
                            <div className="model-option-description">{language.code}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="no-models-message">
                  <div className="model-option-name">{t('narration.noLanguagesAvailable', 'No languages available')}</div>
                  <div className="model-option-description">{t('narration.checkConnection', 'Please check your connection and try again')}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GTTSControls;
