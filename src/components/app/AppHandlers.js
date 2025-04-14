import { parseSrtContent } from '../../utils/srtParser';
import { resetGeminiButtonState } from '../../utils/geminiButtonEffects';
import { cancelYoutubeVideoDownload, extractYoutubeVideoId } from '../../utils/videoDownloader';
import { prepareVideoForSegments, downloadAndPrepareYouTubeVideo } from './VideoProcessingHandlers';
import { hasValidTokens } from '../../services/youtubeApiService';

/**
 * Hook for application event handlers
 */
export const useAppHandlers = (appState) => {
  const {
    activeTab,
    setActiveTab,
    selectedVideo,
    setSelectedVideo,
    uploadedFile,
    setUploadedFile,
    apiKeysSet,
    setStatus,
    setSubtitlesData,
    isDownloading,
    setIsDownloading,
    downloadProgress,
    setDownloadProgress,
    currentDownloadId,
    setCurrentDownloadId,
    isSrtOnlyMode,
    setIsSrtOnlyMode,
    userProvidedSubtitles,
    useUserProvidedSubtitles,
    generateSubtitles,
    retryGeneration,
    isRetrying,
    setIsRetrying,
    setSegmentsStatus,
    setVideoSegments,
    t = (key, defaultValue) => defaultValue // Provide a default implementation if t is not available
  } = appState;

  /**
   * Validate input before generating subtitles
   */
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

  /**
   * Handle SRT file upload
   */
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
      } else {
        // If we have a video source, make sure we're not in SRT-only mode
        setIsSrtOnlyMode(false);
      }

      // If we're in YouTube tabs, we need to download the video first
      if (activeTab.includes('youtube') && selectedVideo) {
        try {
          // Set downloading state to true to disable the generate button
          setIsDownloading(true);
          setDownloadProgress(0);
          setStatus({ message: t('output.downloadingVideo', 'Downloading video...'), type: 'loading' });

          // We'll set the subtitles data after the video is downloaded and prepared

          // Create a wrapper function that includes the additional parameters
          const prepareVideoWrapper = async (file) => {
            return prepareVideoForSegments(file, setStatus, setVideoSegments, setSegmentsStatus, t);
          };

          // Download and prepare the YouTube video
          await downloadAndPrepareYouTubeVideo(
            selectedVideo,
            setIsDownloading,
            setDownloadProgress,
            setStatus,
            setCurrentDownloadId,
            setActiveTab,
            setUploadedFile,
            setIsSrtOnlyMode,
            prepareVideoWrapper,
            t
          );

          // Set the subtitles data directly after video is prepared
          setSubtitlesData(parsedSubtitles);
          setStatus({ message: t('output.srtUploadSuccess', 'SRT file uploaded successfully!'), type: 'success' });

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

          // Create a wrapper function that includes the additional parameters
          const prepareVideoWrapper = async (file) => {
            return prepareVideoForSegments(file, setStatus, setVideoSegments, setSegmentsStatus, t);
          };

          // Prepare the video for segment processing
          await prepareVideoWrapper(uploadedFile);

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

  /**
   * Handle generating subtitles
   */
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

        // Create a wrapper function that includes the additional parameters
        const prepareVideoWrapper = async (file) => {
          return prepareVideoForSegments(file, setStatus, setVideoSegments, setSegmentsStatus, t);
        };

        // Download and prepare the YouTube video
        const downloadedFile = await downloadAndPrepareYouTubeVideo(
          selectedVideo,
          setIsDownloading,
          setDownloadProgress,
          setStatus,
          setCurrentDownloadId,
          setActiveTab,
          setUploadedFile,
          setIsSrtOnlyMode,
          prepareVideoWrapper,
          t
        );

        // Now process with the downloaded file
        input = downloadedFile;
        inputType = 'file-upload';

        // Prepare options for subtitle generation
        const subtitleOptions = {};

        // Add user-provided subtitles if available and enabled
        if (useUserProvidedSubtitles && userProvidedSubtitles) {
          subtitleOptions.userProvidedSubtitles = userProvidedSubtitles;
          console.log('Using user-provided subtitles for generation');
        }

        // Start generating subtitles with the downloaded file
        await generateSubtitles(input, inputType, apiKeysSet, subtitleOptions);
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

      // Prepare options for subtitle generation
      const subtitleOptions = {};

      // Add user-provided subtitles if available and enabled
      if (useUserProvidedSubtitles && userProvidedSubtitles) {
        subtitleOptions.userProvidedSubtitles = userProvidedSubtitles;
        console.log('Using user-provided subtitles for generation');
      }

      await generateSubtitles(input, inputType, apiKeysSet, subtitleOptions);
    }

    // Reset button animation state when generation is complete
    resetGeminiButtonState();
  };

  /**
   * Handle retrying subtitle generation
   */
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

        // Create a wrapper function that includes the additional parameters
        const prepareVideoWrapper = async (file) => {
          return prepareVideoForSegments(file, setStatus, setVideoSegments, setSegmentsStatus, t);
        };

        // Download and prepare the YouTube video
        const downloadedFile = await downloadAndPrepareYouTubeVideo(
          selectedVideo,
          setIsDownloading,
          setDownloadProgress,
          setStatus,
          setCurrentDownloadId,
          setActiveTab,
          setUploadedFile,
          setIsSrtOnlyMode,
          prepareVideoWrapper,
          t
        );

        // Now process with the downloaded file
        input = downloadedFile;
        inputType = 'file-upload';

        // Prepare options for subtitle generation
        const subtitleOptions = {};

        // Add user-provided subtitles if available and enabled
        if (useUserProvidedSubtitles && userProvidedSubtitles) {
          subtitleOptions.userProvidedSubtitles = userProvidedSubtitles;
          console.log('Using user-provided subtitles for retry generation');
        }

        // Start generating subtitles with the downloaded file
        await retryGeneration(input, inputType, apiKeysSet, subtitleOptions);
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

      try {
        // Prepare options for subtitle generation
        const subtitleOptions = {};

        // Add user-provided subtitles if available and enabled
        if (useUserProvidedSubtitles && userProvidedSubtitles) {
          subtitleOptions.userProvidedSubtitles = userProvidedSubtitles;
          console.log('Using user-provided subtitles for retry generation');
        }

        await retryGeneration(input, inputType, apiKeysSet, subtitleOptions);
      } finally {
        // Reset retrying state regardless of success or failure
        setIsRetrying(false);
        // Reset button animation state when generation is complete
        resetGeminiButtonState();
      }
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

  /**
   * Handle tab change
   */
  const handleTabChange = (tab) => {
    localStorage.setItem('lastActiveTab', tab);
    setActiveTab(tab);
    setSelectedVideo(null);
    setUploadedFile(null);
    setStatus({}); // Reset status
    setSubtitlesData(null); // Reset subtitles data

    // Only reset SRT-only mode if we don't have subtitles data in localStorage
    const subtitlesData = localStorage.getItem('subtitles_data');
    if (!subtitlesData) {
      setIsSrtOnlyMode(false); // Reset SRT-only mode
    }

    localStorage.removeItem('current_video_url');
    localStorage.removeItem('current_file_url');
    localStorage.removeItem('current_file_cache_id'); // Also clear the file cache ID
  };

  /**
   * Handle saving API keys and settings
   */
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
      appState.setTimeFormat(timeFormat);
    }

    // Save waveform setting
    if (showWaveformSetting !== undefined) {
      localStorage.setItem('show_waveform', showWaveformSetting.toString());
      appState.setShowWaveform(showWaveformSetting);
    }

    // Save Gemini model
    if (geminiModel) {
      localStorage.setItem('gemini_model', geminiModel);
    }

    // Save video optimization settings
    if (optimizeVideosSetting !== undefined) {
      localStorage.setItem('optimize_videos', optimizeVideosSetting.toString());
      appState.setOptimizeVideos(optimizeVideosSetting);
    }

    if (optimizedResolutionSetting) {
      localStorage.setItem('optimized_resolution', optimizedResolutionSetting);
      appState.setOptimizedResolution(optimizedResolutionSetting);
    }

    if (useOptimizedPreviewSetting !== undefined) {
      localStorage.setItem('use_optimized_preview', useOptimizedPreviewSetting.toString());
      appState.setUseOptimizedPreview(useOptimizedPreviewSetting);
    }

    // Update state based on the selected authentication method
    const useOAuth = localStorage.getItem('use_youtube_oauth') === 'true';
    const hasOAuthTokens = hasValidTokens();

    appState.setApiKeysSet({
      gemini: !!geminiKey,
      youtube: useOAuth ? hasOAuthTokens : !!youtubeKey
    });

    // Show success notification
    setStatus({ message: t('settings.savedSuccessfully', 'Settings saved successfully!'), type: 'success' });
  };

  // Create a wrapper function for prepareVideoForSegments that includes the additional parameters
  const prepareVideoForSegmentsWrapper = async (file) => {
    return prepareVideoForSegments(file, setStatus, setVideoSegments, setSegmentsStatus, t);
  };

  // Create a wrapper function for downloadAndPrepareYouTubeVideo
  const handleDownloadAndPrepareYouTubeVideo = async () => {
    if (!selectedVideo) {
      console.error('No YouTube video selected');
      return;
    }

    await downloadAndPrepareYouTubeVideo(
      selectedVideo,
      setIsDownloading,
      setDownloadProgress,
      setStatus,
      setCurrentDownloadId,
      setActiveTab,
      setUploadedFile,
      setIsSrtOnlyMode,
      prepareVideoForSegmentsWrapper,
      t
    );
  };

  return {
    validateInput,
    handleSrtUpload,
    handleGenerateSubtitles,
    handleRetryGeneration,
    handleCancelDownload,
    handleTabChange,
    saveApiKeys,
    prepareVideoForSegments: prepareVideoForSegmentsWrapper,
    handleDownloadAndPrepareYouTubeVideo
  };
};
