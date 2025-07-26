import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  startYoutubeVideoDownload,
  checkDownloadStatus,
  extractYoutubeVideoId
} from '../../../utils/videoDownloader';
import { SERVER_URL } from '../../../config';

/**
 * Custom hook for managing video state including URLs, loading, errors, and optimization
 * @param {string} videoSource - The video source URL or blob
 * @param {function} onVideoUrlReady - Callback when video URL is ready
 * @returns {object} Video state and handlers
 */
export const useVideoState = (videoSource, onVideoUrlReady) => {
  const { t } = useTranslation();
  
  // Core video state
  const [videoUrl, setVideoUrl] = useState('');
  const [optimizedVideoUrl, setOptimizedVideoUrl] = useState('');
  const [optimizedVideoInfo, setOptimizedVideoInfo] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState('');
  
  // Download management state
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [videoId, setVideoId] = useState(null);
  const [downloadCheckInterval, setDownloadCheckInterval] = useState(null);
  
  // Optimization preference
  const [useOptimizedPreview, setUseOptimizedPreview] = useState(() => {
    return localStorage.getItem('use_optimized_preview') === 'true';
  });

  // Listen for changes to the optimized preview setting
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
          console.log('[useVideoState] Optimized preview setting changed:', currentValue);
          return currentValue;
        }
        return prev;
      });
    }, 500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkInterval);
    };
  }, []);

  // Process video URL (download if it's YouTube)
  const processVideoUrl = useCallback(async (url) => {
    // Reset states
    setError('');
    setIsLoaded(false);

    // Check if it's a YouTube URL
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      try {
        setDownloadProgress(0);
        
        // Store the URL for future use
        localStorage.setItem('current_video_url', url);
        
        // Extract video ID
        extractYoutubeVideoId(url);
        
        // Start the download process
        const id = startYoutubeVideoDownload(url);
        setVideoId(id);
        
        // Check initial status
        const initialStatus = checkDownloadStatus(id);
        if (initialStatus.status === 'completed') {
          setVideoUrl(initialStatus.url);
          setIsDownloading(false);
        } else if (initialStatus.status === 'downloading') {
          setIsDownloading(true);
          setDownloadProgress(initialStatus.progress || 1);
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
  }, [t]);

  // Check for optimized video version
  const checkOptimizedVersion = useCallback(() => {
    try {
      const splitResult = JSON.parse(localStorage.getItem('split_result') || '{}');
      const lastOptimizationTimestamp = localStorage.getItem('last_optimization_timestamp');

      if (splitResult.optimized && splitResult.optimized.video && lastOptimizationTimestamp) {
        // Check if this optimization is recent (within last 5 minutes)
        const optimizationAge = Date.now() - parseInt(lastOptimizationTimestamp);
        const fiveMinutes = 5 * 60 * 1000;

        if (optimizationAge < fiveMinutes) {
          const optimizedUrl = `${SERVER_URL}${splitResult.optimized.video}`;
          setOptimizedVideoUrl(optimizedUrl);

          // Store the optimization info
          setOptimizedVideoInfo({
            resolution: splitResult.optimized.resolution || '360p',
            fps: splitResult.optimized.fps || 1,
            width: splitResult.optimized.width,
            height: splitResult.optimized.height
          });
        } else {
          setOptimizedVideoUrl('');
          setOptimizedVideoInfo(null);
        }
      } else {
        setOptimizedVideoUrl('');
        setOptimizedVideoInfo(null);
      }
    } catch (error) {
      console.error('Error checking optimization:', error);
      setOptimizedVideoUrl('');
      setOptimizedVideoInfo(null);
    }
  }, []);

  // Initialize video source
  useEffect(() => {
    const loadVideo = async () => {
      // Reset video state when source changes
      setIsLoaded(false);
      setVideoUrl('');
      setOptimizedVideoUrl('');
      setError('');
      setOptimizedVideoInfo(null);
      setIsDownloading(false);
      setDownloadProgress(0);

      // Clear narration data when video source changes
      if (process.env.NODE_ENV === 'development') {
        console.log('[useVideoState] Clearing narration data for new video source');
      }
      window.originalNarrations = [];
      window.translatedNarrations = [];
      localStorage.removeItem('originalNarrations');
      localStorage.removeItem('translatedNarrations');

      // Dispatch events to notify other components
      const event = new CustomEvent('narrations-updated', {
        detail: { source: 'original', narrations: [] }
      });
      window.dispatchEvent(event);

      const translatedEvent = new CustomEvent('narrations-updated', {
        detail: { source: 'translated', narrations: [] }
      });
      window.dispatchEvent(translatedEvent);

      if (!videoSource) {
        return;
      }

      // Handle blob URLs (from file upload)
      if (videoSource.startsWith('blob:')) {
        setVideoUrl(videoSource);
        checkOptimizedVersion();
        return;
      }

      // Handle YouTube URLs
      if (videoSource.includes('youtube.com') || videoSource.includes('youtu.be')) {
        await processVideoUrl(videoSource);
        return;
      }

      // For any other URL, try to use it directly
      setVideoUrl(videoSource);
      checkOptimizedVersion();
    };

    loadVideo();
  }, [videoSource, processVideoUrl, checkOptimizedVersion]);

  // Notify parent component when videoUrl changes
  useEffect(() => {
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
        setDownloadCheckInterval(null);
      } else if (status.status === 'error') {
        setError(t('preview.videoError', `Error loading video: ${status.error}`));
        setIsDownloading(false);
        clearInterval(interval);
        setDownloadCheckInterval(null);
      } else if (status.status === 'not_found') {
        setIsDownloading(false);
        clearInterval(interval);
        setDownloadCheckInterval(null);
      } else if (status.status === 'downloading') {
        if (status.progress > 0) {
          setIsDownloading(true);
          setDownloadProgress(status.progress);
        } else {
          setIsDownloading(false);
        }
      }
    }, 1000);

    setDownloadCheckInterval(interval);

    return () => {
      clearInterval(interval);
    };
  }, [videoId, t]);

  // Get the current video URL to use
  const getCurrentVideoUrl = useCallback(() => {
    return useOptimizedPreview && optimizedVideoUrl ? optimizedVideoUrl : videoUrl;
  }, [useOptimizedPreview, optimizedVideoUrl, videoUrl]);

  return {
    // State
    videoUrl,
    optimizedVideoUrl,
    optimizedVideoInfo,
    isLoaded,
    error,
    isDownloading,
    downloadProgress,
    useOptimizedPreview,
    
    // Actions
    setIsLoaded,
    setError,
    setUseOptimizedPreview,
    getCurrentVideoUrl,
    
    // Computed
    hasOptimizedVersion: !!optimizedVideoUrl,
    effectiveVideoUrl: getCurrentVideoUrl()
  };
};
