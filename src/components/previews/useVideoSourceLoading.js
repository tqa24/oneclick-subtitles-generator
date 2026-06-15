import { useEffect, useState, useCallback } from 'react';
import {
  startYoutubeVideoDownload,
  checkDownloadStatus,
  extractYoutubeVideoId
} from '../../utils/videoDownloader';
import { SERVER_URL } from '../../config';
import { dbg } from './videoPreviewDebug';

/**
 * Owns the video preview's source-loading lifecycle:
 *   - the `use_optimized_preview` setting (storage event + same-tab custom
 *     event + periodic fallback poll);
 *   - resolving the source URL for the current `videoSource` (blob upload,
 *     YouTube download, or direct URL) and any recent optimized version;
 *   - kicking off / polling the YouTube download via videoDownloader.
 *
 * The video element ref + playback state stay in the parent. This hook returns
 * the source/download state it owns plus the few setters the parent's other
 * code (native-element effect, render) still needs.
 *
 * Returns { videoUrl, optimizedVideoUrl, optimizedVideoInfo,
 *           isLoaded, setIsLoaded, error, setError, isDownloading,
 *           downloadProgress, useOptimizedPreview }.
 */
const useVideoSourceLoading = ({ videoSource, t, useCookiesForDownload }) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [optimizedVideoUrl, setOptimizedVideoUrl] = useState('');
  const [optimizedVideoInfo, setOptimizedVideoInfo] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [videoId, setVideoId] = useState(null);
  const [downloadCheckInterval, setDownloadCheckInterval] = useState(null);
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

    // Listen for immediate custom event from settings save
    const handleCustomEvent = (e) => {
      dbg('[VideoPreview] Received immediate optimized preview change:', e.detail.value);
      setUseOptimizedPreview(e.detail.value);
    };

    // Listen for storage events (changes from other tabs/windows)
    window.addEventListener('storage', handleStorageChange);

    // Listen for immediate custom event (same tab changes)
    window.addEventListener('optimizedPreviewChanged', handleCustomEvent);

    // Also check for changes periodically as fallback
    const checkInterval = setInterval(() => {
      const currentValue = localStorage.getItem('use_optimized_preview') === 'true';
      setUseOptimizedPreview(prev => {
        if (prev !== currentValue) {
          dbg('[VideoPreview] Optimized preview setting changed (periodic check):', currentValue);
          return currentValue;
        }
        return prev;
      });
    }, 500); // Check every 500ms

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('optimizedPreviewChanged', handleCustomEvent);
      clearInterval(checkInterval);
    };
  }, []);

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
        const id = startYoutubeVideoDownload(url, false, useCookiesForDownload);
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
  }, [t, setError, setIsLoaded, setIsDownloading, setDownloadProgress, setVideoId, setVideoUrl, useCookiesForDownload]);

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
  }, [videoId, t]);

  return {
    videoUrl,
    optimizedVideoUrl,
    optimizedVideoInfo,
    isLoaded,
    setIsLoaded,
    error,
    setError,
    isDownloading,
    downloadProgress,
    useOptimizedPreview,
  };
};

export default useVideoSourceLoading;
