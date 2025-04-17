import React from 'react';
import { useTranslation } from 'react-i18next';
import '../../styles/narration/narrationAdvancedSettings.css';

/**
 * Advanced settings component for narration generation
 * @param {Object} props - Component props
 * @param {Object} props.settings - Current settings
 * @param {Function} props.onSettingsChange - Callback when settings change
 * @param {boolean} props.disabled - Whether controls are disabled
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

  // Handle select changes
  const handleSelectChange = (e) => {
    const { name, value } = e.target;
    handleSettingChange(name, value);
  };

  return (
    <div className="narration-advanced-settings">
      <h4 className="settings-section-title">
        {t('narration.advancedSettings', 'Advanced Settings')}
      </h4>

      {/* Voice Style Controls */}
      <div className="settings-group">
        <h5 className="settings-group-title">{t('narration.voiceStyle', 'Voice Style')}</h5>

        <div className="setting-row">
          <label htmlFor="speechRate">{t('narration.speechRate', 'Speech Rate')}:</label>
          <div className="slider-container">
            <input
              type="range"
              id="speechRate"
              name="speechRate"
              min="0.5"
              max="2.0"
              step="0.1"
              value={settings.speechRate}
              onChange={handleSliderChange}
              disabled={disabled}
            />
            <span className="slider-value">{settings.speechRate.toFixed(1)}x</span>
          </div>
        </div>
      </div>

      {/* Generation Quality Controls */}
      <div className="settings-group">
        <h5 className="settings-group-title">{t('narration.generationQuality', 'Generation Quality')}</h5>

        <div className="setting-row">
          <label htmlFor="nfeStep">{t('narration.nfeStep', 'NFE Steps')}:</label>
          <select
            id="nfeStep"
            name="nfeStep"
            value={settings.nfeStep}
            onChange={handleSelectChange}
            disabled={disabled}
          >
            <option value="8">{t('narration.nfeSteps.veryFast', 'Very Fast (8)')}</option>
            <option value="16">{t('narration.nfeSteps.fast', 'Fast (16)')}</option>
            <option value="32">{t('narration.nfeSteps.balanced', 'Balanced (32)')}</option>
            <option value="64">{t('narration.nfeSteps.highQuality', 'High Quality (64)')}</option>
          </select>
        </div>

        <div className="setting-row">
          <label htmlFor="swayCoef">{t('narration.swayCoef', 'Sway Sampling')}:</label>
          <div className="slider-container">
            <input
              type="range"
              id="swayCoef"
              name="swayCoef"
              min="-1.0"
              max="0.0"
              step="0.1"
              value={settings.swayCoef !== undefined ? settings.swayCoef : -1.0}
              onChange={handleSliderChange}
              disabled={disabled}
            />
            <span className="slider-value">{(settings.swayCoef !== undefined ? settings.swayCoef : -1.0).toFixed(1)}</span>
          </div>
          <div className="setting-description">
            {t('narration.swayCoefDesc', 'Lower values improve quality')}
          </div>
        </div>

        <div className="setting-row">
          <label htmlFor="cfgStrength">{t('narration.cfgStrength', 'Voice Similarity')}:</label>
          <div className="slider-container">
            <input
              type="range"
              id="cfgStrength"
              name="cfgStrength"
              min="1.0"
              max="5.0"
              step="0.5"
              value={settings.cfgStrength !== undefined ? settings.cfgStrength : 2.0}
              onChange={handleSliderChange}
              disabled={disabled}
            />
            <span className="slider-value">{(settings.cfgStrength !== undefined ? settings.cfgStrength : 2.0).toFixed(1)}</span>
          </div>
          <div className="setting-description">
            {t('narration.cfgStrengthDesc', 'Higher values increase voice similarity')}
          </div>
        </div>
      </div>

      {/* Seed Control */}
      <div className="settings-group">
        <h5 className="settings-group-title">{t('narration.seedControl', 'Seed Control')}</h5>

        <div className="setting-row checkbox-row">
          <label htmlFor="useRandomSeed">
            <input
              type="checkbox"
              id="useRandomSeed"
              name="useRandomSeed"
              checked={settings.useRandomSeed !== undefined ? settings.useRandomSeed : true}
              onChange={handleCheckboxChange}
              disabled={disabled}
            />
            {t('narration.useRandomSeed', 'Use Random Seed')}
          </label>
        </div>

        {!(settings.useRandomSeed !== undefined ? settings.useRandomSeed : true) && (
          <div className="setting-row">
            <label htmlFor="seed">{t('narration.seed', 'Seed Value')}:</label>
            <input
              type="number"
              id="seed"
              name="seed"
              value={settings.seed !== undefined ? settings.seed : 42}
              onChange={(e) => handleSettingChange('seed', parseInt(e.target.value) || 0)}
              disabled={disabled}
              min="0"
              max="999999999"
            />
          </div>
        )}
      </div>

      {/* Audio Processing Options */}
      <div className="settings-group">
        <h5 className="settings-group-title">{t('narration.audioProcessing', 'Audio Processing')}</h5>

        <div className="setting-row checkbox-row">
          <label htmlFor="removeSilence">
            <input
              type="checkbox"
              id="removeSilence"
              name="removeSilence"
              checked={settings.removeSilence}
              onChange={handleCheckboxChange}
              disabled={disabled}
            />
            {t('narration.removeSilence', 'Remove Silences')}
          </label>
        </div>
      </div>

      {/* Output Format Options */}
      <div className="settings-group">
        <h5 className="settings-group-title">{t('narration.outputFormat', 'Output Format')}</h5>

        <div className="setting-row">
          <label htmlFor="audioFormat">{t('narration.format', 'Format')}:</label>
          <select
            id="audioFormat"
            name="audioFormat"
            value={settings.audioFormat}
            onChange={handleSelectChange}
            disabled={disabled}
          >
            <option value="wav">{t('narration.formats.wav', 'WAV')}</option>
            <option value="mp3">{t('narration.formats.mp3', 'MP3')}</option>
          </select>
        </div>

        <div className="setting-row">
          <label htmlFor="sampleRate">{t('narration.sampleRate', 'Sample Rate')}:</label>
          <select
            id="sampleRate"
            name="sampleRate"
            value={settings.sampleRate}
            onChange={handleSelectChange}
            disabled={disabled}
          >
            <option value="22050">22.05 kHz</option>
            <option value="44100">44.1 kHz</option>
            <option value="48000">48 kHz</option>
          </select>
        </div>
      </div>

      {/* Batch Processing Options */}
      <div className="settings-group">
        <h5 className="settings-group-title">{t('narration.batchProcessing', 'Batch Processing')}</h5>

        <div className="setting-row">
          <label htmlFor="batchSize">{t('narration.batchSize', 'Batch Size')}:</label>
          <select
            id="batchSize"
            name="batchSize"
            value={settings.batchSize}
            onChange={handleSelectChange}
            disabled={disabled}
          >
            <option value="1">1</option>
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="all">{t('narration.all', 'All')}</option>
          </select>
        </div>

        <div className="setting-row checkbox-row">
          <label htmlFor="mergeOutput">
            <input
              type="checkbox"
              id="mergeOutput"
              name="mergeOutput"
              checked={settings.mergeOutput}
              onChange={handleCheckboxChange}
              disabled={disabled}
            />
            {t('narration.mergeOutput', 'Merge All Audio Files')}
          </label>
        </div>
      </div>
    </div>
  );
};

export default NarrationAdvancedSettings;
