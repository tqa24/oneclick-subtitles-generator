import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/SubtitleSettings.css';

const SubtitleSettings = ({
  settings,
  onSettingsChange,
  onDownloadWithSubtitles,
  onDownloadWithTranslatedSubtitles,
  hasTranslation
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const handleSettingChange = (setting, value) => {
    onSettingsChange({
      ...settings,
      [setting]: value
    });
  };

  const fontOptions = [
    { value: 'Arial, sans-serif', label: 'Arial' },
    { value: 'Helvetica, sans-serif', label: 'Helvetica' },
    { value: 'Georgia, serif', label: 'Georgia' },
    { value: 'Tahoma, sans-serif', label: 'Tahoma' },
    { value: 'Verdana, sans-serif', label: 'Verdana' },
    { value: 'Times New Roman, serif', label: 'Times New Roman' },
    { value: 'Courier New, monospace', label: 'Courier New' }
  ];

  const fontWeightOptions = [
    { value: '400', label: t('subtitleSettings.normal', 'Normal') },
    { value: '700', label: t('subtitleSettings.bold', 'Bold') }
  ];

  // Position is now a percentage value from 0 (top) to 100 (bottom)

  return (
    <div className="subtitle-settings-container">
      <div className="action-buttons">
        <button
          className="action-button download-with-subtitles-btn"
          onClick={onDownloadWithSubtitles}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>{t('subtitleSettings.downloadWithSubtitles', 'Download with Subtitles')}</span>
        </button>

        <button
          className="action-button download-with-translated-subtitles-btn"
          onClick={onDownloadWithTranslatedSubtitles}
          disabled={!hasTranslation}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
            <path d="M3 9h18"></path>
          </svg>
          <span>{t('subtitleSettings.downloadWithTranslatedSubtitles', 'Download with Translated')}</span>
        </button>

        <button
          className="action-button subtitle-settings-toggle"
          onClick={() => setIsOpen(!isOpen)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span>{t('subtitleSettings.toggleSettings', 'Subtitle Settings')}</span>
        </button>
      </div>

      {isOpen && (
        <div className="subtitle-settings-panel">
          <div className="settings-header">
            <h4>{t('subtitleSettings.title', 'Subtitle Settings')}</h4>
            <button
              className="close-settings-btn"
              onClick={() => setIsOpen(false)}
            >
              &times;
            </button>
          </div>

          <div className="settings-content">
            <div className="setting-group">
              <label htmlFor="font-family">{t('subtitleSettings.font', 'Font')}</label>
              <select
                id="font-family"
                value={settings.fontFamily}
                onChange={(e) => handleSettingChange('fontFamily', e.target.value)}
              >
                {fontOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="setting-group">
              <label htmlFor="font-size">{t('subtitleSettings.fontSize', 'Font Size')}</label>
              <div className="range-with-value">
                <input
                  type="range"
                  id="font-size"
                  min="12"
                  max="36"
                  step="1"
                  value={settings.fontSize}
                  onChange={(e) => handleSettingChange('fontSize', e.target.value)}
                />
                <span className="range-value">{settings.fontSize}px</span>
              </div>
            </div>

            <div className="setting-group">
              <label htmlFor="font-weight">{t('subtitleSettings.fontWeight', 'Font Weight')}</label>
              <select
                id="font-weight"
                value={settings.fontWeight}
                onChange={(e) => handleSettingChange('fontWeight', e.target.value)}
              >
                {fontWeightOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="setting-group">
              <label htmlFor="position">{t('subtitleSettings.position', 'Y Position')}</label>
              <div className="range-with-value">
                <input
                  type="range"
                  id="position"
                  min="0"
                  max="100"
                  step="1"
                  value={settings.position}
                  onChange={(e) => handleSettingChange('position', e.target.value)}
                />
                <span className="range-value">{settings.position}%</span>
              </div>
              <div className="position-labels">
                <span>{t('subtitleSettings.top', 'Top')}</span>
                <span>{t('subtitleSettings.bottom', 'Bottom')}</span>
              </div>
            </div>

            <div className="setting-group">
              <label htmlFor="box-width">{t('subtitleSettings.boxWidth', 'Box Width')}</label>
              <div className="range-with-value">
                <input
                  type="range"
                  id="box-width"
                  min="50"
                  max="100"
                  step="5"
                  value={settings.boxWidth}
                  onChange={(e) => handleSettingChange('boxWidth', e.target.value)}
                />
                <span className="range-value">{settings.boxWidth}%</span>
              </div>
            </div>

            <div className="setting-group">
              <label htmlFor="background-color">{t('subtitleSettings.backgroundColor', 'Background Color')}</label>
              <input
                type="color"
                id="background-color"
                value={settings.backgroundColor}
                onChange={(e) => handleSettingChange('backgroundColor', e.target.value)}
              />
            </div>

            <div className="setting-group">
              <label htmlFor="opacity">{t('subtitleSettings.opacity', 'Opacity')}</label>
              <div className="range-with-value">
                <input
                  type="range"
                  id="opacity"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.opacity}
                  onChange={(e) => handleSettingChange('opacity', e.target.value)}
                />
                <span className="range-value">{Math.round(settings.opacity * 100)}%</span>
              </div>
            </div>

            <div className="setting-group">
              <label htmlFor="text-color">{t('subtitleSettings.textColor', 'Text Color')}</label>
              <input
                type="color"
                id="text-color"
                value={settings.textColor}
                onChange={(e) => handleSettingChange('textColor', e.target.value)}
              />
            </div>

            <button
              className="reset-settings-btn"
              onClick={() => onSettingsChange({
                fontFamily: 'Arial, sans-serif',
                fontSize: '24',
                fontWeight: '400',
                position: '90',
                boxWidth: '80',
                backgroundColor: '#000000',
                opacity: '0.7',
                textColor: '#ffffff'
              })}
            >
              {t('subtitleSettings.resetToDefault', 'Reset to Default')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubtitleSettings;
