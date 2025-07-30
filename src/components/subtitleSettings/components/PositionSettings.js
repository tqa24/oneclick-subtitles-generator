import React from 'react';
import { useTranslation } from 'react-i18next';
import StandardSlider from '../../common/StandardSlider';

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
          <StandardSlider
            value={settings.position}
            onChange={(value) => handleSettingChange('position', value)}
            min={0}
            max={100}
            step={1}
            orientation="horizontal"
            size="xsmall"
            state="enabled"
            showValueIndicator={false} // Using custom value display
            showIcon={false}
            showStops={false}
            className="position-slider"
            id="position"
            ariaLabel={t('subtitleSettings.position', 'Y Position')}
          />
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
          <StandardSlider
            value={parseInt(settings.boxWidth)}
            onChange={(value) => handleSettingChange('boxWidth', value.toString())}
            min={50}
            max={100}
            step={5}
            orientation="Horizontal"
            size="XSmall"
            state="Enabled"
            showValueIndicator={false} // Using custom value display
            showIcon={false}
            showStops={false}
            className="box-width-slider"
            id="box-width"
            ariaLabel={t('subtitleSettings.boxWidth', 'Box Width')}
          />
          <div className="slider-value-display">{settings.boxWidth}%</div>
        </div>
      </div>

      <div className="setting-group">
        <label htmlFor="background-radius">{t('subtitleSettings.backgroundRadius', 'Background Radius')}</label>
        <div className="slider-with-value">
          <StandardSlider
            value={parseFloat(settings.backgroundRadius || '0')}
            onChange={(value) => handleSettingChange('backgroundRadius', value.toString())}
            min={0}
            max={20}
            step={1}
            orientation="Horizontal"
            size="XSmall"
            state="Enabled"
            showValueIndicator={false} // Using custom value display
            showIcon={false}
            showStops={false}
            className="background-radius-slider"
            id="background-radius"
            ariaLabel={t('subtitleSettings.backgroundRadius', 'Background Radius')}
          />
          <div className="slider-value-display">{settings.backgroundRadius || '0'}px</div>
        </div>
      </div>

      <div className="setting-group">
        <label htmlFor="background-padding">{t('subtitleSettings.backgroundPadding', 'Background Padding')}</label>
        <div className="slider-with-value">
          <StandardSlider
            value={parseFloat(settings.backgroundPadding || '10')}
            onChange={(value) => handleSettingChange('backgroundPadding', value.toString())}
            min={0}
            max={30}
            step={2}
            orientation="Horizontal"
            size="XSmall"
            state="Enabled"
            showValueIndicator={false} // Using custom value display
            showIcon={false}
            showStops={false}
            className="background-padding-slider"
            id="background-padding"
            ariaLabel={t('subtitleSettings.backgroundPadding', 'Background Padding')}
          />
          <div className="slider-value-display">{settings.backgroundPadding || '10'}px</div>
        </div>
      </div>
    </>
  );
};

export default PositionSettings;
