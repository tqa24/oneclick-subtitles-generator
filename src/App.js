import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import './styles/App.css';
import './styles/GeminiButtonAnimations.css';
import './styles/ProcessingTextAnimation.css';
import './styles/SrtUploadButton.css';
import './styles/VideoAnalysisModal.css';
import './styles/TranscriptionRulesEditor.css';
import Header from './components/Header';
import InputMethods from './components/InputMethods';
import OutputContainer from './components/OutputContainer';
import SettingsModal from './components/SettingsModal';
import OnboardingModal from './components/OnboardingModal';
import TranslationWarningToast from './components/TranslationWarningToast';
import SrtUploadButton from './components/SrtUploadButton';
import VideoAnalysisModal from './components/VideoAnalysisModal';
import TranscriptionRulesEditor from './components/TranscriptionRulesEditor';
import { useSubtitles } from './hooks/useSubtitles';
import { setTranscriptionRules } from './utils/transcriptionRulesStore';
import { downloadYoutubeVideo, cancelYoutubeVideoDownload, extractYoutubeVideoId } from './utils/videoDownloader';
import { initGeminiButtonEffects, resetGeminiButtonState, resetAllGeminiButtonEffects } from './utils/geminiButtonEffects';
import { hasValidTokens } from './services/youtubeApiService';
import { abortAllRequests, PROMPT_PRESETS } from './services/geminiService';
import { parseSrtContent } from './utils/srtParser';
import { splitVideoOnServer } from './utils/videoSplitter';
import { getVideoDuration, getMaxSegmentDurationSeconds } from './utils/durationUtils';

function App() {
  const { t } = useTranslation();
  const [apiKeysSet, setApiKeysSet] = useState({
    gemini: false,
    youtube: false
  });
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState(localStorage.getItem('lastActiveTab') || 'youtube-url');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [segmentsStatus, setSegmentsStatus] = useState([]);
  const [timeFormat, setTimeFormat] = useState(localStorage.getItem('time_format') || 'hms');
  const [showWaveform, setShowWaveform] = useState(localStorage.getItem('show_waveform') !== 'false');
  const [optimizeVideos, setOptimizeVideos] = useState(localStorage.getItem('optimize_videos') !== 'false');
  const [optimizedResolution, setOptimizedResolution] = useState(localStorage.getItem('optimized_resolution') || '360p');
  const [useOptimizedPreview, setUseOptimizedPreview] = useState(localStorage.getItem('use_optimized_preview') === 'true');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [currentDownloadId, setCurrentDownloadId] = useState(null); // Track the current downloading video ID
  const [showOnboarding, setShowOnboarding] = useState(localStorage.getItem('onboarding_completed') !== 'true');
  const [isAppReady, setIsAppReady] = useState(!showOnboarding);
  const [isRetrying, setIsRetrying] = useState(false); // Track when retry is in progress
  const [isSrtOnlyMode, setIsSrtOnlyMode] = useState(false); // Track when we're working with SRT only
  const [showVideoAnalysis, setShowVideoAnalysis] = useState(false); // Show video analysis modal
  const [videoAnalysisResult, setVideoAnalysisResult] = useState(null); // Store video analysis result

  // For debugging - log state changes
  useEffect(() => {
    console.log('showVideoAnalysis changed:', showVideoAnalysis);
  }, [showVideoAnalysis]);

  useEffect(() => {
    console.log('videoAnalysisResult changed:', videoAnalysisResult);
  }, [videoAnalysisResult]);

  // Check localStorage for video analysis data on mount
  useEffect(() => {
    const showAnalysis = localStorage.getItem('show_video_analysis') === 'true';
    const timestamp = localStorage.getItem('video_analysis_timestamp');

    // Check if the analysis is stale (older than 5 minutes)
    const isStale = timestamp && (Date.now() - parseInt(timestamp, 10) > 5 * 60 * 1000);

    if (isStale) {
      // Clear stale analysis data
      console.log('Clearing stale video analysis data');
      localStorage.removeItem('show_video_analysis');
      localStorage.removeItem('video_analysis_timestamp');
      localStorage.removeItem('video_analysis_result');
      return;
    }

    if (showAnalysis && !isStale) {
      console.log('Found show_video_analysis=true in localStorage on mount');
      setShowVideoAnalysis(true);

      try {
        const analysisResult = JSON.parse(localStorage.getItem('video_analysis_result'));
        if (analysisResult) {
          console.log('Setting videoAnalysisResult from localStorage on mount:', analysisResult);
          setVideoAnalysisResult(analysisResult);
        }
      } catch (error) {
        console.error('Error parsing video analysis result from localStorage on mount:', error);
        // Clear invalid data
        localStorage.removeItem('show_video_analysis');
        localStorage.removeItem('video_analysis_timestamp');
        localStorage.removeItem('video_analysis_result');
      }
    }
  }, []);
  const [showRulesEditor, setShowRulesEditor] = useState(false); // Show rules editor modal
  const [transcriptionRules, setTranscriptionRulesState] = useState(null); // Store transcription rules

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

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Initialize Gemini button effects after component mounts
  useEffect(() => {
    // Small delay to ensure DOM is fully rendered
    const timer = setTimeout(() => {
      initGeminiButtonEffects();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // State to store video segments for retrying or generating
  const [videoSegments, setVideoSegments] = useState([]);

  // Handler for generating a specific segment (for strong model)
  const handleGenerateSegment = async (segmentIndex, segments) => {
    if (!segments || !segments[segmentIndex]) {
      console.error('No segment found at index', segmentIndex);
      return;
    }

    console.log('Generating segment', segmentIndex, 'and combining with existing subtitles');

    // Use the retrySegment function which will properly combine this segment's results
    // with any previously processed segments
    await retrySegment(segmentIndex, segments);
  };

  // Handler for retrying a segment with a specific model

  const handleRetryWithModel = async (segmentIndex, modelId, segments) => {
    if (!segments || !segments[segmentIndex]) {
      console.error('No segment found at index', segmentIndex);
      return;
    }

    console.log('Retrying segment', segmentIndex, 'with model', modelId);

    // Save the current model
    const currentModel = localStorage.getItem('gemini_model');

    // Temporarily set the selected model
    localStorage.setItem('gemini_model', modelId);

    try {
      // Use the retrySegment function with the temporarily set model
      await retrySegment(segmentIndex, segments);
    } finally {
      // Restore the original model
      if (currentModel) {
        localStorage.setItem('gemini_model', currentModel);
      } else {
        localStorage.removeItem('gemini_model');
      }
    }
  };



  // Listen for segment status updates
  useEffect(() => {
    // Set up event listener for segment status updates
    const handleSegmentStatusUpdate = (event) => {
      if (event.detail && Array.isArray(event.detail)) {
        // If this is a full update (all segments), replace the array
        if (event.detail.length > 1) {
          setSegmentsStatus(event.detail);
        } else {
          // If this is a single segment update, update just that segment
          const updatedSegment = event.detail[0];
          setSegmentsStatus(prevStatus => {
            const newStatus = [...prevStatus];
            const index = newStatus.findIndex(s => s.index === updatedSegment.index);
            if (index !== -1) {
              newStatus[index] = updatedSegment;
            }
            return newStatus;
          });
        }
      }
    };

    // Add event listener
    window.addEventListener('segmentStatusUpdate', handleSegmentStatusUpdate);

    // Clean up
    return () => {
      window.removeEventListener('segmentStatusUpdate', handleSegmentStatusUpdate);
    };
  }, []);

  // Listen for video segments update
  useEffect(() => {
    // Set up event listener for video segments
    const handleVideoSegmentsUpdate = (event) => {
      if (event.detail && Array.isArray(event.detail)) {
        setVideoSegments(event.detail);
      }
    };

    // Add event listener
    window.addEventListener('videoSegmentsUpdate', handleVideoSegmentsUpdate);

    // Clean up
    return () => {
      window.removeEventListener('videoSegmentsUpdate', handleVideoSegmentsUpdate);
    };
  }, []);

  // Listen for video analysis events
  useEffect(() => {
    // Handle video analysis started
    const handleVideoAnalysisStarted = () => {
      console.log('Received videoAnalysisStarted event');
      // Only show the modal if the flag is set in localStorage
      if (localStorage.getItem('show_video_analysis') === 'true') {
        setShowVideoAnalysis(true);
        console.log('showVideoAnalysis set to true');
      } else {
        console.log('Not showing video analysis modal because show_video_analysis is not true');
      }
    };

    // Handle video analysis complete
    const handleVideoAnalysisComplete = (event) => {
      console.log('Received videoAnalysisComplete event with detail:', event.detail);
      // Only update the result if the flag is set in localStorage
      if (event.detail && localStorage.getItem('show_video_analysis') === 'true') {
        setVideoAnalysisResult(event.detail);
        // Store current timestamp to allow for stale data detection
        localStorage.setItem('video_analysis_timestamp', Date.now().toString());
        console.log('videoAnalysisResult state updated with timestamp:', Date.now());
      } else {
        console.log('Not updating videoAnalysisResult because show_video_analysis is not true');
      }
    };

    // Add event listeners
    console.log('Adding video analysis event listeners');
    window.addEventListener('videoAnalysisStarted', handleVideoAnalysisStarted);
    window.addEventListener('videoAnalysisComplete', handleVideoAnalysisComplete);

    // Clean up
    return () => {
      window.removeEventListener('videoAnalysisStarted', handleVideoAnalysisStarted);
      window.removeEventListener('videoAnalysisComplete', handleVideoAnalysisComplete);
    };
  }, []);

  // Listen for theme and settings changes from other components
  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key === 'theme' || !event.key) {
        const newTheme = localStorage.getItem('theme') || 'dark';
        setTheme(newTheme);
      }

      if (event.key === 'show_waveform' || !event.key) {
        const newShowWaveform = localStorage.getItem('show_waveform') !== 'false';
        setShowWaveform(newShowWaveform);
      }

      if (event.key === 'time_format' || !event.key) {
        const newTimeFormat = localStorage.getItem('time_format') || 'hms';
        setTimeFormat(newTimeFormat);
      }

      if (event.key === 'optimize_videos' || !event.key) {
        const newOptimizeVideos = localStorage.getItem('optimize_videos') !== 'false';
        setOptimizeVideos(newOptimizeVideos);
      }

      if (event.key === 'optimized_resolution' || !event.key) {
        const newOptimizedResolution = localStorage.getItem('optimized_resolution') || '360p';
        setOptimizedResolution(newOptimizedResolution);
      }

      if (event.key === 'use_optimized_preview' || !event.key) {
        const newUseOptimizedPreview = localStorage.getItem('use_optimized_preview') === 'true';
        setUseOptimizedPreview(newUseOptimizedPreview);
      }

      // Check for video analysis changes
      if (event.key === 'show_video_analysis' || event.key === 'video_analysis_timestamp' || !event.key) {
        const showAnalysis = localStorage.getItem('show_video_analysis') === 'true';
        const timestamp = localStorage.getItem('video_analysis_timestamp');
        const isProcessing = localStorage.getItem('video_processing_in_progress') === 'true';

        // Check if the analysis is stale (older than 5 minutes)
        const isStale = timestamp && (Date.now() - parseInt(timestamp, 10) > 5 * 60 * 1000);

        if (isStale) {
          // Clear stale analysis data
          console.log('Clearing stale video analysis data from storage event');
          localStorage.removeItem('show_video_analysis');
          localStorage.removeItem('video_analysis_timestamp');
          localStorage.removeItem('video_analysis_result');
          setShowVideoAnalysis(false);
          setVideoAnalysisResult(null);
          return;
        }

        // If we're already processing (after user made a choice), don't show the modal again
        if (isProcessing) {
          console.log('Not showing video analysis modal because processing is in progress');
          return;
        }

        if (showAnalysis && !isStale && !isProcessing) {
          console.log('Setting showVideoAnalysis to true from localStorage');
          setShowVideoAnalysis(true);

          // Get the analysis result from localStorage
          try {
            const analysisResult = JSON.parse(localStorage.getItem('video_analysis_result'));
            if (analysisResult) {
              console.log('Setting videoAnalysisResult from localStorage:', analysisResult);
              setVideoAnalysisResult(analysisResult);
            }
          } catch (error) {
            console.error('Error parsing video analysis result from localStorage:', error);
            // Clear invalid data
            localStorage.removeItem('show_video_analysis');
            localStorage.removeItem('video_analysis_timestamp');
            localStorage.removeItem('video_analysis_result');
            setShowVideoAnalysis(false);
            setVideoAnalysisResult(null);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

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
    if (!geminiApiKey || (activeTab === 'youtube-search' && (!youtubeApiKey && !useOAuth) || (useOAuth && !hasOAuthTokens))) {
      let message;

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

  // Check for OAuth authentication success
  useEffect(() => {
    const checkOAuthSuccess = () => {
      const oauthSuccess = localStorage.getItem('oauth_auth_success') === 'true';
      if (oauthSuccess) {
        // Clear the flag
        localStorage.removeItem('oauth_auth_success');

        // Update API keys status
        const useOAuth = localStorage.getItem('use_youtube_oauth') === 'true';
        const hasOAuthTokens = hasValidTokens();

        if (useOAuth && hasOAuthTokens) {
          setApiKeysSet(prevState => ({
            ...prevState,
            youtube: true
          }));

          // Show success message
          setStatus({
            message: 'YouTube authentication successful!',
            type: 'success'
          });

          // Clear any previous error messages
          setTimeout(() => {
            setStatus({});
          }, 5000);
        }
      }
    };

    // Check immediately
    checkOAuthSuccess();

    // Set up interval to check periodically
    const intervalId = setInterval(checkOAuthSuccess, 1000);

    // Set up message listener for OAuth success
    const handleMessage = (event) => {
      if (event.origin === window.location.origin &&
          event.data && event.data.type === 'OAUTH_SUCCESS') {
        checkOAuthSuccess();
      }
    };

    window.addEventListener('message', handleMessage);

    // Set up storage event listener
    const handleStorageChange = (event) => {
      if (event.key === 'youtube_oauth_token' || event.key === 'oauth_auth_success') {
        checkOAuthSuccess();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Clean up
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [setStatus]);

  // Initialize Gemini button effects
  useEffect(() => {
    // Use a small delay to ensure the DOM is fully rendered
    const timer = setTimeout(() => {
      initGeminiButtonEffects();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // Re-initialize Gemini button effects when subtitles data changes
  useEffect(() => {
    if (subtitlesData && subtitlesData.length > 0) {
      // Use a small delay to ensure the DOM is updated
      const timer = setTimeout(() => {
        initGeminiButtonEffects();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [subtitlesData]);

  // Reset all Gemini button effects when status changes
  useEffect(() => {
    if (status && (status.type === 'success' || status.type === 'error')) {
      // Use a small delay to ensure the DOM is updated
      const timer = setTimeout(() => {
        resetAllGeminiButtonEffects();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [status]);

  const saveApiKeys = (geminiKey, youtubeKey, segmentDuration = 3, geminiModel, timeFormat, showWaveformSetting, optimizeVideosSetting, optimizedResolutionSetting, useOptimizedPreviewSetting) => {
    // Save to localStorage
    if (geminiKey) {
      localStorage.setItem('gemini_api_key', geminiKey);
    } else {
      localStorage.removeItem('gemini_api_key');
    }

    if (youtubeKey) {
      localStorage.setItem('youtube_api_key', youtubeKey);
    } else {
      localStorage.removeItem('youtube_api_key');
    }

    // Save segment duration
    if (segmentDuration) {
      localStorage.setItem('segment_duration', segmentDuration.toString());
    }

    // Save time format
    if (timeFormat) {
      localStorage.setItem('time_format', timeFormat);
      setTimeFormat(timeFormat);
    }

    // Save waveform setting
    if (showWaveformSetting !== undefined) {
      localStorage.setItem('show_waveform', showWaveformSetting.toString());
      setShowWaveform(showWaveformSetting);
    }

    // Save Gemini model
    if (geminiModel) {
      localStorage.setItem('gemini_model', geminiModel);
    }

    // Save video optimization settings
    if (optimizeVideosSetting !== undefined) {
      localStorage.setItem('optimize_videos', optimizeVideosSetting.toString());
      setOptimizeVideos(optimizeVideosSetting);
    }

    if (optimizedResolutionSetting) {
      localStorage.setItem('optimized_resolution', optimizedResolutionSetting);
      setOptimizedResolution(optimizedResolutionSetting);
    }

    if (useOptimizedPreviewSetting !== undefined) {
      localStorage.setItem('use_optimized_preview', useOptimizedPreviewSetting.toString());
      setUseOptimizedPreview(useOptimizedPreviewSetting);
    }

    // Update state based on the selected authentication method
    const useOAuth = localStorage.getItem('use_youtube_oauth') === 'true';
    const hasOAuthTokens = hasValidTokens();

    setApiKeysSet({
      gemini: !!geminiKey,
      youtube: useOAuth ? hasOAuthTokens : !!youtubeKey
    });

    // Show success notification
    setStatus({ message: t('settings.savedSuccessfully', 'Settings saved successfully!'), type: 'success' });
  };

  const validateInput = () => {
    // If we're in SRT-only mode, always return true
    if (isSrtOnlyMode) {
      return true;
    }

    // Otherwise, check for video/audio sources
    if (activeTab === 'youtube-url') {
      return selectedVideo !== null;
    } else if (activeTab === 'youtube-search') {
      return selectedVideo !== null;
    } else if (activeTab === 'file-upload') {
      return uploadedFile !== null;
    }
    return false;
  };

  // Handle SRT file upload
  const handleSrtUpload = async (srtContent) => {
    try {
      // Parse the SRT content
      const parsedSubtitles = parseSrtContent(srtContent);

      if (parsedSubtitles.length === 0) {
        setStatus({ message: t('errors.invalidSrtFormat', 'Invalid SRT format or empty file'), type: 'error' });
        return;
      }

      // If we don't have a video source, set SRT-only mode
      if (!validateInput() || (!activeTab.includes('youtube') && !uploadedFile)) {
        setIsSrtOnlyMode(true);
        setSubtitlesData(parsedSubtitles);
        setStatus({ message: t('output.srtOnlyMode', 'Working with SRT only. No video source available.'), type: 'info' });
        return;
      }

      // If we're in YouTube tabs, we need to download the video first
      if (activeTab.includes('youtube') && selectedVideo) {
        try {
          // Set downloading state to true to disable the generate button
          setIsDownloading(true);
          setDownloadProgress(0);
          setStatus({ message: t('output.downloadingVideo', 'Downloading video...'), type: 'loading' });

          // Download the YouTube video with the selected quality
          const videoUrl = await downloadYoutubeVideo(
            selectedVideo.url,
            (progress) => {
              setDownloadProgress(progress);
            },
            selectedVideo.quality || '360p' // Use the selected quality or default to 360p
          );

          try {
            // Create a fetch request to get the video as a blob
            const response = await fetch(videoUrl);

            // Check if the response is ok
            if (!response.ok) {
              throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();

            // Check if the blob has content (not empty)
            if (blob.size === 0) {
              throw new Error('Downloaded video is empty. The file may have been deleted from the server.');
            }

            // Create a File object from the blob
            const filename = `${selectedVideo.title || 'youtube_video'}.mp4`;
            const file = new File([blob], filename, { type: 'video/mp4' });

            // Check if video optimization is enabled
            const optimizeVideos = localStorage.getItem('optimize_videos') !== 'false'; // Default to true
            const optimizedResolution = localStorage.getItem('optimized_resolution') || '360p'; // Default to 360p

            if (optimizeVideos) {
              try {
                setStatus({ message: t('output.optimizingVideo', 'Optimizing video for processing...'), type: 'loading' });

                // Call the optimize-video endpoint
                const response = await fetch(`http://localhost:3004/api/optimize-video?resolution=${optimizedResolution}&fps=15`, {
                  method: 'POST',
                  body: file,
                  headers: {
                    'Content-Type': file.type
                  }
                });

                if (!response.ok) {
                  throw new Error(`Failed to optimize video: ${response.status} ${response.statusText}`);
                }

                const result = await response.json();
                console.log('Video optimization result:', result);

                // Store the optimization result in localStorage
                localStorage.setItem('split_result', JSON.stringify({
                  originalMedia: result.originalVideo,
                  optimized: {
                    video: result.optimizedVideo,
                    resolution: result.resolution,
                    fps: result.fps,
                    width: result.width,
                    height: result.height
                  }
                }));
              } catch (error) {
                console.error('Error optimizing video:', error);
                setStatus({
                  message: t('output.optimizationFailed', 'Video optimization failed, using original video.'),
                  type: 'warning'
                });
              }
            }

            // Switch to the upload tab without resetting state
            localStorage.setItem('lastActiveTab', 'file-upload');
            setActiveTab('file-upload');
            setSelectedVideo(null);

            // Process the file as if it was uploaded
            const objectUrl = URL.createObjectURL(file);
            localStorage.setItem('current_file_url', objectUrl);

            // Set the uploaded file
            setUploadedFile(file);

            // Reset downloading state
            setIsDownloading(false);
            setDownloadProgress(100);

            // Set the subtitles data directly (bypass Gemini)
            setSubtitlesData(parsedSubtitles);
            setStatus({ message: t('output.srtUploadSuccess', 'SRT file uploaded successfully!'), type: 'success' });

            try {
              // Prepare the video for segment processing
              await prepareVideoForSegments(file);

              // Update status to show that segments are ready
              setStatus({ message: t('output.segmentsReady', 'Video segments are ready for processing!'), type: 'success' });
            } catch (error) {
              console.error('Error preparing video for segments:', error);
              // Still keep the subtitles, but show a warning
              setStatus({
                message: t('warnings.segmentsPreparationFailed', 'Subtitles loaded, but video segment preparation failed: {{message}}', { message: error.message }),
                type: 'warning'
              });
            }

          } catch (error) {
            console.error('Error processing downloaded video:', error);
            // Reset downloading state
            setIsDownloading(false);
            setDownloadProgress(0);
            setStatus({
              message: t('errors.videoProcessingFailed', 'Video processing failed: {{message}}', { message: error.message }),
              type: 'error'
            });
            return;
          }
        } catch (error) {
          console.error('Error downloading video:', error);
          // Reset downloading state
          setIsDownloading(false);
          setDownloadProgress(0);
          setStatus({ message: `${t('errors.videoDownloadFailed', 'Video download failed')}: ${error.message}`, type: 'error' });
          return;
        }
      } else if (activeTab === 'file-upload' && uploadedFile) {
        try {
          // For file upload tab, set the subtitles data directly
          setSubtitlesData(parsedSubtitles);
          setStatus({ message: t('output.srtUploadSuccess', 'SRT file uploaded successfully!'), type: 'success' });

          // Prepare the video for segment processing
          await prepareVideoForSegments(uploadedFile);

          // Update status to show that segments are ready
          setStatus({ message: t('output.segmentsReady', 'Video segments are ready for processing!'), type: 'success' });
        } catch (error) {
          console.error('Error preparing video for segments:', error);
          // Still keep the subtitles, but show a warning
          setStatus({
            message: t('warnings.segmentsPreparationFailed', 'Subtitles loaded, but video segment preparation failed: {{message}}', { message: error.message }),
            type: 'warning'
          });
        }
      } else {
        setStatus({ message: t('errors.noMediaSelected', 'Please select a video or audio file first'), type: 'error' });
      }
    } catch (error) {
      console.error('Error parsing SRT file:', error);
      setStatus({ message: t('errors.srtParsingFailed', 'Failed to parse SRT file: {{message}}', { message: error.message }), type: 'error' });
    }
  };

  const handleGenerateSubtitles = async () => {
    if (!validateInput()) {
      setStatus({ message: t('errors.invalidInput'), type: 'error' });
      return;
    }

    // If we're in SRT-only mode, just show a message
    if (isSrtOnlyMode) {
      setStatus({ message: t('output.srtOnlyMode', 'Working with SRT only. No video source available.'), type: 'info' });
      return;
    }

    let input, inputType;

    // For YouTube tabs, download the video first and switch to upload tab
    if (activeTab.includes('youtube') && selectedVideo) {
      try {
        // Set downloading state to true to disable the generate button
        setIsDownloading(true);
        setDownloadProgress(0);

        // Check if quality is not 360p to show a warning about audio stitching
        const selectedQuality = selectedVideo.quality || '360p';
        if (selectedQuality !== '360p') {
          setStatus({
            message: t('output.audioStitchingWarning', 'Downloading video... Note: For qualities other than 360p, audio stitching is required which may take a long time, especially for videos over 1 hour.'),
            type: 'warning'
          });
        } else {
          setStatus({ message: t('output.downloadingVideo', 'Downloading video...'), type: 'loading' });
        }

        // Extract video ID and set it as current download
        const videoId = extractYoutubeVideoId(selectedVideo.url);
        setCurrentDownloadId(videoId);

        // Download the YouTube video with the selected quality
        const videoUrl = await downloadYoutubeVideo(
          selectedVideo.url,
          (progress) => {
            setDownloadProgress(progress);
            // Just update the download progress state, no need to set status
            // as it will be shown in the Generate button
          },
          selectedVideo.quality || '360p' // Use the selected quality or default to 360p
        );

        // Clear the current download ID when done
        setCurrentDownloadId(null);

        try {
          // Create a fetch request to get the video as a blob
          const response = await fetch(videoUrl);

          // Check if the response is ok
          if (!response.ok) {
            throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
          }

          const blob = await response.blob();

          // Check if the blob has content (not empty)
          if (blob.size === 0) {
            throw new Error('Downloaded video is empty. The file may have been deleted from the server.');
          }

          // Create a File object from the blob
          const filename = `${selectedVideo.title || 'youtube_video'}.mp4`;
          const file = new File([blob], filename, { type: 'video/mp4' });

          // Check if video optimization is enabled
          const optimizeVideos = localStorage.getItem('optimize_videos') !== 'false'; // Default to true
          const optimizedResolution = localStorage.getItem('optimized_resolution') || '360p'; // Default to 360p

          if (optimizeVideos) {
            try {
              setStatus({ message: t('output.optimizingVideo', 'Optimizing video for processing...'), type: 'loading' });

              // Call the optimize-video endpoint
              const response = await fetch(`http://localhost:3004/api/optimize-video?resolution=${optimizedResolution}&fps=15`, {
                method: 'POST',
                body: file,
                headers: {
                  'Content-Type': file.type
                }
              });

              if (!response.ok) {
                throw new Error(`Failed to optimize video: ${response.status} ${response.statusText}`);
              }

              const result = await response.json();
              console.log('Video optimization result:', result);

              // Store the optimization result in localStorage
              localStorage.setItem('split_result', JSON.stringify({
                originalMedia: result.originalVideo,
                optimized: {
                  video: result.optimizedVideo,
                  resolution: result.resolution,
                  fps: result.fps,
                  width: result.width,
                  height: result.height
                }
              }));
            } catch (error) {
              console.error('Error optimizing video:', error);
              setStatus({
                message: t('output.optimizationFailed', 'Video optimization failed, using original video.'),
                type: 'warning'
              });
            }
          }

          // Switch to the upload tab without resetting state
          localStorage.setItem('lastActiveTab', 'file-upload');
          setActiveTab('file-upload');
          setSelectedVideo(null);

          // Process the file as if it was uploaded
          // Create a new object URL for the file
          const objectUrl = URL.createObjectURL(file);
          localStorage.setItem('current_file_url', objectUrl);

          // Set the uploaded file
          setUploadedFile(file);

          // Reset downloading state
          setIsDownloading(false);
          setDownloadProgress(100);

          setStatus({ message: t('output.videoDownloadComplete', 'Video download complete! Processing...'), type: 'success' });

          // Now process with the downloaded file
          input = file;
          inputType = 'file-upload';

          // Simulate uploading the file to trigger segmentation
          // Create a new FormData object to simulate a file upload
          const formData = new FormData();
          formData.append('file', file);

          // Simulate the upload process
          setStatus({ message: t('output.processingVideo', 'Processing. This may take a few minutes...'), type: 'loading' });

          // Start generating subtitles with the downloaded file
          await generateSubtitles(file, 'file-upload', apiKeysSet);
        } catch (error) {
          console.error('Error processing downloaded video:', error);
          // Reset downloading state
          setIsDownloading(false);
          setDownloadProgress(0);
          setStatus({
            message: t('errors.videoProcessingFailed', 'Video processing failed: {{message}}', { message: error.message }),
            type: 'error'
          });
          return;
        }
      } catch (error) {
        console.error('Error downloading video:', error);
        // Reset downloading state
        setIsDownloading(false);
        setDownloadProgress(0);
        setStatus({ message: `${t('errors.videoDownloadFailed', 'Video download failed')}: ${error.message}`, type: 'error' });
        return;
      }
    } else if (activeTab === 'file-upload' && uploadedFile) {
      input = uploadedFile;
      inputType = 'file-upload';
    }

    await generateSubtitles(input, inputType, apiKeysSet);

    // Reset button animation state when generation is complete
    resetGeminiButtonState();
  };

  /**
   * Prepare video for segment processing by optimizing and splitting
   * @param {File} videoFile - The video file to prepare
   * @returns {Promise<Object>} - Object containing segment information
   */
  const prepareVideoForSegments = async (videoFile) => {
    try {
      // Get video optimization settings from localStorage
      const optimizeVideos = localStorage.getItem('optimize_videos') !== 'false'; // Default to true
      const optimizedResolution = localStorage.getItem('optimized_resolution') || '360p'; // Default to 360p

      // Set status to loading
      setStatus({ message: t('output.preparingVideo', 'Preparing video for segment processing...'), type: 'loading' });

      // Get video duration
      const duration = await getVideoDuration(videoFile);
      console.log(`Video duration: ${duration} seconds`);

      // Calculate number of segments
      const numSegments = Math.ceil(duration / getMaxSegmentDurationSeconds());
      console.log(`Splitting video into ${numSegments} segments`);

      // Upload the media to the server and split it into segments
      const splitResult = await splitVideoOnServer(
        videoFile,
        getMaxSegmentDurationSeconds(),
        (progress, message) => {
          setStatus({
            message: `${message} (${progress}%)`,
            type: 'loading'
          });
        },
        true, // Enable fast splitting by default
        {
          optimizeVideos,
          optimizedResolution
        }
      );

      console.log('Video split into segments:', splitResult);

      // Store the split result in localStorage for later use
      localStorage.setItem('split_result', JSON.stringify(splitResult));

      // Directly update videoSegments state
      setVideoSegments(splitResult.segments);

      // Also dispatch event with segments for potential retries later
      const segmentsEvent = new CustomEvent('videoSegmentsUpdate', {
        detail: splitResult.segments
      });
      window.dispatchEvent(segmentsEvent);

      // Initialize segment status array
      const initialSegmentStatus = splitResult.segments.map((segment, index) => {
        // Calculate time range for this segment
        const startTime = segment.startTime !== undefined ? segment.startTime : index * getMaxSegmentDurationSeconds();
        const segmentDuration = segment.duration !== undefined ? segment.duration : getMaxSegmentDurationSeconds();
        const endTime = startTime + segmentDuration;

        // Format time range for display
        const formatTime = (seconds) => {
          const mins = Math.floor(seconds / 60);
          const secs = Math.floor(seconds % 60);
          return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        const timeRange = `${formatTime(startTime)} - ${formatTime(endTime)}`;

        return {
          status: 'success', // 'success' status will show the retry button
          message: t('output.segmentReady', 'Ready for processing'),
          shortMessage: t('output.ready', 'Ready'),
          timeRange
        };
      });

      // Update segment status
      setSegmentsStatus(initialSegmentStatus);

      return splitResult;
    } catch (error) {
      console.error('Error preparing video for segments:', error);
      setStatus({
        message: t('errors.videoPreparationFailed', 'Video preparation failed: {{message}}', { message: error.message }),
        type: 'error'
      });
      throw error;
    }
  };

  /**
   * Download a YouTube video and prepare it for segment processing
   * This is used when subtitles are loaded from cache for a YouTube video
   */
  const handleDownloadAndPrepareYouTubeVideo = useCallback(async () => {
    if (!selectedVideo) {
      console.error('No YouTube video selected');
      return;
    }

    try {
      // Set downloading state to true to disable the generate button
      setIsDownloading(true);
      setDownloadProgress(0);
      setStatus({ message: t('output.downloadingVideo', 'Downloading video...'), type: 'loading' });

      // Download the YouTube video with the selected quality
      // Extract video ID and set it as current download
      const videoId = extractYoutubeVideoId(selectedVideo.url);
      setCurrentDownloadId(videoId);

      const videoUrl = await downloadYoutubeVideo(
        selectedVideo.url,
        (progress) => {
          setDownloadProgress(progress);
        },
        selectedVideo.quality || '360p' // Use the selected quality or default to 360p
      );

      // Clear the current download ID when done
      setCurrentDownloadId(null);

      try {
        // Create a fetch request to get the video as a blob
        const response = await fetch(videoUrl);

        // Check if the response is ok
        if (!response.ok) {
          throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();

        // Check if the blob has content (not empty)
        if (blob.size === 0) {
          throw new Error('Downloaded video is empty. The file may have been deleted from the server.');
        }

        // Create a File object from the blob
        const filename = `${selectedVideo.title || 'youtube_video'}.mp4`;
        const file = new File([blob], filename, { type: 'video/mp4' });

        // Switch to the upload tab without resetting state
        localStorage.setItem('lastActiveTab', 'file-upload');
        setActiveTab('file-upload');

        // Process the file as if it was uploaded
        const objectUrl = URL.createObjectURL(file);
        localStorage.setItem('current_file_url', objectUrl);

        // Set the uploaded file
        setUploadedFile(file);

        // Reset downloading state
        setIsDownloading(false);
        setDownloadProgress(100);

        // Prepare the video for segment processing
        await prepareVideoForSegments(file);

        // Update status to show that segments are ready
        setStatus({ message: t('output.segmentsReady', 'Video segments are ready for processing!'), type: 'success' });
      } catch (error) {
        console.error('Error processing downloaded video:', error);
        // Reset downloading state
        setIsDownloading(false);
        setDownloadProgress(0);
        setStatus({
          message: t('errors.videoProcessingFailed', 'Video processing failed: {{message}}', { message: error.message }),
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error downloading video:', error);
      // Reset downloading state
      setIsDownloading(false);
      setDownloadProgress(0);
      setStatus({ message: `${t('errors.videoDownloadFailed', 'Video download failed')}: ${error.message}`, type: 'error' });
    }
  }, [selectedVideo, t, setIsDownloading, setDownloadProgress, setStatus, setActiveTab, setUploadedFile, prepareVideoForSegments]);

  // Effect to detect when subtitles are loaded from cache and prepare video for segments
  useEffect(() => {
    // Check if subtitles were loaded from cache
    if (status?.message && status.type === 'success' &&
        (status.message.includes('cache') || status.message.includes('bộ nhớ đệm')) &&
        subtitlesData) {

      // For file upload tab
      if (uploadedFile) {
        console.log('Subtitles loaded from cache, preparing video for segments...');

        // Prepare the video for segments
        prepareVideoForSegments(uploadedFile).catch(error => {
          console.error('Error preparing video for segments after cache load:', error);
          // Show a warning but keep the subtitles
          setStatus({
            message: t('warnings.segmentsPreparationFailed', 'Subtitles loaded, but video segment preparation failed: {{message}}', { message: error.message }),
            type: 'warning'
          });
        });
      }
      // For YouTube tab, we need to download the video first
      else if (activeTab.includes('youtube') && selectedVideo) {
        console.log('Subtitles loaded from cache for YouTube video, downloading video...');

        // We'll handle YouTube videos in a separate function to avoid making this effect too complex
        handleDownloadAndPrepareYouTubeVideo();
      }
    }
  }, [status, subtitlesData, uploadedFile, t, prepareVideoForSegments, activeTab, selectedVideo, handleDownloadAndPrepareYouTubeVideo]);

  const handleRetryGeneration = async () => {
    if (!validateInput()) {
      setStatus({ message: t('errors.invalidInput'), type: 'error' });
      return;
    }

    // If we're in SRT-only mode, just show a message
    if (isSrtOnlyMode) {
      setStatus({ message: t('output.srtOnlyMode', 'Working with SRT only. No video source available.'), type: 'info' });
      return;
    }

    // Set retrying state to true immediately
    setIsRetrying(true);

    let input, inputType;

    // For YouTube tabs, download the video first and switch to upload tab
    if (activeTab.includes('youtube') && selectedVideo) {
      try {
        // Set downloading state to true to disable the generate button
        setIsDownloading(true);
        setDownloadProgress(0);

        // Check if quality is not 360p to show a warning about audio stitching
        const selectedQuality = selectedVideo.quality || '360p';
        if (selectedQuality !== '360p') {
          setStatus({
            message: t('output.audioStitchingWarning', 'Downloading video... Note: For qualities other than 360p, audio stitching is required which may take a long time, especially for videos over 1 hour.'),
            type: 'warning'
          });
        } else {
          setStatus({ message: t('output.downloadingVideo', 'Downloading video...'), type: 'loading' });
        }

        // Download the YouTube video with the selected quality
        const videoUrl = await downloadYoutubeVideo(
          selectedVideo.url,
          (progress) => {
            setDownloadProgress(progress);
            // Just update the download progress state, no need to set status
            // as it will be shown in the Generate button
          },
          selectedVideo.quality || '360p' // Use the selected quality or default to 360p
        );

        try {
          // Create a fetch request to get the video as a blob
          const response = await fetch(videoUrl);

          // Check if the response is ok
          if (!response.ok) {
            throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
          }

          const blob = await response.blob();

          // Check if the blob has content (not empty)
          if (blob.size === 0) {
            throw new Error('Downloaded video is empty. The file may have been deleted from the server.');
          }

          // Create a File object from the blob
          const filename = `${selectedVideo.title || 'youtube_video'}.mp4`;
          const file = new File([blob], filename, { type: 'video/mp4' });

          // Check if video optimization is enabled
          const optimizeVideos = localStorage.getItem('optimize_videos') !== 'false'; // Default to true
          const optimizedResolution = localStorage.getItem('optimized_resolution') || '360p'; // Default to 360p

          if (optimizeVideos) {
            try {
              setStatus({ message: t('output.optimizingVideo', 'Optimizing video for processing...'), type: 'loading' });

              // Call the optimize-video endpoint
              const response = await fetch(`http://localhost:3004/api/optimize-video?resolution=${optimizedResolution}&fps=15`, {
                method: 'POST',
                body: file,
                headers: {
                  'Content-Type': file.type
                }
              });

              if (!response.ok) {
                throw new Error(`Failed to optimize video: ${response.status} ${response.statusText}`);
              }

              const result = await response.json();
              console.log('Video optimization result:', result);

              // Store the optimization result in localStorage
              localStorage.setItem('split_result', JSON.stringify({
                originalMedia: result.originalVideo,
                optimized: {
                  video: result.optimizedVideo,
                  resolution: result.resolution,
                  fps: result.fps,
                  width: result.width,
                  height: result.height
                }
              }));
            } catch (error) {
              console.error('Error optimizing video:', error);
              setStatus({
                message: t('output.optimizationFailed', 'Video optimization failed, using original video.'),
                type: 'warning'
              });
            }
          }

          // Switch to the upload tab without resetting state
          localStorage.setItem('lastActiveTab', 'file-upload');
          setActiveTab('file-upload');
          setSelectedVideo(null);

          // Process the file as if it was uploaded
          // Create a new object URL for the file
          const objectUrl = URL.createObjectURL(file);
          localStorage.setItem('current_file_url', objectUrl);

          // Set the uploaded file
          setUploadedFile(file);

          // Reset downloading state
          setIsDownloading(false);
          setDownloadProgress(100);

          setStatus({ message: t('output.videoDownloadComplete', 'Video download complete! Processing...'), type: 'success' });

          // Now process with the downloaded file
          input = file;
          inputType = 'file-upload';

          // Simulate uploading the file to trigger segmentation
          // Create a new FormData object to simulate a file upload
          const formData = new FormData();
          formData.append('file', file);

          // Simulate the upload process
          setStatus({ message: t('output.processingVideo', 'Processing. This may take a few minutes...'), type: 'loading' });

          // Start generating subtitles with the downloaded file
          await retryGeneration(file, 'file-upload', apiKeysSet);
        } catch (error) {
          console.error('Error processing downloaded video:', error);
          // Reset downloading state
          setIsDownloading(false);
          setDownloadProgress(0);
          // Reset retrying state
          setIsRetrying(false);
          setStatus({
            message: t('errors.videoProcessingFailed', 'Video processing failed: {{message}}', { message: error.message }),
            type: 'error'
          });
          return;
        }
      } catch (error) {
        console.error('Error downloading video:', error);
        // Reset downloading state
        setIsDownloading(false);
        setDownloadProgress(0);
        // Reset retrying state
        setIsRetrying(false);
        setStatus({ message: `${t('errors.videoDownloadFailed', 'Video download failed')}: ${error.message}`, type: 'error' });
        return;
      }
    } else if (activeTab === 'file-upload' && uploadedFile) {
      input = uploadedFile;
      inputType = 'file-upload';
    }

    try {
      await retryGeneration(input, inputType, apiKeysSet);
    } finally {
      // Reset retrying state regardless of success or failure
      setIsRetrying(false);
      // Reset button animation state when generation is complete
      resetGeminiButtonState();
    }
  };

  /**
   * Handle cancelling the current download
   */
  const handleCancelDownload = () => {
    if (currentDownloadId) {
      // Cancel the download
      cancelYoutubeVideoDownload(currentDownloadId);

      // Reset states
      setIsDownloading(false);
      setDownloadProgress(0);
      setCurrentDownloadId(null);
      setStatus({ message: t('output.downloadCancelled', 'Download cancelled'), type: 'warning' });
    }
  };

  const handleTabChange = (tab) => {
    localStorage.setItem('lastActiveTab', tab);
    setActiveTab(tab);
    setSelectedVideo(null);
    setUploadedFile(null);
    setStatus({}); // Reset status
    setSubtitlesData(null); // Reset subtitles data
    setIsSrtOnlyMode(false); // Reset SRT-only mode
    localStorage.removeItem('current_video_url');
    localStorage.removeItem('current_file_url');
    localStorage.removeItem('current_file_cache_id'); // Also clear the file cache ID
  };

  // Handle using the recommended preset from video analysis
  const handleUseRecommendedPreset = (presetId) => {
    console.log('handleUseRecommendedPreset called with presetId:', presetId);
    // Find the preset
    const preset = PROMPT_PRESETS.find(p => p.id === presetId);
    if (preset) {
      // Save the preset to localStorage
      localStorage.setItem('transcription_prompt', preset.prompt);
      localStorage.setItem('selected_preset', presetId);

      // Save the transcription rules
      if (videoAnalysisResult && videoAnalysisResult.transcriptionRules) {
        setTranscriptionRules(videoAnalysisResult.transcriptionRules);
        setTranscriptionRulesState(videoAnalysisResult.transcriptionRules);
      }

      // Update status to indicate we're moving forward
      setStatus({
        message: t('output.preparingSplitting', 'Preparing to split video into segments...'),
        type: 'loading'
      });

      // Dispatch event to notify videoProcessor that user has made a choice
      const userChoiceEvent = new CustomEvent('videoAnalysisUserChoice', {
        detail: {
          presetId,
          transcriptionRules: videoAnalysisResult?.transcriptionRules
        }
      });
      window.dispatchEvent(userChoiceEvent);
      console.log('Dispatched videoAnalysisUserChoice event with presetId:', presetId);

      // Clear the localStorage flags and set processing flag
      localStorage.removeItem('show_video_analysis');
      localStorage.removeItem('video_analysis_timestamp');
      localStorage.removeItem('video_analysis_result'); // Also clear the result
      localStorage.setItem('video_processing_in_progress', 'true'); // Set processing flag
      console.log('Removed video analysis data from localStorage and set processing flag');

      // Close the modal
      setShowVideoAnalysis(false);
      setVideoAnalysisResult(null); // Clear the result to prevent re-showing
      console.log('Modal closed after using recommended preset');
    }
  };

  // Handle using the default preset from settings
  const handleUseDefaultPreset = () => {
    console.log('handleUseDefaultPreset called');

    // Update status to indicate we're moving forward
    setStatus({
      message: t('output.preparingSplitting', 'Preparing to split video into segments...'),
      type: 'loading'
    });

    // Dispatch event to notify videoProcessor that user has made a choice
    const userChoiceEvent = new CustomEvent('videoAnalysisUserChoice', {
      detail: {
        presetId: null, // Use default preset
        transcriptionRules: videoAnalysisResult?.transcriptionRules // Still use the rules
      }
    });
    window.dispatchEvent(userChoiceEvent);
    console.log('Dispatched videoAnalysisUserChoice event with default preset');

    // Save the transcription rules
    if (videoAnalysisResult && videoAnalysisResult.transcriptionRules) {
      setTranscriptionRules(videoAnalysisResult.transcriptionRules);
      setTranscriptionRulesState(videoAnalysisResult.transcriptionRules);
    }

    // Clear the localStorage flags and set processing flag
    localStorage.removeItem('show_video_analysis');
    localStorage.removeItem('video_analysis_timestamp');
    localStorage.removeItem('video_analysis_result'); // Also clear the result
    localStorage.setItem('video_processing_in_progress', 'true'); // Set processing flag
    console.log('Removed video analysis data from localStorage and set processing flag');

    // Close the modal
    setShowVideoAnalysis(false);
    setVideoAnalysisResult(null); // Clear the result to prevent re-showing
    console.log('Modal closed after using default preset');
  };

  // Handle editing the transcription rules
  const handleEditRules = (rules) => {
    console.log('handleEditRules called, closing VideoAnalysisModal and opening TranscriptionRulesEditor');
    setTranscriptionRulesState(rules);
    setShowRulesEditor(true);
    // Close the video analysis modal when opening the rules editor
    setShowVideoAnalysis(false);
    // Clear localStorage flags to ensure modal stays closed
    localStorage.removeItem('show_video_analysis');
    localStorage.removeItem('video_analysis_timestamp');
    console.log('VideoAnalysisModal should now be closed, showVideoAnalysis:', false);
  };

  // Handle saving the edited transcription rules
  const handleSaveRules = (editedRules) => {
    setTranscriptionRulesState(editedRules);
    setTranscriptionRules(editedRules);

    // Update the analysis result with the edited rules
    if (videoAnalysisResult) {
      setVideoAnalysisResult({
        ...videoAnalysisResult,
        transcriptionRules: editedRules
      });
    }
  };

  return (
    <>
      <Header
        onSettingsClick={() => setShowSettings(true)}
      />

      {isAppReady && (
        <main className="app-main">
          <InputMethods
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            selectedVideo={selectedVideo}
            setSelectedVideo={setSelectedVideo}
            uploadedFile={uploadedFile}
            setUploadedFile={setUploadedFile}
            apiKeysSet={apiKeysSet}
          />

          {/* Consistent layout container for buttons and output */}
          <div className="content-layout-container">
          <div className="buttons-container">
            <SrtUploadButton
              onSrtUpload={handleSrtUpload}
              disabled={isGenerating || isDownloading}
            />
              {/* Hide generate button when retrying segments, when isRetrying is true, or when any segment is being retried */}
              {validateInput() && retryingSegments.length === 0 && !isRetrying && !segmentsStatus.some(segment => segment.status === 'retrying') && (
                <button
                  className={`generate-btn ${isGenerating || isDownloading ? 'processing' : ''}`}
                  onClick={handleGenerateSubtitles}
                  disabled={isGenerating || isDownloading}
                >
                {/* Static Gemini icons for fallback */}
                <div className="gemini-icon-container">
                  <div className="gemini-mini-icon random-1 size-sm">
                    <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                  </div>
                  <div className="gemini-mini-icon random-3 size-md">
                    <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                  </div>
                </div>
                {isGenerating || isDownloading ? (
                  <span className="processing-text-container">
                    <span className="processing-gemini-icon">
                      <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    </span>
                    <span className="processing-text">
                      {isDownloading
                        ? t('output.downloadingVideoProgress', 'Downloading video: {{progress}}%', { progress: downloadProgress })
                        : t('output.processingVideo').split('...')[0]
                      }
                    </span>
                    <span className="processing-dots"></span>
                  </span>
                ) : isSrtOnlyMode ? t('output.srtOnlyMode', 'Working with SRT only') : t('header.tagline')}
              </button>
              )}

              {/* Add cancel button as a proper member of the buttons-container */}
              {isDownloading && currentDownloadId && validateInput() && retryingSegments.length === 0 && !isRetrying && !segmentsStatus.some(segment => segment.status === 'retrying') && (
                <button
                  className="cancel-download-btn"
                  onClick={handleCancelDownload}
                  title={t('output.cancelDownload', 'Cancel download')}
                >
                  {/* Static Gemini icons for fallback */}
                  <div className="gemini-icon-container">
                    <div className="gemini-mini-icon random-1 size-sm">
                      <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    </div>
                    <div className="gemini-mini-icon random-3 size-md">
                      <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    </div>
                  </div>
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                  {t('output.cancelDownload', 'Cancel Download')}
                </button>
              )}

              {(subtitlesData || status.type === 'error') && !isGenerating && !isDownloading && (
                <button
                  className={`retry-gemini-btn ${retryingSegments.length > 0 ? 'processing' : ''}`}
                  onClick={handleRetryGeneration}
                  disabled={isGenerating || isDownloading}
                  title={t('output.retryGeminiTooltip')}
                >
                  {/* Static Gemini icons for fallback */}
                  <div className="gemini-icon-container">
                    <div className="gemini-mini-icon random-2 size-sm">
                      <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    </div>
                    <div className="gemini-mini-icon random-4 size-md">
                      <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    </div>
                  </div>
                  {retryingSegments.length > 0 ? (
                    <span className="processing-text-container">
                      <span className="processing-gemini-icon">
                        <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" stroke="currentColor" strokeWidth="1.5"/>
                        </svg>
                      </span>
                      <span className="processing-text">{t('output.processingVideo').split('...')[0]}</span>
                      <span className="processing-dots"></span>
                    </span>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                        <path d="M1 4v6h6"></path>
                        <path d="M23 20v-6h-6"></path>
                        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                      </svg>
                      {t('output.retryGemini')}
                    </>
                  )}
                </button>

              )}

              {(isGenerating || retryingSegments.length > 0 || isRetrying) && (
                <button
                    className="force-stop-btn"
                    onClick={(e) => {
                      // Add processing class for animation
                      e.currentTarget.classList.add('processing');

                      // Remove processing class after animation completes
                      setTimeout(() => {
                        if (e.currentTarget) {
                          e.currentTarget.classList.remove('processing');
                        }
                      }, 1000);
                      // Abort all ongoing Gemini API requests
                      abortAllRequests();
                      // Reset retrying state immediately
                      setIsRetrying(false);
                      // The state will be updated by the event listener in useSubtitles hook
                    }}
                    title={t('output.forceStopTooltip', 'Force stop all Gemini requests')}
                  >
                    {/* Static Gemini icons for fallback */}
                    <div className="gemini-icon-container">
                      <div className="gemini-mini-icon random-1 size-sm">
                        <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" stroke="currentColor" strokeWidth="1.5"/>
                        </svg>
                      </div>
                      <div className="gemini-mini-icon random-3 size-md">
                        <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" stroke="currentColor" strokeWidth="1.5"/>
                        </svg>
                      </div>
                      <div className="gemini-mini-icon random-2 size-sm">
                        <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" stroke="currentColor" strokeWidth="1.5"/>
                        </svg>
                      </div>
                      <div className="gemini-mini-icon random-4 size-md">
                        <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" stroke="currentColor" strokeWidth="1.5"/>
                        </svg>
                      </div>
                    </div>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    </svg>
                    {t('output.forceStop', 'Force Stop')}
                  </button>
                )}
            </div>

          <OutputContainer
            status={status}
            subtitlesData={subtitlesData}
            setSubtitlesData={setSubtitlesData} // Pass the setter function
            selectedVideo={selectedVideo}
            uploadedFile={uploadedFile}
            isGenerating={isGenerating}
            segmentsStatus={segmentsStatus}
            activeTab={activeTab}
            onRetrySegment={retrySegment}
            onRetryWithModel={handleRetryWithModel}
            onGenerateSegment={handleGenerateSegment}
            videoSegments={videoSegments}
            retryingSegments={retryingSegments}
            timeFormat={timeFormat}
            showWaveform={showWaveform}
            useOptimizedPreview={useOptimizedPreview}
            isSrtOnlyMode={isSrtOnlyMode}
          />
          </div>
        </main>
      )}

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onSave={saveApiKeys}
          apiKeysSet={apiKeysSet}
          setApiKeysSet={setApiKeysSet}
          optimizeVideos={optimizeVideos}
          optimizedResolution={optimizedResolution}
          useOptimizedPreview={useOptimizedPreview}
        />
      )}

      {showOnboarding && (
        <OnboardingModal
          onComplete={(selections) => {
            // Save the selected preset to transcription prompt
            const selectedPreset = PROMPT_PRESETS.find(preset => preset.id === selections.presetId);
            if (selectedPreset) {
              let promptText = selectedPreset.prompt;

              // If it's the translation preset and a target language is provided, replace the placeholder
              if (selections.presetId === 'translate-vietnamese' && selections.targetLanguage) {
                promptText = promptText.replace(/TARGET_LANGUAGE/g, selections.targetLanguage);
              }

              localStorage.setItem('transcription_prompt', promptText);
            }

            // Mark onboarding as complete
            setShowOnboarding(false);
            setIsAppReady(true);

            // Show a success message
            setStatus({
              message: t('onboarding.completed', 'Setup complete! You can change these settings anytime.'),
              type: 'success'
            });

            // Clear the message after 5 seconds
            setTimeout(() => {
              setStatus({});
            }, 5000);
          }}
        />
      )}

      {/* Video Analysis Modal */}
      {console.log('Render - showVideoAnalysis:', showVideoAnalysis, 'videoAnalysisResult:', videoAnalysisResult)}
      {/* Check if we should show the modal */}
      {((showVideoAnalysis || localStorage.getItem('show_video_analysis') === 'true') &&
        (videoAnalysisResult || localStorage.getItem('video_analysis_result'))) && (
        <VideoAnalysisModal
          isOpen={true}
          onClose={() => {
            // Clear localStorage flags
            localStorage.removeItem('show_video_analysis');
            localStorage.removeItem('video_analysis_timestamp');
            localStorage.removeItem('video_analysis_result');
            setShowVideoAnalysis(false);
            setVideoAnalysisResult(null);
            console.log('Video analysis modal closed by user');
            // Use default preset if user closes the modal
            handleUseDefaultPreset();
          }}
          analysisResult={videoAnalysisResult}
          onUsePreset={handleUseRecommendedPreset}
          onUseDefaultPreset={handleUseDefaultPreset}
          onEditRules={handleEditRules}
        />
      )}

      {/* Transcription Rules Editor */}
      {showRulesEditor && transcriptionRules && (
        <TranscriptionRulesEditor
          isOpen={showRulesEditor}
          onClose={() => setShowRulesEditor(false)}
          initialRules={transcriptionRules}
          onSave={handleSaveRules}
        />
      )}

      {/* Toast for translation warnings */}
      <TranslationWarningToast />
    </>
  );
}

export default App;