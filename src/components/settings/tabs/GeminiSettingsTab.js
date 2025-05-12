import React from 'react';
import { useTranslation } from 'react-i18next';
import { ModelIcon } from '../icons/TabIcons';
import GeminiConcurrentClientsSettings from '../GeminiConcurrentClientsSettings';

/**
 * Component for Gemini-specific settings
 * @param {Object} props - Component props
 * @param {string} props.geminiModel - Current Gemini model
 * @param {Function} props.setGeminiModel - Function to set Gemini model
 * @returns {JSX.Element} - Rendered component
 */
const GeminiSettingsTab = ({
  geminiModel,
  setGeminiModel
}) => {
  const { t } = useTranslation();

  return (
    <div className="settings-section gemini-settings-section">
      <div className="video-processing-grid">
        {/* AI Model Card */}
        <div className="settings-card ai-model-card">
          <div className="settings-card-header">
            <div className="settings-card-icon">
              <ModelIcon />
            </div>
            <h4>{t('settings.modelSettings', 'AI Model')}</h4>
          </div>
          <div className="settings-card-content">
            <div className="compact-setting">
              <label htmlFor="gemini-model">
                {t('settings.geminiModel', 'Gemini Model')}
              </label>
              <p className="setting-description">
                {t('settings.geminiModelDescription', 'Select the Gemini model to use for transcription. Different models offer trade-offs between accuracy and speed.')}
              </p>
              <select
                id="gemini-model"
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className="enhanced-select"
              >
                <option value="gemini-2.5-pro-exp-03-25">
                  {t('settings.modelBestAccuracy', 'Gemini 2.5 Pro (Best accuracy, slowest, easily overloaded)')}
                </option>
                <option value="gemini-2.5-flash-preview-04-17">
                  {t('settings.modelSmartFast', 'Gemini 2.5 Flash (Smarter & faster, second best accuracy)')}
                </option>
                <option value="gemini-2.0-flash">
                  {t('settings.modelThirdBest', 'Gemini 2.0 Flash (Third best, acceptable accuracy, medium speed)')}
                </option>
                <option value="gemini-2.0-flash-lite">
                  {t('settings.modelFastest', 'Gemini 2.0 Flash Lite (Worst accuracy, fastest - for testing only)')}
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Narration Settings Card */}
        <div className="settings-card narration-settings-card">
          <div className="settings-card-header">
            <div className="settings-card-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor"/>
                <path d="M8 16l8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M16 16l-8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h4>{t('settings.narrationSettings', 'Narration Settings')}</h4>
          </div>
          <div className="settings-card-content">
            <GeminiConcurrentClientsSettings />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeminiSettingsTab;
