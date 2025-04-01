import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/SettingsModal.css';

const SettingsModal = ({ onClose, onSave, apiKeysSet }) => {
  const { t } = useTranslation();
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [youtubeApiKey, setYoutubeApiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showYoutubeKey, setShowYoutubeKey] = useState(false);
  
  // Load saved API keys on component mount
  useEffect(() => {
    const savedGeminiKey = localStorage.getItem('gemini_api_key') || '';
    const savedYoutubeKey = localStorage.getItem('youtube_api_key') || '';
    
    setGeminiApiKey(savedGeminiKey);
    setYoutubeApiKey(savedYoutubeKey);
  }, []);
  
  // Handle save button click
  const handleSave = () => {
    onSave(geminiApiKey, youtubeApiKey);
    onClose();
  };
  
  // Generate masked version of API key
  const maskKey = (key) => {
    if (!key) return '';
    if (key.length <= 8) return '••••••••';
    
    return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
  };

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal">
        <div className="settings-header">
          <h2>{t('settings.title', 'Settings')}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        
        <div className="settings-content">
          <div className="api-key-section">
            <h3>{t('settings.apiKeys', 'API Keys')}</h3>
            
            <div className="api-key-input">
              <label htmlFor="gemini-api-key">
                {t('settings.geminiApiKey', 'Gemini API Key')}
                <span className={`api-key-status ${apiKeysSet.gemini ? 'set' : 'not-set'}`}>
                  {apiKeysSet.gemini 
                    ? t('settings.keySet', 'Set') 
                    : t('settings.keyNotSet', 'Not Set')}
                </span>
              </label>
              
              <div className="input-with-toggle">
                <input 
                  type={showGeminiKey ? "text" : "password"} 
                  id="gemini-api-key" 
                  value={geminiApiKey} 
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder={t('settings.geminiApiKeyPlaceholder', 'Enter your Gemini API key')}
                />
                <button 
                  type="button" 
                  className="toggle-visibility" 
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                >
                  {showGeminiKey ? '🙈' : '👁️'}
                </button>
              </div>
              
              <p className="api-key-help">
                {t('settings.geminiApiKeyHelp', 'Required for all functions. Get one at')} 
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  Google AI Studio
                </a>
              </p>
              <div className="api-key-instructions">
                <h4>{t('settings.getApiKey', 'Get Gemini API Key')}</h4>
                <ol>
                  <li>{t('settings.geminiStep1', 'Login to Google AI Studio')}</li>
                  <li>{t('settings.geminiStep2', 'Click \'Get API Key\'')}</li>
                  <li>{t('settings.geminiStep3', 'Create a new key or select existing')}</li>
                  <li>{t('settings.geminiStep4', 'Copy your API key')}</li>
                  <li>{t('settings.geminiStep5', 'Paste it into the field above')}</li>
                </ol>
              </div>
            </div>
            
            <div className="api-key-input">
              <label htmlFor="youtube-api-key">
                {t('settings.youtubeApiKey', 'YouTube API Key')}
                <span className={`api-key-status ${apiKeysSet.youtube ? 'set' : 'not-set'}`}>
                  {apiKeysSet.youtube 
                    ? t('settings.keySet', 'Set') 
                    : t('settings.keyNotSet', 'Not Set')}
                </span>
              </label>
              
              <div className="input-with-toggle">
                <input 
                  type={showYoutubeKey ? "text" : "password"} 
                  id="youtube-api-key" 
                  value={youtubeApiKey} 
                  onChange={(e) => setYoutubeApiKey(e.target.value)}
                  placeholder={t('settings.youtubeApiKeyPlaceholder', 'Enter your YouTube API key')}
                />
                <button 
                  type="button" 
                  className="toggle-visibility" 
                  onClick={() => setShowYoutubeKey(!showYoutubeKey)}
                >
                  {showYoutubeKey ? '🙈' : '👁️'}
                </button>
              </div>
              
              <p className="api-key-help">
                {t('settings.youtubeApiKeyHelp', 'Required for YouTube search. Get one at')} 
                <a 
                  href="https://console.cloud.google.com/apis/credentials" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  Google Cloud Console
                </a>
              </p>
              <div className="api-key-instructions">
                <h4>{t('settings.getYoutubeApiKey', 'Get YouTube API Key')}</h4>
                <ol>
                  <li>{t('settings.youtubeStep1', 'Go to Google Cloud Console')}</li>
                  <li>{t('settings.youtubeStep2', 'Create or select a project')}</li>
                  <li>{t('settings.youtubeStep3', 'Enable \'YouTube Data API v3\'')}</li>
                  <li>{t('settings.youtubeStep4', 'Go to credentials')}</li>
                  <li>{t('settings.youtubeStep5', 'Generate API key')}</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
        
        <div className="settings-footer">
          <button className="cancel-btn" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </button>
          <button className="save-btn" onClick={handleSave}>
            {t('common.save', 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;