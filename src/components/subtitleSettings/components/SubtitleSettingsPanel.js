import React from 'react';
import { useTranslation } from 'react-i18next';
import FontSettings from './FontSettings';
import PositionSettings from './PositionSettings';
import StyleSettings from './StyleSettings';
import { fontOptions, fontWeightOptions, textAlignOptions, getTextTransformOptions } from '../constants';
import { groupFontsByCategory } from '../utils/fontUtils';
import CloseButton from '../../common/CloseButton';
import CustomDropdown from '../../common/CustomDropdown';

/**
 * Subtitle Settings Panel component
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the panel is open
 * @param {Function} props.setIsOpen - Function to set isOpen state
 * @param {Object} props.settings - Current subtitle settings
 * @param {Function} props.handleSettingChange - Function to handle setting changes
 * @param {string} props.subtitleLanguage - Current subtitle language
 * @param {Function} props.handleSubtitleLanguageChange - Function to handle subtitle language changes
 * @param {boolean} props.hasTranslation - Whether translation is available
 * @param {string} props.targetLanguage - Target language for translation
 * @param {Function} props.resetToDefaults - Function to reset settings to defaults
 * @returns {JSX.Element} - Rendered component
 */
const SubtitleSettingsPanel = ({
  isOpen,
  setIsOpen,
  settings,
  handleSettingChange,
  subtitleLanguage,
  handleSubtitleLanguageChange,
  hasTranslation,
  targetLanguage,
  resetToDefaults
}) => {
  const { t } = useTranslation();
  
  // Group fonts for the select element
  const fontGroups = groupFontsByCategory(fontOptions);

  if (!isOpen) return null;

  return (
    <div className="subtitle-settings-panel">

      <div className="settings-content">
        {/* Subtitle Language Selector - Always shown at the top */}
        <div className="setting-group subtitle-language-group">
          <label htmlFor="subtitle-language">{t('subtitleSettings.subtitleLanguage', 'Subtitle Language')}</label>
          <CustomDropdown
            value={subtitleLanguage}
            onChange={(value) => handleSubtitleLanguageChange({ target: { value } })}
            disabled={!hasTranslation}
            options={[
              { value: 'original', label: t('subtitleSettings.original', 'Original') },
              ...(hasTranslation ? [{
                value: 'translated',
                label: `${t('subtitleSettings.translated', 'Translated')}${targetLanguage ? ` (${targetLanguage})` : ''}`
              }] : [])
            ]}
            placeholder={t('subtitleSettings.selectLanguage', 'Select Language')}
          />
        </div>

        <hr className="settings-divider" />

        {/* Font Settings */}
        <FontSettings 
          settings={settings} 
          handleSettingChange={handleSettingChange} 
          fontGroups={fontGroups} 
          fontWeightOptions={fontWeightOptions} 
        />

        {/* Position Settings */}
        <PositionSettings 
          settings={settings} 
          handleSettingChange={handleSettingChange} 
        />

        {/* Style Settings */}
        <StyleSettings
          settings={settings}
          handleSettingChange={handleSettingChange}
          textAlignOptions={textAlignOptions}
          textTransformOptions={getTextTransformOptions(t)}
        />

        <button
          className="reset-settings-btn"
          onClick={resetToDefaults}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
            <path d="M3 3v5h5"></path>
          </svg>
          {t('subtitleSettings.resetToDefault', 'Reset to Default')}
        </button>
      </div>
    </div>
  );
};

export default SubtitleSettingsPanel;
