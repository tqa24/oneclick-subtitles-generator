import React from 'react';
import { useTranslation } from 'react-i18next';

const BackgroundControls = ({ customization, onChange }) => {
  const { t } = useTranslation();

  const updateCustomization = (updates) => {
    onChange({ ...customization, ...updates, preset: 'custom' });
  };

  return (
    <>
      {/* Background Color */}
      <div className="customization-row">
        <div className="row-label">
          <label>{t('videoRendering.backgroundColor', 'Background Color')}</label>
        </div>
        <div className="row-content">
          <div className="color-control">
            <input
              type="color"
              value={customization.backgroundColor}
              onChange={(e) => updateCustomization({ backgroundColor: e.target.value })}
              className="color-picker"
            />
            <input
              type="text"
              value={customization.backgroundColor}
              onChange={(e) => updateCustomization({ backgroundColor: e.target.value })}
              placeholder="#000000"
              className="color-input"
            />
          </div>
        </div>
      </div>

      {/* Background Opacity */}
      <div className="customization-row">
        <div className="row-label">
          <label>{t('videoRendering.backgroundOpacity', 'Background Opacity')}</label>
        </div>
        <div className="row-content">
          <div className="slider-control">
            <span className="slider-value">{customization.backgroundOpacity}%</span>
            <div className="custom-slider-container background-opacity-slider">
              <div className="custom-slider-track">
                <div
                  className="custom-slider-fill"
                  style={{ width: `${customization.backgroundOpacity}%` }}
                ></div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${customization.backgroundOpacity}%` }}
                ></div>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={customization.backgroundOpacity}
                onChange={(e) => updateCustomization({ backgroundOpacity: parseInt(e.target.value) })}
                className="custom-slider-input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Border Radius */}
      <div className="customization-row">
        <div className="row-label">
          <label>{t('videoRendering.borderRadius', 'Border Radius')}</label>
        </div>
        <div className="row-content">
          <div className="slider-control">
            <span className="slider-value">{customization.borderRadius}px</span>
            <div className="custom-slider-container border-radius-slider">
              <div className="custom-slider-track">
                <div
                  className="custom-slider-fill"
                  style={{ width: `${(customization.borderRadius / 100) * 100}%` }}
                ></div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${(customization.borderRadius / 100) * 100}%` }}
                ></div>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={customization.borderRadius}
                onChange={(e) => updateCustomization({ borderRadius: parseInt(e.target.value) })}
                className="custom-slider-input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Border Width */}
      <div className="customization-row">
        <div className="row-label">
          <label>{t('videoRendering.borderWidth', 'Border Width')}</label>
        </div>
        <div className="row-content">
          <div className="slider-control">
            <span className="slider-value">{customization.borderWidth}px</span>
            <div className="custom-slider-container border-width-slider">
              <div className="custom-slider-track">
                <div
                  className="custom-slider-fill"
                  style={{ width: `${(customization.borderWidth / 20) * 100}%` }}
                ></div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${(customization.borderWidth / 20) * 100}%` }}
                ></div>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                value={customization.borderWidth}
                onChange={(e) => updateCustomization({ borderWidth: parseInt(e.target.value) })}
                className="custom-slider-input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Border Color */}
      <div className="customization-row">
        <div className="row-label">
          <label>{t('videoRendering.borderColor', 'Border Color')}</label>
        </div>
        <div className="row-content">
          <div className="color-control">
            <input
              type="color"
              value={customization.borderColor}
              onChange={(e) => updateCustomization({ borderColor: e.target.value })}
              className="color-picker"
            />
            <input
              type="text"
              value={customization.borderColor}
              onChange={(e) => updateCustomization({ borderColor: e.target.value })}
              placeholder="#ffffff"
              className="color-input"
            />
          </div>
        </div>
      </div>

      {/* Border Style */}
      <div className="customization-row">
        <div className="row-label">
          <label>{t('videoRendering.borderStyle', 'Border Style')}</label>
        </div>
        <div className="row-content">
          <select
            value={customization.borderStyle}
            onChange={(e) => updateCustomization({ borderStyle: e.target.value })}
            className="setting-select"
          >
            <option value="none">{t('videoRendering.none', 'None')}</option>
            <option value="solid">{t('videoRendering.solid', 'Solid')}</option>
            <option value="dashed">{t('videoRendering.dashed', 'Dashed')}</option>
            <option value="dotted">{t('videoRendering.dotted', 'Dotted')}</option>
            <option value="double">{t('videoRendering.double', 'Double')}</option>
          </select>
        </div>
      </div>
    </>
  );
};

export default BackgroundControls;
