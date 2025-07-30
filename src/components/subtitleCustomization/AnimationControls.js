import React from 'react';
import { useTranslation } from 'react-i18next';
import StandardSlider from '../common/StandardSlider';
import { getAnimationTypes, getAnimationEasing } from './fontOptions';

const AnimationControls = ({ customization, onChange }) => {
  const { t } = useTranslation();

  // Get localized options
  const animationTypes = getAnimationTypes(t);
  const animationEasing = getAnimationEasing(t);

  const updateCustomization = (updates) => {
    onChange({ ...customization, ...updates, preset: 'custom' });
  };

  return (
    <>
      {/* Animation Type */}
      <div className="customization-row">
        <div className="row-label">
          <label>{t('videoRendering.animationType', 'Animation Type')}</label>
        </div>
        <div className="row-content">
          <select
            value={customization.animationType}
            onChange={(e) => updateCustomization({ animationType: e.target.value })}
            className="setting-select"
          >
            {animationTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Animation Easing */}
      <div className="customization-row">
        <div className="row-label">
          <label>{t('videoRendering.animationEasing', 'Animation Easing')}</label>
        </div>
        <div className="row-content">
          <select
            value={customization.animationEasing}
            onChange={(e) => updateCustomization({ animationEasing: e.target.value })}
            className="setting-select"
          >
            {animationEasing.map(easing => (
              <option key={easing.value} value={easing.value}>
                {easing.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Fade In Duration */}
      <div className="customization-row">
        <div className="row-label">
          <label>{t('videoRendering.fadeInDuration', 'Fade In Duration')}</label>
        </div>
        <div className="row-content">
          <div className="slider-control">
            <span className="slider-value">{customization.fadeInDuration}s</span>
            <StandardSlider
              value={customization.fadeInDuration}
              onChange={(value) => updateCustomization({ fadeInDuration: parseFloat(value) })}
              min={0}
              max={2.0}
              step={0.1}
              orientation="Horizontal"
              size="XSmall"
              state="Enabled"
              showValueIndicator={false} // Using custom value display
              showIcon={false}
              showStops={false}
              className="fade-in-duration-slider"
              id="fade-in-duration-slider"
              ariaLabel={t('videoRendering.fadeInDuration', 'Fade In Duration')}
            />
          </div>
        </div>
      </div>

      {/* Fade Out Duration */}
      <div className="customization-row">
        <div className="row-label">
          <label>{t('videoRendering.fadeOutDuration', 'Fade Out Duration')}</label>
        </div>
        <div className="row-content">
          <div className="slider-control">
            <span className="slider-value">{customization.fadeOutDuration}s</span>
            <StandardSlider
              value={customization.fadeOutDuration}
              onChange={(value) => updateCustomization({ fadeOutDuration: parseFloat(value) })}
              min={0}
              max={2.0}
              step={0.1}
              orientation="Horizontal"
              size="XSmall"
              state="Enabled"
              showValueIndicator={false} // Using custom value display
              showIcon={false}
              showStops={false}
              className="fade-out-duration-slider"
              id="fade-out-duration-slider"
              ariaLabel={t('videoRendering.fadeOutDuration', 'Fade Out Duration')}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default AnimationControls;
