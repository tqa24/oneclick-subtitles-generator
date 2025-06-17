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
import FontSelectionModal from './subtitleCustomization/FontSelectionModal';

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

  // Advanced gradient effects
  gradientEnabled: false,
  gradientType: 'linear',
  gradientDirection: '45deg',
  gradientColorStart: '#ffffff',
  gradientColorEnd: '#cccccc',
  gradientColorMid: '#eeeeee',

  // Advanced text effects
  strokeEnabled: false,
  strokeWidth: 2,
  strokeColor: '#000000',
  multiShadowEnabled: false,
  shadowLayers: 1,

  // Kinetic effects
  pulseEnabled: false,
  pulseSpeed: 1,
  shakeEnabled: false,
  shakeIntensity: 2,

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
  const [isFontModalOpen, setIsFontModalOpen] = useState(false);

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
        fontFamily: "'Roboto', sans-serif",
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
        fontFamily: "'Times New Roman', serif",
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
        fontFamily: "'Arial', sans-serif",
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
        fontFamily: "'Helvetica', sans-serif",
        fontSize: 26,
        fontWeight: 300,
        backgroundColor: 'transparent',
        backgroundOpacity: 0,
        borderRadius: 0,
        textShadowEnabled: true,
        textShadowColor: '#000000',
        textShadowBlur: 8,
        preset: 'minimal'
      },
      gaming: {
        ...defaultCustomization,
        fontFamily: "'Audiowide', cursive",
        fontSize: 36,
        fontWeight: 700,
        textColor: '#ff6b35',
        backgroundColor: '#0a0a0a',
        backgroundOpacity: 85,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#ff6b35',
        borderStyle: 'solid',
        glowEnabled: true,
        glowColor: '#ff6b35',
        glowIntensity: 12,
        strokeEnabled: true,
        strokeWidth: 1,
        strokeColor: '#000000',
        animationType: 'bounce',
        preset: 'gaming'
      },
      cinematic: {
        ...defaultCustomization,
        fontFamily: "'Playfair Display', serif",
        fontSize: 32,
        fontWeight: 400,
        textColor: '#f5f5dc',
        backgroundColor: '#1c1c1c',
        backgroundOpacity: 75,
        borderRadius: 2,
        textShadowEnabled: true,
        textShadowColor: '#000000',
        textShadowBlur: 8,
        textShadowOffsetY: 3,
        letterSpacing: 1,
        lineHeight: 1.4,
        preset: 'cinematic'
      },
      gradient: {
        ...defaultCustomization,
        fontFamily: "'Montserrat', sans-serif",
        fontSize: 34,
        fontWeight: 600,
        gradientEnabled: true,
        gradientType: 'linear',
        gradientDirection: '45deg',
        gradientColorStart: '#ff6b6b',
        gradientColorEnd: '#4ecdc4',
        backgroundColor: '#000000',
        backgroundOpacity: 60,
        borderRadius: 8,
        textShadowEnabled: true,
        textShadowColor: '#000000',
        textShadowBlur: 6,
        preset: 'gradient'
      },
      retro: {
        ...defaultCustomization,
        fontFamily: "'Press Start 2P', cursive",
        fontSize: 24,
        fontWeight: 700,
        textColor: '#00ff41',
        backgroundColor: '#000000',
        backgroundOpacity: 90,
        borderRadius: 0,
        textShadowEnabled: true,
        textShadowColor: '#00ff41',
        textShadowBlur: 10,
        glowEnabled: true,
        glowColor: '#00ff41',
        glowIntensity: 8,
        letterSpacing: 2,
        textTransform: 'uppercase',
        preset: 'retro'
      },
      elegant: {
        ...defaultCustomization,
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 30,
        fontWeight: 300,
        textColor: '#ffffff',
        backgroundColor: 'transparent',
        backgroundOpacity: 0,
        borderRadius: 0,
        textShadowEnabled: true,
        textShadowColor: '#000000',
        textShadowBlur: 12,
        textShadowOffsetY: 2,
        letterSpacing: 0.5,
        lineHeight: 1.5,
        strokeEnabled: true,
        strokeWidth: 1,
        strokeColor: '#333333',
        preset: 'elegant'
      },
      cyberpunk: {
        ...defaultCustomization,
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 38,
        fontWeight: 700,
        textColor: '#ff0080',
        backgroundColor: '#000000',
        backgroundOpacity: 95,
        borderRadius: 0,
        borderWidth: 3,
        borderColor: '#ff0080',
        glowEnabled: true,
        glowColor: '#ff0080',
        glowIntensity: 25,
        textShadowEnabled: true,
        textShadowColor: '#ff0080',
        textShadowBlur: 15,
        letterSpacing: 3,
        textTransform: 'uppercase',
        preset: 'cyberpunk'
      },
      vintage: {
        ...defaultCustomization,
        fontFamily: "'Playfair Display', serif",
        fontSize: 32,
        fontWeight: 400,
        textColor: '#f4e4bc',
        backgroundColor: '#8b4513',
        backgroundOpacity: 85,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: '#daa520',
        textShadowEnabled: true,
        textShadowColor: '#654321',
        textShadowBlur: 8,
        letterSpacing: 1,
        preset: 'vintage'
      },
      comic: {
        ...defaultCustomization,
        fontFamily: "'Bangers', cursive",
        fontSize: 36,
        fontWeight: 400,
        textColor: '#ffffff',
        backgroundColor: '#ff6b35',
        backgroundOpacity: 90,
        borderRadius: 20,
        borderWidth: 4,
        borderColor: '#000000',
        strokeEnabled: true,
        strokeWidth: 3,
        strokeColor: '#000000',
        textShadowEnabled: true,
        textShadowColor: '#ff0000',
        textShadowBlur: 5,
        preset: 'comic'
      },
      horror: {
        ...defaultCustomization,
        fontFamily: "'Nosifer', cursive",
        fontSize: 34,
        fontWeight: 400,
        textColor: '#8b0000',
        backgroundColor: '#000000',
        backgroundOpacity: 95,
        borderRadius: 5,
        glowEnabled: true,
        glowColor: '#8b0000',
        glowIntensity: 30,
        textShadowEnabled: true,
        textShadowColor: '#ff0000',
        textShadowBlur: 20,
        textShadowOffsetY: 5,
        letterSpacing: 2,
        preset: 'horror'
      },
      luxury: {
        ...defaultCustomization,
        fontFamily: "'Playfair Display', serif",
        fontSize: 35,
        fontWeight: 400,
        textColor: '#ffd700',
        backgroundColor: '#1a1a1a',
        backgroundOpacity: 80,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ffd700',
        textShadowEnabled: true,
        textShadowColor: '#000000',
        textShadowBlur: 10,
        letterSpacing: 2,
        lineHeight: 1.4,
        preset: 'luxury'
      },
      kawaii: {
        ...defaultCustomization,
        fontFamily: "'Comfortaa', cursive",
        fontSize: 30,
        fontWeight: 600,
        textColor: '#ff69b4',
        backgroundColor: '#ffffff',
        backgroundOpacity: 85,
        borderRadius: 25,
        borderWidth: 3,
        borderColor: '#ff69b4',
        textShadowEnabled: true,
        textShadowColor: '#ffb6c1',
        textShadowBlur: 8,
        preset: 'kawaii'
      },
      grunge: {
        ...defaultCustomization,
        fontFamily: "'Righteous', cursive",
        fontSize: 32,
        fontWeight: 400,
        textColor: '#ffffff',
        backgroundColor: '#2f2f2f',
        backgroundOpacity: 90,
        borderRadius: 0,
        strokeEnabled: true,
        strokeWidth: 2,
        strokeColor: '#000000',
        textShadowEnabled: true,
        textShadowColor: '#000000',
        textShadowBlur: 15,
        textShadowOffsetY: 3,
        letterSpacing: 1,
        preset: 'grunge'
      },
      corporate: {
        ...defaultCustomization,
        fontFamily: "'Open Sans', sans-serif",
        fontSize: 28,
        fontWeight: 400,
        textColor: '#2c3e50',
        backgroundColor: '#ecf0f1',
        backgroundOpacity: 90,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#bdc3c7',
        textShadowEnabled: false,
        letterSpacing: 0.5,
        lineHeight: 1.3,
        preset: 'corporate'
      },
      anime: {
        ...defaultCustomization,
        fontFamily: "'Nunito', sans-serif",
        fontSize: 32,
        fontWeight: 700,
        textColor: '#ffffff',
        backgroundColor: '#ff6b9d',
        backgroundOpacity: 85,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: '#ffffff',
        strokeEnabled: true,
        strokeWidth: 1,
        strokeColor: '#ff1493',
        textShadowEnabled: true,
        textShadowColor: '#ff1493',
        textShadowBlur: 8,
        preset: 'anime'
      },
      vaporwave: {
        ...defaultCustomization,
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 34,
        fontWeight: 300,
        gradientEnabled: true,
        gradientColorStart: '#ff00ff',
        gradientColorEnd: '#00ffff',
        gradientDirection: '45deg',
        backgroundColor: '#1a0033',
        backgroundOpacity: 90,
        borderRadius: 0,
        glowEnabled: true,
        glowColor: '#ff00ff',
        glowIntensity: 20,
        letterSpacing: 4,
        textTransform: 'uppercase',
        preset: 'vaporwave'
      },
      steampunk: {
        ...defaultCustomization,
        fontFamily: "'Cinzel', serif",
        fontSize: 30,
        fontWeight: 600,
        textColor: '#cd853f',
        backgroundColor: '#2f1b14',
        backgroundOpacity: 90,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#8b4513',
        textShadowEnabled: true,
        textShadowColor: '#000000',
        textShadowBlur: 12,
        letterSpacing: 1,
        preset: 'steampunk'
      },
      noir: {
        ...defaultCustomization,
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 36,
        fontWeight: 400,
        textColor: '#ffffff',
        backgroundColor: '#000000',
        backgroundOpacity: 95,
        borderRadius: 0,
        textShadowEnabled: true,
        textShadowColor: '#333333',
        textShadowBlur: 20,
        textShadowOffsetY: 8,
        letterSpacing: 3,
        textTransform: 'uppercase',
        preset: 'noir'
      },
      pastel: {
        ...defaultCustomization,
        fontFamily: "'Quicksand', sans-serif",
        fontSize: 28,
        fontWeight: 500,
        textColor: '#6b5b95',
        backgroundColor: '#f8f8ff',
        backgroundOpacity: 85,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#dda0dd',
        textShadowEnabled: true,
        textShadowColor: '#e6e6fa',
        textShadowBlur: 6,
        preset: 'pastel'
      },
      bold: {
        ...defaultCustomization,
        fontFamily: "'Anton', sans-serif",
        fontSize: 42,
        fontWeight: 400,
        textColor: '#ffffff',
        backgroundColor: '#000000',
        backgroundOpacity: 90,
        borderRadius: 5,
        strokeEnabled: true,
        strokeWidth: 4,
        strokeColor: '#ff0000',
        textShadowEnabled: true,
        textShadowColor: '#ff0000',
        textShadowBlur: 10,
        letterSpacing: 2,
        textTransform: 'uppercase',
        preset: 'bold'
      },
      sketch: {
        ...defaultCustomization,
        fontFamily: "'Kalam', cursive",
        fontSize: 30,
        fontWeight: 400,
        textColor: '#2c3e50',
        backgroundColor: '#ffffff',
        backgroundOpacity: 80,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#34495e',
        strokeEnabled: true,
        strokeWidth: 1,
        strokeColor: '#7f8c8d',
        preset: 'sketch'
      },
      glitch: {
        ...defaultCustomization,
        fontFamily: "'Courier New', monospace",
        fontSize: 32,
        fontWeight: 700,
        textColor: '#00ff00',
        backgroundColor: '#000000',
        backgroundOpacity: 95,
        borderRadius: 0,
        glowEnabled: true,
        glowColor: '#00ff00',
        glowIntensity: 35,
        textShadowEnabled: true,
        textShadowColor: '#ff0000',
        textShadowBlur: 8,
        textShadowOffsetY: 2,
        letterSpacing: 3,
        textTransform: 'uppercase',
        preset: 'glitch'
      },
      royal: {
        ...defaultCustomization,
        fontFamily: "'Cinzel', serif",
        fontSize: 34,
        fontWeight: 600,
        textColor: '#ffd700',
        backgroundColor: '#4b0082',
        backgroundOpacity: 90,
        borderRadius: 10,
        borderWidth: 3,
        borderColor: '#ffd700',
        textShadowEnabled: true,
        textShadowColor: '#000000',
        textShadowBlur: 15,
        letterSpacing: 2,
        lineHeight: 1.4,
        preset: 'royal'
      },
      sunset: {
        ...defaultCustomization,
        fontFamily: "'Poppins', sans-serif",
        fontSize: 32,
        fontWeight: 500,
        gradientEnabled: true,
        gradientColorStart: '#ff7e5f',
        gradientColorEnd: '#feb47b',
        gradientDirection: '135deg',
        backgroundColor: '#2c1810',
        backgroundOpacity: 75,
        borderRadius: 15,
        textShadowEnabled: true,
        textShadowColor: '#8b4513',
        textShadowBlur: 10,
        preset: 'sunset'
      },
      ocean: {
        ...defaultCustomization,
        fontFamily: "'Merriweather', serif",
        fontSize: 30,
        fontWeight: 400,
        gradientEnabled: true,
        gradientColorStart: '#667eea',
        gradientColorEnd: '#764ba2',
        gradientDirection: '90deg',
        backgroundColor: '#1e3c72',
        backgroundOpacity: 80,
        borderRadius: 12,
        textShadowEnabled: true,
        textShadowColor: '#0f1419',
        textShadowBlur: 8,
        preset: 'ocean'
      },
      forest: {
        ...defaultCustomization,
        fontFamily: "'Lora', serif",
        fontSize: 28,
        fontWeight: 400,
        textColor: '#90ee90',
        backgroundColor: '#2d5016',
        backgroundOpacity: 85,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#228b22',
        textShadowEnabled: true,
        textShadowColor: '#006400',
        textShadowBlur: 12,
        letterSpacing: 0.5,
        preset: 'forest'
      }
    };

    const presetConfig = presets[preset] || presets.default;
    onChange({ ...customization, ...presetConfig });
  };

  return (
    <div className="subtitle-customization-panel">
      <div className="panel-content">
        {/* Style Presets - using translation-section row pattern */}
        <div className="customization-row preset-row">
          <div className="preset-buttons">
            {['default', 'modern', 'classic', 'neon', 'minimal', 'gaming', 'cinematic', 'gradient', 'retro', 'elegant', 'cyberpunk', 'vintage', 'comic', 'horror', 'luxury', 'kawaii', 'grunge', 'corporate', 'anime', 'vaporwave', 'steampunk', 'noir', 'pastel', 'bold', 'sketch', 'glitch', 'royal', 'sunset', 'ocean', 'forest'].map(preset => (
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

        {/* Font Family */}
        <div className="customization-row">
          <div className="row-label">
            <label>{t('videoRendering.fontFamily', 'Font Family')}</label>
          </div>
          <div className="row-content">
            <button
              className="font-selector-button"
              onClick={() => setIsFontModalOpen(true)}
            >
              <div className="font-selector-preview">
                <span
                  className="font-name"
                  style={{ fontFamily: customization.fontFamily }}
                >
                  {(() => {
                    const currentFont = Object.values(groupFontsByCategory())
                      .flat()
                      .find(font => font.value === customization.fontFamily);
                    return currentFont?.label || 'Select Font';
                  })()}
                </span>
                <span className="font-flags">
                  {(() => {
                    const currentFont = Object.values(groupFontsByCategory())
                      .flat()
                      .find(font => font.value === customization.fontFamily);
                    return currentFont ? getFontSupportFlags(currentFont) : '';
                  })()}
                </span>
              </div>
            </button>
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
                    style={{ width: `${((customization.fontSize - 8) / (120 - 8)) * 100}%` }}
                  ></div>
                </div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${((customization.fontSize - 8) / (120 - 8)) * 100}%` }}
                ></div>
                <input
                  type="range"
                  min="8"
                  max="120"
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
                    style={{ width: `${((customization.lineHeight - 0.5) / (3.0 - 0.5)) * 100}%` }}
                  ></div>
                </div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${((customization.lineHeight - 0.5) / (3.0 - 0.5)) * 100}%` }}
                ></div>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
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
                    style={{ width: `${(customization.borderRadius / 100) * 100}%` }}
                  ></div>
                </div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${(customization.borderRadius / 100) * 100}%` }}
                ></div>
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
              <div className="volume-slider">
                <div className="custom-slider-track">
                  <div
                    className="custom-slider-fill"
                    style={{ width: `${(customization.borderWidth / 20) * 100}%` }}
                  ></div>
                </div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${(customization.borderWidth / 20) * 100}%` }}
                ></div>
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
                    style={{ width: `${((customization.maxWidth - 10) / (150 - 10)) * 100}%` }}
                  ></div>
                </div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${((customization.maxWidth - 10) / (150 - 10)) * 100}%` }}
                ></div>
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
              <div className="volume-slider">
                <div className="custom-slider-track">
                  <div
                    className="custom-slider-fill"
                    style={{ width: `${(customization.marginBottom / 400) * 100}%` }}
                  ></div>
                </div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${(customization.marginBottom / 400) * 100}%` }}
                ></div>
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
              <div className="volume-slider">
                <div className="custom-slider-track">
                  <div
                    className="custom-slider-fill"
                    style={{ width: `${(customization.marginTop / 400) * 100}%` }}
                  ></div>
                </div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${(customization.marginTop / 400) * 100}%` }}
                ></div>
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
                      style={{ width: `${(customization.textShadowBlur / 50) * 100}%` }}
                    ></div>
                  </div>
                  <div
                    className="custom-slider-thumb"
                    style={{ left: `${(customization.textShadowBlur / 50) * 100}%` }}
                  ></div>
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
                <div className="volume-slider">
                  <div className="custom-slider-track">
                    <div
                      className="custom-slider-fill"
                      style={{ width: `${((customization.textShadowOffsetY + 25) / 50) * 100}%` }}
                    ></div>
                  </div>
                  <div
                    className="custom-slider-thumb"
                    style={{ left: `${((customization.textShadowOffsetY + 25) / 50) * 100}%` }}
                  ></div>
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
                      style={{ width: `${(customization.glowIntensity / 100) * 100}%` }}
                    ></div>
                  </div>
                  <div
                    className="custom-slider-thumb"
                    style={{ left: `${(customization.glowIntensity / 100) * 100}%` }}
                  ></div>
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
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={customization.gradientEnabled}
                  onChange={(e) => updateCustomization({ gradientEnabled: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
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
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={customization.strokeEnabled}
                  onChange={(e) => updateCustomization({ strokeEnabled: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
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
                <div className="volume-slider">
                  <div className="custom-slider-track">
                    <div
                      className="custom-slider-fill"
                      style={{ width: `${(customization.strokeWidth / 10) * 100}%` }}
                    ></div>
                  </div>
                  <div
                    className="custom-slider-thumb"
                    style={{ left: `${(customization.strokeWidth / 10) * 100}%` }}
                  ></div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={customization.strokeWidth}
                    onChange={(e) => updateCustomization({ strokeWidth: parseFloat(e.target.value) })}
                    className="custom-slider-input"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Letter Spacing */}
        <div className="customization-row">
          <div className="row-label">
            <label>{t('videoRendering.letterSpacing', 'Letter Spacing')}</label>
          </div>
          <div className="row-content">
            <div className="slider-control">
              <span className="slider-value">{customization.letterSpacing}px</span>
              <div className="volume-slider">
                <div className="custom-slider-track">
                  <div
                    className="custom-slider-fill"
                    style={{ width: `${((customization.letterSpacing + 10) / 20) * 100}%` }}
                  ></div>
                </div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${((customization.letterSpacing + 10) / 20) * 100}%` }}
                ></div>
                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="0.5"
                  value={customization.letterSpacing}
                  onChange={(e) => updateCustomization({ letterSpacing: parseFloat(e.target.value) })}
                  className="custom-slider-input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Text Transform */}
        <div className="customization-row">
          <div className="row-label">
            <label>{t('videoRendering.textTransform', 'Text Transform')}</label>
          </div>
          <div className="row-content">
            <select
              value={customization.textTransform}
              onChange={(e) => updateCustomization({ textTransform: e.target.value })}
              className="setting-select"
            >
              <option value="none">Normal</option>
              <option value="uppercase">UPPERCASE</option>
              <option value="lowercase">lowercase</option>
              <option value="capitalize">Capitalize</option>
            </select>
          </div>
        </div>

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
                    style={{ width: `${((customization.fadeInDuration - 0.0) / (5.0 - 0.0)) * 100}%` }}
                  ></div>
                </div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${((customization.fadeInDuration - 0.0) / (5.0 - 0.0)) * 100}%` }}
                ></div>
                <input
                  type="range"
                  min="0.0"
                  max="5.0"
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
                    style={{ width: `${((customization.fadeOutDuration - 0.0) / (5.0 - 0.0)) * 100}%` }}
                  ></div>
                </div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${((customization.fadeOutDuration - 0.0) / (5.0 - 0.0)) * 100}%` }}
                ></div>
                <input
                  type="range"
                  min="0.0"
                  max="5.0"
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

      {/* Font Selection Modal */}
      <FontSelectionModal
        isOpen={isFontModalOpen}
        onClose={() => setIsFontModalOpen(false)}
        selectedFont={customization.fontFamily}
        onFontSelect={(fontFamily) => updateCustomization({ fontFamily })}
      />
    </div>
  );
};

export default SubtitleCustomizationPanel;
