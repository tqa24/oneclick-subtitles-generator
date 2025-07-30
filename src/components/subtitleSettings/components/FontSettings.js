import React from 'react';
import { useTranslation } from 'react-i18next';
import StandardSlider from '../../common/StandardSlider';

/**
 * Font Settings component
 * 
 * @param {Object} props - Component props
 * @param {Object} props.settings - Current subtitle settings
 * @param {Function} props.handleSettingChange - Function to handle setting changes
 * @param {Object} props.fontGroups - Grouped font options
 * @param {Array} props.fontWeightOptions - Font weight options
 * @returns {JSX.Element} - Rendered component
 */
const FontSettings = ({ settings, handleSettingChange, fontGroups, fontWeightOptions }) => {
  const { t } = useTranslation();

  return (
    <>
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
        <div className="slider-with-value">
          <StandardSlider
            value={parseInt(settings.fontSize)}
            onChange={(value) => handleSettingChange('fontSize', value.toString())}
            min={12}
            max={36}
            step={1}
            orientation="Horizontal"
            size="XSmall"
            state="Enabled"
            showValueIndicator={false} // Using custom value display
            showIcon={false}
            showStops={false}
            className="font-size-slider"
            id="font-size"
            ariaLabel={t('subtitleSettings.fontSize', 'Font Size')}
          />
          <div className="slider-value-display">{settings.fontSize}px</div>
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
        <label htmlFor="line-spacing">{t('subtitleSettings.lineSpacing', 'Line Spacing')}</label>
        <div className="slider-with-value">
          <StandardSlider
            value={parseFloat(settings.lineSpacing || '1.4')}
            onChange={(value) => handleSettingChange('lineSpacing', value.toString())}
            min={1}
            max={2}
            step={0.1}
            orientation="Horizontal"
            size="XSmall"
            state="Enabled"
            showValueIndicator={false} // Using custom value display
            showIcon={false}
            showStops={false}
            className="line-spacing-slider"
            id="line-spacing"
            ariaLabel={t('subtitleSettings.lineSpacing', 'Line Spacing')}
          />
          <div className="slider-value-display">{settings.lineSpacing || '1.4'}</div>
        </div>
      </div>

      <div className="setting-group">
        <label htmlFor="letter-spacing">{t('subtitleSettings.letterSpacing', 'Letter Spacing')}</label>
        <div className="slider-with-value">
          <StandardSlider
            value={parseFloat(settings.letterSpacing || '0')}
            onChange={(value) => handleSettingChange('letterSpacing', value.toString())}
            min={-1}
            max={5}
            step={0.5}
            orientation="Horizontal"
            size="XSmall"
            state="Enabled"
            showValueIndicator={false} // Using custom value display
            showIcon={false}
            showStops={false}
            className="letter-spacing-slider"
            id="letter-spacing"
            ariaLabel={t('subtitleSettings.letterSpacing', 'Letter Spacing')}
          />
          <div className="slider-value-display">{settings.letterSpacing || '0'}px</div>
        </div>
      </div>
    </>
  );
};

export default FontSettings;
