import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Advanced Settings Toggle component
 * @param {Object} props - Component props
 * @param {boolean} props.showAdvancedSettings - Whether advanced settings are shown
 * @param {Function} props.setShowAdvancedSettings - Function to set show advanced settings
 * @returns {JSX.Element} - Rendered component
 */
const AdvancedSettingsToggle = ({
  showAdvancedSettings,
  setShowAdvancedSettings
}) => {
  const { t } = useTranslation();

  return (
    <div className="narration-row advanced-settings-row">
      <div className="row-label">
        <label>{t('narration.advancedSettings', 'Advanced Settings')}:</label>
      </div>
      <div className="row-content">
        <div
          className="advanced-settings-toggle"
          onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
        >
          <span className="advanced-settings-toggle-label">
            {t('narration.advancedSettingsToggle', 'Voice & Audio Settings')}
          </span>
          <span className={`advanced-settings-toggle-icon ${showAdvancedSettings ? 'expanded' : ''}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
};

export default AdvancedSettingsToggle;
