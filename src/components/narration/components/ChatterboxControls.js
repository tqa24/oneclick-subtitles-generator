import React from 'react';
import { useTranslation } from 'react-i18next';
import '../../../styles/narration/narrationAdvancedSettingsRedesign.css';

/**
 * Chatterbox Controls component for exaggeration and CFG weight sliders
 * @param {Object} props - Component props
 * @param {number} props.exaggeration - Current exaggeration value (0.25-2.0)
 * @param {Function} props.setExaggeration - Function to set exaggeration
 * @param {number} props.cfgWeight - Current CFG weight value (0.0-1.0)
 * @param {Function} props.setCfgWeight - Function to set CFG weight
 * @param {boolean} props.isGenerating - Whether generation is in progress
 * @returns {JSX.Element} - Rendered component
 */
const ChatterboxControls = ({
  exaggeration,
  setExaggeration,
  cfgWeight,
  setCfgWeight,
  isGenerating
}) => {
  const { t } = useTranslation();

  // Handle slider changes
  const handleExaggerationChange = (e) => {
    const value = parseFloat(e.target.value);
    setExaggeration(value);
    // Save to localStorage for persistence
    localStorage.setItem('chatterbox_exaggeration', value.toString());
  };

  const handleCfgWeightChange = (e) => {
    const value = parseFloat(e.target.value);
    setCfgWeight(value);
    // Save to localStorage for persistence
    localStorage.setItem('chatterbox_cfg_weight', value.toString());
  };

  // Calculate slider fill percentage
  const calculateFillPercentage = (value, min, max) => {
    return ((value - min) / (max - min)) * 100;
  };

  return (
    <div className="chatterbox-controls">
      {/* Exaggeration Slider */}
      <div className="narration-row chatterbox-control-row animated-row">
        <div className="row-label">
          <label htmlFor="chatterbox-exaggeration">{t('narration.exaggeration', 'Emotional Intensity')}:</label>
        </div>
        <div className="row-content">
          <div className="slider-with-value">
            <div className={`custom-slider-container ${isGenerating ? 'disabled' : ''}`}>
              <div className="custom-slider-track">
                <div
                  className="custom-slider-fill"
                  style={{ width: `${calculateFillPercentage(exaggeration, 0.25, 2.0)}%` }}
                ></div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${calculateFillPercentage(exaggeration, 0.25, 2.0)}%` }}
                ></div>
              </div>
              <input
                type="range"
                id="chatterbox-exaggeration"
                name="exaggeration"
                min="0.25"
                max="2.0"
                step="0.05"
                value={exaggeration}
                onChange={handleExaggerationChange}
                disabled={isGenerating}
                className="custom-slider-input"
                title={t('narration.exaggerationTooltip', 'Controls emotional intensity of the voice (0.25-2.0, neutral=0.5)')}
              />
            </div>
            <div className="slider-value-display">{exaggeration.toFixed(2)}</div>
          </div>
          <div className="setting-description">
            {t('narration.exaggerationDesc', 'Higher values increase emotional expression')}
          </div>
        </div>
      </div>

      {/* CFG Weight Slider */}
      <div className="narration-row chatterbox-control-row animated-row">
        <div className="row-label">
          <label htmlFor="chatterbox-cfg-weight">{t('narration.cfgWeight', 'Pace Control')}:</label>
        </div>
        <div className="row-content">
          <div className="slider-with-value">
            <div className={`custom-slider-container ${isGenerating ? 'disabled' : ''}`}>
              <div className="custom-slider-track">
                <div
                  className="custom-slider-fill"
                  style={{ width: `${calculateFillPercentage(cfgWeight, 0.0, 1.0)}%` }}
                ></div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${calculateFillPercentage(cfgWeight, 0.0, 1.0)}%` }}
                ></div>
              </div>
              <input
                type="range"
                id="chatterbox-cfg-weight"
                name="cfgWeight"
                min="0.0"
                max="1.0"
                step="0.05"
                value={cfgWeight}
                onChange={handleCfgWeightChange}
                disabled={isGenerating}
                className="custom-slider-input"
                title={t('narration.cfgWeightTooltip', 'Controls generation strength and pace (0.0-1.0)')}
              />
            </div>
            <div className="slider-value-display">{cfgWeight.toFixed(2)}</div>
          </div>
          <div className="setting-description">
            {t('narration.cfgWeightDesc', 'Adjusts generation strength and speaking pace')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatterboxControls;
