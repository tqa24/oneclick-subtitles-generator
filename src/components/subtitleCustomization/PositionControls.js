import React from 'react';
import { useTranslation } from 'react-i18next';
import StandardSlider from '../common/StandardSlider';
import CustomDropdown from '../common/CustomDropdown';

const PositionControls = ({ customization, onChange }) => {
  const { t } = useTranslation();

  const updateCustomization = (updates) => {
    onChange({ ...customization, ...updates, preset: 'custom' });
  };

  return (
    <>
      {/* Position */}
      <div className="customization-row">
        <div className="row-label">
          <label>{t('videoRendering.position', 'Position')}</label>
        </div>
        <div className="row-content">
          <CustomDropdown
            value={customization.position}
            onChange={(value) => updateCustomization({ position: value })}
            options={[
              { value: 'bottom', label: t('videoRendering.bottom', 'Bottom') },
              { value: 'top', label: t('videoRendering.top', 'Top') },
              { value: 'center', label: t('videoRendering.center', 'Center') },
              { value: 'custom', label: t('videoRendering.custom', 'Custom') }
            ]}
            placeholder={t('videoRendering.selectPosition', 'Select Position')}
          />
        </div>
      </div>

      {/* Custom Position X */}
      {customization.position === 'custom' && (
        <div className="customization-row">
          <div className="row-label">
            <label>{t('videoRendering.customPositionX', 'Position X')}</label>
          </div>
          <div className="row-content">
            <div className="slider-control">
              <span className="slider-value">{customization.customPositionX}%</span>
              <StandardSlider
                value={customization.customPositionX}
                onChange={(value) => updateCustomization({ customPositionX: parseInt(value) })}
                min={0}
                max={100}
                step={1}
                orientation="horizontal"
                size="xsmall"
                state="enabled"
                showValueIndicator={false} // Using custom value display
                showIcon={false}
                showStops={false}
                className="position-x-slider"
                id="position-x-slider"
                ariaLabel={t('videoRendering.customPositionX', 'Position X')}
              />
            </div>
          </div>
        </div>
      )}

      {/* Custom Position Y */}
      {customization.position === 'custom' && (
        <div className="customization-row">
          <div className="row-label">
            <label>{t('videoRendering.customPositionY', 'Position Y')}</label>
          </div>
          <div className="row-content">
            <div className="slider-control">
              <span className="slider-value">{customization.customPositionY}%</span>
              <StandardSlider
                value={customization.customPositionY}
                onChange={(value) => updateCustomization({ customPositionY: parseInt(value) })}
                min={0}
                max={100}
                step={1}
                orientation="horizontal"
                size="xsmall"
                state="enabled"
                showValueIndicator={false} // Using custom value display
                showIcon={false}
                showStops={false}
                className="position-y-slider"
                id="position-y-slider"
                ariaLabel={t('videoRendering.customPositionY', 'Position Y')}
              />
            </div>
          </div>
        </div>
      )}

      {/* Max Width */}
      <div className="customization-row">
        <div className="row-label">
          <label>{t('videoRendering.maxWidth', 'Max Width')}</label>
        </div>
        <div className="row-content">
          <div className="slider-control">
            <span className="slider-value">{customization.maxWidth}%</span>
            <StandardSlider
              value={customization.maxWidth}
              onChange={(value) => updateCustomization({ maxWidth: parseInt(value) })}
              min={10}
              max={150}
              step={1}
              orientation="horizontal"
              size="xsmall"
              state="enabled"
              showValueIndicator={false} // Using custom value display
              showIcon={false}
              showStops={false}
              className="max-width-slider"
              id="max-width-slider"
              ariaLabel={t('videoRendering.maxWidth', 'Max Width')}
            />
          </div>
        </div>
      </div>

      {/* Margin Bottom */}
      <div className="customization-row">
        <div className="row-label">
          <label>{t('videoRendering.marginBottom', 'Margin Bottom')}</label>
        </div>
        <div className="row-content">
          <div className="slider-control">
            <span className="slider-value">{customization.marginBottom}px</span>
            <StandardSlider
              value={customization.marginBottom}
              onChange={(value) => updateCustomization({ marginBottom: parseInt(value) })}
              min={0}
              max={2000}
              step={1}
              orientation="horizontal"
              size="xsmall"
              state="enabled"
              showValueIndicator={false} // Using custom value display
              showIcon={false}
              showStops={false}
              className="margin-bottom-slider"
              id="margin-bottom-slider"
              ariaLabel={t('videoRendering.marginBottom', 'Margin Bottom')}
            />
          </div>
        </div>
      </div>

      {/* Margin Top */}
      <div className="customization-row">
        <div className="row-label">
          <label>{t('videoRendering.marginTop', 'Margin Top')}</label>
        </div>
        <div className="row-content">
          <div className="slider-control">
            <span className="slider-value">{customization.marginTop}px</span>
            <StandardSlider
              value={customization.marginTop}
              onChange={(value) => updateCustomization({ marginTop: parseInt(value) })}
              min={0}
              max={2000}
              step={1}
              orientation="horizontal"
              size="xsmall"
              state="enabled"
              showValueIndicator={false} // Using custom value display
              showIcon={false}
              showStops={false}
              className="margin-top-slider"
              id="margin-top-slider"
              ariaLabel={t('videoRendering.marginTop', 'Margin Top')}
            />
          </div>
        </div>
      </div>

      {/* Margin Left */}
      <div className="customization-row">
        <div className="row-label">
          <label>{t('videoRendering.marginLeft', 'Margin Left')}</label>
        </div>
        <div className="row-content">
          <div className="slider-control">
            <span className="slider-value">{customization.marginLeft}px</span>
            <StandardSlider
              value={customization.marginLeft}
              onChange={(value) => updateCustomization({ marginLeft: parseInt(value) })}
              min={0}
              max={2000}
              step={1}
              orientation="horizontal"
              size="xsmall"
              state="enabled"
              showValueIndicator={false} // Using custom value display
              showIcon={false}
              showStops={false}
              className="margin-left-slider"
              id="margin-left-slider"
              ariaLabel={t('videoRendering.marginLeft', 'Margin Left')}
            />
          </div>
        </div>
      </div>

      {/* Margin Right */}
      <div className="customization-row">
        <div className="row-label">
          <label>{t('videoRendering.marginRight', 'Margin Right')}</label>
        </div>
        <div className="row-content">
          <div className="slider-control">
            <span className="slider-value">{customization.marginRight}px</span>
            <StandardSlider
              value={customization.marginRight}
              onChange={(value) => updateCustomization({ marginRight: parseInt(value) })}
              min={0}
              max={2000}
              step={1}
              orientation="horizontal"
              size="xsmall"
              state="enabled"
              showValueIndicator={false} // Using custom value display
              showIcon={false}
              showStops={false}
              className="margin-right-slider"
              id="margin-right-slider"
              ariaLabel={t('videoRendering.marginRight', 'Margin Right')}
            />
          </div>
        </div>
      </div>


    </>
  );
};

export default PositionControls;
