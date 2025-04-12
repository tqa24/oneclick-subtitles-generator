import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/SubtitleSettings.css';

const SubtitleSettings = ({
  settings,
  onSettingsChange,
  onDownloadWithSubtitles,
  onDownloadWithTranslatedSubtitles,
  hasTranslation,
  translatedSubtitles,
  targetLanguage
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(() => {
    // Load isOpen state from localStorage
    const savedIsOpen = localStorage.getItem('subtitle_settings_panel_open');
    return savedIsOpen === 'true';
  });

  const [subtitleLanguage, setSubtitleLanguage] = useState(() => {
    // Load subtitle language from localStorage
    const savedLanguage = localStorage.getItem('subtitle_language');
    return savedLanguage || 'original';
  });

  // Update subtitle language when translation becomes available
  useEffect(() => {
    if (hasTranslation && settings.showTranslatedSubtitles) {
      setSubtitleLanguage('translated');
    }
  }, [hasTranslation, settings.showTranslatedSubtitles]);

  // State for transparent background toggle
  const [isTransparent, setIsTransparent] = useState(() => {
    // Load transparency state from localStorage
    const savedTransparency = localStorage.getItem('subtitle_settings_panel_transparent');
    return savedTransparency === 'true';
  });

  // Save isOpen state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('subtitle_settings_panel_open', isOpen.toString());
  }, [isOpen]);

  // Save transparency state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('subtitle_settings_panel_transparent', isTransparent.toString());
  }, [isTransparent]);

  const handleSettingChange = (setting, value) => {
    const updatedSettings = {
      ...settings,
      [setting]: value
    };

    // Save to localStorage
    localStorage.setItem('subtitle_settings', JSON.stringify(updatedSettings));

    // Update state via parent component
    onSettingsChange(updatedSettings);
  };

  const handleSubtitleLanguageChange = (e) => {
    const value = e.target.value;
    setSubtitleLanguage(value);

    // Update the showTranslatedSubtitles setting
    const showTranslated = value === 'translated';
    handleSettingChange('showTranslatedSubtitles', showTranslated);

    // Save the selected language to localStorage
    localStorage.setItem('subtitle_language', value);
  };

  const fontOptions = [
    // Korean optimized fonts
    { value: "'Noto Sans KR', sans-serif", label: 'Noto Sans Korean', group: 'Korean Optimized', koreanSupport: true, vietnameseSupport: false },
    { value: "'Nanum Gothic', sans-serif", label: 'Nanum Gothic', group: 'Korean Optimized', koreanSupport: true, vietnameseSupport: false },
    { value: "'Malgun Gothic', sans-serif", label: 'Malgun Gothic', group: 'Korean Optimized', koreanSupport: true, vietnameseSupport: false },
    { value: "'Nanum Myeongjo', serif", label: 'Nanum Myeongjo', group: 'Korean Optimized', koreanSupport: true, vietnameseSupport: false },
    { value: "'Nanum Barun Gothic', sans-serif", label: 'Nanum Barun Gothic', group: 'Korean Optimized', koreanSupport: true, vietnameseSupport: false },
    { value: "'Spoqa Han Sans', sans-serif", label: 'Spoqa Han Sans', group: 'Korean Optimized', koreanSupport: true, vietnameseSupport: false },
    { value: "'KoPub Batang', serif", label: 'KoPub Batang', group: 'Korean Optimized', koreanSupport: true, vietnameseSupport: false },
    { value: "'Gowun Dodum', sans-serif", label: 'Gowun Dodum', group: 'Korean Optimized', koreanSupport: true, vietnameseSupport: false },

    // Vietnamese optimized fonts
    { value: "'Noto Sans Vietnamese', sans-serif", label: 'Noto Sans Vietnamese', group: 'Vietnamese Optimized', koreanSupport: false, vietnameseSupport: true },
    { value: "'Be Vietnam Pro', sans-serif", label: 'Be Vietnam Pro', group: 'Vietnamese Optimized', koreanSupport: false, vietnameseSupport: true },
    { value: "'Sarabun', sans-serif", label: 'Sarabun', group: 'Vietnamese Optimized', koreanSupport: false, vietnameseSupport: true },
    { value: "'Montserrat Alternates', sans-serif", label: 'Montserrat Alternates', group: 'Vietnamese Optimized', koreanSupport: false, vietnameseSupport: true },
    { value: "'Josefin Sans', sans-serif", label: 'Josefin Sans', group: 'Vietnamese Optimized', koreanSupport: false, vietnameseSupport: true },
    { value: "'Lexend', sans-serif", label: 'Lexend', group: 'Vietnamese Optimized', koreanSupport: false, vietnameseSupport: true },

    // Multilingual fonts with good support for both Korean and Vietnamese
    { value: "'Noto Sans', sans-serif", label: 'Noto Sans', group: 'Multilingual', koreanSupport: true, vietnameseSupport: true },
    { value: "'Noto Serif', serif", label: 'Noto Serif', group: 'Multilingual', koreanSupport: true, vietnameseSupport: true },
    { value: "'Arial Unicode MS', sans-serif", label: 'Arial Unicode', group: 'Multilingual', koreanSupport: true, vietnameseSupport: true },
    { value: "'Source Sans Pro', sans-serif", label: 'Source Sans Pro', group: 'Multilingual', koreanSupport: true, vietnameseSupport: true },
    { value: "'Roboto', sans-serif", label: 'Roboto', group: 'Multilingual', koreanSupport: true, vietnameseSupport: true },
    { value: "'Open Sans', sans-serif", label: 'Open Sans', group: 'Multilingual', koreanSupport: true, vietnameseSupport: true },

    // Standard sans-serif fonts
    { value: "'Poppins', sans-serif", label: 'Poppins', group: 'Sans-serif', koreanSupport: false, vietnameseSupport: true },
    { value: "'Arial', sans-serif", label: 'Arial', group: 'Sans-serif', koreanSupport: false, vietnameseSupport: true },
    { value: "'Helvetica', sans-serif", label: 'Helvetica', group: 'Sans-serif', koreanSupport: false, vietnameseSupport: true },
    { value: "'Tahoma', sans-serif", label: 'Tahoma', group: 'Sans-serif', koreanSupport: false, vietnameseSupport: true },
    { value: "'Verdana', sans-serif", label: 'Verdana', group: 'Sans-serif', koreanSupport: false, vietnameseSupport: true },

    // Serif fonts
    { value: "'Georgia', serif", label: 'Georgia', group: 'Serif', koreanSupport: false, vietnameseSupport: false },
    { value: "'Times New Roman', serif", label: 'Times New Roman', group: 'Serif', koreanSupport: false, vietnameseSupport: true },

    // Monospace fonts
    { value: "'Nanum Gothic Coding', monospace", label: 'Nanum Gothic Coding', group: 'Monospace', koreanSupport: true, vietnameseSupport: false },
    { value: "'Roboto Mono', monospace", label: 'Roboto Mono', group: 'Monospace', koreanSupport: false, vietnameseSupport: true },
    { value: "'Courier New', monospace", label: 'Courier New', group: 'Monospace', koreanSupport: false, vietnameseSupport: false }
  ];

  // Group fonts for the select element
  const fontGroups = fontOptions.reduce((groups, font) => {
    if (!groups[font.group]) {
      groups[font.group] = [];
    }
    groups[font.group].push(font);
    return groups;
  }, {});

  const fontWeightOptions = [
    { value: '300', label: t('subtitleSettings.light', 'Light') },
    { value: '400', label: t('subtitleSettings.normal', 'Normal') },
    { value: '500', label: t('subtitleSettings.medium', 'Medium') },
    { value: '600', label: t('subtitleSettings.semiBold', 'Semi Bold') },
    { value: '700', label: t('subtitleSettings.bold', 'Bold') },
    { value: '800', label: t('subtitleSettings.extraBold', 'Extra Bold') }
  ];

  const textAlignOptions = [
    { value: 'left', label: t('subtitleSettings.left', 'Left') },
    { value: 'center', label: t('subtitleSettings.center', 'Center') },
    { value: 'right', label: t('subtitleSettings.right', 'Right') }
  ];

  const textTransformOptions = [
    { value: 'none', label: t('subtitleSettings.none', 'None') },
    { value: 'uppercase', label: t('subtitleSettings.uppercase', 'UPPERCASE') },
    { value: 'lowercase', label: t('subtitleSettings.lowercase', 'lowercase') },
    { value: 'capitalize', label: t('subtitleSettings.capitalize', 'Capitalize') }
  ];

  // Position is now a percentage value from 0 (top) to 100 (bottom)

  return (
    <div className="subtitle-settings-container">
      <div className="action-buttons">
        {/* Render with Subtitles and Render with Translated buttons hidden for now */}

        <button
          className="action-button subtitle-settings-toggle md-filled-tonal-button"
          onClick={() => setIsOpen(!isOpen)}
          title={t('subtitleSettings.settingsTooltip', 'Customize subtitle appearance')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span>{t('subtitleSettings.toggleSettings', 'Subtitle Settings')}</span>
        </button>
      </div>

      {isOpen && (
        <div className={`subtitle-settings-panel ${isTransparent ? 'transparent' : ''}`}>
          <div className="settings-header">
            <h4>{t('subtitleSettings.title', 'Subtitle Settings')}</h4>
            <div className="settings-header-actions">
              <button
                className={`transparency-toggle-btn ${isTransparent ? 'active' : ''}`}
                onClick={() => setIsTransparent(!isTransparent)}
                title={isTransparent ? t('subtitleSettings.showBackground', 'Show Background') : t('subtitleSettings.transparentBackground', 'Transparent Background')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {isTransparent ? (
                    <>
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </>
                  )}
                </svg>
              </button>
              <button
                className="close-settings-btn"
                onClick={() => setIsOpen(false)}
              >
                &times;
              </button>
            </div>
          </div>

          <div className="settings-content">
            {/* Subtitle Language Selector - Always shown at the top */}
            <div className="setting-group subtitle-language-group">
              <label htmlFor="subtitle-language">{t('subtitleSettings.subtitleLanguage', 'Subtitle Language')}</label>
              <select
                id="subtitle-language"
                value={subtitleLanguage}
                onChange={handleSubtitleLanguageChange}
                className="subtitle-language-select"
                disabled={!hasTranslation}
              >
                <option value="original">{t('subtitleSettings.original', 'Original')}</option>
                {hasTranslation && (
                  <option value="translated">
                    {t('subtitleSettings.translated', 'Translated')}
                    {targetLanguage ? ` (${targetLanguage})` : ''}
                  </option>
                )}
              </select>
            </div>

            <hr className="settings-divider" />

            {/* Column Headers - Only shown in transparent mode */}
            {isTransparent && (
              <>
                <div className="column-header font-column-header">{t('subtitleSettings.fontSettings', 'Font Settings')}</div>
                <div className="column-header text-column-header">{t('subtitleSettings.textFormatting', 'Text Formatting')}</div>
                <div className="column-header position-column-header">{t('subtitleSettings.positionSettings', 'Position Settings')}</div>
                <div className="column-header background-column-header">{t('subtitleSettings.backgroundSettings', 'Background Settings')}</div>
              </>
            )}

            <div className="setting-group">
              <label htmlFor="font-family">{t('subtitleSettings.font', 'Font')}</label>
              <select
                id="font-family"
                value={settings.fontFamily}
                onChange={(e) => handleSettingChange('fontFamily', e.target.value)}
                className="font-select"
              >
                {Object.entries(fontGroups).map(([group, fonts]) => (
                  <optgroup key={group} label={group}>
                    {fonts.map(font => (
                      <option key={font.value} value={font.value}>
                        {font.label} {font.koreanSupport && '🇰🇷'}{font.vietnameseSupport && '🇻🇳'}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="setting-description">
                {t('subtitleSettings.fontSupportNote', 'Fonts marked with 🇰🇷 support Korean, 🇻🇳 support Vietnamese')}
              </p>
              <div className="font-preview" style={{ fontFamily: settings.fontFamily }}>
                <span className="font-preview-label">{t('subtitleSettings.fontPreview', 'Preview')}:</span>
                <div className="font-preview-samples">
                  <span className="font-preview-text">안녕하세요 (Korean)</span>
                  <span className="font-preview-text">Xin chào (Vietnamese)</span>
                  <span className="font-preview-text">Hello 123</span>
                </div>
              </div>
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

            <div className="setting-group">
              <label htmlFor="text-align">{t('subtitleSettings.textAlign', 'Text Alignment')}</label>
              <div className="button-toggle-group">
                {textAlignOptions.map(option => (
                  <button
                    key={option.value}
                    className={`button-toggle ${settings.textAlign === option.value ? 'active' : ''}`}
                    onClick={() => handleSettingChange('textAlign', option.value)}
                    title={option.label}
                  >
                    {option.value === 'left' && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="12" x2="15" y2="12"></line>
                        <line x1="3" y1="18" x2="18" y2="18"></line>
                      </svg>
                    )}
                    {option.value === 'center' && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="6" y1="12" x2="18" y2="12"></line>
                        <line x1="4" y1="18" x2="20" y2="18"></line>
                      </svg>
                    )}
                    {option.value === 'right' && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="9" y1="12" x2="21" y2="12"></line>
                        <line x1="6" y1="18" x2="21" y2="18"></line>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-group">
              <label htmlFor="text-transform">{t('subtitleSettings.textTransform', 'Text Transform')}</label>
              <select
                id="text-transform"
                value={settings.textTransform || 'none'}
                onChange={(e) => handleSettingChange('textTransform', e.target.value)}
              >
                {textTransformOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="setting-group">
              <label htmlFor="line-spacing">{t('subtitleSettings.lineSpacing', 'Line Spacing')}</label>
              <div className="range-with-value">
                <input
                  type="range"
                  id="line-spacing"
                  min="1"
                  max="2"
                  step="0.1"
                  value={settings.lineSpacing || '1.4'}
                  onChange={(e) => handleSettingChange('lineSpacing', e.target.value)}
                />
                <span className="range-value">{settings.lineSpacing || '1.4'}</span>
              </div>
            </div>

            <div className="setting-group">
              <label htmlFor="letter-spacing">{t('subtitleSettings.letterSpacing', 'Letter Spacing')}</label>
              <div className="range-with-value">
                <input
                  type="range"
                  id="letter-spacing"
                  min="-1"
                  max="5"
                  step="0.5"
                  value={settings.letterSpacing || '0'}
                  onChange={(e) => handleSettingChange('letterSpacing', e.target.value)}
                />
                <span className="range-value">{settings.letterSpacing || '0'}px</span>
              </div>
            </div>

            <div className="setting-group">
              <label htmlFor="background-radius">{t('subtitleSettings.backgroundRadius', 'Background Radius')}</label>
              <div className="range-with-value">
                <input
                  type="range"
                  id="background-radius"
                  min="0"
                  max="20"
                  step="1"
                  value={settings.backgroundRadius || '0'}
                  onChange={(e) => handleSettingChange('backgroundRadius', e.target.value)}
                />
                <span className="range-value">{settings.backgroundRadius || '0'}px</span>
              </div>
            </div>

            <div className="setting-group">
              <label htmlFor="background-padding">{t('subtitleSettings.backgroundPadding', 'Background Padding')}</label>
              <div className="range-with-value">
                <input
                  type="range"
                  id="background-padding"
                  min="0"
                  max="30"
                  step="2"
                  value={settings.backgroundPadding || '10'}
                  onChange={(e) => handleSettingChange('backgroundPadding', e.target.value)}
                />
                <span className="range-value">{settings.backgroundPadding || '10'}px</span>
              </div>
            </div>

            <div className="setting-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.textShadow === 'true' || settings.textShadow === true}
                  onChange={(e) => handleSettingChange('textShadow', e.target.checked)}
                />
                <span>{t('subtitleSettings.textShadow', 'Text Shadow')}</span>
              </label>
            </div>

            <button
              className="reset-settings-btn"
              onClick={() => {
                const defaultSettings = {
                  fontFamily: "'Noto Sans KR', sans-serif",
                  fontSize: '24',
                  fontWeight: '500',
                  position: '90',
                  boxWidth: '80',
                  backgroundColor: '#000000',
                  opacity: '0.7',
                  textColor: '#ffffff',
                  textAlign: 'center',
                  textTransform: 'none',
                  lineSpacing: '1.4',
                  letterSpacing: '0',
                  backgroundRadius: '4',
                  backgroundPadding: '10',
                  textShadow: false,
                  showTranslatedSubtitles: false
                };

                // Save default settings to localStorage
                localStorage.setItem('subtitle_settings', JSON.stringify(defaultSettings));

                // Update state via parent component
                onSettingsChange(defaultSettings);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                <path d="M3 3v5h5"></path>
              </svg>
              {t('subtitleSettings.resetToDefault', 'Reset to Default')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubtitleSettings;
