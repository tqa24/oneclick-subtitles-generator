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

  if (!isExpanded) {
    return (
      <div className="subtitle-customization-collapsed" onClick={onToggle}>
        <div className="collapsed-header">
          <span className="collapsed-icon">🎨</span>
          <span className="collapsed-title">{t('videoRendering.subtitleCustomization', 'Subtitle Customization')}</span>
          <span className="collapsed-preset">({customization.preset})</span>
          <span className="expand-arrow">▶</span>
        </div>
      </div>
    );
  }

  return (
    <div className="subtitle-customization-panel">
      <div className="panel-header" onClick={onToggle}>
        <span className="panel-icon">🎨</span>
        <span className="panel-title">{t('videoRendering.subtitleCustomization', 'Subtitle Customization')}</span>
        <span className="expand-arrow expanded">▼</span>
      </div>

      <div className="panel-content">
        {/* Style Presets */}
        <div className={`customization-section ${expandedSections.presets ? 'expanded' : ''}`}>
          <div className="section-header" onClick={() => toggleSection('presets')}>
            <span>📋 {t('videoRendering.stylePresets', 'Style Presets')}</span>
            <span>{expandedSections.presets ? '▼' : '▶'}</span>
          </div>
          {expandedSections.presets && (
            <div className="section-content">
              <div className="preset-grid">
                {['default', 'modern', 'classic', 'neon', 'minimal'].map(preset => (
                  <button
                    key={preset}
                    className={`preset-button ${customization.preset === preset ? 'active' : ''}`}
                    onClick={() => applyPreset(preset)}
                  >
                    {preset.charAt(0).toUpperCase() + preset.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Text Styling */}
        <div className={`customization-section ${expandedSections.text ? 'expanded' : ''}`}>
          <div className="section-header" onClick={() => toggleSection('text')}>
            <span>✏️ {t('videoRendering.textStyling', 'Text Styling')}</span>
            <span>{expandedSections.text ? '▼' : '▶'}</span>
          </div>
          {expandedSections.text && (
            <div className="section-content">
              <div className="control-row">
                <div className="control-item">
                  <label>{t('videoRendering.fontFamily', 'Font Family')}</label>
                  <select
                    value={customization.fontFamily}
                    onChange={(e) => updateCustomization({ fontFamily: e.target.value })}
                    className="font-family-select"
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
                <div className="control-item">
                  <label>{t('videoRendering.fontSize', 'Font Size')}: {customization.fontSize}px</label>
                  <input
                    type="range"
                    min="12"
                    max="72"
                    value={customization.fontSize}
                    onChange={(e) => updateCustomization({ fontSize: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="control-row">
                <div className="control-item">
                  <label>{t('videoRendering.fontWeight', 'Font Weight')}: {customization.fontWeight}</label>
                  <input
                    type="range"
                    min="100"
                    max="900"
                    step="100"
                    value={customization.fontWeight}
                    onChange={(e) => updateCustomization({ fontWeight: parseInt(e.target.value) })}
                  />
                </div>
                <div className="control-item">
                  <label>{t('videoRendering.textColor', 'Text Color')}</label>
                  <div className="color-input-group">
                    <input
                      type="color"
                      value={customization.textColor}
                      onChange={(e) => updateCustomization({ textColor: e.target.value })}
                    />
                    <input
                      type="text"
                      value={customization.textColor}
                      onChange={(e) => updateCustomization({ textColor: e.target.value })}
                      placeholder="#ffffff"
                    />
                  </div>
                </div>
              </div>

              <div className="control-row">
                <div className="control-item">
                  <label>{t('videoRendering.textAlign', 'Text Alignment')}</label>
                  <select
                    value={customization.textAlign}
                    onChange={(e) => updateCustomization({ textAlign: e.target.value })}
                  >
                    <option value="left">{t('videoRendering.left', 'Left')}</option>
                    <option value="center">{t('videoRendering.center', 'Center')}</option>
                    <option value="right">{t('videoRendering.right', 'Right')}</option>
                  </select>
                </div>
                <div className="control-item">
                  <label>{t('videoRendering.lineHeight', 'Line Height')}: {customization.lineHeight}</label>
                  <input
                    type="range"
                    min="0.8"
                    max="2.0"
                    step="0.1"
                    value={customization.lineHeight}
                    onChange={(e) => updateCustomization({ lineHeight: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Background & Border */}
        <div className={`customization-section ${expandedSections.background ? 'expanded' : ''}`}>
          <div className="section-header" onClick={() => toggleSection('background')}>
            <span>🎭 {t('videoRendering.backgroundBorder', 'Background & Border')}</span>
            <span>{expandedSections.background ? '▼' : '▶'}</span>
          </div>
          {expandedSections.background && (
            <div className="section-content">
              <div className="control-row">
                <div className="control-item">
                  <label>{t('videoRendering.backgroundColor', 'Background Color')}</label>
                  <div className="color-input-group">
                    <input
                      type="color"
                      value={customization.backgroundColor}
                      onChange={(e) => updateCustomization({ backgroundColor: e.target.value })}
                    />
                    <input
                      type="text"
                      value={customization.backgroundColor}
                      onChange={(e) => updateCustomization({ backgroundColor: e.target.value })}
                      placeholder="#000000"
                    />
                  </div>
                </div>
                <div className="control-item">
                  <label>{t('videoRendering.backgroundOpacity', 'Background Opacity')}: {customization.backgroundOpacity}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={customization.backgroundOpacity}
                    onChange={(e) => updateCustomization({ backgroundOpacity: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="control-row">
                <div className="control-item">
                  <label>{t('videoRendering.borderRadius', 'Border Radius')}: {customization.borderRadius}px</label>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={customization.borderRadius}
                    onChange={(e) => updateCustomization({ borderRadius: parseInt(e.target.value) })}
                  />
                </div>
                <div className="control-item">
                  <label>{t('videoRendering.borderWidth', 'Border Width')}: {customization.borderWidth}px</label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={customization.borderWidth}
                    onChange={(e) => updateCustomization({ borderWidth: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Position */}
        <div className={`customization-section ${expandedSections.position ? 'expanded' : ''}`}>
          <div className="section-header" onClick={() => toggleSection('position')}>
            <span>📍 {t('videoRendering.position', 'Position & Layout')}</span>
            <span>{expandedSections.position ? '▼' : '▶'}</span>
          </div>
          {expandedSections.position && (
            <div className="section-content">
              <div className="control-row">
                <div className="control-item">
                  <label>{t('videoRendering.position', 'Position')}</label>
                  <select
                    value={customization.position}
                    onChange={(e) => updateCustomization({ position: e.target.value })}
                  >
                    <option value="bottom">{t('videoRendering.bottom', 'Bottom')}</option>
                    <option value="top">{t('videoRendering.top', 'Top')}</option>
                    <option value="center">{t('videoRendering.center', 'Center')}</option>
                    <option value="custom">{t('videoRendering.custom', 'Custom')}</option>
                  </select>
                </div>
                <div className="control-item">
                  <label>{t('videoRendering.maxWidth', 'Max Width')}: {customization.maxWidth}%</label>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={customization.maxWidth}
                    onChange={(e) => updateCustomization({ maxWidth: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="control-row">
                <div className="control-item">
                  <label>{t('videoRendering.marginBottom', 'Margin Bottom')}: {customization.marginBottom}px</label>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={customization.marginBottom}
                    onChange={(e) => updateCustomization({ marginBottom: parseInt(e.target.value) })}
                  />
                </div>
                <div className="control-item">
                  <label>{t('videoRendering.marginTop', 'Margin Top')}: {customization.marginTop}px</label>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={customization.marginTop}
                    onChange={(e) => updateCustomization({ marginTop: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Effects */}
        <div className={`customization-section ${expandedSections.effects ? 'expanded' : ''}`}>
          <div className="section-header" onClick={() => toggleSection('effects')}>
            <span>✨ {t('videoRendering.effects', 'Effects')}</span>
            <span>{expandedSections.effects ? '▼' : '▶'}</span>
          </div>
          {expandedSections.effects && (
            <div className="section-content">
              {/* Text Shadow */}
              <div className="control-row">
                <div className="control-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={customization.textShadowEnabled}
                      onChange={(e) => updateCustomization({ textShadowEnabled: e.target.checked })}
                    />
                    {t('videoRendering.textShadow', 'Text Shadow')}
                  </label>
                </div>
                {customization.textShadowEnabled && (
                  <div className="control-item">
                    <label>{t('videoRendering.shadowColor', 'Shadow Color')}</label>
                    <input
                      type="color"
                      value={customization.textShadowColor}
                      onChange={(e) => updateCustomization({ textShadowColor: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {customization.textShadowEnabled && (
                <div className="control-row">
                  <div className="control-item">
                    <label>{t('videoRendering.shadowBlur', 'Shadow Blur')}: {customization.textShadowBlur}px</label>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={customization.textShadowBlur}
                      onChange={(e) => updateCustomization({ textShadowBlur: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="control-item">
                    <label>{t('videoRendering.shadowOffset', 'Shadow Offset')}: {customization.textShadowOffsetY}px</label>
                    <input
                      type="range"
                      min="-10"
                      max="10"
                      value={customization.textShadowOffsetY}
                      onChange={(e) => updateCustomization({ textShadowOffsetY: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              )}

              {/* Glow Effect */}
              <div className="control-row">
                <div className="control-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={customization.glowEnabled}
                      onChange={(e) => updateCustomization({ glowEnabled: e.target.checked })}
                    />
                    {t('videoRendering.glow', 'Glow Effect')}
                  </label>
                </div>
                {customization.glowEnabled && (
                  <div className="control-item">
                    <label>{t('videoRendering.glowColor', 'Glow Color')}</label>
                    <input
                      type="color"
                      value={customization.glowColor}
                      onChange={(e) => updateCustomization({ glowColor: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {customization.glowEnabled && (
                <div className="control-row">
                  <div className="control-item">
                    <label>{t('videoRendering.glowIntensity', 'Glow Intensity')}: {customization.glowIntensity}px</label>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={customization.glowIntensity}
                      onChange={(e) => updateCustomization({ glowIntensity: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Animation */}
        <div className={`customization-section ${expandedSections.animation ? 'expanded' : ''}`}>
          <div className="section-header" onClick={() => toggleSection('animation')}>
            <span>🎬 {t('videoRendering.animation', 'Animation & Transitions')}</span>
            <span>{expandedSections.animation ? '▼' : '▶'}</span>
          </div>
          {expandedSections.animation && (
            <div className="section-content">
              <div className="control-row">
                <div className="control-item">
                  <label>{t('videoRendering.animationType', 'Animation Type')}</label>
                  <select
                    value={customization.animationType}
                    onChange={(e) => updateCustomization({ animationType: e.target.value })}
                  >
                    {animationTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="control-item">
                  <label>{t('videoRendering.animationEasing', 'Animation Easing')}</label>
                  <select
                    value={customization.animationEasing}
                    onChange={(e) => updateCustomization({ animationEasing: e.target.value })}
                  >
                    {animationEasing.map(easing => (
                      <option key={easing.value} value={easing.value}>
                        {easing.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="control-row">
                <div className="control-item">
                  <label>{t('videoRendering.fadeInDuration', 'Fade In Duration')}: {customization.fadeInDuration}s</label>
                  <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.1"
                    value={customization.fadeInDuration}
                    onChange={(e) => updateCustomization({ fadeInDuration: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="control-item">
                  <label>{t('videoRendering.fadeOutDuration', 'Fade Out Duration')}: {customization.fadeOutDuration}s</label>
                  <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.1"
                    value={customization.fadeOutDuration}
                    onChange={(e) => updateCustomization({ fadeOutDuration: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubtitleCustomizationPanel;
