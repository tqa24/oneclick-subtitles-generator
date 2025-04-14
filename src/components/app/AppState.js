import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSubtitles } from '../../hooks/useSubtitles';
import { getUserProvidedSubtitlesSync } from '../../utils/userSubtitlesStore';
import { getTranscriptionRulesSync } from '../../utils/transcriptionRulesStore';
import { hasValidTokens } from '../../services/youtubeApiService';
import { PROMPT_PRESETS } from '../../services/geminiService';

/**
 * Custom hook for managing application state
 */
export const useAppState = () => {
  const { t } = useTranslation();

  // API Keys and authentication state
  const [apiKeysSet, setApiKeysSet] = useState({
    gemini: false,
    youtube: false
  });

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState(localStorage.getItem('lastActiveTab') || 'youtube-url');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [timeFormat, setTimeFormat] = useState(localStorage.getItem('time_format') || 'hms');
  const [showWaveform, setShowWaveform] = useState(localStorage.getItem('show_waveform') !== 'false');

  // Video processing state
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [optimizeVideos, setOptimizeVideos] = useState(localStorage.getItem('optimize_videos') !== 'false');
  const [optimizedResolution, setOptimizedResolution] = useState(localStorage.getItem('optimized_resolution') || '360p');
  const [useOptimizedPreview, setUseOptimizedPreview] = useState(localStorage.getItem('use_optimized_preview') !== 'false');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [currentDownloadId, setCurrentDownloadId] = useState(null);
  const [isAppReady] = useState(true); // App is always ready (onboarding removed)
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSrtOnlyMode, setIsSrtOnlyMode] = useState(false);

  // Video analysis state
  const [showVideoAnalysis, setShowVideoAnalysis] = useState(false);
  const [videoAnalysisResult, setVideoAnalysisResult] = useState(null);

  // Segments state
  const [segmentsStatus, setSegmentsStatus] = useState([]);
  const [videoSegments, setVideoSegments] = useState([]);

  // Rules editor state
  const [showRulesEditor, setShowRulesEditor] = useState(false);

  // User-provided subtitles state
  const [userProvidedSubtitles, setUserProvidedSubtitlesState] = useState(() => {
    // Try to get user-provided subtitles synchronously
    const savedSubtitles = getUserProvidedSubtitlesSync();
    return savedSubtitles || '';
  });

  // Track whether user-provided subtitles are being used
  const [useUserProvidedSubtitles, setUseUserProvidedSubtitles] = useState(() => {
    return localStorage.getItem('use_user_provided_subtitles') === 'true';
  });

  // Transcription rules state
  const [transcriptionRules, setTranscriptionRulesState] = useState(() => {
    // Try to get rules synchronously via the utility function
    const savedRules = getTranscriptionRulesSync();
    console.log('Initializing transcription rules from store:', savedRules ? 'found' : 'not found');
    return savedRules;
  });

  // Get subtitles hook
  const {
    subtitlesData,
    setSubtitlesData,
    status,
    setStatus,
    isGenerating,
    generateSubtitles,
    retryGeneration,
    retrySegment,
    retryingSegments
  } = useSubtitles(t);

  // Initialize default values for settings
  useEffect(() => {
    // Set onboarding as completed
    localStorage.setItem('onboarding_completed', 'true');

    // Set default preset if not already set
    if (!localStorage.getItem('selected_preset_id')) {
      localStorage.setItem('selected_preset_id', 'general');
    }

    // Set default model if not already set
    if (!localStorage.getItem('gemini_model')) {
      localStorage.setItem('gemini_model', 'gemini-2.0-flash');
    }

    // Set default transcription prompt if not already set
    if (!localStorage.getItem('transcription_prompt')) {
      const defaultPreset = PROMPT_PRESETS.find(preset => preset.id === 'general');
      if (defaultPreset) {
        localStorage.setItem('transcription_prompt', defaultPreset.prompt);
      }
    }

    // Clear status messages and video analysis state on mount
    // Clear any lingering status messages on page load
    setStatus({});

    // Clear video processing flag
    localStorage.removeItem('video_processing_in_progress');

    // Check if there's an active video analysis in progress
    const showAnalysis = localStorage.getItem('show_video_analysis') === 'true';
    const timestamp = localStorage.getItem('video_analysis_timestamp');

    // Check if the analysis is stale (older than 5 minutes)
    const isStale = timestamp && (Date.now() - parseInt(timestamp, 10) > 5 * 60 * 1000);

    // Always clear video analysis data on page refresh
    // Check if this is a page refresh using a more modern approach
    const pageWasReloaded = window.performance &&
      (window.performance.getEntriesByType('navigation')[0]?.type === 'reload' ||
       document.referrer === document.location.href);

    if (isStale || pageWasReloaded) {
      // Clear analysis data
      localStorage.removeItem('show_video_analysis');
      localStorage.removeItem('video_analysis_timestamp');
      localStorage.removeItem('video_analysis_result');
      setShowVideoAnalysis(false);
      setVideoAnalysisResult(null);
      return;
    }

    if (showAnalysis && !isStale) {
      setShowVideoAnalysis(true);

      try {
        const analysisResult = JSON.parse(localStorage.getItem('video_analysis_result'));
        if (analysisResult) {
          setVideoAnalysisResult(analysisResult);
        }
      } catch (error) {
        console.error('Error parsing video analysis result from localStorage on mount:', error);
        // Clear invalid data
        localStorage.removeItem('show_video_analysis');
        localStorage.removeItem('video_analysis_timestamp');
        localStorage.removeItem('video_analysis_result');
        setShowVideoAnalysis(false);
        setVideoAnalysisResult(null);
      }
    }
  }, [setStatus]);

  // Initialize API keys and OAuth status from localStorage
  useEffect(() => {
    const geminiApiKey = localStorage.getItem('gemini_api_key');
    const youtubeApiKey = localStorage.getItem('youtube_api_key');
    const useOAuth = localStorage.getItem('use_youtube_oauth') === 'true';
    const hasOAuthTokens = hasValidTokens();

    setApiKeysSet({
      gemini: !!geminiApiKey,
      youtube: useOAuth ? hasOAuthTokens : !!youtubeApiKey
    });

    // Check API keys status and show message if needed
    // eslint-disable-next-line no-mixed-operators
    if (!geminiApiKey || (activeTab === 'youtube-search' && ((!youtubeApiKey && !useOAuth) || (useOAuth && !hasOAuthTokens)))) {
      let message;

      // eslint-disable-next-line no-mixed-operators
      if (!geminiApiKey && activeTab === 'youtube-search' && ((!youtubeApiKey && !useOAuth) || (useOAuth && !hasOAuthTokens))) {
        message = t('errors.bothKeysRequired', 'Please set your Gemini API key and configure YouTube authentication in the settings to use this application.');
      } else if (!geminiApiKey) {
        message = t('errors.apiKeyRequired', 'Please set your API key in the settings first.');
      } else if (useOAuth && !hasOAuthTokens && activeTab === 'youtube-search') {
        message = t('errors.youtubeAuthRequired', 'YouTube authentication required. Please set up OAuth in settings.');
      } else if (activeTab === 'youtube-search') {
        message = t('errors.youtubeApiKeyRequired', 'Please set your YouTube API key in the settings to use this application.');
      }

      if (message) {
        setStatus({ message, type: 'info' });
      }
    }
  }, [setStatus, activeTab, t]);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return {
    // State
    apiKeysSet, setApiKeysSet,
    showSettings, setShowSettings,
    activeTab, setActiveTab,
    theme, setTheme,
    timeFormat, setTimeFormat,
    showWaveform, setShowWaveform,
    selectedVideo, setSelectedVideo,
    uploadedFile, setUploadedFile,
    optimizeVideos, setOptimizeVideos,
    optimizedResolution, setOptimizedResolution,
    useOptimizedPreview, setUseOptimizedPreview,
    isDownloading, setIsDownloading,
    downloadProgress, setDownloadProgress,
    currentDownloadId, setCurrentDownloadId,
    isAppReady,
    isRetrying, setIsRetrying,
    isSrtOnlyMode, setIsSrtOnlyMode,
    showVideoAnalysis, setShowVideoAnalysis,
    videoAnalysisResult, setVideoAnalysisResult,
    segmentsStatus, setSegmentsStatus,
    videoSegments, setVideoSegments,
    showRulesEditor, setShowRulesEditor,
    userProvidedSubtitles, setUserProvidedSubtitlesState,
    useUserProvidedSubtitles, setUseUserProvidedSubtitles,
    transcriptionRules, setTranscriptionRulesState,

    // Subtitles hook
    subtitlesData, setSubtitlesData,
    status, setStatus,
    isGenerating,
    generateSubtitles,
    retryGeneration,
    retrySegment,
    retryingSegments
  };
};
