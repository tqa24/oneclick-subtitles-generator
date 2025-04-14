import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../../styles/SettingsModal.css';
import '../../styles/settings/checkbox-fix.css';
import { DEFAULT_TRANSCRIPTION_PROMPT } from '../../services/geminiService';
import { getClientCredentials, hasValidTokens } from '../../services/youtubeApiService';
import LanguageSelector from '../LanguageSelector';

// Import modularized components
import ApiKeysTab from './tabs/ApiKeysTab';
import VideoProcessingTab from './tabs/VideoProcessingTab';
import PromptsTab from './tabs/PromptsTab';
import CacheTab from './tabs/CacheTab';
import AboutTab from './tabs/AboutTab';

// Import icons
import { ApiKeyIcon, ProcessingIcon, PromptIcon, CacheIcon, AboutIcon } from './icons/TabIcons';

// Import theme utilities
import { toggleTheme as toggleThemeUtil, getThemeIcon, getThemeLabel, initializeTheme, setupSystemThemeListener } from './utils/themeUtils';

const SettingsModal = ({ onClose, onSave, apiKeysSet, setApiKeysSet }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(() => {
    // Load last active tab from localStorage or default to 'api-keys'
    return localStorage.getItem('settings_last_active_tab') || 'api-keys';
  });

  // Theme state
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  // State for tracking which About background to show
  const [useAlternativeBackground, setUseAlternativeBackground] = useState(() => {
    // Initialize from localStorage
    return localStorage.getItem('about_alternative_bg') === 'true';
  });
  
  const [hasChanges, setHasChanges] = useState(false); // Track if any settings have changed
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false); // Track if settings have been loaded
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [youtubeApiKey, setYoutubeApiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showYoutubeKey, setShowYoutubeKey] = useState(false);
  const [useOAuth, setUseOAuth] = useState(false);
  const [youtubeClientId, setYoutubeClientId] = useState('');
  const [youtubeClientSecret, setYoutubeClientSecret] = useState('');
  const [showClientId, setShowClientId] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [segmentDuration, setSegmentDuration] = useState(3); // Default to 3 minutes
  const [geminiModel, setGeminiModel] = useState('gemini-2.0-flash'); // Default model
  const [timeFormat, setTimeFormat] = useState('hms'); // Default to HH:MM:SS format
  const [showWaveform, setShowWaveform] = useState(true); // Default to showing waveform
  const [segmentOffsetCorrection, setSegmentOffsetCorrection] = useState(-3.0); // Default offset correction for second segment
  const [useVideoAnalysis, setUseVideoAnalysis] = useState(true); // Default to using video analysis
  const [videoAnalysisModel, setVideoAnalysisModel] = useState('gemini-2.0-flash'); // Default to Flash
  const [videoAnalysisTimeout, setVideoAnalysisTimeout] = useState('20'); // Default to 20 seconds timeout
  const [optimizeVideos, setOptimizeVideos] = useState(true); // Default to optimizing videos
  const [optimizedResolution, setOptimizedResolution] = useState('360p'); // Default to 360p
  const [useOptimizedPreview, setUseOptimizedPreview] = useState(true); // Default to optimized video in preview
  const [isFactoryResetting, setIsFactoryResetting] = useState(false); // State for factory reset process
  const [transcriptionPrompt, setTranscriptionPrompt] = useState(DEFAULT_TRANSCRIPTION_PROMPT); // Custom transcription prompt

  // Save active tab to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('settings_last_active_tab', activeTab);
  }, [activeTab]);

  // Add ESC key handler to close the modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Add event listener when the component mounts
    document.addEventListener('keydown', handleEscKey);

    // Remove event listener when the component unmounts
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [onClose]);

  // Store original settings for comparison
  const [originalSettings, setOriginalSettings] = useState({
    geminiApiKey: '',
    youtubeApiKey: '',
    segmentDuration: 3,
    geminiModel: 'gemini-2.0-flash',
    timeFormat: 'hms',
    showWaveform: true,
    segmentOffsetCorrection: -3.0,
    transcriptionPrompt: DEFAULT_TRANSCRIPTION_PROMPT,
    useOAuth: false,
    youtubeClientId: '',
    youtubeClientSecret: '',
    useVideoAnalysis: true,
    videoAnalysisModel: 'gemini-2.0-flash',
    videoAnalysisTimeout: '20',
    optimizeVideos: true,
    optimizedResolution: '360p',
    useOptimizedPreview: true
  });

  // Listen for system theme changes and apply initial theme
  useEffect(() => {
    // Set up system theme change listener
    const cleanup = setupSystemThemeListener(setTheme);
    
    // Handle initial theme setup
    const savedTheme = initializeTheme();
    setTheme(savedTheme);
    
    return cleanup;
  }, []);

  // Load saved settings on component mount
  useEffect(() => {
    const loadSettings = () => {
      const savedGeminiKey = localStorage.getItem('gemini_api_key') || '';
      const savedYoutubeKey = localStorage.getItem('youtube_api_key') || '';
      const savedSegmentDuration = parseInt(localStorage.getItem('segment_duration') || '3');
      const savedGeminiModel = localStorage.getItem('gemini_model') || 'gemini-2.0-flash';
      const savedTimeFormat = localStorage.getItem('time_format') || 'hms';
      const savedShowWaveform = localStorage.getItem('show_waveform') !== 'false'; // Default to true if not set
      const savedOffsetCorrection = parseFloat(localStorage.getItem('segment_offset_correction') || '-3.0');
      const savedUseVideoAnalysis = localStorage.getItem('use_video_analysis') !== 'false'; // Default to true if not set
      const savedVideoAnalysisModel = localStorage.getItem('video_analysis_model') || 'gemini-2.0-flash'; // Default to Flash
      const savedVideoAnalysisTimeout = localStorage.getItem('video_analysis_timeout') || '20'; // Default to 20 seconds timeout
      const savedTranscriptionPrompt = localStorage.getItem('transcription_prompt') || DEFAULT_TRANSCRIPTION_PROMPT;
      const savedUseOAuth = localStorage.getItem('use_youtube_oauth') === 'true';
      const savedOptimizeVideos = localStorage.getItem('optimize_videos') !== 'false'; // Default to true if not set
      const savedOptimizedResolution = localStorage.getItem('optimized_resolution') || '360p';
      const savedUseOptimizedPreview = localStorage.getItem('use_optimized_preview') !== 'false'; // Default to true if not set
      const { clientId, clientSecret } = getClientCredentials();
      const authenticated = hasValidTokens();

      // Original settings will be set after all state updates

      setGeminiApiKey(savedGeminiKey);
      setYoutubeApiKey(savedYoutubeKey);
      setSegmentDuration(savedSegmentDuration);
      setGeminiModel(savedGeminiModel);
      setTimeFormat(savedTimeFormat);
      setShowWaveform(savedShowWaveform);
      setSegmentOffsetCorrection(savedOffsetCorrection);
      setUseVideoAnalysis(savedUseVideoAnalysis);
      setVideoAnalysisModel(savedVideoAnalysisModel);
      setVideoAnalysisTimeout(savedVideoAnalysisTimeout);
      setTranscriptionPrompt(savedTranscriptionPrompt);
      setUseOAuth(savedUseOAuth);
      setYoutubeClientId(clientId);
      setYoutubeClientSecret(clientSecret);
      setIsAuthenticated(authenticated);
      setOptimizeVideos(savedOptimizeVideos);
      setOptimizedResolution(savedOptimizedResolution);
      setUseOptimizedPreview(savedUseOptimizedPreview);
      setHasChanges(false); // Reset changes flag when loading settings

      // Set original settings to match loaded settings
      setOriginalSettings({
        geminiApiKey: savedGeminiKey,
        youtubeApiKey: savedYoutubeKey,
        segmentDuration: savedSegmentDuration,
        geminiModel: savedGeminiModel,
        timeFormat: savedTimeFormat,
        showWaveform: savedShowWaveform,
        segmentOffsetCorrection: savedOffsetCorrection,
        transcriptionPrompt: savedTranscriptionPrompt,
        useOAuth: savedUseOAuth,
        youtubeClientId: clientId,
        youtubeClientSecret: clientSecret,
        useVideoAnalysis: savedUseVideoAnalysis,
        videoAnalysisModel: savedVideoAnalysisModel,
        videoAnalysisTimeout: savedVideoAnalysisTimeout,
        optimizeVideos: savedOptimizeVideos,
        optimizedResolution: savedOptimizedResolution,
        useOptimizedPreview: savedUseOptimizedPreview
      });

      // Mark settings as loaded
      setIsSettingsLoaded(true);
    };

    // Load settings initially
    loadSettings();

    // Check for OAuth success flag
    const oauthSuccess = localStorage.getItem('oauth_auth_success') === 'true';
    if (oauthSuccess) {
      // Refresh authentication status
      setIsAuthenticated(hasValidTokens());
    }

    // Set up event listener for storage changes
    const handleStorageChange = (event) => {
      if (event.key === 'youtube_oauth_token' || event.key === 'oauth_auth_success') {
        setIsAuthenticated(hasValidTokens());
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Clean up
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Function to toggle theme
  const handleToggleTheme = () => {
    const newTheme = toggleThemeUtil(theme, setTheme);
    setTheme(newTheme);
  };

  // Handle factory reset
  const handleFactoryReset = async () => {
    if (window.confirm(t('settings.confirmFactoryReset', 'Are you sure you want to perform a factory reset? This will clear all cache files and browser data. This cannot be undone.'))) {
      setIsFactoryResetting(true);

      try {
        // 1. Clear server-side cache
        const cacheResponse = await fetch('http://localhost:3004/api/clear-cache', {
          method: 'DELETE'
        });

        if (!cacheResponse.ok) {
          throw new Error('Failed to clear server cache');
        }

        // 2. Clear all localStorage items
        localStorage.clear();

        // 3. Clear IndexedDB if used
        const databases = await window.indexedDB.databases();
        databases.forEach(db => {
          window.indexedDB.deleteDatabase(db.name);
        });

        // 4. Show success message
        alert(t('settings.factoryResetSuccess', 'Factory reset completed successfully. The application will now reload.'));

        // 5. Reload the page to apply changes
        window.location.reload();
      } catch (error) {
        console.error('Error during factory reset:', error);
        alert(t('settings.factoryResetError', 'Error during factory reset: {{errorMessage}}', { errorMessage: error.message }));
        setIsFactoryResetting(false);
      }
    }
  };

  // Effect to check for changes in settings
  useEffect(() => {
    // Only check for changes if settings have been loaded
    if (!isSettingsLoaded) return;

    // Compare current settings with original settings
    const settingsChanged =
      geminiApiKey !== originalSettings.geminiApiKey ||
      youtubeApiKey !== originalSettings.youtubeApiKey ||
      segmentDuration !== originalSettings.segmentDuration ||
      geminiModel !== originalSettings.geminiModel ||
      timeFormat !== originalSettings.timeFormat ||
      showWaveform !== originalSettings.showWaveform ||
      segmentOffsetCorrection !== originalSettings.segmentOffsetCorrection ||
      transcriptionPrompt !== originalSettings.transcriptionPrompt ||
      useOAuth !== originalSettings.useOAuth ||
      youtubeClientId !== originalSettings.youtubeClientId ||
      youtubeClientSecret !== originalSettings.youtubeClientSecret ||
      useVideoAnalysis !== originalSettings.useVideoAnalysis ||
      videoAnalysisModel !== originalSettings.videoAnalysisModel ||
      videoAnalysisTimeout !== originalSettings.videoAnalysisTimeout ||
      optimizeVideos !== originalSettings.optimizeVideos ||
      optimizedResolution !== originalSettings.optimizedResolution ||
      useOptimizedPreview !== originalSettings.useOptimizedPreview;

    setHasChanges(settingsChanged);
  }, [isSettingsLoaded, geminiApiKey, youtubeApiKey, segmentDuration, geminiModel, timeFormat, showWaveform,
      segmentOffsetCorrection, transcriptionPrompt, useOAuth, youtubeClientId,
      youtubeClientSecret, useVideoAnalysis, videoAnalysisModel, videoAnalysisTimeout,
      optimizeVideos, optimizedResolution, useOptimizedPreview, originalSettings]);

  // Handle save button click
  const handleSave = () => {
    // Save settings to localStorage
    localStorage.setItem('segment_duration', segmentDuration.toString());
    localStorage.setItem('gemini_model', geminiModel);
    localStorage.setItem('time_format', timeFormat);
    localStorage.setItem('show_waveform', showWaveform.toString());
    localStorage.setItem('segment_offset_correction', segmentOffsetCorrection.toString());
    localStorage.setItem('transcription_prompt', transcriptionPrompt);
    localStorage.setItem('use_youtube_oauth', useOAuth.toString());
    localStorage.setItem('use_video_analysis', useVideoAnalysis.toString());
    localStorage.setItem('video_analysis_model', videoAnalysisModel);
    localStorage.setItem('video_analysis_timeout', videoAnalysisTimeout);
    localStorage.setItem('optimize_videos', optimizeVideos.toString());
    localStorage.setItem('optimized_resolution', optimizedResolution);
    localStorage.setItem('use_optimized_preview', useOptimizedPreview.toString());

    // Notify parent component about API keys, segment duration, model, time format, and video optimization settings
    onSave(geminiApiKey, youtubeApiKey, segmentDuration, geminiModel, timeFormat, showWaveform, optimizeVideos, optimizedResolution, useOptimizedPreview);

    // Update original settings to match current settings
    setOriginalSettings({
      geminiApiKey,
      youtubeApiKey,
      segmentDuration,
      geminiModel,
      timeFormat,
      showWaveform,
      segmentOffsetCorrection,
      transcriptionPrompt,
      useOAuth,
      youtubeClientId,
      youtubeClientSecret,
      useVideoAnalysis,
      videoAnalysisModel,
      videoAnalysisTimeout,
      optimizeVideos,
      optimizedResolution,
      useOptimizedPreview
    });

    // Reset changes flag and mark settings as loaded
    setHasChanges(false);
    setIsSettingsLoaded(true);

    onClose();
  };

  return (
    <div className="settings-modal-overlay">
      <div className="settings-modal">
        <div className="settings-header">
          <h2>{t('settings.title', 'Settings')}</h2>

          {/* Tab Navigation */}
          <div className="settings-tabs">
            <button
              className={`settings-tab ${activeTab === 'api-keys' ? 'active' : ''}`}
              onClick={() => setActiveTab('api-keys')}
            >
              <ApiKeyIcon />
              {t('settings.apiKeys', 'API Keys')}
            </button>
            <button
              className={`settings-tab ${activeTab === 'video-processing' ? 'active' : ''}`}
              onClick={() => setActiveTab('video-processing')}
            >
              <ProcessingIcon />
              {t('settings.videoProcessing', 'Video Processing')}
            </button>
            <button
              className={`settings-tab ${activeTab === 'prompts' ? 'active' : ''}`}
              onClick={() => setActiveTab('prompts')}
            >
              <PromptIcon />
              {t('settings.prompts', 'Prompts')}
            </button>
            <button
              className={`settings-tab ${activeTab === 'cache' ? 'active' : ''}`}
              onClick={() => setActiveTab('cache')}
            >
              <CacheIcon />
              {t('settings.cache', 'Cache')}
            </button>
            <button
              className={`settings-tab ${activeTab === 'about' ? 'active' : ''}`}
              onClick={() => {
                // Toggle the background when clicking on the About tab
                if (activeTab !== 'about') {
                  // Get the current state from localStorage or default to false
                  const currentState = localStorage.getItem('about_alternative_bg') === 'true';
                  // Toggle the state
                  const newState = !currentState;
                  // Save the new state
                  localStorage.setItem('about_alternative_bg', newState.toString());
                  // Update the state
                  setUseAlternativeBackground(newState);
                }
                setActiveTab('about');
              }}
            >
              <AboutIcon />
              {t('settings.about', 'About')}
            </button>
          </div>

          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="settings-content">
          {/* API Keys Tab Content */}
          <div className={`settings-tab-content ${activeTab === 'api-keys' ? 'active' : ''}`}>
            <ApiKeysTab
              geminiApiKey={geminiApiKey}
              setGeminiApiKey={setGeminiApiKey}
              youtubeApiKey={youtubeApiKey}
              setYoutubeApiKey={setYoutubeApiKey}
              showGeminiKey={showGeminiKey}
              setShowGeminiKey={setShowGeminiKey}
              showYoutubeKey={showYoutubeKey}
              setShowYoutubeKey={setShowYoutubeKey}
              useOAuth={useOAuth}
              setUseOAuth={setUseOAuth}
              youtubeClientId={youtubeClientId}
              setYoutubeClientId={setYoutubeClientId}
              youtubeClientSecret={youtubeClientSecret}
              setYoutubeClientSecret={setYoutubeClientSecret}
              showClientId={showClientId}
              setShowClientId={setShowClientId}
              showClientSecret={showClientSecret}
              setShowClientSecret={setShowClientSecret}
              isAuthenticated={isAuthenticated}
              setIsAuthenticated={setIsAuthenticated}
              apiKeysSet={apiKeysSet}
              setApiKeysSet={setApiKeysSet}
            />
          </div>

          {/* Video Processing Tab Content */}
          <div className={`settings-tab-content ${activeTab === 'video-processing' ? 'active' : ''}`}>
            <VideoProcessingTab
              segmentDuration={segmentDuration}
              setSegmentDuration={setSegmentDuration}
              geminiModel={geminiModel}
              setGeminiModel={setGeminiModel}
              timeFormat={timeFormat}
              setTimeFormat={setTimeFormat}
              showWaveform={showWaveform}
              setShowWaveform={setShowWaveform}
              useVideoAnalysis={useVideoAnalysis}
              setUseVideoAnalysis={setUseVideoAnalysis}
              videoAnalysisModel={videoAnalysisModel}
              setVideoAnalysisModel={setVideoAnalysisModel}
              videoAnalysisTimeout={videoAnalysisTimeout}
              setVideoAnalysisTimeout={setVideoAnalysisTimeout}
              optimizeVideos={optimizeVideos}
              setOptimizeVideos={setOptimizeVideos}
              optimizedResolution={optimizedResolution}
              setOptimizedResolution={setOptimizedResolution}
              useOptimizedPreview={useOptimizedPreview}
              setUseOptimizedPreview={setUseOptimizedPreview}
            />
          </div>

          {/* Prompts Tab Content */}
          <div className={`settings-tab-content ${activeTab === 'prompts' ? 'active' : ''}`}>
            <PromptsTab
              transcriptionPrompt={transcriptionPrompt}
              setTranscriptionPrompt={setTranscriptionPrompt}
            />
          </div>

          {/* Cache Management Tab Content */}
          <div className={`settings-tab-content ${activeTab === 'cache' ? 'active' : ''}`}>
            <CacheTab />
          </div>

          {/* About Tab Content */}
          <div className={`settings-tab-content ${activeTab === 'about' ? 'active' : ''}`}>
            <AboutTab useAlternativeBackground={useAlternativeBackground} />
          </div>
        </div>

        <div className="settings-footer">
          <div className="settings-footer-left">
            {/* Theme toggle and language selector */}
            <div className="settings-footer-controls">
              <button
                className="theme-toggle"
                onClick={handleToggleTheme}
                aria-label={getThemeLabel(theme, t)}
                title={getThemeLabel(theme, t)}
              >
                {getThemeIcon(theme)}
              </button>
              <LanguageSelector isDropup={true} />
            </div>

            {/* Factory reset button */}
            <button
              className="factory-reset-btn"
              onClick={handleFactoryReset}
              disabled={isFactoryResetting}
              title={t('settings.factoryResetTooltip', 'Reset application to factory settings')}
            >
              {isFactoryResetting ? (
                <>
                  <span className="loading-spinner"></span>
                  {t('settings.resetting', 'Resetting...')}
                </>
              ) : (
                t('settings.factoryReset', 'Factory Reset')
              )}
            </button>
          </div>
          <div className="settings-footer-right">
            <button
              className="cancel-btn"
              onClick={onClose}
              title={t('settings.pressEscToClose', 'Press ESC to close')}
            >
              {t('common.cancel', 'Cancel')} <span className="key-hint">(ESC)</span>
            </button>
            <button
              className="save-btn"
              onClick={handleSave}
              disabled={!hasChanges}
              title={!hasChanges ? t('settings.noChanges', 'No changes to save') : t('settings.saveChanges', 'Save changes')}
            >
              {t('common.save', 'Save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
