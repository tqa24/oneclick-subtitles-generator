import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './styles/App.css';
import './styles/GeminiButtonAnimations.css';
import './styles/ProcessingTextAnimation.css';
import './styles/SrtUploadButton.css';
import Header from './components/Header';
import InputMethods from './components/InputMethods';
import OutputContainer from './components/OutputContainer';
import SettingsModal from './components/SettingsModal';
import OnboardingModal from './components/OnboardingModal';
import TranslationWarningToast from './components/TranslationWarningToast';
import SrtUploadButton from './components/SrtUploadButton';
import { useSubtitles } from './hooks/useSubtitles';
import { downloadYoutubeVideo } from './utils/videoDownloader';
import { initGeminiButtonEffects, resetGeminiButtonState, resetAllGeminiButtonEffects } from './utils/geminiButtonEffects';
import { hasValidTokens } from './services/youtubeApiService';
import { abortAllRequests, PROMPT_PRESETS } from './services/geminiService';
import { parseSrtContent } from './utils/srtParser';

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
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(localStorage.getItem('onboarding_completed') !== 'true');
  const [isAppReady, setIsAppReady] = useState(!showOnboarding);

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

  const saveApiKeys = (geminiKey, youtubeKey, segmentDuration = 3, geminiModel, timeFormat, showWaveformSetting) => {
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
  const handleSrtUpload = async (srtContent, fileName) => {
    try {
      // Parse the SRT content
      const parsedSubtitles = parseSrtContent(srtContent);

      if (parsedSubtitles.length === 0) {
        setStatus({ message: t('errors.invalidSrtFormat', 'Invalid SRT format or empty file'), type: 'error' });
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
        // For file upload tab, just set the subtitles data directly
        setSubtitlesData(parsedSubtitles);
        setStatus({ message: t('output.srtUploadSuccess', 'SRT file uploaded successfully!'), type: 'success' });
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

  const handleRetryGeneration = async () => {
    if (!validateInput()) {
      setStatus({ message: t('errors.invalidInput'), type: 'error' });
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

    await retryGeneration(input, inputType, apiKeysSet);

    // Reset button animation state when generation is complete
    resetGeminiButtonState();
  };

  const handleTabChange = (tab) => {
    localStorage.setItem('lastActiveTab', tab);
    setActiveTab(tab);
    setSelectedVideo(null);
    setUploadedFile(null);
    setStatus({}); // Reset status
    setSubtitlesData(null); // Reset subtitles data
    localStorage.removeItem('current_video_url');
    localStorage.removeItem('current_file_url');
    localStorage.removeItem('current_file_cache_id'); // Also clear the file cache ID
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
          {validateInput() && (
            <div className="buttons-container">
              <SrtUploadButton
                onSrtUpload={handleSrtUpload}
                disabled={isGenerating || isDownloading}
              />
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
                ) : t('header.tagline')}
              </button>

              {(subtitlesData || status.type === 'error') && !isGenerating && !isDownloading && (
                <>
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

                {(isGenerating || retryingSegments.length > 0) && (
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
                </>
              )}
            </div>
          )}

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

      {/* Toast for translation warnings */}
      <TranslationWarningToast />
    </>
  );
}

export default App;