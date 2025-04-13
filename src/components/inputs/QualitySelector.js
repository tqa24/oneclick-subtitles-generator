import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../../styles/components/quality-selector.css';

const QualitySelector = ({ onChange, className }) => {
  const { t } = useTranslation();
  const [selectedQuality, setSelectedQuality] = useState(() => {
    return localStorage.getItem('youtube_download_quality') || '360p';
  });

  // Quality options with descriptions
  const qualityOptions = [
    { value: '144p', label: '144p', description: t('qualitySelector.lowestQuality', 'Lowest quality (recommended for videos > 1 hour)') },
    { value: '240p', label: '240p', description: t('qualitySelector.lowQuality', 'Low quality') },
    { value: '360p', label: '360p', description: t('qualitySelector.mediumQuality', 'Medium quality (default)') },
    { value: '480p', label: '480p', description: t('qualitySelector.highQuality', 'High quality') },
    { value: '720p', label: '720p', description: t('qualitySelector.hdQuality', 'HD quality (may cause issues with long videos)') }
  ];

  // Update localStorage when quality changes
  useEffect(() => {
    localStorage.setItem('youtube_download_quality', selectedQuality);
  }, [selectedQuality]);

  // Notify parent when component mounts with initial quality
  useEffect(() => {
    if (onChange) {
      onChange(selectedQuality);
    }
  }, []);  // Empty dependency array means this runs only once on mount

  const handleQualityChange = (e) => {
    const newQuality = e.target.value;
    setSelectedQuality(newQuality);

    // Notify parent component of the change
    if (onChange) {
      onChange(newQuality);
    }
  };

  return (
    <div className={`quality-selector-container ${className || ''}`}>
      <label htmlFor="quality-selector" className="quality-selector-label">
        {t('qualitySelector.videoQuality', 'Video Quality')}:
      </label>
      <div className="quality-selector-wrapper">
        <select
          id="quality-selector"
          className="quality-selector"
          value={selectedQuality}
          onChange={handleQualityChange}
        >
          {qualityOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="quality-selector-arrow">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      {/* Warning message for audio stitching */}
      {selectedQuality !== '360p' && (
        <div className="quality-warning">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{t('qualitySelector.longVideoWarning', 'For videos longer than 1 hour, use 144p to avoid app crashes')}</span>
        </div>
      )}

      {/* Description of selected quality */}
      <div className="quality-description">
        {qualityOptions.find(option => option.value === selectedQuality)?.description}
      </div>
    </div>
  );
};

export default QualitySelector;
