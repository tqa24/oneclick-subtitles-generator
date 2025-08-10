import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import StandardSlider from '../common/StandardSlider';
import { groupFontsByCategory, getFontSupportFlags } from './fontOptions';
import FontSelectionModal from './FontSelectionModal';
import { formatDecimal } from '../../utils/formatUtils';

const TextControls = ({ customization, onChange }) => {
  const { t } = useTranslation();
  const [isFontModalOpen, setIsFontModalOpen] = useState(false);

  const updateCustomization = (updates) => {
    onChange({ ...customization, ...updates, preset: 'custom' });
  };

  return (
    <>
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
            <StandardSlider
              value={customization.fontSize}
              onChange={(value) => updateCustomization({ fontSize: parseInt(value) })}
              min={8}
              max={120}
              step={1}
              orientation="Horizontal"
              size="XSmall"
              state="Enabled"
              showValueIndicator={false} // Using custom value display
              showIcon={false}
              showStops={false}
              className="font-size-slider"
              id="font-size-slider"
              ariaLabel={t('videoRendering.fontSize', 'Font Size')}
            />
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
            <StandardSlider
              value={customization.fontWeight}
              onChange={(value) => updateCustomization({ fontWeight: parseInt(value) })}
              min={100}
              max={900}
              step={100}
              orientation="Horizontal"
              size="XSmall"
              state="Enabled"
              showValueIndicator={false} // Using custom value display
              showIcon={false}
              showStops={false}
              className="font-weight-slider"
              id="font-weight-slider"
              ariaLabel={t('videoRendering.fontWeight', 'Font Weight')}
            />
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
            <span className="slider-value">{formatDecimal(customization.lineHeight, 1)}</span>
            <StandardSlider
              value={customization.lineHeight}
              onChange={(value) => updateCustomization({ lineHeight: formatDecimal(value, 1) })}
              min={0.5}
              max={3.0}
              step={0.1}
              orientation="Horizontal"
              size="XSmall"
              state="Enabled"
              showValueIndicator={false} // Using custom value display
              showIcon={false}
              showStops={false}
              className="line-height-slider"
              id="line-height-slider"
              ariaLabel={t('videoRendering.lineHeight', 'Line Height')}
            />
          </div>
        </div>
      </div>

      {/* Letter Spacing */}
      <div className="customization-row">
        <div className="row-label">
          <label>{t('videoRendering.letterSpacing', 'Letter Spacing')}</label>
        </div>
        <div className="row-content">
          <div className="slider-control">
            <span className="slider-value">{formatDecimal(customization.letterSpacing, 1)}px</span>
            <StandardSlider
              value={customization.letterSpacing}
              onChange={(value) => updateCustomization({ letterSpacing: formatDecimal(value, 1) })}
              min={-10}
              max={10}
              step={0.5}
              orientation="Horizontal"
              size="XSmall"
              state="Enabled"
              showValueIndicator={false} // Using custom value display
              showIcon={false}
              showStops={false}
              className="letter-spacing-slider"
              id="letter-spacing-slider"
              ariaLabel={t('videoRendering.letterSpacing', 'Letter Spacing')}
            />
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
            <option value="none">{t('videoRendering.none', 'None')}</option>
            <option value="uppercase">{t('videoRendering.uppercase', 'Uppercase')}</option>
            <option value="lowercase">{t('videoRendering.lowercase', 'Lowercase')}</option>
            <option value="capitalize">{t('videoRendering.capitalize', 'Capitalize')}</option>
          </select>
        </div>
      </div>

      {/* Font Modal */}
      {isFontModalOpen && (
        <FontSelectionModal
          isOpen={isFontModalOpen}
          onClose={() => setIsFontModalOpen(false)}
          onFontSelect={(fontFamily) => {
            updateCustomization({ fontFamily });
            setIsFontModalOpen(false);
          }}
          selectedFont={customization.fontFamily}
        />
      )}
    </>
  );
};

export default TextControls;
