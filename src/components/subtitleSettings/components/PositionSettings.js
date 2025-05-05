import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Position Settings component
 * 
 * @param {Object} props - Component props
 * @param {Object} props.settings - Current subtitle settings
 * @param {Function} props.handleSettingChange - Function to handle setting changes
 * @returns {JSX.Element} - Rendered component
 */
const PositionSettings = ({ settings, handleSettingChange }) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="setting-group">
        <label htmlFor="position">{t('subtitleSettings.position', 'Y Position')}</label>
        <div className="slider-with-value">
          <div className="custom-slider-container">
            <div className="custom-slider-track">
              <div
                className="custom-slider-fill"
                style={{ width: `${settings.position}%` }}
              ></div>
              <div
                className="custom-slider-thumb"
                style={{ left: `${settings.position}%` }}
              ></div>
            </div>
            <input
              type="range"
              id="position"
              min="0"
              max="100"
              step="1"
              value={settings.position}
              onChange={(e) => handleSettingChange('position', e.target.value)}
              className="custom-slider-input"
            />
          </div>
          <div className="slider-value-display">{settings.position}%</div>
        </div>
        <div className="position-labels">
          <span>{t('subtitleSettings.top', 'Top')}</span>
          <span>{t('subtitleSettings.bottom', 'Bottom')}</span>
        </div>
      </div>

      <div className="setting-group">
        <label htmlFor="box-width">{t('subtitleSettings.boxWidth', 'Box Width')}</label>
        <div className="slider-with-value">
          <div className="custom-slider-container">
            <div className="custom-slider-track">
              <div
                className="custom-slider-fill"
                style={{ width: `${((settings.boxWidth - 50) / 50) * 100}%` }}
              ></div>
              <div
                className="custom-slider-thumb"
                style={{ left: `${((settings.boxWidth - 50) / 50) * 100}%` }}
              ></div>
            </div>
            <input
              type="range"
              id="box-width"
              min="50"
              max="100"
              step="5"
              value={settings.boxWidth}
              onChange={(e) => handleSettingChange('boxWidth', e.target.value)}
              className="custom-slider-input"
            />
          </div>
          <div className="slider-value-display">{settings.boxWidth}%</div>
        </div>
      </div>

      <div className="setting-group">
        <label htmlFor="background-radius">{t('subtitleSettings.backgroundRadius', 'Background Radius')}</label>
        <div className="slider-with-value">
          <div className="custom-slider-container">
            <div className="custom-slider-track">
              <div
                className="custom-slider-fill"
                style={{ width: `${(parseFloat(settings.backgroundRadius || 0) / 20) * 100}%` }}
              ></div>
              <div
                className="custom-slider-thumb"
                style={{ left: `${(parseFloat(settings.backgroundRadius || 0) / 20) * 100}%` }}
              ></div>
            </div>
            <input
              type="range"
              id="background-radius"
              min="0"
              max="20"
              step="1"
              value={settings.backgroundRadius || '0'}
              onChange={(e) => handleSettingChange('backgroundRadius', e.target.value)}
              className="custom-slider-input"
            />
          </div>
          <div className="slider-value-display">{settings.backgroundRadius || '0'}px</div>
        </div>
      </div>

      <div className="setting-group">
        <label htmlFor="background-padding">{t('subtitleSettings.backgroundPadding', 'Background Padding')}</label>
        <div className="slider-with-value">
          <div className="custom-slider-container">
            <div className="custom-slider-track">
              <div
                className="custom-slider-fill"
                style={{ width: `${(parseFloat(settings.backgroundPadding || 10) / 30) * 100}%` }}
              ></div>
              <div
                className="custom-slider-thumb"
                style={{ left: `${(parseFloat(settings.backgroundPadding || 10) / 30) * 100}%` }}
              ></div>
            </div>
            <input
              type="range"
              id="background-padding"
              min="0"
              max="30"
              step="2"
              value={settings.backgroundPadding || '10'}
              onChange={(e) => handleSettingChange('backgroundPadding', e.target.value)}
              className="custom-slider-input"
            />
          </div>
          <div className="slider-value-display">{settings.backgroundPadding || '10'}px</div>
        </div>
      </div>
    </>
  );
};

export default PositionSettings;
