import React from 'react';
import { useTranslation } from 'react-i18next';

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
          <select
            value={customization.position}
            onChange={(e) => updateCustomization({ position: e.target.value })}
            className="setting-select"
          >
            <option value="bottom">{t('videoRendering.bottom', 'Bottom')}</option>
            <option value="top">{t('videoRendering.top', 'Top')}</option>
            <option value="center">{t('videoRendering.center', 'Center')}</option>
            <option value="custom">{t('videoRendering.custom', 'Custom')}</option>
          </select>
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
              <div className="custom-slider-container position-x-slider">
                <div className="custom-slider-track">
                  <div
                    className="custom-slider-fill"
                    style={{ width: `${customization.customPositionX}%` }}
                  ></div>
                  <div
                    className="custom-slider-thumb"
                    style={{ left: `${customization.customPositionX}%` }}
                  ></div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={customization.customPositionX}
                  onChange={(e) => updateCustomization({ customPositionX: parseInt(e.target.value) })}
                  className="custom-slider-input"
                />
              </div>
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
              <div className="custom-slider-container position-y-slider">
                <div className="custom-slider-track">
                  <div
                    className="custom-slider-fill"
                    style={{ width: `${customization.customPositionY}%` }}
                  ></div>
                  <div
                    className="custom-slider-thumb"
                    style={{ left: `${customization.customPositionY}%` }}
                  ></div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={customization.customPositionY}
                  onChange={(e) => updateCustomization({ customPositionY: parseInt(e.target.value) })}
                  className="custom-slider-input"
                />
              </div>
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
            <div className="custom-slider-container max-width-slider">
              <div className="custom-slider-track">
                <div
                  className="custom-slider-fill"
                  style={{ width: `${((customization.maxWidth - 10) / (150 - 10)) * 100}%` }}
                ></div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${((customization.maxWidth - 10) / (150 - 10)) * 100}%` }}
                ></div>
              </div>
              <input
                type="range"
                min="10"
                max="150"
                value={customization.maxWidth}
                onChange={(e) => updateCustomization({ maxWidth: parseInt(e.target.value) })}
                className="custom-slider-input"
              />
            </div>
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
            <div className="custom-slider-container margin-bottom-slider">
              <div className="custom-slider-track">
                <div
                  className="custom-slider-fill"
                  style={{ width: `${(customization.marginBottom / 400) * 100}%` }}
                ></div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${(customization.marginBottom / 400) * 100}%` }}
                ></div>
              </div>
              <input
                type="range"
                min="0"
                max="400"
                value={customization.marginBottom}
                onChange={(e) => updateCustomization({ marginBottom: parseInt(e.target.value) })}
                className="custom-slider-input"
              />
            </div>
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
            <div className="custom-slider-container margin-top-slider">
              <div className="custom-slider-track">
                <div
                  className="custom-slider-fill"
                  style={{ width: `${(customization.marginTop / 400) * 100}%` }}
                ></div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${(customization.marginTop / 400) * 100}%` }}
                ></div>
              </div>
              <input
                type="range"
                min="0"
                max="400"
                value={customization.marginTop}
                onChange={(e) => updateCustomization({ marginTop: parseInt(e.target.value) })}
                className="custom-slider-input"
              />
            </div>
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
            <div className="custom-slider-container margin-left-slider">
              <div className="custom-slider-track">
                <div
                  className="custom-slider-fill"
                  style={{ width: `${(customization.marginLeft / 400) * 100}%` }}
                ></div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${(customization.marginLeft / 400) * 100}%` }}
                ></div>
              </div>
              <input
                type="range"
                min="0"
                max="400"
                value={customization.marginLeft}
                onChange={(e) => updateCustomization({ marginLeft: parseInt(e.target.value) })}
                className="custom-slider-input"
              />
            </div>
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
            <div className="custom-slider-container margin-right-slider">
              <div className="custom-slider-track">
                <div
                  className="custom-slider-fill"
                  style={{ width: `${(customization.marginRight / 400) * 100}%` }}
                ></div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${(customization.marginRight / 400) * 100}%` }}
                ></div>
              </div>
              <input
                type="range"
                min="0"
                max="400"
                value={customization.marginRight}
                onChange={(e) => updateCustomization({ marginRight: parseInt(e.target.value) })}
                className="custom-slider-input"
              />
            </div>
          </div>
        </div>
      </div>


    </>
  );
};

export default PositionControls;
