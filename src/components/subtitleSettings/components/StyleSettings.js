import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Style Settings component
 * 
 * @param {Object} props - Component props
 * @param {Object} props.settings - Current subtitle settings
 * @param {Function} props.handleSettingChange - Function to handle setting changes
 * @param {Array} props.textAlignOptions - Text alignment options
 * @param {Array} props.textTransformOptions - Text transform options
 * @returns {JSX.Element} - Rendered component
 */
const StyleSettings = ({ settings, handleSettingChange, textAlignOptions, textTransformOptions }) => {
  const { t } = useTranslation();

  return (
    <>
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
        <div className="slider-with-value">
          <div className="custom-slider-container">
            <div className="custom-slider-track">
              <div
                className="custom-slider-fill"
                style={{ width: `${settings.opacity * 100}%` }}
              ></div>
              <div
                className="custom-slider-thumb"
                style={{ left: `${settings.opacity * 100}%` }}
              ></div>
            </div>
            <input
              type="range"
              id="opacity"
              min="0"
              max="1"
              step="0.1"
              value={settings.opacity}
              onChange={(e) => handleSettingChange('opacity', e.target.value)}
              className="custom-slider-input"
            />
          </div>
          <div className="slider-value-display">{Math.round(settings.opacity * 100)}%</div>
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
        <label>{t('subtitleSettings.textShadow', 'Text Shadow')}</label>
        <div className="toggle-switch-container">
          <label className="toggle-switch" htmlFor="text-shadow">
            <input
              type="checkbox"
              id="text-shadow"
              checked={settings.textShadow === 'true' || settings.textShadow === true}
              onChange={(e) => handleSettingChange('textShadow', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
          <span className="toggle-label">
            {settings.textShadow === 'true' || settings.textShadow === true 
              ? t('common.on', 'On') 
              : t('common.off', 'Off')}
          </span>
        </div>
      </div>
    </>
  );
};

export default StyleSettings;
