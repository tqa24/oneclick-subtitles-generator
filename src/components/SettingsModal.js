import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/SettingsModal.css';

const SettingsModal = ({ onClose, onSave, apiKeysSet }) => {
  const { t } = useTranslation();
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [youtubeApiKey, setYoutubeApiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showYoutubeKey, setShowYoutubeKey] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  
  // Load saved API keys on component mount
  useEffect(() => {
    const savedGeminiKey = localStorage.getItem('gemini_api_key') || '';
    const savedYoutubeKey = localStorage.getItem('youtube_api_key') || '';
    
    setGeminiApiKey(savedGeminiKey);
    setYoutubeApiKey(savedYoutubeKey);
  }, []);
  
  // Handle clear cache
  const handleClearCache = async () => {
    if (window.confirm(t('settings.confirmClearCache', 'Are you sure you want to clear all cached subtitles and videos? This cannot be undone.'))) {
      setClearingCache(true);
      try {
        const response = await fetch('http://localhost:3004/api/clear-cache', {
          method: 'DELETE'
        });
        
        const data = await response.json();
        if (data.success) {
          // Clear localStorage video/subtitle related items
          localStorage.removeItem('current_video_url');
          localStorage.removeItem('current_file_url');
          alert(t('settings.cacheClearedSuccess', 'Cache cleared successfully!'));
        } else {
          throw new Error(data.error || 'Failed to clear cache');
        }
      } catch (error) {
        console.error('Error clearing cache:', error);
        alert(t('settings.cacheClearError', 'Error clearing cache. Please try again.'));
      } finally {
        setClearingCache(false);
      }
    }
  };
  
  // Handle save button click
  const handleSave = () => {
    onSave(geminiApiKey, youtubeApiKey);
    onClose();
  };

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal">
        <div className="settings-header">
          <h2>{t('settings.title', 'Settings')}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        
        <div className="settings-content">
          <div className="settings-section api-key-section">
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
                  aria-label={showGeminiKey ? t('settings.hide') : t('settings.show')}
                >
                  {showGeminiKey ? t('settings.hide') : t('settings.show')}
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
                  aria-label={showYoutubeKey ? t('settings.hide') : t('settings.show')}
                >
                  {showYoutubeKey ? t('settings.hide') : t('settings.show')}
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
          
          <div className="settings-section cache-section">
            <h3>{t('settings.cache', 'Cache Management')}</h3>
            <p className="cache-description">
              {t('settings.cacheDescription', 'Clear all cached subtitles and downloaded videos to free up space.')}
            </p>
            <button 
              className="clear-cache-btn" 
              onClick={handleClearCache}
              disabled={clearingCache}
            >
              {clearingCache 
                ? t('settings.clearingCache', 'Clearing Cache...')
                : t('settings.clearCache', 'Clear Cache')}
            </button>
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