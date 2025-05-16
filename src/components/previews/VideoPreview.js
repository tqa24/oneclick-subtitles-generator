import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  startYoutubeVideoDownload,
  checkDownloadStatus,
  extractYoutubeVideoId
} from '../../utils/videoDownloader';
import { renderSubtitlesToVideo, downloadVideo } from '../../utils/videoUtils';
import { convertTimeStringToSeconds } from '../../utils/vttUtils';
import { extractAndDownloadAudio } from '../../utils/fileUtils';
import SubtitleSettings from '../SubtitleSettings';
// Narration settings now integrated into the translation section
import '../../styles/VideoPreview.css';
import '../../styles/narration/index.css';
import { SERVER_URL } from '../../config';

const VideoPreview = ({ currentTime, setCurrentTime, setDuration, videoSource, onSeek, translatedSubtitles, subtitlesArray, onVideoUrlReady, onReferenceAudioChange }) => {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const seekLockRef = useRef(false);
  const lastTimeUpdateRef = useRef(0); // Track last time update to throttle updates
  const lastPlayStateRef = useRef(false); // Track last play state to avoid redundant updates
  // isFullscreen state is set but not directly used in rendering - used for event handling
  const [, setIsFullscreen] = useState(false); // Track fullscreen state
  const [videoUrl, setVideoUrl] = useState('');
  const [optimizedVideoUrl, setOptimizedVideoUrl] = useState('');
  const [optimizedVideoInfo, setOptimizedVideoInfo] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isAudioDownloading, setIsAudioDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [videoId, setVideoId] = useState(null);
  const [downloadCheckInterval, setDownloadCheckInterval] = useState(null);
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [isRefreshingNarration, setIsRefreshingNarration] = useState(false); // Track narration refresh state
  // Native track subtitles disabled - using only custom subtitle display
  const [useOptimizedPreview, setUseOptimizedPreview] = useState(() => {
    return localStorage.getItem('use_optimized_preview') !== 'false';
  });

  // State for custom subtitle display
  const [currentSubtitleText, setCurrentSubtitleText] = useState('');

  // Native track subtitles disabled - using only custom subtitle display

  const [subtitleSettings, setSubtitleSettings] = useState(() => {
    // Try to load settings from localStorage
    const savedSettings = localStorage.getItem('subtitle_settings');
    if (savedSettings) {
      try {
        return JSON.parse(savedSettings);
      } catch (e) {
        console.error('Error parsing saved subtitle settings:', e);
      }
    }

    // Default settings if nothing is saved
    return {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24',
      fontWeight: '400',
      position: '90', // Now a percentage value from 0 (top) to 100 (bottom)
      boxWidth: '80',
      backgroundColor: '#000000',
      opacity: '0.7',
      textColor: '#ffffff',
      showTranslatedSubtitles: false
    };
  });
  // We track play state in lastPlayStateRef instead of using state to avoid unnecessary re-renders

  // Process the video URL (download if it's YouTube)
  const processVideoUrl = useCallback(async (url) => {


    // Reset states
    setError('');
    setIsLoaded(false);

    // Check if it's a YouTube URL
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      try {
        // Don't set downloading state to true until we know we need to download
        // This prevents the downloading UI from showing unnecessarily
        setDownloadProgress(0);

        // Store the URL for future use
        localStorage.setItem('current_video_url', url);

        // Extract video ID (used by the download process internally)
        extractYoutubeVideoId(url);

        // Start the download process but don't wait for it to complete
        const id = startYoutubeVideoDownload(url);
        setVideoId(id);

        // Check initial status - it might already be complete if cached
        const initialStatus = checkDownloadStatus(id);
        if (initialStatus.status === 'completed') {
          setVideoUrl(initialStatus.url);
          setIsDownloading(false);
        } else if (initialStatus.status === 'downloading') {
          // Only set downloading state to true if we're actually downloading
          setIsDownloading(true);
          setDownloadProgress(initialStatus.progress || 1); // Set to at least 1% to show progress
        }
      } catch (err) {
        console.error('Error starting YouTube video download:', err);
        setError(t('preview.videoError', `Error loading video: ${err.message}`));
        setIsDownloading(false);
      }
    } else {
      // Not a YouTube URL, use directly
      setVideoUrl(url);
    }
  }, [t, setError, setIsLoaded, setIsDownloading, setDownloadProgress, setVideoId, setVideoUrl]);

  // Initialize video source
  useEffect(() => {
    const loadVideo = async () => {
      // Reset video state when source changes
      setIsLoaded(false);
      setVideoUrl('');
      setOptimizedVideoUrl('');
      setError('');
      setOptimizedVideoInfo(null); // Reset optimized video info
      setIsDownloading(false); // Reset downloading state
      setDownloadProgress(0); // Reset download progress

      // Clear narration data when video source changes
      // Only log in development mode
      if (process.env.NODE_ENV === 'development') {

      }
      window.originalNarrations = [];
      window.translatedNarrations = [];
      localStorage.removeItem('originalNarrations');
      localStorage.removeItem('translatedNarrations');

      // Dispatch event to notify other components that narrations have been cleared
      const event = new CustomEvent('narrations-updated', {
        detail: {
          source: 'original',
          narrations: []
        }
      });
      window.dispatchEvent(event);

      const translatedEvent = new CustomEvent('narrations-updated', {
        detail: {
          source: 'translated',
          narrations: []
        }
      });
      window.dispatchEvent(translatedEvent);

      if (!videoSource) {
        // Don't show error message - SRT-only mode will be activated in App.js
        return;
      }

      // Only log in development mode
      if (process.env.NODE_ENV === 'development') {

      }

      // If it's a blob URL (from file upload), use it directly
      if (videoSource.startsWith('blob:')) {
        // Only log in development mode
        if (process.env.NODE_ENV === 'development') {

        }
        setVideoUrl(videoSource);

        // Check if we have an optimized version in localStorage
        try {
          const splitResult = JSON.parse(localStorage.getItem('split_result') || '{}');

          // Verify the optimized video exists and matches the current video source
          if (splitResult.optimized && splitResult.optimized.video &&
              splitResult.originalMedia && // Make sure we have original media info
              // Check if this split result is for the current video
              // by comparing the timestamp in the URL or filename
              videoSource.includes(splitResult.originalMedia.split('/').pop().split('.')[0])) {

            // Only log in development mode
            if (process.env.NODE_ENV === 'development') {

            }
            setOptimizedVideoUrl(`${SERVER_URL}${splitResult.optimized.video}`);

            // Store the optimization info
            setOptimizedVideoInfo({
              resolution: splitResult.optimized.resolution || '360p',
              fps: splitResult.optimized.fps || 15,
              width: splitResult.optimized.width,
              height: splitResult.optimized.height
            });
          } else {
            // Only log in development mode
            if (process.env.NODE_ENV === 'development') {

            }
            setOptimizedVideoUrl('');
            setOptimizedVideoInfo(null);
          }
        } catch (error) {
          console.error('Error parsing split result from localStorage:', error);
          setOptimizedVideoUrl('');
          setOptimizedVideoInfo(null);
        }
        return;
      }

      // If it's a YouTube URL, handle download
      if (videoSource.includes('youtube.com') || videoSource.includes('youtu.be')) {
        await processVideoUrl(videoSource);
        return;
      }

      // For any other URL, try to use it directly
      setVideoUrl(videoSource);
    };

    loadVideo();
  }, [videoSource, t, processVideoUrl]);

  // Notify parent component when videoUrl changes
  useEffect(() => {
    // Determine which URL to use based on the useOptimizedPreview setting
    const urlToUse = useOptimizedPreview && optimizedVideoUrl ? optimizedVideoUrl : videoUrl;

    if (urlToUse && onVideoUrlReady) {
      onVideoUrlReady(urlToUse);
    }
  }, [videoUrl, optimizedVideoUrl, useOptimizedPreview, onVideoUrlReady]);

  // Check download status at interval if we have a videoId
  useEffect(() => {
    if (!videoId) return;

    // Clear any existing interval
    if (downloadCheckInterval) {
      clearInterval(downloadCheckInterval);
    }

    // Set up a new interval to check download status
    const interval = setInterval(() => {
      const status = checkDownloadStatus(videoId);

      if (status.status === 'completed') {
        setVideoUrl(status.url);
        setIsDownloading(false);
        clearInterval(interval);
        setDownloadCheckInterval(null); // Reset the interval state
      } else if (status.status === 'error') {
        setError(t('preview.videoError', `Error loading video: ${status.error}`));
        setIsDownloading(false);
        clearInterval(interval);
        setDownloadCheckInterval(null); // Reset the interval state
      } else if (status.status === 'not_found') {
        // If the download was cancelled or doesn't exist, stop checking
        setIsDownloading(false);
        clearInterval(interval);
        setDownloadCheckInterval(null); // Reset the interval state
      } else if (status.status === 'downloading') {
        // Only update progress if we're actually downloading and progress is > 0
        if (status.progress > 0) {
          setIsDownloading(true);
          setDownloadProgress(status.progress);
        } else {
          // If progress is 0, don't show the downloading UI
          setIsDownloading(false);
        }
      }
    }, 1000);

    setDownloadCheckInterval(interval);

    // Clean up on unmount
    return () => {
      clearInterval(interval);
      // Don't update state during cleanup to avoid React warnings
    };
  }, [videoId, t, downloadCheckInterval, setVideoUrl, setIsDownloading, setError, setDownloadProgress, setDownloadCheckInterval]);

  // processVideoUrl is now defined inside the useEffect above

  // We don't need a separate cleanup effect since we're handling cleanup in the main effect above

  // Handle native video element
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Validate the video URL
    if (!videoUrl) {

      setError(t('preview.videoError', 'No video URL provided.'));
      return;
    }

    // Event handlers
    const handleMetadataLoaded = () => {
      // Only log in development mode
      if (process.env.NODE_ENV === 'development') {

      }
      setIsLoaded(true);
      setDuration(videoElement.duration);
      setError(''); // Clear any previous errors
    };

    const handleError = (e) => {
      // Get more detailed information about the error
      let errorDetails = '';
      if (videoElement.error) {
        const errorCode = videoElement.error.code;
        switch (errorCode) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorDetails = 'Video playback was aborted.';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorDetails = 'Network error. Check your internet connection.';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorDetails = 'Video decoding error. The file might be corrupted.';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorDetails = 'Video format or MIME type is not supported by your browser.';
            break;
          default:
            errorDetails = `Unknown error (code: ${errorCode}).`;
        }
      }

      console.error('Video element error:', e, errorDetails);
      setError(t('preview.videoError', `Error loading video: ${errorDetails}`));
      setIsLoaded(false);
    };

    const handleTimeUpdate = () => {
      // Only update currentTime if we're not in a seek operation
      if (!seekLockRef.current) {
        // Throttle time updates to reduce unnecessary re-renders
        // Only update if more than 100ms has passed since the last update
        const now = performance.now();
        if (now - lastTimeUpdateRef.current > 100) {
          const currentVideoTime = videoElement.currentTime;
          setCurrentTime(currentVideoTime);
          lastTimeUpdateRef.current = now;

          // Determine which subtitle array to use based on settings
          const useTranslated = subtitleSettings.showTranslatedSubtitles && translatedSubtitles && translatedSubtitles.length > 0;
          const subtitlesToUse = useTranslated ? translatedSubtitles : subtitlesArray;

          // Find the current subtitle based on the video's current time
          if (subtitlesToUse && subtitlesToUse.length > 0) {
            const currentSub = subtitlesToUse.find(sub => {
              // Handle both numeric and string time formats
              const startTime = typeof sub.start === 'number' ? sub.start :
                               (typeof sub.startTime === 'string' ? convertTimeStringToSeconds(sub.startTime) :
                               convertTimeStringToSeconds(sub.start));
              const endTime = typeof sub.end === 'number' ? sub.end :
                             (typeof sub.endTime === 'string' ? convertTimeStringToSeconds(sub.endTime) :
                             convertTimeStringToSeconds(sub.end));
              return currentVideoTime >= startTime && currentVideoTime <= endTime;
            });

            // Update the current subtitle text
            if (currentSub) {
              setCurrentSubtitleText(currentSub.text);
              // Only log in development mode and throttle to avoid excessive logging
              if (process.env.NODE_ENV === 'development') {
                // Store the last logged subtitle to avoid logging the same one repeatedly
                if (!window._lastLoggedSubtitle || window._lastLoggedSubtitle !== currentSub.text) {

                  window._lastLoggedSubtitle = currentSub.text;
                }
              }

              // Update fullscreen subtitle if in fullscreen mode
              const container = document.getElementById('fullscreen-subtitle-overlay');
              if (container) {
                // Clear existing content
                container.innerHTML = '';

                // Create subtitle element
                const subtitle = document.createElement('div');
                subtitle.id = 'fullscreen-subtitle';

                // Handle newlines by splitting the text and adding <br> tags
                const lines = currentSub.text.split('\n');
                lines.forEach((line, index) => {
                  if (index > 0) {
                    subtitle.appendChild(document.createElement('br'));
                  }
                  subtitle.appendChild(document.createTextNode(line));
                });

                // Apply styles
                subtitle.style.display = 'inline-block';
                subtitle.style.backgroundColor = `rgba(${parseInt(subtitleSettings.backgroundColor.slice(1, 3), 16)},
                                               ${parseInt(subtitleSettings.backgroundColor.slice(3, 5), 16)},
                                               ${parseInt(subtitleSettings.backgroundColor.slice(5, 7), 16)},
                                               ${subtitleSettings.opacity || '0.7'})`;
                subtitle.style.color = subtitleSettings.textColor || '#ffffff';
                subtitle.style.padding = `${subtitleSettings.backgroundPadding || '10'}px`;
                subtitle.style.borderRadius = `${subtitleSettings.backgroundRadius || '4'}px`;
                subtitle.style.fontFamily = subtitleSettings.fontFamily || 'Arial, sans-serif';
                subtitle.style.fontSize = `${subtitleSettings.fontSize || '24'}px`;
                subtitle.style.fontWeight = subtitleSettings.fontWeight || '400';
                subtitle.style.lineHeight = subtitleSettings.lineSpacing || '1.4';
                subtitle.style.letterSpacing = `${subtitleSettings.letterSpacing || '0'}px`;
                subtitle.style.textTransform = subtitleSettings.textTransform || 'none';
                subtitle.style.textShadow = subtitleSettings.textShadow === true || subtitleSettings.textShadow === 'true' ?
                                          '1px 1px 2px rgba(0, 0, 0, 0.8)' : 'none';
                subtitle.style.maxWidth = '100%';
                subtitle.style.overflowWrap = 'break-word';

                // Add to container
                container.appendChild(subtitle);
              }
            } else {
              setCurrentSubtitleText('');

              // Clear fullscreen subtitle if in fullscreen mode
              const container = document.getElementById('fullscreen-subtitle-overlay');
              if (container) {
                container.innerHTML = '';
              }
            }
          }
        }
      }

      // Update play state in ref to avoid unnecessary re-renders
      const currentlyPlaying = !videoElement.paused;
      if (currentlyPlaying !== lastPlayStateRef.current) {
        lastPlayStateRef.current = currentlyPlaying;
      }
    };

    const handlePlayPauseEvent = () => {
      // Update play state in ref to avoid unnecessary re-renders
      const currentlyPlaying = !videoElement.paused;
      if (currentlyPlaying !== lastPlayStateRef.current) {
        lastPlayStateRef.current = currentlyPlaying;
      }
    };

    const handleSeeking = () => {
      seekLockRef.current = true;
    };

    const handleSeeked = () => {
      // Update the current time immediately when seeking is complete
      setCurrentTime(videoElement.currentTime);
      lastTimeUpdateRef.current = performance.now();

      // Notify parent component about the seek operation
      if (onSeek) {
        onSeek(videoElement.currentTime);
      }

      // Release the seek lock immediately
      seekLockRef.current = false;
    };

    // Add event listeners
    videoElement.addEventListener('loadedmetadata', handleMetadataLoaded);
    videoElement.addEventListener('error', handleError);
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('play', handlePlayPauseEvent);
    videoElement.addEventListener('pause', handlePlayPauseEvent);
    videoElement.addEventListener('seeking', handleSeeking);
    videoElement.addEventListener('seeked', handleSeeked);

    // Clean up
    return () => {
      videoElement.removeEventListener('loadedmetadata', handleMetadataLoaded);
      videoElement.removeEventListener('error', handleError);
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('play', handlePlayPauseEvent);
      videoElement.removeEventListener('pause', handlePlayPauseEvent);
      videoElement.removeEventListener('seeking', handleSeeking);
      videoElement.removeEventListener('seeked', handleSeeked);
    };
  }, [videoUrl, setCurrentTime, setDuration, t, onSeek, subtitlesArray, translatedSubtitles, subtitleSettings]);

  // Native track subtitles disabled - using only custom subtitle display

  // Listen for aligned narration generation events
  useEffect(() => {
    // Function to handle aligned narration status updates
    const handleAlignedNarrationStatus = (event) => {
      if (event.detail) {
        const { status, message, isStillGenerating } = event.detail;

        // If the status is 'complete' and isStillGenerating is false, the narration regeneration is fully done
        if (status === 'complete' && !isStillGenerating) {

          setIsRefreshingNarration(false);
        }

        // If the status is 'error' and isStillGenerating is false, there was an error during regeneration
        if (status === 'error' && !isStillGenerating) {
          console.error('Error during aligned narration regeneration:', message);
          setIsRefreshingNarration(false);
        }

        // If isStillGenerating is true, keep the overlay visible
        if (isStillGenerating) {

        }
      }
    };

    // Function to handle aligned narration generation state changes
    const handleAlignedNarrationGeneratingState = (event) => {
      if (event.detail) {
        const { isGenerating } = event.detail;

        // If isGenerating is false, the narration generation is complete
        if (!isGenerating && !isRefreshingNarration) {
          return; // No need to update if we're not refreshing
        }

        if (!isGenerating) {

          setIsRefreshingNarration(false);
        }
      }
    };

    // Add event listeners
    window.addEventListener('aligned-narration-status', handleAlignedNarrationStatus);
    window.addEventListener('aligned-narration-generating-state', handleAlignedNarrationGeneratingState);

    // Clean up event listeners
    return () => {
      window.removeEventListener('aligned-narration-status', handleAlignedNarrationStatus);
      window.removeEventListener('aligned-narration-generating-state', handleAlignedNarrationGeneratingState);
    };
  }, [isRefreshingNarration]);

  // The duplicate event listener for aligned-narration-status has been removed
  // We're now only using the more comprehensive listener above that includes isStillGenerating

  // Clean up aligned narration resources when component unmounts
  useEffect(() => {
    return () => {
      // Clean up aligned narration audio
      if (typeof window.resetAlignedNarration === 'function') {
        console.log('Cleaning up aligned narration on component unmount');
        window.resetAlignedNarration();
      }

      // Also clean up any other audio elements that might be playing
      if (window.alignedAudioElement) {
        try {
          console.log('Cleaning up alignedAudioElement on component unmount');
          window.alignedAudioElement.pause();
          window.alignedAudioElement.src = '';
          window.alignedAudioElement.load();
          window.alignedAudioElement = null;
        } catch (e) {
          console.warn('Error cleaning up window.alignedAudioElement on unmount:', e);
        }
      }
    };
  }, []);

  // Handle fullscreen changes
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Function to create and inject fullscreen subtitle container
    const createFullscreenSubtitleContainer = () => {
      // Check if container already exists
      let container = document.getElementById('fullscreen-subtitle-overlay');
      if (!container) {
        container = document.createElement('div');
        container.id = 'fullscreen-subtitle-overlay';
        container.style.position = 'fixed';
        container.style.left = '0';
        container.style.right = '0';
        container.style.bottom = '10%';
        container.style.width = `${subtitleSettings.boxWidth || '80'}%`;
        container.style.margin = '0 auto';
        container.style.textAlign = 'center';
        container.style.zIndex = '9999';
        container.style.pointerEvents = 'none';
        document.body.appendChild(container);
      }
      return container;
    };

    // Function to handle fullscreen change events
    const handleFullscreenChange = () => {
      const isDocFullscreen = !!document.fullscreenElement ||
                             !!document.webkitFullscreenElement ||
                             !!document.mozFullScreenElement ||
                             !!document.msFullscreenElement;

      // Check if our video is the fullscreen element
      const isVideoFullscreen = isDocFullscreen &&
                              (document.fullscreenElement === videoElement ||
                               document.webkitFullscreenElement === videoElement ||
                               document.mozFullScreenElement === videoElement ||
                               document.msFullscreenElement === videoElement);

      setIsFullscreen(isVideoFullscreen);
      // Only log in development mode
      if (process.env.NODE_ENV === 'development') {

      }

      // If entering fullscreen, create the subtitle container
      if (isVideoFullscreen) {
        createFullscreenSubtitleContainer();
      } else {
        // If exiting fullscreen, remove the subtitle container
        const container = document.getElementById('fullscreen-subtitle-overlay');
        if (container) {
          document.body.removeChild(container);
        }
      }
    };

    // Add event listeners for all browser variants
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Clean up
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [subtitleSettings.boxWidth]);

  // Seek to time when currentTime changes externally (from LyricsDisplay)
  useEffect(() => {
    if (!isLoaded) return;

    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Only seek if the difference is significant to avoid loops
    // Increased threshold to 0.2 seconds to further reduce unnecessary seeks
    if (Math.abs(videoElement.currentTime - currentTime) > 0.2) {
      // Set the seek lock to prevent timeupdate from overriding our seek
      seekLockRef.current = true;

      // Store the playing state
      const wasPlaying = !videoElement.paused;
      lastPlayStateRef.current = wasPlaying;

      // Set the new time without pausing first
      // This reduces the play/pause flickering
      videoElement.currentTime = currentTime;

      // Update the last time update reference
      lastTimeUpdateRef.current = performance.now();

      // Release the seek lock after a very short delay
      setTimeout(() => {
        seekLockRef.current = false;
      }, 50);
    }
  }, [currentTime, isLoaded]);

  // Handle downloading video with subtitles
  const handleDownloadWithSubtitles = async () => {
    if (!videoUrl || !subtitlesArray || subtitlesArray.length === 0) {
      setError(t('videoPreview.noSubtitlesToRender', 'No subtitles to render'));
      return;
    }

    setIsRenderingVideo(true);
    setRenderProgress(0);
    setError('');

    try {
      const renderedVideoUrl = await renderSubtitlesToVideo(
        videoUrl,
        subtitlesArray,
        subtitleSettings,
        (progress) => setRenderProgress(progress)
      );

      // Get video title or use default
      const videoTitle = videoSource?.title || 'video-with-subtitles';
      downloadVideo(renderedVideoUrl, `${videoTitle}.webm`);
    } catch (err) {
      console.error('Error rendering subtitles:', err);
      setError(t('videoPreview.renderError', 'Error rendering subtitles: {{error}}', { error: err.message }));
    } finally {
      setIsRenderingVideo(false);
    }
  };

  // Handle downloading video with translated subtitles
  const handleDownloadWithTranslatedSubtitles = async () => {
    if (!videoUrl || !translatedSubtitles || translatedSubtitles.length === 0) {
      setError(t('videoPreview.noTranslatedSubtitles', 'No translated subtitles available'));
      return;
    }

    setIsRenderingVideo(true);
    setRenderProgress(0);
    setError('');

    try {
      // Convert translatedSubtitles to the format expected by renderSubtitlesToVideo
      // Use original subtitle timings when available
      const formattedSubtitles = translatedSubtitles.map(sub => {
        // If this subtitle has an originalId, find the corresponding original subtitle
        if (sub.originalId && subtitlesArray) {
          const originalSub = subtitlesArray.find(s => s.id === sub.originalId);
          if (originalSub) {
            // Use the original subtitle's timing
            return {
              id: sub.id,
              start: originalSub.start,
              end: originalSub.end,
              text: sub.text
            };
          }
        }

        // If the subtitle already has start/end properties, use them
        if (sub.start !== undefined && sub.end !== undefined) {
          return sub;
        }

        // Otherwise, convert from startTime/endTime format
        return {
          id: sub.id,
          start: typeof sub.startTime === 'string' ? convertTimeStringToSeconds(sub.startTime) : 0,
          end: typeof sub.endTime === 'string' ? convertTimeStringToSeconds(sub.endTime) : 0,
          text: sub.text
        };
      });

      const renderedVideoUrl = await renderSubtitlesToVideo(
        videoUrl,
        formattedSubtitles,
        subtitleSettings,
        (progress) => setRenderProgress(progress)
      );

      // Get video title or use default
      const videoTitle = videoSource?.title || 'video-with-translated-subtitles';
      downloadVideo(renderedVideoUrl, `${videoTitle}.webm`);
    } catch (err) {
      console.error('Error rendering translated subtitles:', err);
      setError(t('videoPreview.renderError', 'Error rendering subtitles: {{error}}', { error: err.message }));
    } finally {
      setIsRenderingVideo(false);
    }
  };

  return (
    <div className="video-preview">
      {/* Narration Settings moved to unified component in translation section */}

      <div className="video-preview-header">
        <h3>{t('output.videoPreview', 'Video Preview with Subtitles')}</h3>
        <SubtitleSettings
          settings={subtitleSettings}
          onSettingsChange={setSubtitleSettings}
          onDownloadWithSubtitles={handleDownloadWithSubtitles}
          onDownloadWithTranslatedSubtitles={handleDownloadWithTranslatedSubtitles}
          hasTranslation={translatedSubtitles && translatedSubtitles.length > 0}
          translatedSubtitles={translatedSubtitles}
          targetLanguage={translatedSubtitles && translatedSubtitles.length > 0 && translatedSubtitles[0].language}
          videoRef={videoRef}
          originalNarrations={window.originalNarrations || (() => {
            try {
              const stored = localStorage.getItem('originalNarrations');
              return stored ? JSON.parse(stored) : [];
            } catch (e) {
              console.error('Error parsing originalNarrations from localStorage:', e);
              return [];
            }
          })()}
          translatedNarrations={window.translatedNarrations || (() => {
            try {
              const stored = localStorage.getItem('translatedNarrations');
              return stored ? JSON.parse(stored) : [];
            } catch (e) {
              console.error('Error parsing translatedNarrations from localStorage:', e);
              return [];
            }
          })()}
          {...(() => {
            // Store subtitles data in window for access by other components
            if (subtitlesArray && subtitlesArray.length > 0) {
              window.subtitlesData = subtitlesArray;
              // Only log in development mode
              if (process.env.NODE_ENV === 'development' && !window._loggedSubtitlesData) {

                window._loggedSubtitlesData = true;
              }
            }
            // Store original subtitles (same as subtitlesArray in this context)
            if (subtitlesArray && subtitlesArray.length > 0) {
              window.originalSubtitles = subtitlesArray;
              // Only log in development mode
              if (process.env.NODE_ENV === 'development' && !window._loggedOriginalSubtitles) {

                window._loggedOriginalSubtitles = true;
              }
            }
            // Store translated subtitles if available
            if (translatedSubtitles && translatedSubtitles.length > 0) {
              window.translatedSubtitles = translatedSubtitles;
              // Only log in development mode
              if (process.env.NODE_ENV === 'development' && !window._loggedTranslatedSubtitles) {

                window._loggedTranslatedSubtitles = true;
              }
            }
            return {};
          })()}
          getAudioUrl={(filename) => `${SERVER_URL}/narration/audio/${filename || 'test.wav'}`}
        />
      </div>

      {isRenderingVideo && (
        <div className="rendering-overlay">
          <div className="rendering-progress">
            <div className="progress-bar" style={{ width: `${renderProgress * 100}%` }}></div>
          </div>
          <div className="rendering-text">
            {t('videoPreview.rendering', 'Rendering video with subtitles...')} ({Math.round(renderProgress * 100)}%)
          </div>
        </div>
      )}

      <div className="video-container">
        {error && <div className="error">{error}</div>}

        {/* Only show downloading UI if we're actually downloading and have progress > 0 */}
        {isDownloading && downloadProgress > 0 && (
          <div className="video-downloading">
            <div className="download-progress">
              <div className="progress-bar" style={{ width: `${downloadProgress}%` }}></div>
            </div>
            <div className="download-text">
              {t('preview.downloading', 'Downloading video...')} ({downloadProgress}%)
            </div>
          </div>
        )}

        {/* Always show video player if we have a URL, regardless of download state */}
        {videoUrl ? (
          <div className="native-video-container">
              {/* Video quality toggle - only show when optimized video is available */}
              {optimizedVideoUrl && (
                <div className="video-quality-toggle" title={t('preview.videoQualityToggle', 'Toggle between original and optimized video quality')}>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={useOptimizedPreview}
                      onChange={(e) => {
                        const newValue = e.target.checked;
                        setUseOptimizedPreview(newValue);
                        localStorage.setItem('use_optimized_preview', newValue.toString());
                      }}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <span className="toggle-label">
                    {useOptimizedPreview ? t('preview.optimizedQuality', 'Optimized Quality') : t('preview.originalQuality', 'Original Quality')}
                  </span>
                  {useOptimizedPreview && optimizedVideoInfo && (
                    <span className="quality-info">
                      {optimizedVideoInfo.resolution}, {optimizedVideoInfo.fps}fps
                    </span>
                  )}
                </div>
              )}

              {/* Refresh Narration button - only show when video is loaded */}
              {isLoaded && (
                <div className="refresh-narration-button">
                  <button
                    onClick={async () => {
                      try {
                        // Pause the video if it's playing
                        if (videoRef.current && !videoRef.current.paused) {
                          videoRef.current.pause();
                        }

                        // Set refreshing state to show loading overlay
                        setIsRefreshingNarration(true);

                        // Get narrations from window object
                        // First check if we're using grouped subtitles
                        const isUsingGroupedSubtitles = window.useGroupedSubtitles || false;
                        const groupedNarrations = window.groupedNarrations || [];
                        const originalNarrations = window.originalNarrations || [];

                        // Use grouped narrations if available and enabled, otherwise use original narrations
                        const narrations = (isUsingGroupedSubtitles && groupedNarrations.length > 0)
                          ? groupedNarrations
                          : originalNarrations;

                        console.log(`Using ${isUsingGroupedSubtitles ? 'grouped' : 'original'} narrations for alignment. Found ${narrations.length} narrations.`);

                        // Debug: Log the structure of the first few narrations to understand what properties are available
                        if (narrations.length > 0) {
                          console.log('First narration structure:', JSON.stringify(narrations[0], null, 2));
                          console.log('Narrations with success but no filename:', narrations.filter(n => n.success && !n.filename).length);
                          console.log('Narrations with success and filename:', narrations.filter(n => n.success && n.filename).length);
                        } else {
                          console.log('No narrations found in window.originalNarrations or window.groupedNarrations');
                          console.log('window.originalNarrations exists:', !!window.originalNarrations);
                          console.log('window.groupedNarrations exists:', !!window.groupedNarrations);

                          // Check if we have subtitles data
                          const subtitlesData = window.subtitlesData || window.originalSubtitles || [];
                          console.log('Subtitles data available:', subtitlesData.length);
                        }

                        // Check if we have any narration results
                        if (!narrations || narrations.length === 0) {
                          console.error('No narration results available in window objects');

                          // Try to reconstruct narration results from the file system
                          // This is a fallback for when window.originalNarrations is empty
                          // but we know narrations exist on the server

                          // Get all subtitles
                          const allSubtitles = window.subtitlesData || window.originalSubtitles || [];

                          if (allSubtitles.length === 0) {
                            console.error('No subtitles available to reconstruct narrations');
                            throw new Error('No narration results or subtitles available for alignment');
                          }

                          console.log('Attempting to reconstruct narrations from subtitles');

                          // Create synthetic narration objects based on subtitles
                          const syntheticNarrations = allSubtitles.map(subtitle => ({
                            subtitle_id: subtitle.id,
                            filename: `subtitle_${subtitle.id}/1.wav`, // Use correct F5-TTS filename pattern
                            success: true, // Assume success
                            start: subtitle.start,
                            end: subtitle.end,
                            text: subtitle.text
                          }));

                          // Use these synthetic narrations
                          console.log(`Created ${syntheticNarrations.length} synthetic narrations from subtitles`);

                          // Replace the narrations array with our synthetic one
                          narrations.length = 0; // Clear the array
                          narrations.push(...syntheticNarrations); // Add synthetic narrations

                          // Also update the window object for future use
                          window.originalNarrations = [...syntheticNarrations];

                          console.log('Synthetic narrations created successfully');
                        }



                        // Force reset the aligned narration cache and clean up any existing audio elements
                        if (typeof window.resetAlignedNarration === 'function') {
                          console.log('Calling resetAlignedNarration to clean up existing audio elements');
                          window.resetAlignedNarration();
                        }

                        // Also clean up any other audio elements that might be playing
                        if (window.alignedAudioElement) {
                          try {
                            console.log('Cleaning up existing alignedAudioElement');
                            window.alignedAudioElement.pause();
                            window.alignedAudioElement.src = '';
                            window.alignedAudioElement.load();
                            window.alignedAudioElement = null;
                          } catch (e) {
                            console.warn('Error cleaning up window.alignedAudioElement:', e);
                          }
                        }

                        // Get all subtitles from the window object
                        // Use grouped subtitles if we're using grouped narrations
                        // Reuse the isUsingGroupedSubtitles variable from above
                        const allSubtitles = isUsingGroupedSubtitles && window.groupedSubtitles ?
                          window.groupedSubtitles :
                          (window.subtitlesData || window.originalSubtitles || []);

                        console.log(`Using ${isUsingGroupedSubtitles ? 'grouped' : 'original'} subtitles for subtitle map. Found ${allSubtitles.length} subtitles.`);

                        // Create a map for faster lookup
                        const subtitleMap = {};
                        allSubtitles.forEach(sub => {
                          if (sub.id !== undefined) {
                            subtitleMap[sub.id] = sub;
                          }
                        });



                        // Prepare the data for the aligned narration with correct timing
                        const narrationData = narrations
                          .filter(result => {
                            // Check if the result has success and filename
                            if (result.success && result.filename) {
                              console.log(`Using existing filename for subtitle ${result.subtitle_id}: ${result.filename}`);
                              return true;
                            }

                            // If it has success but no filename, try to construct a default filename
                            if (result.success && !result.filename && result.subtitle_id) {
                              // Try the correct filename pattern for F5-TTS (1.wav instead of f5tts_1.wav)
                              result.filename = `subtitle_${result.subtitle_id}/1.wav`;
                              console.log(`Added correct F5-TTS filename for subtitle ${result.subtitle_id}: ${result.filename}`);
                              return true;
                            }

                            return false;
                          })
                          .map(result => {
                            // Find the corresponding subtitle for timing information
                            const subtitle = subtitleMap[result.subtitle_id];

                            // If we found a matching subtitle, use its timing
                            if (subtitle && typeof subtitle.start === 'number' && typeof subtitle.end === 'number') {

                              return {
                                filename: result.filename,
                                subtitle_id: result.subtitle_id,
                                start: subtitle.start,
                                end: subtitle.end,
                                text: subtitle.text || result.text || ''
                              };
                            }

                            // If no timing found, use defaults
                            console.warn(`No timing found for subtitle ${result.subtitle_id}. Using defaults.`);
                            return {
                              filename: result.filename,
                              subtitle_id: result.subtitle_id,
                              start: 0,
                              end: 5,
                              text: result.text || ''
                            };
                          });

                        // Sort by start time to ensure correct order
                        narrationData.sort((a, b) => a.start - b.start);



                        // Check if we have any narration data
                        if (narrationData.length === 0) {
                          throw new Error('No valid narration files found. Please generate narrations first.');
                        }

                        // Log the narration data for debugging
                        console.log(`Found ${narrationData.length} narration files to align`);

                        // Create a download link using the imported SERVER_URL
                        const downloadUrl = `${SERVER_URL}/api/narration/download-aligned`;

                        console.log('Using download URL:', downloadUrl);
                        console.log('Sending request to:', downloadUrl);
                        console.log('Request payload:', JSON.stringify({ narrations: narrationData }, null, 2).substring(0, 200) + '...');

                        // Use fetch API to download the file
                        const response = await fetch(downloadUrl, {
                          method: 'POST',
                          mode: 'cors',
                          credentials: 'include',
                          headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'audio/wav'
                          },
                          body: JSON.stringify({ narrations: narrationData })
                        });

                        console.log('Response status:', response.status);
                        console.log('Response headers:', [...response.headers.entries()]);

                        // Check if the response is successful
                        if (!response.ok) {
                          // Try to get more detailed error information
                          try {
                            const errorText = await response.text();
                            console.error('Error response body:', errorText);

                            // Try to parse the error as JSON for more details
                            try {
                              const errorJson = JSON.parse(errorText);
                              console.error('Error details:', errorJson.details || 'No details available');

                              if (errorJson.error && errorJson.error.includes('Audio file not found')) {
                                // Show a more user-friendly error message
                                throw new Error(`Some narration files are missing. Please regenerate narrations before refreshing.`);
                              } else {
                                throw new Error(`Failed to generate aligned audio: ${errorJson.error || response.statusText}`);
                              }
                            } catch (jsonError) {
                              // If it's not valid JSON, use the raw text
                              throw new Error(`Failed to generate aligned audio: ${errorText || response.statusText}`);
                            }
                          } catch (textError) {
                            console.error('Could not read error response body:', textError);
                            // If we couldn't read the response at all, use the status text
                            throw new Error(`Failed to generate aligned audio: ${response.statusText}`);
                          }
                        }

                        // Get the blob from the response
                        const blob = await response.blob();


                        // Create a URL for the blob
                        const url = URL.createObjectURL(blob);

                        // Update the aligned narration cache directly
                        window.alignedNarrationCache = {
                          blob: blob,
                          url: url,
                          timestamp: Date.now(),
                          subtitleTimestamps: {}
                        };

                        // Import the aligned narration service function for volume
                        const {
                          setAlignedNarrationVolume
                        } = require('../../services/alignedNarrationService');

                        // Create a new audio element for the aligned narration
                        const audio = new Audio();
                        audio.src = url;
                        audio.id = 'aligned-narration-audio';
                        audio.preload = 'auto';
                        audio.crossOrigin = 'anonymous';

                        // Add event listeners for debugging


                        audio.onerror = () => {
                          const errorMessage = audio.error
                            ? `Code: ${audio.error.code}, Message: ${audio.error.message}`
                            : 'unknown error';
                          console.error('Error with aligned narration audio:', errorMessage);
                        };

                        // Set the audio element in the window object
                        window.alignedAudioElement = audio;

                        // Load the audio
                        audio.load();

                        // Wait for the audio to be ready
                        await new Promise((resolve) => {
                          audio.addEventListener('canplaythrough', resolve, { once: true });
                        });

                        // Set the volume to maximum
                        audio.volume = 1.0;

                        // Also use the service function to set volume
                        setAlignedNarrationVolume(1.0);

                        // Set a flag to indicate that aligned narration is available
                        window.isAlignedNarrationAvailable = true;

                        // Notify the system that aligned narration is available
                        window.dispatchEvent(new CustomEvent('aligned-narration-ready', {
                          detail: {
                            audioElement: audio,
                            url: url,
                            timestamp: Date.now()
                          }
                        }));

                        // Also dispatch an event to notify that the aligned narration status has changed
                        window.dispatchEvent(new CustomEvent('aligned-narration-status', {
                          detail: {
                            status: 'complete',
                            message: 'Aligned narration generation complete',
                            isStillGenerating: false
                          }
                        }));

                        // Set up direct playback of the audio
                        const setupDirectPlayback = () => {
                          // Remove any existing event listeners
                          // First check if we have stored handlers from a previous setup
                          if (window.alignedNarrationEventHandlers) {
                            console.log('Removing existing event handlers from previous setup');
                            const { handleVideoPlay, handleVideoPause, handleVideoSeeked, handleVideoTimeUpdate } = window.alignedNarrationEventHandlers;

                            videoRef.current.removeEventListener('play', handleVideoPlay);
                            videoRef.current.removeEventListener('pause', handleVideoPause);
                            videoRef.current.removeEventListener('seeked', handleVideoSeeked);
                            videoRef.current.removeEventListener('timeupdate', handleVideoTimeUpdate);
                          } else {
                            // If we don't have stored handlers, try to remove generic ones
                            console.log('No existing handlers found, removing generic event listeners');
                            videoRef.current.removeEventListener('play', window.handleVideoPlay);
                            videoRef.current.removeEventListener('pause', window.handleVideoPause);
                            videoRef.current.removeEventListener('seeked', window.handleVideoSeeked);
                            videoRef.current.removeEventListener('timeupdate', window.handleVideoTimeUpdate);
                          }

                          // Define event handlers
                          function handleVideoPlay() {

                            if (audio) {
                              audio.currentTime = videoRef.current.currentTime;
                              const playPromise = audio.play();
                              if (playPromise !== undefined) {
                                playPromise.catch(error => {
                                  console.error('Error playing aligned narration:', error);
                                });
                              }
                            }
                          }

                          function handleVideoPause() {

                            if (audio) {
                              audio.pause();
                            }
                          }

                          function handleVideoSeeked() {

                            if (audio) {
                              audio.currentTime = videoRef.current.currentTime;
                              if (!videoRef.current.paused) {
                                const playPromise = audio.play();
                                if (playPromise !== undefined) {
                                  playPromise.catch(error => {
                                    console.error('Error playing aligned narration after seek:', error);
                                  });
                                }
                              }
                            }
                          }

                          function handleVideoTimeUpdate() {
                            // Only update if the difference is significant
                            if (audio && Math.abs(audio.currentTime - videoRef.current.currentTime) > 0.3) {
                              audio.currentTime = videoRef.current.currentTime;
                            }
                          }

                          // Add event listeners
                          videoRef.current.addEventListener('play', handleVideoPlay);
                          videoRef.current.addEventListener('pause', handleVideoPause);
                          videoRef.current.addEventListener('seeked', handleVideoSeeked);
                          videoRef.current.addEventListener('timeupdate', handleVideoTimeUpdate);

                          // Store the event handlers on the window for cleanup
                          window.alignedNarrationEventHandlers = {
                            handleVideoPlay,
                            handleVideoPause,
                            handleVideoSeeked,
                            handleVideoTimeUpdate
                          };

                          // If the video is playing, start playing the aligned narration
                          if (videoRef.current && !videoRef.current.paused) {

                            handleVideoPlay();
                          }
                        };

                        // Set up direct playback
                        setupDirectPlayback();


                      } catch (error) {
                        console.error('Error during aligned narration regeneration:', error);
                      } finally {
                        // Clear refreshing state
                        setIsRefreshingNarration(false);
                      }
                    }}
                    disabled={isRefreshingNarration}
                  >
                    {isRefreshingNarration ? (
                      // Show loading spinner when refreshing
                      <>
                        <svg className="spinner" width="24" height="24" viewBox="0 0 24 24">
                          <circle className="path" cx="12" cy="12" r="10" fill="none" strokeWidth="3"></circle>
                        </svg>
                        <span className="button-text">{t('preview.refreshingNarration', 'Refreshing Narration...')}</span>
                      </>
                    ) : (
                      // Show refresh icon when not refreshing
                      <>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                        </svg>
                        <span className="button-text">{t('preview.refreshNarration', 'Refresh Narration')}</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Download audio button - only show when video is loaded */}
              {isLoaded && (
                <div className="download-audio-button">
                  <button
                    disabled={isAudioDownloading}
                    className={isAudioDownloading ? 'downloading' : ''}
                    onClick={async () => {
                      if (isAudioDownloading) return; // Prevent multiple clicks

                      // Get video title or use default
                      const videoTitle = videoSource?.title || 'audio';
                      // Use the current video URL (optimized or original)
                      const currentVideoUrl = useOptimizedPreview && optimizedVideoUrl ? optimizedVideoUrl : videoUrl;

                      // Show loading state
                      setError('');
                      setIsAudioDownloading(true);



                      // Extract and download audio - our utility function now handles blob URLs properly
                      const success = await extractAndDownloadAudio(currentVideoUrl, videoTitle);

                      // Reset loading state
                      setIsAudioDownloading(false);

                      // Show error if failed
                      if (!success) {
                        setError(t('preview.audioExtractionError', 'Failed to extract audio from video. Please try again.'));

                        // Clear error after 5 seconds
                        setTimeout(() => {
                          setError('');
                        }, 5000);
                      }
                    }}
                  >
                    {isAudioDownloading ? (
                      // Material Design loading spinner
                      <svg className="spinner" width="24" height="24" viewBox="0 0 24 24">
                        <circle className="path" cx="12" cy="12" r="10" fill="none" strokeWidth="3"></circle>
                      </svg>
                    ) : (
                      // Material Design download icon
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                      </svg>
                    )}
                    <span className="button-text">{isAudioDownloading ? t('preview.downloadingAudio', 'Downloading audio...') : t('preview.downloadAudio', 'Download Audio')}</span>
                  </button>
                </div>
              )}
              <div className="video-wrapper" style={{ position: 'relative' }}>
                <video
                  ref={videoRef}
                  controls
                  className="video-player"
                  playsInline
                  src={useOptimizedPreview && optimizedVideoUrl ? optimizedVideoUrl : videoUrl}
                  crossOrigin="anonymous"
                  onError={(e) => {
                    console.error('Video error:', e);
                    // If optimized video fails to load, fall back to original video
                    if (useOptimizedPreview && optimizedVideoUrl && e.target.src === optimizedVideoUrl) {

                      e.target.src = videoUrl;
                      e.target.load();
                    }
                  }}
                >
                  <source
                    src={useOptimizedPreview && optimizedVideoUrl ? optimizedVideoUrl : videoUrl}
                    type="video/mp4"
                    onError={(e) => {
                      console.error('Source error:', e);
                      // If optimized video fails to load, fall back to original video
                      if (useOptimizedPreview && optimizedVideoUrl && e.target.src === optimizedVideoUrl) {

                        e.target.src = videoUrl;
                      }
                    }}
                  />

                  {/* Native track subtitles disabled - using only custom subtitle display */}

                  {t('preview.videoNotSupported', 'Your browser does not support the video tag.')}
                </video>

                {/* Loading overlay for narration refresh */}
                {isRefreshingNarration && (
                  <div className="narration-refresh-overlay">
                    <div className="narration-refresh-content">
                      <svg className="spinner-large" width="48" height="48" viewBox="0 0 24 24">
                        <circle className="path" cx="12" cy="12" r="10" fill="none" strokeWidth="3"></circle>
                      </svg>
                      <div className="narration-refresh-text">
                        {t('preview.refreshingNarration', 'Refreshing narration...')}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Apply subtitle styling to the video element */}
              <style>
                {`
                  /* Set CSS variables for custom subtitle styling */
                  :root {
                    --subtitle-position: ${subtitleSettings.position || '90'}%;
                    --subtitle-box-width: ${subtitleSettings.boxWidth || '80'}%;
                    --subtitle-background-radius: ${subtitleSettings.backgroundRadius || '4'}px;
                    --subtitle-background-padding: ${subtitleSettings.backgroundPadding || '10'}px;
                    --subtitle-text-transform: ${subtitleSettings.textTransform || 'none'};
                    --subtitle-letter-spacing: ${subtitleSettings.letterSpacing || '0'}px;
                  }

                  /* Native track subtitles disabled - using only custom subtitle display */

                  /* Video container positioning */
                  .native-video-container {
                    position: relative;
                  }

                  /* Style for custom subtitle display */
                  .custom-subtitle-container {
                    position: absolute;
                    left: 0;
                    right: 0;
                    width: var(--subtitle-box-width);
                    max-width: 100%;
                    margin: 0 auto;
                    text-align: center;
                    z-index: 5;
                    /* Calculate top position based on percentage (0% = top, 100% = bottom) */
                    bottom: calc(100% - var(--subtitle-position));
                    transform: translateY(50%);
                  }

                  .custom-subtitle {
                    display: inline-block;
                    background-color: rgba(${parseInt(subtitleSettings.backgroundColor.slice(1, 3), 16)}, ${parseInt(subtitleSettings.backgroundColor.slice(3, 5), 16)}, ${parseInt(subtitleSettings.backgroundColor.slice(5, 7), 16)}, ${subtitleSettings.opacity});
                    color: ${subtitleSettings.textColor};
                    font-family: ${subtitleSettings.fontFamily};
                    font-size: ${subtitleSettings.fontSize}px;
                    font-weight: ${subtitleSettings.fontWeight};
                    line-height: ${subtitleSettings.lineSpacing || '1.4'};
                    text-align: ${subtitleSettings.textAlign || 'center'};
                    text-transform: var(--subtitle-text-transform);
                    letter-spacing: var(--subtitle-letter-spacing);
                    padding: ${subtitleSettings.backgroundPadding || '10'}px;
                    border-radius: ${subtitleSettings.backgroundRadius || '4'}px;
                    text-shadow: ${subtitleSettings.textShadow === true || subtitleSettings.textShadow === 'true' ? '1px 1px 2px rgba(0, 0, 0, 0.8)' : 'none'};
                    max-width: 100%;
                    word-wrap: break-word;
                  }
                `}
              </style>

              {/* Custom subtitle display */}
              <div className="custom-subtitle-container" style={{ width: `${subtitleSettings.boxWidth || '80'}%` }}>
                {currentSubtitleText && (
                  <div className="custom-subtitle">
                    {currentSubtitleText.split('\n').map((line, index) => (
                      <React.Fragment key={index}>
                        {index > 0 && <br />}
                        {line}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

      </div>
    </div>
  );
};

export default VideoPreview;