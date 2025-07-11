import React from 'react';
import { useTranslation } from 'react-i18next';
import MaterialSwitch from '../common/MaterialSwitch';
import '../../styles/common/material-switch.css';

const EffectsControls = ({ customization, onChange }) => {
  const { t } = useTranslation();

  const updateCustomization = (updates) => {
    onChange({ ...customization, ...updates, preset: 'custom' });
  };

  return (
    <>
      {/* Text Shadow */}
      <div className="customization-row">
        <div className="row-label">
          <label>{t('videoRendering.textShadow', 'Text Shadow')}</label>
        </div>
        <div className="row-content">
          <div className="toggle-control">
            <div className="material-switch-container">
              <MaterialSwitch
                id="text-shadow-enabled"
                checked={customization.textShadowEnabled}
                onChange={(e) => updateCustomization({ textShadowEnabled: e.target.checked })}
                ariaLabel={t('videoRendering.textShadow', 'Text Shadow')}
                icons={true}
              />
            </div>
            {customization.textShadowEnabled && (
              <div className="color-control">
                <input
                  type="color"
                  value={customization.textShadowColor}
                  onChange={(e) => updateCustomization({ textShadowColor: e.target.value })}
                  className="color-picker"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Shadow Blur */}
      {customization.textShadowEnabled && (
        <div className="customization-row">
          <div className="row-label">
            <label>{t('videoRendering.shadowBlur', 'Shadow Blur')}</label>
          </div>
          <div className="row-content">
            <div className="slider-control">
              <span className="slider-value">{customization.textShadowBlur}px</span>
              <div className="custom-slider-container shadow-blur-slider">
                <div className="custom-slider-track">
                  <div
                    className="custom-slider-fill"
                    style={{ width: `${(customization.textShadowBlur / 50) * 100}%` }}
                  ></div>
                  <div
                    className="custom-slider-thumb"
                    style={{ left: `${(customization.textShadowBlur / 50) * 100}%` }}
                  ></div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={customization.textShadowBlur}
                  onChange={(e) => updateCustomization({ textShadowBlur: parseInt(e.target.value) })}
                  className="custom-slider-input"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shadow Offset */}
      {customization.textShadowEnabled && (
        <div className="customization-row">
          <div className="row-label">
            <label>{t('videoRendering.shadowOffset', 'Shadow Offset')}</label>
          </div>
          <div className="row-content">
            <div className="slider-control">
              <span className="slider-value">{customization.textShadowOffsetY}px</span>
              <div className="custom-slider-container shadow-offset-slider">
                <div className="custom-slider-track">
                  <div
                    className="custom-slider-fill"
                    style={{ width: `${((customization.textShadowOffsetY + 25) / 50) * 100}%` }}
                  ></div>
                  <div
                    className="custom-slider-thumb"
                    style={{ left: `${((customization.textShadowOffsetY + 25) / 50) * 100}%` }}
                  ></div>
                </div>
                <input
                  type="range"
                  min="-25"
                  max="25"
                  value={customization.textShadowOffsetY}
                  onChange={(e) => updateCustomization({ textShadowOffsetY: parseInt(e.target.value) })}
                  className="custom-slider-input"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Glow Effect */}
      <div className="customization-row">
        <div className="row-label">
          <label>{t('videoRendering.glow', 'Glow Effect')}</label>
        </div>
        <div className="row-content">
          <div className="toggle-control">
            <div className="material-switch-container">
              <MaterialSwitch
                id="glow-enabled"
                checked={customization.glowEnabled}
                onChange={(e) => updateCustomization({ glowEnabled: e.target.checked })}
                ariaLabel={t('videoRendering.glow', 'Glow Effect')}
                icons={true}
              />
            </div>
            {customization.glowEnabled && (
              <div className="color-control">
                <input
                  type="color"
                  value={customization.glowColor}
                  onChange={(e) => updateCustomization({ glowColor: e.target.value })}
                  className="color-picker"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Glow Intensity */}
      {customization.glowEnabled && (
        <div className="customization-row">
          <div className="row-label">
            <label>{t('videoRendering.glowIntensity', 'Glow Intensity')}</label>
          </div>
          <div className="row-content">
            <div className="slider-control">
              <span className="slider-value">{customization.glowIntensity}px</span>
              <div className="custom-slider-container glow-intensity-slider">
                <div className="custom-slider-track">
                  <div
                    className="custom-slider-fill"
                    style={{ width: `${(customization.glowIntensity / 100) * 100}%` }}
                  ></div>
                  <div
                    className="custom-slider-thumb"
                    style={{ left: `${(customization.glowIntensity / 100) * 100}%` }}
                  ></div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={customization.glowIntensity}
                  onChange={(e) => updateCustomization({ glowIntensity: parseInt(e.target.value) })}
                  className="custom-slider-input"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gradient Text Effect */}
      <div className="customization-row">
        <div className="row-label">
          <label>{t('videoRendering.gradientText', 'Gradient Text')}</label>
        </div>
        <div className="row-content">
          <div className="toggle-control">
            <div className="material-switch-container">
              <MaterialSwitch
                id="gradient-enabled"
                checked={customization.gradientEnabled}
                onChange={(e) => updateCustomization({ gradientEnabled: e.target.checked })}
                ariaLabel={t('videoRendering.gradient', 'Gradient')}
                icons={true}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Gradient Colors */}
      {customization.gradientEnabled && (
        <>
          <div className="customization-row">
            <div className="row-label">
              <label>{t('videoRendering.gradientStart', 'Gradient Start')}</label>
            </div>
            <div className="row-content">
              <div className="color-control">
                <input
                  type="color"
                  value={customization.gradientColorStart}
                  onChange={(e) => updateCustomization({ gradientColorStart: e.target.value })}
                  className="color-picker"
                />
                <input
                  type="text"
                  value={customization.gradientColorStart}
                  onChange={(e) => updateCustomization({ gradientColorStart: e.target.value })}
                  placeholder="#ff6b6b"
                  className="color-input"
                />
              </div>
            </div>
          </div>

          <div className="customization-row">
            <div className="row-label">
              <label>{t('videoRendering.gradientEnd', 'Gradient End')}</label>
            </div>
            <div className="row-content">
              <div className="color-control">
                <input
                  type="color"
                  value={customization.gradientColorEnd}
                  onChange={(e) => updateCustomization({ gradientColorEnd: e.target.value })}
                  className="color-picker"
                />
                <input
                  type="text"
                  value={customization.gradientColorEnd}
                  onChange={(e) => updateCustomization({ gradientColorEnd: e.target.value })}
                  placeholder="#4ecdc4"
                  className="color-input"
                />
              </div>
            </div>
          </div>

          <div className="customization-row">
            <div className="row-label">
              <label>{t('videoRendering.gradientDirection', 'Gradient Direction')}</label>
            </div>
            <div className="row-content">
              <select
                value={customization.gradientDirection}
                onChange={(e) => updateCustomization({ gradientDirection: e.target.value })}
                className="setting-select"
              >
                <option value="0deg">Horizontal →</option>
                <option value="90deg">Vertical ↓</option>
                <option value="45deg">Diagonal ↘</option>
                <option value="135deg">Diagonal ↙</option>
                <option value="180deg">Horizontal ←</option>
                <option value="270deg">Vertical ↑</option>
              </select>
            </div>
          </div>
        </>
      )}

      {/* Text Stroke Effect */}
      <div className="customization-row">
        <div className="row-label">
          <label>{t('videoRendering.textStroke', 'Text Stroke')}</label>
        </div>
        <div className="row-content">
          <div className="toggle-control">
            <div className="material-switch-container">
              <MaterialSwitch
                id="stroke-enabled"
                checked={customization.strokeEnabled}
                onChange={(e) => updateCustomization({ strokeEnabled: e.target.checked })}
                ariaLabel={t('videoRendering.stroke', 'Stroke')}
                icons={true}
              />
            </div>
            {customization.strokeEnabled && (
              <div className="color-control">
                <input
                  type="color"
                  value={customization.strokeColor}
                  onChange={(e) => updateCustomization({ strokeColor: e.target.value })}
                  className="color-picker"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stroke Width */}
      {customization.strokeEnabled && (
        <div className="customization-row">
          <div className="row-label">
            <label>{t('videoRendering.strokeWidth', 'Stroke Width')}</label>
          </div>
          <div className="row-content">
            <div className="slider-control">
              <span className="slider-value">{customization.strokeWidth}px</span>
              <div className="custom-slider-container stroke-width-slider">
                <div className="custom-slider-track">
                  <div
                    className="custom-slider-fill"
                    style={{ width: `${(customization.strokeWidth / 10) * 100}%` }}
                  ></div>
                  <div
                    className="custom-slider-thumb"
                    style={{ left: `${(customization.strokeWidth / 10) * 100}%` }}
                  ></div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={customization.strokeWidth}
                  onChange={(e) => updateCustomization({ strokeWidth: parseInt(e.target.value) })}
                  className="custom-slider-input"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EffectsControls;
