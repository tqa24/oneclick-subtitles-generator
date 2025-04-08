import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  startYoutubeVideoDownload,
  checkDownloadStatus,
  extractYoutubeVideoId
} from '../../utils/videoDownloader';
import { renderSubtitlesToVideo, downloadVideo } from '../../utils/videoUtils';
import SubtitleSettings from '../SubtitleSettings';
import '../../styles/VideoPreview.css';

const VideoPreview = ({ currentTime, setCurrentTime, subtitle, setDuration, videoSource, onSeek, translatedSubtitles, subtitlesArray }) => {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const seekLockRef = useRef(false);
  const lastTimeUpdateRef = useRef(0); // Track last time update to throttle updates
  const lastPlayStateRef = useRef(false); // Track last play state to avoid redundant updates
  const [videoUrl, setVideoUrl] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [videoId, setVideoId] = useState(null);
  const [downloadCheckInterval, setDownloadCheckInterval] = useState(null);
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
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
      textColor: '#ffffff'
    };
  });
  // We track play state in lastPlayStateRef instead of using state to avoid unnecessary re-renders

  // Process the video URL (download if it's YouTube)
  const processVideoUrl = useCallback(async (url) => {
    console.log('Processing video URL:', url);

    // Reset states
    setError('');
    setIsLoaded(false);

    // Check if it's a YouTube URL
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      try {
        setIsDownloading(true);
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
      setError('');

      if (!videoSource) {
        setError(t('preview.noVideo', 'No video source available. Please select a video first.'));
        return;
      }

      // If it's a blob URL (from file upload), use it directly
      if (videoSource.startsWith('blob:')) {
        console.log('Loading file URL:', videoSource);
        setVideoUrl(videoSource);
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
      setDownloadProgress(status.progress);

      if (status.status === 'completed') {
        setVideoUrl(status.url);
        setIsDownloading(false);
        clearInterval(interval);
      } else if (status.status === 'error') {
        setError(t('preview.videoError', `Error loading video: ${status.error}`));
        setIsDownloading(false);
        clearInterval(interval);
      }
    }, 1000);

    setDownloadCheckInterval(interval);

    // Clean up on unmount
    return () => clearInterval(interval);
  }, [videoId, t, downloadCheckInterval]);

  // processVideoUrl is now defined inside the useEffect above

  // Clean up interval on component unmount
  useEffect(() => {
    return () => {
      if (downloadCheckInterval) {
        clearInterval(downloadCheckInterval);
      }
    };
  }, [downloadCheckInterval]);

  // Handle native video element
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Validate the video URL
    if (!videoUrl) {
      console.log('Empty video URL provided');
      setError(t('preview.videoError', 'No video URL provided.'));
      return;
    }

    // Event handlers
    const handleMetadataLoaded = () => {
      console.log('Video metadata loaded successfully for:', videoUrl);
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
          setCurrentTime(videoElement.currentTime);
          lastTimeUpdateRef.current = now;
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
  }, [videoUrl, setCurrentTime, setDuration, t, onSeek]);

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
      // translatedSubtitles is already an array of subtitle objects
      const renderedVideoUrl = await renderSubtitlesToVideo(
        videoUrl,
        translatedSubtitles,
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
      <div className="video-preview-header">
        <h3>{t('output.videoPreview', 'Video Preview with Subtitles')}</h3>
        <SubtitleSettings
          settings={subtitleSettings}
          onSettingsChange={setSubtitleSettings}
          onDownloadWithSubtitles={handleDownloadWithSubtitles}
          onDownloadWithTranslatedSubtitles={handleDownloadWithTranslatedSubtitles}
          hasTranslation={translatedSubtitles && translatedSubtitles.length > 0}
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

        {isDownloading ? (
          <div className="video-downloading">
            <div className="download-progress">
              <div className="progress-bar" style={{ width: `${downloadProgress}%` }}></div>
            </div>
            <div className="download-text">
              {t('preview.downloading', 'Downloading video...')} ({downloadProgress}%)
            </div>
          </div>
        ) : (
          videoUrl ? (
            <div className="native-video-container">
              <video
                ref={videoRef}
                controls
                className="video-player"
                playsInline
                src={videoUrl}
              >
                <source src={videoUrl} type="video/mp4" />
                {t('preview.videoNotSupported', 'Your browser does not support the video tag.')}
              </video>

              <div
                className="video-subtitle"
                style={{
                  '--font-family': subtitleSettings.fontFamily,
                  '--font-size': `${subtitleSettings.fontSize}px`,
                  '--font-weight': subtitleSettings.fontWeight,
                  '--box-width': `${subtitleSettings.boxWidth}%`,
                  '--background-color': `rgba(${parseInt(subtitleSettings.backgroundColor.slice(1, 3), 16)}, ${parseInt(subtitleSettings.backgroundColor.slice(3, 5), 16)}, ${parseInt(subtitleSettings.backgroundColor.slice(5, 7), 16)}, ${subtitleSettings.opacity})`,
                  '--text-color': subtitleSettings.textColor,
                  bottom: 'auto',
                  top: `${subtitleSettings.position}%`,
                  transform: 'translateY(-100%)'
                }}
              >
                {subtitle}
              </div>
            </div>
          ) : (
            <div className="no-video-message">
              {t('preview.noVideo', 'No video source available. Please select a video first.')}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default VideoPreview;