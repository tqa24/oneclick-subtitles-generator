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
  const [segmentDuration, setSegmentDuration] = useState(5); // Default to 5 minutes
  const [geminiModel, setGeminiModel] = useState('gemini-2.0-flash'); // Default model
  const [timeFormat, setTimeFormat] = useState('hms'); // Default to HH:MM:SS format
  const [cacheDetails, setCacheDetails] = useState(null); // Store cache deletion details
  const [cacheStatus, setCacheStatus] = useState({ message: '', type: '' }); // Status message for cache operations

  // Load saved settings on component mount
  useEffect(() => {
    const savedGeminiKey = localStorage.getItem('gemini_api_key') || '';
    const savedYoutubeKey = localStorage.getItem('youtube_api_key') || '';
    const savedSegmentDuration = parseInt(localStorage.getItem('segment_duration') || '5');
    const savedGeminiModel = localStorage.getItem('gemini_model') || 'gemini-2.0-flash';
    const savedTimeFormat = localStorage.getItem('time_format') || 'hms';

    setGeminiApiKey(savedGeminiKey);
    setYoutubeApiKey(savedYoutubeKey);
    setSegmentDuration(savedSegmentDuration);
    setGeminiModel(savedGeminiModel);
    setTimeFormat(savedTimeFormat);
  }, []);

  // Handle clear cache
  const handleClearCache = async () => {
    // No confirmation prompt as requested
    setClearingCache(true);
    setCacheDetails(null); // Reset previous details
    setCacheStatus({ message: '', type: '' }); // Reset status message

    try {
      const response = await fetch('http://localhost:3004/api/clear-cache', {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        // Clear localStorage video/subtitle related items
        localStorage.removeItem('current_video_url');
        localStorage.removeItem('current_file_url');

        // Check if details exist in the response
        if (data.details) {
          // Store the cache details for display
          setCacheDetails(data.details);

          // Set success message with details
          const totalFiles = data.details.totalCount || 0;
          const totalSize = data.details.formattedTotalSize || '0 Bytes';
          setCacheStatus({
            message: t('settings.cacheClearedDetails', 'Cache cleared: {{totalFiles}} files ({{totalSize}})', { totalFiles, totalSize }),
            type: 'success'
          });
        } else {
          // Fallback for when details are missing
          setCacheStatus({
            message: t('settings.cacheClearedSuccess', 'Cache cleared successfully!'),
            type: 'success'
          });
        }
      } else {
        throw new Error(data.error || 'Failed to clear cache');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      setCacheStatus({
        message: t('settings.cacheClearError', 'Error clearing cache: {{errorMessage}}', { errorMessage: error.message }),
        type: 'error'
      });
    } finally {
      setClearingCache(false);
    }
  };

  // Handle save button click
  const handleSave = () => {
    // Save settings to localStorage
    localStorage.setItem('segment_duration', segmentDuration.toString());
    localStorage.setItem('gemini_model', geminiModel);
    localStorage.setItem('time_format', timeFormat);

    // Notify parent component about API keys, segment duration, model, and time format
    onSave(geminiApiKey, youtubeApiKey, segmentDuration, geminiModel, timeFormat);
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

          <div className="settings-section video-processing-section">
            <h3>{t('settings.videoProcessing', 'Video Processing')}</h3>
            <div className="segment-duration-setting">
              <label htmlFor="segment-duration">
                {t('settings.segmentDuration', 'Segment Duration (minutes)')}
              </label>
              <p className="setting-description">
                {t('settings.segmentDurationDescription', 'Choose how long each video segment should be when processing long videos. Shorter segments process faster but may be less accurate.')}
              </p>
              <select
                id="segment-duration"
                value={segmentDuration}
                onChange={(e) => setSegmentDuration(parseInt(e.target.value))}
                className="segment-duration-select"
              >
                <option value="3">3 {t('settings.minutes', 'minutes')}</option>
                <option value="5">5 {t('settings.minutes', 'minutes')}</option>
                <option value="10">10 {t('settings.minutes', 'minutes')}</option>
                <option value="15">15 {t('settings.minutes', 'minutes')}</option>
                <option value="20">20 {t('settings.minutes', 'minutes')}</option>
                <option value="30">30 {t('settings.minutes', 'minutes')}</option>
                <option value="45">45 {t('settings.minutes', 'minutes')}</option>
              </select>
            </div>

            <div className="gemini-model-setting">
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
                className="gemini-model-select"
              >
                <option value="gemini-2.5-pro-exp-03-25">
                  {t('settings.modelBestAccuracy', 'Gemini 2.5 Pro (Best accuracy, slowest, easily overloaded)')}
                </option>
                <option value="gemini-2.0-flash-thinking-exp-01-21">
                  {t('settings.modelSecondBest', 'Gemini 2.0 Flash Thinking (Second best, high accuracy, slowest)')}
                </option>
                <option value="gemini-2.0-flash">
                  {t('settings.modelThirdBest', 'Gemini 2.0 Flash (Third best, acceptable accuracy, medium speed)')}
                </option>
                <option value="gemini-2.0-flash-lite">
                  {t('settings.modelFastest', 'Gemini 2.0 Flash Lite (Worst accuracy, fastest - for testing only)')}
                </option>
              </select>
            </div>

            <div className="time-format-setting">
              <label htmlFor="time-format">
                {t('settings.timeFormat', 'Time Format')}
              </label>
              <p className="setting-description">
                {t('settings.timeFormatDescription', 'Choose how time is displayed in the timeline and lyrics.')}
              </p>
              <select
                id="time-format"
                value={timeFormat}
                onChange={(e) => setTimeFormat(e.target.value)}
                className="time-format-select"
              >
                <option value="seconds">{t('settings.timeFormatSeconds', 'Seconds (e.g., 75.40s)')}</option>
                <option value="hms">{t('settings.timeFormatHMS', 'HH:MM:SS (e.g., 1:15.40)')}</option>
              </select>
            </div>
          </div>

          <div className="settings-section cache-section">
            <h3>{t('settings.cache', 'Cache Management')}</h3>
            <p className="cache-description">
              {t('settings.cacheDescription', 'Clear all cached subtitles and downloaded videos to free up space.')}
            </p>

            {/* Cache status message */}
            {cacheStatus.message && (
              <div className={`cache-status-message status-${cacheStatus.type}`}>
                {cacheStatus.message}
              </div>
            )}

            {/* Cache details */}
            {cacheDetails && (
              <div className="cache-details">
                <div className="cache-details-item">
                  <h4>{t('settings.videosCleared', 'Videos')}:</h4>
                  <p>
                    {cacheDetails.videos?.count || 0} {t('settings.files', 'files')}
                    ({cacheDetails.videos?.formattedSize || '0 Bytes'})
                  </p>
                </div>

                <div className="cache-details-item">
                  <h4>{t('settings.segmentsCleared', 'Segments')}:</h4>
                  <p>
                    {cacheDetails.segments?.count || 0} {t('settings.files', 'files')}
                    ({cacheDetails.segments?.formattedSize || '0 Bytes'})
                  </p>
                </div>

                <div className="cache-details-item">
                  <h4>{t('settings.subtitlesCleared', 'Subtitles')}:</h4>
                  <p>
                    {cacheDetails.subtitles?.count || 0} {t('settings.files', 'files')}
                    ({cacheDetails.subtitles?.formattedSize || '0 Bytes'})
                  </p>
                </div>
              </div>
            )}

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