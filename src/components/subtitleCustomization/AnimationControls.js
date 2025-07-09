import React from 'react';
import { useTranslation } from 'react-i18next';
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
            <div className="custom-slider-container fade-in-duration-slider">
              <div className="custom-slider-track">
                <div
                  className="custom-slider-fill"
                  style={{ width: `${(customization.fadeInDuration / 2.0) * 100}%` }}
                ></div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${(customization.fadeInDuration / 2.0) * 100}%` }}
                ></div>
              </div>
              <input
                type="range"
                min="0"
                max="2.0"
                step="0.1"
                value={customization.fadeInDuration}
                onChange={(e) => updateCustomization({ fadeInDuration: parseFloat(e.target.value) })}
                className="custom-slider-input"
              />
            </div>
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
            <div className="custom-slider-container fade-out-duration-slider">
              <div className="custom-slider-track">
                <div
                  className="custom-slider-fill"
                  style={{ width: `${(customization.fadeOutDuration / 2.0) * 100}%` }}
                ></div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${(customization.fadeOutDuration / 2.0) * 100}%` }}
                ></div>
              </div>
              <input
                type="range"
                min="0"
                max="2.0"
                step="0.1"
                value={customization.fadeOutDuration}
                onChange={(e) => updateCustomization({ fadeOutDuration: parseFloat(e.target.value) })}
                className="custom-slider-input"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AnimationControls;
