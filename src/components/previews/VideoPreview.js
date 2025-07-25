import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import MaterialSwitch from '../common/MaterialSwitch';
import LiquidGlass from '../common/LiquidGlass';
import '../../styles/common/material-switch.css';
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

const VideoPreview = ({ currentTime, setCurrentTime, setDuration, videoSource, onSeek, translatedSubtitles, subtitlesArray, onVideoUrlReady, onReferenceAudioChange, onRenderVideo }) => {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const seekLockRef = useRef(false);
  const lastTimeUpdateRef = useRef(0); // Track last time update to throttle updates
  const lastPlayStateRef = useRef(false); // Track last play state to avoid redundant updates
  // isFullscreen state is set but not directly used in rendering - used for event handling
  const [isFullscreen, setIsFullscreen] = useState(false); // Track fullscreen state
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
  const [isVideoHovered, setIsVideoHovered] = useState(false); // Track video hover state for showing controls

  // Custom video control states
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showCustomControls, setShowCustomControls] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const dragTimeRef = useRef(0);
  const [isVolumeSliderVisible, setIsVolumeSliderVisible] = useState(false);
  const [isVolumeDragging, setIsVolumeDragging] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isSpeedMenuVisible, setIsSpeedMenuVisible] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const hideControlsTimeoutRef = useRef(null);
  const [bufferedProgress, setBufferedProgress] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  // Native track subtitles disabled - using only custom subtitle display
  const [useOptimizedPreview, setUseOptimizedPreview] = useState(() => {
    return localStorage.getItem('use_optimized_preview') === 'true';
  });

  // Listen for changes to the optimized preview setting from Settings modal
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'use_optimized_preview') {
        setUseOptimizedPreview(e.newValue === 'true');
      }
    };

    // Listen for storage events (changes from other tabs/windows)
    window.addEventListener('storage', handleStorageChange);

    // Also check for changes periodically since storage events don't fire in the same tab
    const checkInterval = setInterval(() => {
      const currentValue = localStorage.getItem('use_optimized_preview') === 'true';
      setUseOptimizedPreview(prev => {
        if (prev !== currentValue) {
          console.log('[VideoPreview] Optimized preview setting changed:', currentValue);
          return currentValue;
        }
        return prev;
      });
    }, 500); // Check every 500ms

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkInterval);
    };
  }, []);

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
          const lastOptimizationTimestamp = localStorage.getItem('last_optimization_timestamp');

          // For blob URLs, we'll use the most recent optimization result
          // since blob URLs don't contain filename information
          if (splitResult.optimized && splitResult.optimized.video && lastOptimizationTimestamp) {
            // Check if this optimization is recent (within last 5 minutes)
            const optimizationAge = Date.now() - parseInt(lastOptimizationTimestamp);
            const fiveMinutes = 5 * 60 * 1000;

            if (optimizationAge < fiveMinutes) {
              const optimizedUrl = `${SERVER_URL}${splitResult.optimized.video}`;
              // Using recent optimization result for blob URL
              setOptimizedVideoUrl(optimizedUrl);

              // Store the optimization info
              setOptimizedVideoInfo({
                resolution: splitResult.optimized.resolution || '360p',
                fps: splitResult.optimized.fps || 1,
                width: splitResult.optimized.width,
                height: splitResult.optimized.height
              });
            } else {
              // Optimization result too old, clearing
              setOptimizedVideoUrl('');
              setOptimizedVideoInfo(null);
            }
          } else {
            // No valid optimization result found
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

      // Check for optimized version for all video types
      try {
        const splitResult = JSON.parse(localStorage.getItem('split_result') || '{}');
        const lastOptimizationTimestamp = localStorage.getItem('last_optimization_timestamp');

        if (splitResult.optimized && splitResult.optimized.video && lastOptimizationTimestamp) {
          // Check if this optimization is recent (within last 5 minutes)
          const optimizationAge = Date.now() - parseInt(lastOptimizationTimestamp);
          const fiveMinutes = 5 * 60 * 1000;

          if (optimizationAge < fiveMinutes) {
            const optimizedUrl = `${SERVER_URL}${splitResult.optimized.video}`;
            // Using recent optimization result for regular URL
            setOptimizedVideoUrl(optimizedUrl);

            // Store the optimization info
            setOptimizedVideoInfo({
              resolution: splitResult.optimized.resolution || '360p',
              fps: splitResult.optimized.fps || 1,
              width: splitResult.optimized.width,
              height: splitResult.optimized.height
            });
          }
        }
      } catch (error) {
        console.error('Error checking optimization for regular URL:', error);
      }
    };

    loadVideo();
  }, [videoSource, t, processVideoUrl]);

  // Notify parent component when videoUrl changes
  useEffect(() => {
    // Determine which URL to use based on the useOptimizedPreview setting
    const urlToUse = useOptimizedPreview && optimizedVideoUrl ? optimizedVideoUrl : videoUrl;

    // Debug logging removed for production

    if (urlToUse && onVideoUrlReady) {
      onVideoUrlReady(urlToUse);
    }
  }, [videoUrl, optimizedVideoUrl, useOptimizedPreview, onVideoUrlReady]);

  // Debug logging removed for production

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
      console.log('🎬 FULLSCREEN CHANGE EVENT TRIGGERED');
      const isDocFullscreen = !!document.fullscreenElement ||
                             !!document.webkitFullscreenElement ||
                             !!document.mozFullScreenElement ||
                             !!document.msFullscreenElement;
      console.log('🎬 Document fullscreen state:', isDocFullscreen);

      // Check if our video container is the fullscreen element
      const container = document.querySelector('.native-video-container');
      const isVideoFullscreen = isDocFullscreen &&
                              (document.fullscreenElement === container ||
                               document.webkitFullscreenElement === container ||
                               document.mozFullScreenElement === container ||
                               document.msFullscreenElement === container);

      console.log('🎬 Video fullscreen check:', {
        container: !!container,
        isDocFullscreen,
        isVideoFullscreen,
        fullscreenElement: document.fullscreenElement
      });

      setIsFullscreen(isVideoFullscreen);
      // Only log in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log('Fullscreen change:', {
          isDocFullscreen,
          isVideoFullscreen,
          fullscreenElement: document.fullscreenElement,
          container
        });
      }

      // If entering fullscreen, create the subtitle container and setup controls
      if (isVideoFullscreen) {
        console.log('🎬 ENTERING FULLSCREEN - Starting video resize process');
        createFullscreenSubtitleContainer();
        // Add a class to the video element to help with styling
        videoElement.classList.add('fullscreen-video');

        // Force video and container to fill fullscreen with JavaScript
        setTimeout(() => {
          if (videoElement) {
            console.log('🎬 APPLYING FULLSCREEN STYLES TO VIDEO');
            console.log('Video element before:', {
              width: videoElement.style.width,
              height: videoElement.style.height,
              objectFit: videoElement.style.objectFit,
              position: videoElement.style.position
            });

            // Use setProperty with important flag to override any existing styles
            videoElement.style.setProperty('width', '100vw', 'important');
            videoElement.style.setProperty('height', '100vh', 'important');
            videoElement.style.setProperty('object-fit', 'fill', 'important');
            videoElement.style.setProperty('position', 'fixed', 'important');
            videoElement.style.setProperty('top', '0', 'important');
            videoElement.style.setProperty('left', '0', 'important');
            videoElement.style.setProperty('z-index', '1000', 'important');
            videoElement.style.setProperty('max-width', 'none', 'important');
            videoElement.style.setProperty('max-height', 'none', 'important');
            videoElement.style.setProperty('min-width', '100vw', 'important');
            videoElement.style.setProperty('min-height', '100vh', 'important');
            videoElement.style.setProperty('transform', 'none', 'important');

            // Also remove any conflicting attributes
            videoElement.removeAttribute('width');
            videoElement.removeAttribute('height');

            console.log('Video element after:', {
              width: videoElement.style.width,
              height: videoElement.style.height,
              objectFit: videoElement.style.objectFit,
              position: videoElement.style.position,
              computedWidth: window.getComputedStyle(videoElement).width,
              computedHeight: window.getComputedStyle(videoElement).height,
              computedObjectFit: window.getComputedStyle(videoElement).objectFit
            });

            // Force video wrapper styles
            const videoWrapper = videoElement.closest('.video-wrapper');
            if (videoWrapper) {
              videoWrapper.style.setProperty('width', '100vw', 'important');
              videoWrapper.style.setProperty('height', '100vh', 'important');
              videoWrapper.style.setProperty('position', 'fixed', 'important');
              videoWrapper.style.setProperty('top', '0', 'important');
              videoWrapper.style.setProperty('left', '0', 'important');
              videoWrapper.style.setProperty('z-index', '999', 'important');
              videoWrapper.style.setProperty('overflow', 'hidden', 'important');
            }

            // Force container styles
            if (container) {
              container.style.setProperty('width', '100vw', 'important');
              container.style.setProperty('height', '100vh', 'important');
              container.style.setProperty('position', 'fixed', 'important');
              container.style.setProperty('top', '0', 'important');
              container.style.setProperty('left', '0', 'important');
              container.style.setProperty('z-index', '998', 'important');
              container.style.setProperty('display', 'block', 'important');
              container.style.setProperty('padding', '0', 'important');
              container.style.setProperty('margin', '0', 'important');
            }
          }
        }, 100);
      } else {
        // If exiting fullscreen, remove the subtitle container and cleanup
        const container = document.getElementById('fullscreen-subtitle-overlay');
        if (container) {
          document.body.removeChild(container);
        }
        videoElement.classList.remove('fullscreen-video');

        // Reset video styles when exiting fullscreen
        if (videoElement) {
          videoElement.style.width = '';
          videoElement.style.height = '';
          videoElement.style.objectFit = '';
          videoElement.style.position = '';
          videoElement.style.top = '';
          videoElement.style.left = '';
          videoElement.style.zIndex = '';
          videoElement.style.maxWidth = '';
          videoElement.style.maxHeight = '';
          videoElement.style.minWidth = '';
          videoElement.style.minHeight = '';
          videoElement.style.transform = '';

          // Reset video wrapper styles
          const videoWrapper = videoElement.closest('.video-wrapper');
          if (videoWrapper) {
            videoWrapper.style.width = '';
            videoWrapper.style.height = '';
            videoWrapper.style.position = '';
            videoWrapper.style.top = '';
            videoWrapper.style.left = '';
            videoWrapper.style.zIndex = '';
            videoWrapper.style.overflow = '';
          }

          // Reset container styles
          if (container) {
            container.style.width = '';
            container.style.height = '';
            container.style.position = '';
            container.style.display = '';
            container.style.padding = '';
            container.style.margin = '';
            container.style.zIndex = '';
          }
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

  // Custom video controls event handlers
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleLoadedMetadata = () => {
      setVideoDuration(videoElement.duration);
      setDuration(videoElement.duration);
      setVolume(videoElement.volume);
      setIsMuted(videoElement.muted);
      setShowCustomControls(true);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(videoElement.currentTime); // Use existing currentTime prop

      // Update buffered progress
      if (videoElement.buffered.length > 0 && videoDuration > 0) {
        const bufferedEnd = videoElement.buffered.end(videoElement.buffered.length - 1);
        setBufferedProgress((bufferedEnd / videoDuration) * 100);
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleVolumeChange = () => {
      setVolume(videoElement.volume);
      setIsMuted(videoElement.muted);
    };

    const handleLoadStart = () => {
      setIsVideoLoading(true);
    };

    const handleCanPlay = () => {
      setIsVideoLoading(false);
    };

    const handleWaiting = () => {
      setIsBuffering(true);
    };

    const handleCanPlayThrough = () => {
      setIsBuffering(false);
    };

    // Add video event listeners
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('volumechange', handleVolumeChange);
    videoElement.addEventListener('loadstart', handleLoadStart);
    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('waiting', handleWaiting);
    videoElement.addEventListener('canplaythrough', handleCanPlayThrough);

    return () => {
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('pause', handlePause);
      videoElement.removeEventListener('volumechange', handleVolumeChange);
      videoElement.removeEventListener('loadstart', handleLoadStart);
      videoElement.removeEventListener('canplay', handleCanPlay);
      videoElement.removeEventListener('waiting', handleWaiting);
      videoElement.removeEventListener('canplaythrough', handleCanPlayThrough);
    };
  }, [videoUrl]);



  const handleTimelineMouseDown = useCallback((e) => {
    if (!videoRef.current || videoDuration === 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min((clickX / rect.width) * videoDuration, videoDuration));

    // Immediately set the video time for instant feedback
    videoRef.current.currentTime = newTime;
    setDragTime(newTime);
    dragTimeRef.current = newTime;

    let hasMoved = false;

    // Add global mouse event listeners
    const handleMouseMove = (e) => {
      hasMoved = true;
      setIsDragging(true);
      const rect = e.target.closest('.timeline-container')?.getBoundingClientRect();
      if (rect) {
        const clickX = e.clientX - rect.left;
        const newTime = Math.max(0, Math.min((clickX / rect.width) * videoDuration, videoDuration));
        setDragTime(newTime);
        dragTimeRef.current = newTime;
      }
    };

    const handleMouseUp = () => {
      if (hasMoved && videoRef.current) {
        videoRef.current.currentTime = dragTimeRef.current;
      }
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [videoDuration]);

  // Touch support for timeline
  const handleTimelineTouchStart = useCallback((e) => {
    if (!videoRef.current || videoDuration === 0) return;

    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    const touchX = touch.clientX - rect.left;
    const newTime = Math.max(0, Math.min((touchX / rect.width) * videoDuration, videoDuration));

    // Immediately set the video time for instant feedback
    videoRef.current.currentTime = newTime;
    setDragTime(newTime);
    dragTimeRef.current = newTime;

    let hasMoved = false;

    // Add global touch event listeners
    const handleTouchMove = (e) => {
      e.preventDefault();
      hasMoved = true;
      setIsDragging(true);
      const rect = e.target.closest('.timeline-container')?.getBoundingClientRect();
      if (rect && e.touches[0]) {
        const touchX = e.touches[0].clientX - rect.left;
        const newTime = Math.max(0, Math.min((touchX / rect.width) * videoDuration, videoDuration));
        setDragTime(newTime);
        dragTimeRef.current = newTime;
      }
    };

    const handleTouchEnd = () => {
      if (hasMoved && videoRef.current) {
        videoRef.current.currentTime = dragTimeRef.current;
      }
      setIsDragging(false);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  }, [videoDuration]);

  // Handle volume slider dragging
  useEffect(() => {
    if (!isVolumeDragging) return;

    const handleMouseMove = (e) => {
      const volumeSlider = document.querySelector('.expanding-volume-slider');
      if (volumeSlider) {
        const rect = volumeSlider.getBoundingClientRect();
        const newVolume = Math.max(0, Math.min(1, (rect.bottom - e.clientY) / rect.height));
        setVolume(newVolume);
        if (videoRef.current) {
          videoRef.current.volume = newVolume;
          videoRef.current.muted = newVolume === 0;
          setIsMuted(newVolume === 0);
        }
      }
    };

    const handleMouseUp = () => {
      setIsVolumeDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isVolumeDragging]);

  // Handle keyboard shortcuts for video control
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Handle multiple keyboard shortcuts
      const validKeys = ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyM', 'KeyF', 'KeyK'];
      if (!validKeys.includes(event.code) && !['j', 'l', 'k', 'm', 'f', ' '].includes(event.key.toLowerCase())) return;

      // Don't handle spacebar if user is typing in an input field
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.contentEditable === 'true' ||
        activeElement.isContentEditable
      )) {
        return;
      }

      // Don't handle spacebar if a modal is open (check for common modal classes)
      const hasOpenModal = document.querySelector(
        '.modal-overlay, .settings-modal-overlay, .advanced-settings-modal-overlay, ' +
        '.download-modal-overlay, .segment-retry-modal-overlay, .prompt-editor-overlay, ' +
        '.subtitles-input-modal-overlay, .custom-modal-overlay'
      );
      if (hasOpenModal) {
        return;
      }

      // Don't handle spacebar if the video rendering section is expanded and focused
      // This prevents conflicts with the RemotionVideoPreview
      const videoRenderingSection = document.querySelector('.video-rendering-section.expanded');
      const videoPreviewPanel = document.querySelector('.video-preview-panel');
      if (videoRenderingSection && videoPreviewPanel) {
        // Check if the user is interacting with the video rendering section
        const isInVideoRenderingArea = event.target.closest('.video-rendering-section') ||
                                      event.target.closest('.video-preview-panel');
        if (isInVideoRenderingArea) {
          return; // Let the RemotionVideoPreview handle its own spacebar events
        }
      }

      // Only proceed if video element exists and is loaded
      const videoElement = videoRef.current;
      if (!videoElement || !isLoaded) return;

      // Prevent default behavior for handled keys
      event.preventDefault();
      event.stopPropagation();

      // Handle different keyboard shortcuts
      switch (event.code || event.key.toLowerCase()) {
        case 'Space':
        case ' ':
        case 'KeyK':
        case 'k':
          // Toggle play/pause
          if (videoElement.paused) {
            videoElement.play().catch(error => {
              console.error('Error playing video:', error);
            });
          } else {
            videoElement.pause();
          }
          break;

        case 'ArrowLeft':
        case 'j':
          // Seek backward 10 seconds
          videoElement.currentTime = Math.max(0, videoElement.currentTime - 10);
          break;

        case 'ArrowRight':
        case 'l':
          // Seek forward 10 seconds
          videoElement.currentTime = Math.min(videoDuration, videoElement.currentTime + 10);
          break;

        case 'ArrowUp':
          // Volume up
          videoElement.volume = Math.min(1, videoElement.volume + 0.1);
          setVolume(videoElement.volume);
          if (videoElement.muted) {
            videoElement.muted = false;
            setIsMuted(false);
          }
          break;

        case 'ArrowDown':
          // Volume down
          videoElement.volume = Math.max(0, videoElement.volume - 0.1);
          setVolume(videoElement.volume);
          if (videoElement.volume === 0) {
            videoElement.muted = true;
            setIsMuted(true);
          }
          break;

        case 'KeyM':
        case 'm':
          // Toggle mute
          videoElement.muted = !videoElement.muted;
          setIsMuted(videoElement.muted);
          if (!videoElement.muted && videoElement.volume === 0) {
            videoElement.volume = 0.5;
            setVolume(0.5);
          }
          break;

        case 'KeyF':
        case 'f':
          // Toggle fullscreen
          if (isFullscreen) {
            if (document.exitFullscreen) {
              document.exitFullscreen().catch(console.error);
            } else if (document.webkitExitFullscreen) {
              document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
              document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
              document.msExitFullscreen();
            }
            // Force state update if needed
            setTimeout(() => {
              const stillFullscreen = !!(document.fullscreenElement ||
                                       document.webkitFullscreenElement ||
                                       document.mozFullScreenElement ||
                                       document.msFullscreenElement);
              if (!stillFullscreen) {
                setIsFullscreen(false);
              }
            }, 100);
          } else {
            const container = document.querySelector('.native-video-container');
            if (container) {
              if (container.requestFullscreen) {
                container.requestFullscreen();
              } else if (container.webkitRequestFullscreen) {
                container.webkitRequestFullscreen();
              } else if (container.mozRequestFullScreen) {
                container.mozRequestFullScreen();
              } else if (container.msRequestFullscreen) {
                container.msRequestFullscreen();
              }
            }
          }
          break;

        default:
          break;
      }
    };

    // Add global keydown listener
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLoaded]); // Re-run when video load state changes

  // Auto-hide controls timer
  useEffect(() => {
    const resetHideTimer = () => {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }

      setControlsVisible(true);

      // Auto-hide logic
      if (isPlaying) {
        if (isFullscreen) {
          // In fullscreen mode, always auto-hide after 1 second
          hideControlsTimeoutRef.current = setTimeout(() => {
            setControlsVisible(false);
            const videoContainer = document.querySelector('.native-video-container');
            if (videoContainer) {
              videoContainer.style.cursor = 'none';
            }
          }, 1000);
        } else if (!isVideoHovered) {
          // In normal mode, auto-hide only when not hovering
          hideControlsTimeoutRef.current = setTimeout(() => {
            setControlsVisible(false);
          }, 3000);
        }
      }
    };

    // Reset timer when play state or hover state changes
    resetHideTimer();

    return () => {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
    };
  }, [isPlaying, isVideoHovered, isFullscreen]);

  // Show controls on mouse movement
  useEffect(() => {
    const handleMouseMove = () => {
      setControlsVisible(true);

      // Show cursor when controls are visible
      const videoContainer = document.querySelector('.native-video-container');
      if (videoContainer && isFullscreen) {
        videoContainer.style.cursor = 'default';
      }

      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }

      // Auto-hide logic after mouse movement
      if (isPlaying) {
        if (isFullscreen) {
          // In fullscreen mode, always auto-hide after 1 second
          hideControlsTimeoutRef.current = setTimeout(() => {
            setControlsVisible(false);
            if (videoContainer) {
              videoContainer.style.cursor = 'none';
            }
          }, 1000);
        } else if (!isVideoHovered) {
          // In normal mode, auto-hide only when not hovering
          hideControlsTimeoutRef.current = setTimeout(() => {
            setControlsVisible(false);
          }, 3000);
        }
      }
    };

    const videoContainer = document.querySelector('.native-video-container');
    if (videoContainer) {
      videoContainer.addEventListener('mousemove', handleMouseMove);
      return () => {
        videoContainer.removeEventListener('mousemove', handleMouseMove);
      };
    }
  }, [isPlaying, isVideoHovered, isFullscreen]);

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
      {/* CSS Animation for spinner and hide native controls */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          /* Force hide native video controls in all states including fullscreen */
          .video-player::-webkit-media-controls {
            display: none !important;
          }
          .video-player::-webkit-media-controls-panel {
            display: none !important;
          }
          .video-player::-webkit-media-controls-play-button {
            display: none !important;
          }
          .video-player::-webkit-media-controls-timeline {
            display: none !important;
          }
          .video-player::-webkit-media-controls-current-time-display {
            display: none !important;
          }
          .video-player::-webkit-media-controls-time-remaining-display {
            display: none !important;
          }
          .video-player::-webkit-media-controls-mute-button {
            display: none !important;
          }
          .video-player::-webkit-media-controls-volume-slider {
            display: none !important;
          }
          .video-player::-webkit-media-controls-fullscreen-button {
            display: none !important;
          }
          .video-player::-webkit-media-controls-overlay-play-button {
            display: none !important;
          }

          /* Firefox */
          .video-player::-moz-media-controls {
            display: none !important;
          }

          /* Edge/IE */
          .video-player::-ms-media-controls {
            display: none !important;
          }

          /* Additional fallback */
          .video-player {
            outline: none !important;
          }
          .video-player:focus {
            outline: none !important;
          }

          /* Fullscreen container styling - remove centering */
          .native-video-container:fullscreen {
            width: 100vw !important;
            height: 100vh !important;
            background: black !important;
            position: relative !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .native-video-container:-webkit-full-screen {
            width: 100vw !important;
            height: 100vh !important;
            background: black !important;
            position: relative !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .native-video-container:-moz-full-screen {
            width: 100vw !important;
            height: 100vh !important;
            background: black !important;
            position: relative !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .native-video-container:-ms-fullscreen {
            width: 100vw !important;
            height: 100vh !important;
            background: black !important;
            position: relative !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Video in fullscreen - use transform scale approach */
          .native-video-container:fullscreen .video-player,
          .native-video-container:-webkit-full-screen .video-player,
          .native-video-container:-moz-full-screen .video-player,
          .native-video-container:-ms-fullscreen .video-player {
            width: 100vw !important;
            height: 100vh !important;
            max-width: none !important;
            max-height: none !important;
            min-width: 100vw !important;
            min-height: 100vh !important;
            object-fit: fill !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            z-index: 1000 !important;
            transform: none !important;
          }

          /* Video wrapper in fullscreen */
          .native-video-container:fullscreen .video-wrapper,
          .native-video-container:-webkit-full-screen .video-wrapper,
          .native-video-container:-moz-full-screen .video-wrapper,
          .native-video-container:-ms-fullscreen .video-wrapper {
            width: 100vw !important;
            height: 100vh !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            z-index: 1 !important;
          }

          /* Force video element to fill in fullscreen - multiple selectors for maximum coverage */
          .native-video-container:fullscreen video,
          .native-video-container:-webkit-full-screen video,
          .native-video-container:-moz-full-screen video,
          .native-video-container:-ms-fullscreen video,
          .native-video-container:fullscreen .video-player,
          .native-video-container:-webkit-full-screen .video-player,
          .native-video-container:-moz-full-screen .video-player,
          .native-video-container:-ms-fullscreen .video-player {
            width: 100vw !important;
            height: 100vh !important;
            object-fit: fill !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            z-index: 1000 !important;
            transform: none !important;
            max-width: none !important;
            max-height: none !important;
            min-width: 100vw !important;
            min-height: 100vh !important;
            cursor: pointer !important;
            touch-action: manipulation !important;
          }
        `}
      </style>

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
          onRenderVideo={onRenderVideo}
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
          <div
            className="native-video-container"
            onMouseEnter={() => !isFullscreen && setIsVideoHovered(true)}
            onMouseLeave={() => !isFullscreen && setIsVideoHovered(false)}
          >
              {/* Video quality toggle - only show when optimized video is available */}


              {/* Refresh Narration button - only show when video is loaded and hovered */}
              {isLoaded && (
                <LiquidGlass
                  width={180}
                  height={50}
                  position="absolute"
                  top="10px"
                  left="10px"
                  borderRadius="25px"
                  className="content-center interactive theme-primary"
                  cursor="pointer"
                  zIndex={10}
                  effectIntensity={0.6}
                  effectRadius={0.5}
                  effectWidth={0.3}
                  effectHeight={0.2}
                  animateOnHover={true}
                  hoverScale={1.05}
                  updateOnMouseMove={false}
                  style={{
                    opacity: isVideoHovered ? 1 : 0,
                    transition: 'opacity 0.3s ease-in-out',
                    pointerEvents: isVideoHovered ? 'auto' : 'none'
                  }}
                  aria-label={t('preview.refreshNarration', 'Refresh Narration')}
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
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      width: '100%',
                      height: '100%',
                      opacity: isRefreshingNarration ? 0.7 : 1,
                      cursor: isRefreshingNarration ? 'not-allowed' : 'pointer'
                    }}>
                      {isRefreshingNarration ? (
                        // Show loading spinner when refreshing
                        <>
                          <svg className="spinner" width="22" height="22" viewBox="0 0 24 24" style={{ color: 'white' }}>
                            <circle className="path" cx="12" cy="12" r="10" fill="none" strokeWidth="3"></circle>
                          </svg>
                          <span style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>
                            {t('preview.refreshingNarration', 'Refreshing...')}
                          </span>
                        </>
                      ) : (
                        // Show refresh icon when not refreshing
                        <>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                          </svg>
                          <span style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>
                            {t('preview.refreshNarration', 'Refresh Narration')}
                          </span>
                        </>
                      )}
                    </div>
                </LiquidGlass>
              )}

              {/* Gemini FPS Info button - only show when video is loaded and hovered */}
              {isLoaded && (
                <LiquidGlass
                  width={50}
                  height={50}
                  position="absolute"
                  top="10px"
                  left="200px"
                  borderRadius="25px"
                  className="content-center interactive theme-warning shape-circle"
                  cursor="pointer"
                  zIndex={10}
                  effectIntensity={0.7}
                  effectRadius={0.6}
                  effectWidth={0.4}
                  effectHeight={0.4}
                  animateOnHover={true}
                  hoverScale={1.1}
                  updateOnMouseMove={true}
                  aria-label="Gemini FPS Info"
                  style={{
                    opacity: isVideoHovered ? 1 : 0,
                    transition: 'opacity 0.3s ease-in-out',
                    pointerEvents: isVideoHovered ? 'auto' : 'none'
                  }}
                  onClick={() => {
                    window.open('https://ai.google.dev/gemini-api/docs/video-understanding', '_blank');
                  }}
                >
                  <div
                    title="Gemini chỉ xử lý 1FPS dù gửi video có FPS cao, bấm nút để xem thêm, vui lòng chọn Render Video để có chất lượng + FPS tốt nhất"
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                    </svg>
                  </div>
                </LiquidGlass>
              )}



              {/* Download audio button - only show when video is loaded and hovered */}
              {isLoaded && (
                <LiquidGlass
                  width={160}
                  height={50}
                  position="absolute"
                  top="10px"
                  right="10px"
                  borderRadius="25px"
                  className={`content-center interactive ${isAudioDownloading ? 'theme-secondary' : 'theme-success'}`}
                  cursor={isAudioDownloading ? 'not-allowed' : 'pointer'}
                  zIndex={10}
                  effectIntensity={isAudioDownloading ? 0.3 : 0.6}
                  effectRadius={0.5}
                  effectWidth={0.3}
                  effectHeight={0.2}
                  animateOnHover={!isAudioDownloading}
                  hoverScale={1.05}
                  updateOnMouseMove={false}
                  aria-label={t('preview.downloadAudio', 'Download Audio')}
                  style={{
                    opacity: isVideoHovered ? 1 : 0,
                    transition: 'opacity 0.3s ease-in-out',
                    pointerEvents: isVideoHovered ? 'auto' : 'none'
                  }}
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
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      width: '100%',
                      height: '100%',
                      opacity: isAudioDownloading ? 0.7 : 1,
                      cursor: isAudioDownloading ? 'not-allowed' : 'pointer'
                    }}>
                      {isAudioDownloading ? (
                        // Material Design loading spinner
                        <>
                          <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" style={{ color: 'white' }}>
                            <circle className="path" cx="12" cy="12" r="10" fill="none" strokeWidth="3"></circle>
                          </svg>
                          <span style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>
                            {t('preview.downloadingAudio', 'Downloading...')}
                          </span>
                        </>
                      ) : (
                        // Material Design download icon
                        <>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                          </svg>
                          <span style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>
                            {t('preview.downloadAudio', 'Download Audio')}
                          </span>
                        </>
                      )}
                    </div>
                </LiquidGlass>
              )}
              <div className="video-wrapper" style={{ position: 'relative' }}>
                <video
                  ref={videoRef}
                  className="video-player"
                  onClick={() => {
                    if (videoRef.current) {
                      if (isPlaying) {
                        videoRef.current.pause();
                      } else {
                        videoRef.current.play().catch(console.error);
                      }
                    }
                  }}
                  onTouchEnd={(e) => {
                    // Prevent double-tap zoom on mobile
                    e.preventDefault();
                    if (videoRef.current) {
                      if (isPlaying) {
                        videoRef.current.pause();
                      } else {
                        videoRef.current.play().catch(console.error);
                      }
                    }
                  }}
                  style={{ cursor: 'pointer', touchAction: 'manipulation' }}
                  playsInline
                  controlsList="nodownload nofullscreen noremoteplayback"
                  disablePictureInPicture={false}
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

                {/* Loading/Buffering Spinner */}
                {(isVideoLoading || isBuffering) && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 15
                  }}>
                    <LiquidGlass
                      width={60}
                      height={60}
                      borderRadius="30px"
                      className="content-center theme-primary shape-circle"
                      effectIntensity={0.8}
                      effectRadius={0.6}
                      effectWidth={0.4}
                      effectHeight={0.4}
                      style={{
                        background: 'rgba(0,0,0,0.7)',
                        backdropFilter: 'blur(10px)'
                      }}
                    >
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          border: '3px solid rgba(255,255,255,0.3)',
                          borderTop: '3px solid white',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                      </div>
                    </LiquidGlass>
                  </div>
                )}

                {/* Custom Liquid Glass Video Controls */}
                {showCustomControls && (
                  <div
                    className="custom-video-controls"
                    style={{
                      position: 'absolute',
                      bottom: '0',
                      left: '0',
                      right: '0',
                      height: '70px',
                      background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 15px',
                      zIndex: 10
                    }}
                  >
                    {/* Play/Pause Button */}
                    <LiquidGlass
                      width={50}
                      height={50}
                      borderRadius="25px"
                      className="content-center interactive theme-primary shape-circle"
                      cursor="pointer"
                      effectIntensity={0.6}
                      effectRadius={0.5}
                      effectWidth={0.3}
                      effectHeight={0.3}
                      animateOnHover={true}
                      hoverScale={1.1}
                      updateOnMouseMove={true}
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                      onClick={() => {
                        if (videoRef.current) {
                          if (isPlaying) {
                            videoRef.current.pause();
                          } else {
                            videoRef.current.play().catch(console.error);
                          }
                        }
                      }}
                      style={{
                        marginRight: '15px',
                        opacity: ((!isFullscreen && isVideoHovered) || (isPlaying && controlsVisible)) ? 1 : 0,
                        transition: 'opacity 0.3s ease-in-out',
                        pointerEvents: ((!isFullscreen && isVideoHovered) || (isPlaying && controlsVisible)) ? 'auto' : 'none'
                      }}
                    >
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {isPlaying ? (
                          // Pause icon
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                          </svg>
                        ) : (
                          // Play icon
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        )}
                      </div>
                    </LiquidGlass>

                    {/* Timeline/Progress Bar */}
                    <div
                      className="timeline-container"
                      style={{
                        flex: 1,
                        height: '8px',
                        minHeight: '8px',
                        maxHeight: '8px',
                        background: 'rgba(255,255,255,0.3)',
                        borderRadius: '4px',
                        position: 'relative',
                        cursor: 'pointer',
                        marginRight: '15px',
                        touchAction: 'none',
                        alignSelf: 'center',
                        overflow: 'visible',
                        margin: '0', // Reset any default margins
                        opacity: ((!isFullscreen && isVideoHovered) || (isPlaying && controlsVisible)) ? 1 : 0,
                        transition: 'opacity 0.3s ease-in-out',
                        pointerEvents: ((!isFullscreen && isVideoHovered) || (isPlaying && controlsVisible)) ? 'auto' : 'none'
                      }}
                      onMouseDown={handleTimelineMouseDown}
                      onTouchStart={handleTimelineTouchStart}
                    >
                      {/* Buffered progress (background) */}
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        height: '100%',
                        width: `${bufferedProgress}%`,
                        background: 'rgba(255,255,255,0.4)',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease'
                      }} />

                      {/* Progress fill */}
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        height: '100%',
                        width: videoDuration > 0 ? `${((isDragging ? dragTime : currentTime) / videoDuration) * 100}%` : '0%',
                        background: '#4CAF50',
                        borderRadius: '4px',
                        transition: isDragging ? 'none' : 'width 0.1s ease'
                      }} />

                      {/* Progress handle */}
                      <div style={{
                        position: 'absolute',
                        left: videoDuration > 0 ? `${((isDragging ? dragTime : currentTime) / videoDuration) * 100}%` : '0%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: isDragging ? '16px' : '12px',
                        height: isDragging ? '16px' : '12px',
                        background: 'white',
                        borderRadius: '50%',
                        boxShadow: isDragging ? '0 4px 8px rgba(0,0,0,0.5)' : '0 2px 4px rgba(0,0,0,0.3)',
                        transition: isDragging ? 'none' : 'left 0.1s ease, width 0.2s ease, height 0.2s ease',
                        cursor: 'pointer'
                      }} />
                    </div>

                    {/* Time Display */}
                    <div style={{
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: '500',
                      marginRight: '15px',
                      minWidth: '80px',
                      textAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      opacity: ((!isFullscreen && isVideoHovered) || (isPlaying && controlsVisible)) ? 1 : 0,
                      transition: 'opacity 0.3s ease-in-out',
                      pointerEvents: ((!isFullscreen && isVideoHovered) || (isPlaying && controlsVisible)) ? 'auto' : 'none'
                    }}>
                      {Math.floor((isDragging ? dragTime : currentTime) / 60)}:{String(Math.floor((isDragging ? dragTime : currentTime) % 60)).padStart(2, '0')} / {Math.floor(videoDuration / 60)}:{String(Math.floor(videoDuration % 60)).padStart(2, '0')}
                    </div>

                    {/* Volume Control with Expanding Pill */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginRight: '15px',
                        position: 'relative'
                      }}
                      onMouseEnter={() => setIsVolumeSliderVisible(true)}
                      onMouseLeave={() => setIsVolumeSliderVisible(false)}
                    >
                      {/* Expanding Volume Pill */}
                      <LiquidGlass
                        width={50}
                        height={isVolumeSliderVisible ? 180 : 50}
                        borderRadius="25px"
                        className="content-center interactive theme-secondary"
                        cursor="pointer"
                        effectIntensity={0.7}
                        effectRadius={0.6}
                        effectWidth={0.4}
                        effectHeight={0.4}
                        animateOnHover={true}
                        hoverScale={1.02}
                        updateOnMouseMove={true}
                        style={{
                          transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-in-out',
                          transform: isVolumeSliderVisible ? 'translateY(-65px)' : 'translateY(0px)', // Shoot upward
                          transformOrigin: 'bottom center', // Expand from bottom
                          opacity: ((!isFullscreen && isVideoHovered) || (isPlaying && controlsVisible)) ? 1 : 0,
                          pointerEvents: ((!isFullscreen && isVideoHovered) || (isPlaying && controlsVisible)) ? 'auto' : 'none'
                        }}
                      >
                        <div style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          position: 'relative'
                        }}>
                          {/* Volume Slider - always present but with opacity transition */}
                          <div
                            className="expanding-volume-slider"
                            style={{
                              width: '6px',
                              height: '60px',
                              background: 'rgba(255,255,255,0.3)',
                              borderRadius: '3px',
                              position: 'absolute',
                              top: '50px', // Moved down to be more visible
                              cursor: 'pointer',
                              opacity: isVolumeSliderVisible ? 1 : 0,
                              transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              pointerEvents: isVolumeSliderVisible ? 'auto' : 'none'
                            }}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsVolumeDragging(true);
                                const rect = e.currentTarget.getBoundingClientRect();
                                const newVolume = Math.max(0, Math.min(1, (rect.bottom - e.clientY) / rect.height));
                                setVolume(newVolume);
                                if (videoRef.current) {
                                  videoRef.current.volume = newVolume;
                                  videoRef.current.muted = newVolume === 0;
                                  setIsMuted(newVolume === 0);
                                }
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                const newVolume = Math.max(0, Math.min(1, (rect.bottom - e.clientY) / rect.height));
                                setVolume(newVolume);
                                if (videoRef.current) {
                                  videoRef.current.volume = newVolume;
                                  videoRef.current.muted = newVolume === 0;
                                  setIsMuted(newVolume === 0);
                                }
                              }}
                            >
                            {/* Glass-style volume fill with gradient */}
                            <div style={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              width: '100%',
                              height: `${volume * 100}%`,
                              background: 'linear-gradient(to top, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.6) 100%)',
                              borderRadius: '3px',
                              backdropFilter: 'blur(4px)',
                              boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3), 0 1px 3px rgba(0,0,0,0.2)',
                              transition: isVolumeDragging ? 'none' : 'height 0.2s ease'
                            }} />

                            {/* Glass orb handle */}
                            <div
                              style={{
                                position: 'absolute',
                                bottom: `${volume * 100}%`,
                                left: '50%',
                                transform: 'translate(-50%, 50%)',
                                width: isVolumeDragging ? '18px' : '16px',
                                height: isVolumeDragging ? '18px' : '16px',
                                background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,1), rgba(255,255,255,0.95), rgba(255,255,255,0.85))',
                                borderRadius: '50%',
                                backdropFilter: 'blur(2px)',
                                boxShadow: isVolumeDragging
                                  ? '0 4px 12px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.6), 0 0 8px rgba(255,255,255,0.4)'
                                  : '0 2px 6px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.6), 0 0 4px rgba(255,255,255,0.3)',
                                border: '1px solid rgba(255,255,255,0.8)',
                                transition: isVolumeDragging ? 'none' : 'all 0.2s ease',
                                cursor: 'pointer',
                                zIndex: 10
                              }}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsVolumeDragging(true);
                              }}
                            />

                            {/* Volume percentage indicator - Simple text */}
                            <div
                              style={{
                                position: 'absolute',
                                top: '-35px', // Even higher at the very top
                                left: '50%',
                                transform: 'translateX(-50%)',
                                fontSize: '12px',
                                fontWeight: '600',
                                color: 'white',
                                textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                                opacity: isVolumeDragging || isVolumeSliderVisible ? 1 : 0,
                                transition: 'opacity 0.2s ease',
                                pointerEvents: 'none',
                                zIndex: 15,
                                textAlign: 'center'
                              }}
                            >
                              {Math.round(volume * 100)}%
                            </div>
                          </div>

                          {/* Volume Icon - Fixed position at bottom */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '30px',
                              height: '30px',
                              cursor: 'pointer',
                              position: 'absolute',
                              bottom: '10px', // Back to original position
                              left: '50%',
                              transform: 'translateX(-50%)'
                            }}
                            onClick={() => {
                              if (videoRef.current) {
                                const newMuted = !videoRef.current.muted;
                                videoRef.current.muted = newMuted;
                                setIsMuted(newMuted);
                                if (newMuted) {
                                  setVolume(0);
                                } else {
                                  const newVolume = volume === 0 ? 0.5 : volume;
                                  setVolume(newVolume);
                                  videoRef.current.volume = newVolume;
                                }
                              }
                            }}
                          >
                            {isMuted || volume === 0 ? (
                              // Muted icon
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                              </svg>
                            ) : volume < 0.5 ? (
                              // Low volume icon
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                              </svg>
                            ) : (
                              // High volume icon
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                              </svg>
                            )}
                          </div>
                        </div>
                      </LiquidGlass>
                    </div>

                    {/* Combined Actions Pill (Speed, Download, PiP) */}
                    <div
                      style={{
                        position: 'relative',
                        marginRight: '15px'
                      }}
                      onMouseEnter={() => setIsSpeedMenuVisible(true)}
                      onMouseLeave={() => setIsSpeedMenuVisible(false)}
                    >
                      {/* Invisible hover area extension */}
                      <div style={{
                        position: 'absolute',
                        top: '-200px',
                        left: '-10px',
                        right: '-10px',
                        height: '200px',
                        zIndex: 5
                      }} />
                      {/* Speed Menu */}
                      {isSpeedMenuVisible && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '60px',
                            left: '35px', // Moved right to align better with speed button
                            transform: 'translateX(-50%)',
                            zIndex: 20,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            padding: '8px'
                          }}
                        >
                          {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
                            <LiquidGlass
                              key={speed}
                              width={60}
                              height={32}
                              borderRadius="16px"
                              className={`content-center interactive ${playbackSpeed === speed ? 'theme-success' : 'theme-secondary'}`}
                              cursor="pointer"
                              effectIntensity={0.3}
                              effectRadius={0.5}
                              effectWidth={0.2}
                              effectHeight={0.3}
                              animateOnHover={true}
                              hoverScale={1.1}
                              updateOnMouseMove={true}
                              onClick={() => {
                                setPlaybackSpeed(speed);
                                if (videoRef.current) {
                                  videoRef.current.playbackRate = speed;
                                }
                              }}
                            >
                              <div style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: playbackSpeed === speed ? '600' : '500',
                                color: 'white',
                                textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                              }}>
                                {speed}x
                              </div>
                            </LiquidGlass>
                          ))}
                        </div>
                      )}

                      {/* Combined Actions Pill */}
                      <LiquidGlass
                        width={150}
                        height={50}
                        borderRadius="25px"
                        className="content-center interactive theme-secondary"
                        cursor="pointer"
                        effectIntensity={0.6}
                        effectRadius={0.5}
                        effectWidth={0.3}
                        effectHeight={0.2}
                        animateOnHover={true}
                        hoverScale={1.02}
                        updateOnMouseMove={false}
                        style={{
                          opacity: ((!isFullscreen && isVideoHovered) || (isPlaying && controlsVisible)) ? 1 : 0,
                          transition: 'opacity 0.3s ease-in-out',
                          pointerEvents: ((!isFullscreen && isVideoHovered) || (isPlaying && controlsVisible)) ? 'auto' : 'none'
                        }}
                      >
                        <div style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-around',
                          padding: '0 10px'
                        }}>
                          {/* Speed Button */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '40px',
                              height: '30px',
                              borderRadius: '15px',
                              background: 'rgba(33, 150, 243, 0.2)',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Speed functionality handled by hover menu
                            }}
                          >
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 'bold',
                              color: 'white'
                            }}>
                              {playbackSpeed}x
                            </span>
                          </div>

                          {/* Download Video Button */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '30px',
                              height: '30px',
                              borderRadius: '15px',
                              background: 'rgba(76, 175, 80, 0.2)',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (videoRef.current && videoRef.current.src) {
                                const link = document.createElement('a');
                                link.href = videoRef.current.src;
                                link.download = `video_${Date.now()}.mp4`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                            </svg>
                          </div>

                          {/* Picture-in-Picture Button */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '30px',
                              height: '30px',
                              borderRadius: '15px',
                              background: 'rgba(255, 152, 0, 0.2)',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (videoRef.current) {
                                try {
                                  if (document.pictureInPictureElement) {
                                    await document.exitPictureInPicture();
                                  } else if (videoRef.current.requestPictureInPicture) {
                                    await videoRef.current.requestPictureInPicture();
                                  }
                                } catch (error) {
                                  console.error('Picture-in-Picture error:', error);
                                }
                              }
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                              <path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/>
                            </svg>
                          </div>
                        </div>
                      </LiquidGlass>
                    </div>



                    {/* Fullscreen Button */}
                    <LiquidGlass
                      width={50}
                      height={50}
                      borderRadius="25px"
                      className="content-center interactive theme-warning shape-circle"
                      cursor="pointer"
                      effectIntensity={0.6}
                      effectRadius={0.5}
                      effectWidth={0.3}
                      effectHeight={0.3}
                      animateOnHover={true}
                      hoverScale={1.1}
                      updateOnMouseMove={true}
                      aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                      onClick={() => {
                        if (isFullscreen) {
                          // Try all exit fullscreen methods
                          if (document.exitFullscreen) {
                            document.exitFullscreen().catch(console.error);
                          } else if (document.webkitExitFullscreen) {
                            document.webkitExitFullscreen();
                          } else if (document.mozCancelFullScreen) {
                            document.mozCancelFullScreen();
                          } else if (document.msExitFullscreen) {
                            document.msExitFullscreen();
                          }
                          // Force state update if needed
                          setTimeout(() => {
                            const stillFullscreen = !!(document.fullscreenElement ||
                                                     document.webkitFullscreenElement ||
                                                     document.mozFullScreenElement ||
                                                     document.msFullscreenElement);
                            if (!stillFullscreen) {
                              console.log('🎬 FALLBACK: Exiting fullscreen, resetting styles');

                              // Reset all styles
                              const videoElement = document.querySelector('.native-video-container video');
                              const videoWrapper = document.querySelector('.native-video-container .video-wrapper');
                              const container = document.querySelector('.native-video-container');

                              if (videoElement) {
                                videoElement.style.removeProperty('width');
                                videoElement.style.removeProperty('height');
                                videoElement.style.removeProperty('object-fit');
                                videoElement.style.removeProperty('position');
                                videoElement.style.removeProperty('top');
                                videoElement.style.removeProperty('left');
                                videoElement.style.removeProperty('z-index');
                                videoElement.style.removeProperty('max-width');
                                videoElement.style.removeProperty('max-height');
                                videoElement.style.removeProperty('min-width');
                                videoElement.style.removeProperty('min-height');
                              }

                              if (videoWrapper) {
                                videoWrapper.style.removeProperty('width');
                                videoWrapper.style.removeProperty('height');
                                videoWrapper.style.removeProperty('position');
                              }

                              if (container) {
                                container.style.removeProperty('width');
                                container.style.removeProperty('height');
                                container.style.removeProperty('position');
                                container.style.removeProperty('top');
                                container.style.removeProperty('left');
                                container.style.removeProperty('z-index');
                                container.style.removeProperty('background');
                                // Reset cursor to default
                                container.style.cursor = 'default';
                              }

                              setIsFullscreen(false);
                              console.log('🎬 FALLBACK: Exit fullscreen styles reset');
                            }
                          }, 100);
                        } else {
                          console.log('🎬 FULLSCREEN BUTTON CLICKED - Requesting fullscreen');
                          const container = document.querySelector('.native-video-container');
                          if (container) {
                            console.log('🎬 Container found, requesting fullscreen');

                            // Request fullscreen
                            let fullscreenPromise;
                            if (container.requestFullscreen) {
                              fullscreenPromise = container.requestFullscreen();
                            } else if (container.webkitRequestFullscreen) {
                              fullscreenPromise = container.webkitRequestFullscreen();
                            } else if (container.mozRequestFullScreen) {
                              fullscreenPromise = container.mozRequestFullScreen();
                            } else if (container.msRequestFullscreen) {
                              fullscreenPromise = container.msRequestFullscreen();
                            }

                            // Fallback: Force fullscreen styles after a short delay
                            setTimeout(() => {
                              console.log('🎬 FALLBACK: Checking if fullscreen succeeded');
                              const isNowFullscreen = !!document.fullscreenElement ||
                                                    !!document.webkitFullscreenElement ||
                                                    !!document.mozFullScreenElement ||
                                                    !!document.msFullscreenElement;

                              if (isNowFullscreen) {
                                console.log('🎬 FALLBACK: Fullscreen detected, applying styles manually');
                                const videoElement = document.querySelector('.native-video-container video');
                                const videoWrapper = document.querySelector('.native-video-container .video-wrapper');
                                const container = document.querySelector('.native-video-container');

                                if (videoElement && videoWrapper && container) {
                                  // Apply container styles
                                  container.style.setProperty('width', '100vw', 'important');
                                  container.style.setProperty('height', '100vh', 'important');
                                  container.style.setProperty('position', 'fixed', 'important');
                                  container.style.setProperty('top', '0', 'important');
                                  container.style.setProperty('left', '0', 'important');
                                  container.style.setProperty('z-index', '998', 'important');
                                  container.style.setProperty('background', 'black', 'important');

                                  // Apply wrapper styles
                                  videoWrapper.style.setProperty('width', '100vw', 'important');
                                  videoWrapper.style.setProperty('height', '100vh', 'important');
                                  videoWrapper.style.setProperty('position', 'relative', 'important');

                                  // Apply video styles - use fixed positioning to ensure full coverage
                                  videoElement.style.setProperty('width', '100vw', 'important');
                                  videoElement.style.setProperty('height', '100vh', 'important');
                                  videoElement.style.setProperty('object-fit', 'fill', 'important');
                                  videoElement.style.setProperty('position', 'fixed', 'important');
                                  videoElement.style.setProperty('top', '0', 'important');
                                  videoElement.style.setProperty('left', '0', 'important');
                                  videoElement.style.setProperty('z-index', '1', 'important');
                                  videoElement.style.setProperty('max-width', 'none', 'important');
                                  videoElement.style.setProperty('max-height', 'none', 'important');
                                  videoElement.style.setProperty('min-width', '100vw', 'important');
                                  videoElement.style.setProperty('min-height', '100vh', 'important');

                                  // Set React state to show controls initially
                                  setIsFullscreen(true);
                                  setControlsVisible(true);
                                  setIsVideoHovered(false); // Reset hover state in fullscreen

                                  // Start auto-hide timer for fullscreen
                                  if (hideControlsTimeoutRef.current) {
                                    clearTimeout(hideControlsTimeoutRef.current);
                                  }

                                  if (isPlaying) {
                                    hideControlsTimeoutRef.current = setTimeout(() => {
                                      setControlsVisible(false);
                                      container.style.cursor = 'none';
                                    }, 1000);
                                  }

                                  console.log('🎬 FALLBACK: All styles applied successfully');
                                } else {
                                  console.log('🎬 FALLBACK: Could not find all required elements');
                                }
                              }
                            }, 100);

                          } else {
                            console.log('🎬 ERROR: Container not found!');
                          }
                        }
                      }}
                      style={{
                        opacity: ((!isFullscreen && isVideoHovered) || (isPlaying && controlsVisible)) ? 1 : 0,
                        transition: 'opacity 0.3s ease-in-out',
                        pointerEvents: ((!isFullscreen && isVideoHovered) || (isPlaying && controlsVisible)) ? 'auto' : 'none'
                      }}
                    >
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {isFullscreen ? (
                          // Exit fullscreen icon
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                            <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                          </svg>
                        ) : (
                          // Fullscreen icon
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                          </svg>
                        )}
                      </div>
                    </LiquidGlass>
                  </div>
                )}

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