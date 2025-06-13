import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/SubtitleCustomizationPanel.css';
import {
  fontOptions,
  animationTypes,
  animationEasing,
  fontWeightOptions,
  textAlignOptions,
  textTransformOptions,
  borderStyleOptions,
  positionOptions,
  groupFontsByCategory,
  getFontSupportFlags
} from './subtitleCustomization/fontOptions';

// Default customization settings
export const defaultCustomization = {
  fontSize: 28,
  fontFamily: "'Noto Sans', sans-serif",
  fontWeight: 600,
  textColor: '#ffffff',
  textAlign: 'center',
  lineHeight: 1.2,
  letterSpacing: 0,
  textTransform: 'none',

  backgroundColor: '#000000',
  backgroundOpacity: 50,
  borderRadius: 4,
  borderWidth: 0,
  borderColor: '#ffffff',
  borderStyle: 'none',

  textShadowEnabled: true,
  textShadowColor: '#000000',
  textShadowBlur: 4,
  textShadowOffsetX: 0,
  textShadowOffsetY: 2,
  glowEnabled: false,
  glowColor: '#ffffff',
  glowIntensity: 10,

  position: 'bottom',
  customPositionX: 50,
  customPositionY: 80,
  marginBottom: 80,
  marginTop: 80,
  marginLeft: 0,
  marginRight: 0,
  maxWidth: 80,

  fadeInDuration: 0.3,
  fadeOutDuration: 0.3,
  animationType: 'fade',
  animationEasing: 'ease',

  wordWrap: true,
  maxLines: 3,
  lineBreakBehavior: 'auto',
  rtlSupport: false,

  preset: 'default'
};

const SubtitleCustomizationPanel = ({ customization, onChange, isExpanded, onToggle }) => {
  const { t } = useTranslation();
  const [expandedSections, setExpandedSections] = useState({
    presets: true,
    text: false,
    background: false,
    effects: false,
    position: false,
    animation: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const updateCustomization = (updates) => {
    onChange({ ...customization, ...updates, preset: 'custom' });
  };

  const applyPreset = (preset) => {
    const presets = {
      default: defaultCustomization,
      modern: {
        ...defaultCustomization,
        fontFamily: 'Roboto',
        fontSize: 32,
        fontWeight: 400,
        backgroundColor: '#1a1a1a',
        backgroundOpacity: 80,
        borderRadius: 8,
        textShadowEnabled: false,
        preset: 'modern'
      },
      classic: {
        ...defaultCustomization,
        fontFamily: 'Times New Roman',
        fontSize: 30,
        fontWeight: 700,
        textColor: '#ffff00',
        backgroundColor: '#000000',
        backgroundOpacity: 70,
        borderRadius: 0,
        textShadowEnabled: true,
        textShadowColor: '#000000',
        textShadowBlur: 6,
        preset: 'classic'
      },
      neon: {
        ...defaultCustomization,
        fontFamily: 'Arial',
        fontSize: 34,
        fontWeight: 700,
        textColor: '#00ffff',
        backgroundColor: '#000000',
        backgroundOpacity: 90,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#00ffff',
        borderStyle: 'solid',
        glowEnabled: true,
        glowColor: '#00ffff',
        glowIntensity: 15,
        preset: 'neon'
      },
      minimal: {
        ...defaultCustomization,
        fontFamily: 'Helvetica',
        fontSize: 26,
        fontWeight: 300,
        backgroundColor: 'transparent',
        backgroundOpacity: 0,
        borderRadius: 0,
        textShadowEnabled: true,
        textShadowColor: '#000000',
        textShadowBlur: 8,
        preset: 'minimal'
      }
    };

    const presetConfig = presets[preset] || presets.default;
    onChange({ ...customization, ...presetConfig });
  };

  return (
    <div className="subtitle-customization-panel">
      <div className="panel-content">
        {/* Style Presets - using translation-section row pattern */}
        <div className="customization-row">
          <div className="row-label">
            <label>{t('videoRendering.stylePresets', 'Style Presets')}</label>
          </div>
          <div className="row-content">
            <div className="preset-buttons">
              {['default', 'modern', 'classic', 'neon', 'minimal'].map(preset => (
                <button
                  key={preset}
                  className={`pill-button ${customization.preset === preset ? 'primary' : 'secondary'}`}
                  onClick={() => applyPreset(preset)}
                >
                  {preset.charAt(0).toUpperCase() + preset.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Font Family */}
        <div className="customization-row">
          <div className="row-label">
            <label>{t('videoRendering.fontFamily', 'Font Family')}</label>
          </div>
          <div className="row-content">
            <select
              value={customization.fontFamily}
              onChange={(e) => updateCustomization({ fontFamily: e.target.value })}
              className="setting-select"
            >
              {Object.entries(groupFontsByCategory()).map(([group, fonts]) => (
                <optgroup key={group} label={group}>
                  {fonts.map(font => (
                    <option key={font.value} value={font.value}>
                      {font.label} {getFontSupportFlags(font)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {/* Font Size */}
        <div className="customization-row">
          <div className="row-label">
            <label>{t('videoRendering.fontSize', 'Font Size')}</label>
          </div>
          <div className="row-content">
            <div className="slider-control">
              <span className="slider-value">{customization.fontSize}px</span>
              <div className="volume-slider">
                <div className="custom-slider-track">
                  <div
                    className="custom-slider-fill"
                    style={{ width: `${((customization.fontSize - 12) / (72 - 12)) * 100}%` }}
                  ></div>
                </div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${((customization.fontSize - 12) / (72 - 12)) * 100}%` }}
                ></div>
                <input
                  type="range"
                  min="12"
                  max="72"
                  value={customization.fontSize}
                  onChange={(e) => updateCustomization({ fontSize: parseInt(e.target.value) })}
                  className="custom-slider-input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Font Weight */}
        <div className="customization-row">
          <div className="row-label">
            <label>{t('videoRendering.fontWeight', 'Font Weight')}</label>
          </div>
          <div className="row-content">
            <div className="slider-control">
              <span className="slider-value">{customization.fontWeight}</span>
              <div className="volume-slider">
                <div className="custom-slider-track">
                  <div
                    className="custom-slider-fill"
                    style={{ width: `${((customization.fontWeight - 100) / (900 - 100)) * 100}%` }}
                  ></div>
                </div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${((customization.fontWeight - 100) / (900 - 100)) * 100}%` }}
                ></div>
                <input
                  type="range"
                  min="100"
                  max="900"
                  step="100"
                  value={customization.fontWeight}
                  onChange={(e) => updateCustomization({ fontWeight: parseInt(e.target.value) })}
                  className="custom-slider-input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Text Color */}
        <div className="customization-row">
          <div className="row-label">
            <label>{t('videoRendering.textColor', 'Text Color')}</label>
          </div>
          <div className="row-content">
            <div className="color-control">
              <input
                type="color"
                value={customization.textColor}
                onChange={(e) => updateCustomization({ textColor: e.target.value })}
                className="color-picker"
              />
              <input
                type="text"
                value={customization.textColor}
                onChange={(e) => updateCustomization({ textColor: e.target.value })}
                placeholder="#ffffff"
                className="color-input"
              />
            </div>
          </div>
        </div>

        {/* Text Alignment */}
        <div className="customization-row">
          <div className="row-label">
            <label>{t('videoRendering.textAlign', 'Text Alignment')}</label>
          </div>
          <div className="row-content">
            <select
              value={customization.textAlign}
              onChange={(e) => updateCustomization({ textAlign: e.target.value })}
              className="setting-select"
            >
              <option value="left">{t('videoRendering.left', 'Left')}</option>
              <option value="center">{t('videoRendering.center', 'Center')}</option>
              <option value="right">{t('videoRendering.right', 'Right')}</option>
            </select>
          </div>
        </div>

        {/* Line Height */}
        <div className="customization-row">
          <div className="row-label">
            <label>{t('videoRendering.lineHeight', 'Line Height')}</label>
          </div>
          <div className="row-content">
            <div className="slider-control">
              <span className="slider-value">{customization.lineHeight}</span>
              <div className="volume-slider">
                <div className="custom-slider-track">
                  <div
                    className="custom-slider-fill"
                    style={{ width: `${((customization.lineHeight - 0.8) / (2.0 - 0.8)) * 100}%` }}
                  ></div>
                </div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${((customization.lineHeight - 0.8) / (2.0 - 0.8)) * 100}%` }}
                ></div>
                <input
                  type="range"
                  min="0.8"
                  max="2.0"
                  step="0.1"
                  value={customization.lineHeight}
                  onChange={(e) => updateCustomization({ lineHeight: parseFloat(e.target.value) })}
                  className="custom-slider-input"
                />
              </div>
            </div>
          </div>
        </div>

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
              <div className="volume-slider">
                <div className="custom-slider-track">
                  <div
                    className="custom-slider-fill"
                    style={{ width: `${customization.backgroundOpacity}%` }}
                  ></div>
                </div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${customization.backgroundOpacity}%` }}
                ></div>
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
              <div className="volume-slider">
                <div className="custom-slider-track">
                  <div
                    className="custom-slider-fill"
                    style={{ width: `${(customization.borderRadius / 50) * 100}%` }}
                  ></div>
                </div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${(customization.borderRadius / 50) * 100}%` }}
                ></div>
                <input
                  type="range"
                  min="0"
                  max="50"
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
              <div className="volume-slider">
                <div className="custom-slider-track">
                  <div
                    className="custom-slider-fill"
                    style={{ width: `${(customization.borderWidth / 10) * 100}%` }}
                  ></div>
                </div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${(customization.borderWidth / 10) * 100}%` }}
                ></div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={customization.borderWidth}
                  onChange={(e) => updateCustomization({ borderWidth: parseInt(e.target.value) })}
                  className="custom-slider-input"
                />
              </div>
            </div>
          </div>
        </div>

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

        {/* Max Width */}
        <div className="customization-row">
          <div className="row-label">
            <label>{t('videoRendering.maxWidth', 'Max Width')}</label>
          </div>
          <div className="row-content">
            <div className="slider-control">
              <span className="slider-value">{customization.maxWidth}%</span>
              <div className="volume-slider">
                <div className="custom-slider-track">
                  <div
                    className="custom-slider-fill"
                    style={{ width: `${((customization.maxWidth - 20) / (100 - 20)) * 100}%` }}
                  ></div>
                </div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${((customization.maxWidth - 20) / (100 - 20)) * 100}%` }}
                ></div>
                <input
                  type="range"
                  min="20"
                  max="100"
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
              <div className="volume-slider">
                <div className="custom-slider-track">
                  <div
                    className="custom-slider-fill"
                    style={{ width: `${(customization.marginBottom / 200) * 100}%` }}
                  ></div>
                </div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${(customization.marginBottom / 200) * 100}%` }}
                ></div>
                <input
                  type="range"
                  min="0"
                  max="200"
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
              <div className="volume-slider">
                <div className="custom-slider-track">
                  <div
                    className="custom-slider-fill"
                    style={{ width: `${(customization.marginTop / 200) * 100}%` }}
                  ></div>
                </div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${(customization.marginTop / 200) * 100}%` }}
                ></div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={customization.marginTop}
                  onChange={(e) => updateCustomization({ marginTop: parseInt(e.target.value) })}
                  className="custom-slider-input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Text Shadow */}
        <div className="customization-row">
          <div className="row-label">
            <label>{t('videoRendering.textShadow', 'Text Shadow')}</label>
          </div>
          <div className="row-content">
            <div className="toggle-control">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={customization.textShadowEnabled}
                  onChange={(e) => updateCustomization({ textShadowEnabled: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
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
                <div className="volume-slider">
                  <div className="custom-slider-track">
                    <div
                      className="custom-slider-fill"
                      style={{ width: `${(customization.textShadowBlur / 20) * 100}%` }}
                    ></div>
                  </div>
                  <div
                    className="custom-slider-thumb"
                    style={{ left: `${(customization.textShadowBlur / 20) * 100}%` }}
                  ></div>
                  <input
                    type="range"
                    min="0"
                    max="20"
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
                <div className="volume-slider">
                  <div className="custom-slider-track">
                    <div
                      className="custom-slider-fill"
                      style={{ width: `${((customization.textShadowOffsetY + 10) / 20) * 100}%` }}
                    ></div>
                  </div>
                  <div
                    className="custom-slider-thumb"
                    style={{ left: `${((customization.textShadowOffsetY + 10) / 20) * 100}%` }}
                  ></div>
                  <input
                    type="range"
                    min="-10"
                    max="10"
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
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={customization.glowEnabled}
                  onChange={(e) => updateCustomization({ glowEnabled: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
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
                <div className="volume-slider">
                  <div className="custom-slider-track">
                    <div
                      className="custom-slider-fill"
                      style={{ width: `${(customization.glowIntensity / 30) * 100}%` }}
                    ></div>
                  </div>
                  <div
                    className="custom-slider-thumb"
                    style={{ left: `${(customization.glowIntensity / 30) * 100}%` }}
                  ></div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    value={customization.glowIntensity}
                    onChange={(e) => updateCustomization({ glowIntensity: parseInt(e.target.value) })}
                    className="custom-slider-input"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

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
              <div className="volume-slider">
                <div className="custom-slider-track">
                  <div
                    className="custom-slider-fill"
                    style={{ width: `${((customization.fadeInDuration - 0.1) / (2.0 - 0.1)) * 100}%` }}
                  ></div>
                </div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${((customization.fadeInDuration - 0.1) / (2.0 - 0.1)) * 100}%` }}
                ></div>
                <input
                  type="range"
                  min="0.1"
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
              <div className="volume-slider">
                <div className="custom-slider-track">
                  <div
                    className="custom-slider-fill"
                    style={{ width: `${((customization.fadeOutDuration - 0.1) / (2.0 - 0.1)) * 100}%` }}
                  ></div>
                </div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${((customization.fadeOutDuration - 0.1) / (2.0 - 0.1)) * 100}%` }}
                ></div>
                <input
                  type="range"
                  min="0.1"
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
      </div>
    </div>
  );
};

export default SubtitleCustomizationPanel;
