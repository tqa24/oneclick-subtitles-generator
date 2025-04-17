import React from 'react';
import { useTranslation } from 'react-i18next';
import '../../styles/narration/narrationAdvancedSettingsRedesign.css';

/**
 * Narration Advanced Settings component - Redesigned with Material Design 3
 * @param {Object} props - Component props
 * @param {Object} props.settings - Advanced settings
 * @param {Function} props.onSettingsChange - Function to update settings
 * @param {boolean} props.disabled - Whether settings are disabled
 * @returns {JSX.Element} - Rendered component
 */
const NarrationAdvancedSettings = ({ settings, onSettingsChange, disabled = false }) => {
  const { t } = useTranslation();

  // Handle setting changes
  const handleSettingChange = (key, value) => {
    onSettingsChange({
      ...settings,
      [key]: value
    });
  };

  // Handle slider changes
  const handleSliderChange = (e) => {
    const { name, value } = e.target;
    handleSettingChange(name, parseFloat(value));
  };

  // Handle checkbox changes
  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    handleSettingChange(name, checked);
  };

  // Handle radio changes
  const handleRadioChange = (name, value) => {
    handleSettingChange(name, value);
  };

  return (
    <div className="advanced-settings">
      <div className="settings-grid">
        {/* Voice Style Controls */}
        <div className="settings-section">
          <h4 className="settings-section-title">
            {t('narration.voiceStyle', 'Voice Style')}
          </h4>

          <div className="narration-row">
            <div className="row-label">
              <label htmlFor="speechRate">{t('narration.speechRate', 'Speed')}:</label>
            </div>
            <div className="row-content">
              <div className="slider-container">
                <input
                  type="range"
                  id="speechRate"
                  name="speechRate"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={settings.speechRate || 1.0}
                  onChange={handleSliderChange}
                  disabled={disabled}
                  className="range-slider"
                />
                <div className="slider-value">{(settings.speechRate || 1.0).toFixed(1)}x</div>
              </div>
            </div>
          </div>
        </div>

        {/* Generation Quality Controls */}
        <div className="settings-section">
          <h4 className="settings-section-title">
            {t('narration.generationQuality', 'Quality')}
          </h4>

          <div className="narration-row">
            <div className="row-label">
              <label>{t('narration.nfeStep', 'Steps')}:</label>
            </div>
            <div className="row-content">
              <div className="radio-pill-group">
                {['8', '16', '32', '64'].map((value) => (
                  <div className="radio-pill" key={value}>
                    <input
                      type="radio"
                      id={`nfeStep-${value}`}
                      name="nfeStep"
                      checked={String(settings.nfeStep) === value}
                      onChange={() => handleRadioChange('nfeStep', value)}
                      disabled={disabled}
                    />
                    <label htmlFor={`nfeStep-${value}`}>{value}</label>
                  </div>
                ))}
              </div>
              <div className="setting-description">
                {t('narration.nfeStepDesc', 'Higher values improve quality but take longer')}
              </div>
            </div>
          </div>

          <div className="narration-row">
            <div className="row-label">
              <label htmlFor="cfgStrength">{t('narration.cfgStrength', 'Similarity')}:</label>
            </div>
            <div className="row-content">
              <div className="slider-container">
                <input
                  type="range"
                  id="cfgStrength"
                  name="cfgStrength"
                  min="1.0"
                  max="5.0"
                  step="0.1"
                  value={settings.cfgStrength || 2.0}
                  onChange={handleSliderChange}
                  disabled={disabled}
                  className="range-slider"
                />
                <div className="slider-value">{(settings.cfgStrength || 2.0).toFixed(1)}</div>
              </div>
              <div className="setting-description">
                {t('narration.cfgStrengthDesc', 'Higher values increase voice similarity')}
              </div>
            </div>
          </div>

          <div className="narration-row">
            <div className="row-label">
              <label htmlFor="swayCoef">{t('narration.swayCoef', 'Sway')}:</label>
            </div>
            <div className="row-content">
              <div className="slider-container">
                <input
                  type="range"
                  id="swayCoef"
                  name="swayCoef"
                  min="-2.0"
                  max="2.0"
                  step="0.1"
                  value={settings.swayCoef || -1.0}
                  onChange={handleSliderChange}
                  disabled={disabled}
                  className="range-slider"
                />
                <div className="slider-value">{(settings.swayCoef || -1.0).toFixed(1)}</div>
              </div>
              <div className="setting-description">
                {t('narration.swayCoefDesc', 'Lower values improve quality')}
              </div>
            </div>
          </div>
        </div>

        {/* Seed Control */}
        <div className="settings-section">
          <h4 className="settings-section-title">
            {t('narration.seedControl', 'Seed')}
          </h4>

          <div className="narration-row">
            <div className="row-label">
              <label>{t('narration.randomSeed', 'Random')}:</label>
            </div>
            <div className="row-content">
              <div className="switch-container">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.useRandomSeed !== false}
                    onChange={(e) => handleCheckboxChange(e)}
                    name="useRandomSeed"
                    disabled={disabled}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <span>{t('narration.useRandomSeed', 'Use random seed')}</span>
              </div>
            </div>
          </div>

          {settings.useRandomSeed === false && (
            <div className="narration-row">
              <div className="row-label">
                <label htmlFor="seed">{t('narration.seed', 'Value')}:</label>
              </div>
              <div className="row-content">
                <input
                  type="number"
                  id="seed"
                  name="seed"
                  value={settings.seed || 42}
                  onChange={(e) => handleSettingChange('seed', parseInt(e.target.value) || 0)}
                  disabled={disabled}
                  className="number-input"
                  min="0"
                  max="999999"
                />
              </div>
            </div>
          )}
        </div>

        {/* Audio Processing Options */}
        <div className="settings-section">
          <h4 className="settings-section-title">
            {t('narration.audioProcessing', 'Processing')}
          </h4>

          <div className="narration-row">
            <div className="row-label">
              <label>{t('narration.removeSilence', 'Silence')}:</label>
            </div>
            <div className="row-content">
              <div className="switch-container">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.removeSilence !== false}
                    onChange={(e) => handleCheckboxChange(e)}
                    name="removeSilence"
                    disabled={disabled}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <span>{t('narration.removeSilenceDesc', 'Remove silence')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Output Format Options */}
        <div className="settings-section">
          <h4 className="settings-section-title">
            {t('narration.outputFormat', 'Output')}
          </h4>

          <div className="narration-row">
            <div className="row-label">
              <label>{t('narration.sampleRate', 'Sample Rate')}:</label>
            </div>
            <div className="row-content">
              <div className="radio-pill-group">
                {['22050', '44100', '48000'].map((value) => (
                  <div className="radio-pill" key={value}>
                    <input
                      type="radio"
                      id={`sampleRate-${value}`}
                      name="sampleRate"
                      checked={String(settings.sampleRate) === value}
                      onChange={() => handleRadioChange('sampleRate', value)}
                      disabled={disabled}
                    />
                    <label htmlFor={`sampleRate-${value}`}>{value} Hz</label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="narration-row">
            <div className="row-label">
              <label>{t('narration.audioFormat', 'Format')}:</label>
            </div>
            <div className="row-content">
              <div className="radio-pill-group">
                {['wav', 'mp3'].map((value) => (
                  <div className="radio-pill" key={value}>
                    <input
                      type="radio"
                      id={`audioFormat-${value}`}
                      name="audioFormat"
                      checked={settings.audioFormat === value}
                      onChange={() => handleRadioChange('audioFormat', value)}
                      disabled={disabled || value !== 'wav'} // Only WAV is supported for now
                    />
                    <label htmlFor={`audioFormat-${value}`}>
                      {value.toUpperCase()}
                      {value !== 'wav' && (
                        <span className="unavailable-indicator">
                          {t('narration.comingSoon', '(soon)')}
                        </span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Batch Processing Options */}
        <div className="settings-section">
          <h4 className="settings-section-title">
            {t('narration.batchProcessing', 'Batch')}
          </h4>

          <div className="narration-row">
            <div className="row-label">
              <label>{t('narration.batchSize', 'Batch Size')}:</label>
            </div>
            <div className="row-content">
              <div className="radio-pill-group">
                {['5', '10', '20', 'all'].map((value) => (
                  <div className="radio-pill" key={value}>
                    <input
                      type="radio"
                      id={`batchSize-${value}`}
                      name="batchSize"
                      checked={settings.batchSize === value}
                      onChange={() => handleRadioChange('batchSize', value)}
                      disabled={disabled}
                    />
                    <label htmlFor={`batchSize-${value}`}>
                      {value === 'all' ? t('narration.all', 'All') : value}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="narration-row">
            <div className="row-label">
              <label>{t('narration.mergeOutput', 'Merge')}:</label>
            </div>
            <div className="row-content">
              <div className="switch-container">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.mergeOutput === true}
                    onChange={(e) => handleCheckboxChange(e)}
                    name="mergeOutput"
                    disabled={disabled || true} // Not implemented yet
                  />
                  <span className="toggle-slider"></span>
                </label>
                <span>
                  {t('narration.mergeOutputDesc', 'Combine all audio')}
                  <span className="unavailable-indicator">
                    {t('narration.comingSoon', '(soon)')}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NarrationAdvancedSettings;
