import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  startYoutubeVideoDownload,
  checkDownloadStatus,
  extractYoutubeVideoId
} from '../../utils/videoDownloader';
import { renderSubtitlesToVideo, downloadVideo } from '../../utils/videoUtils';
import { subtitlesToVtt, createVttBlobUrl, revokeVttBlobUrl, convertTimeStringToSeconds } from '../../utils/vttUtils';
import SubtitleSettings from '../SubtitleSettings';
import '../../styles/VideoPreview.css';

const VideoPreview = ({ currentTime, setCurrentTime, subtitle, setDuration, videoSource, onSeek, translatedSubtitles, subtitlesArray, onVideoUrlReady }) => {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const seekLockRef = useRef(false);
  const lastTimeUpdateRef = useRef(0); // Track last time update to throttle updates
  const lastPlayStateRef = useRef(false); // Track last play state to avoid redundant updates
  const [videoUrl, setVideoUrl] = useState('');
  const [optimizedVideoUrl, setOptimizedVideoUrl] = useState('');
  const [optimizedVideoInfo, setOptimizedVideoInfo] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [videoId, setVideoId] = useState(null);
  const [downloadCheckInterval, setDownloadCheckInterval] = useState(null);
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [originalVttUrl, setOriginalVttUrl] = useState('');
  const [translatedVttUrl, setTranslatedVttUrl] = useState('');
  const [useOptimizedPreview, setUseOptimizedPreview] = useState(() => {
    return localStorage.getItem('use_optimized_preview') !== 'false';
  });

  // Use refs to track previous values to prevent unnecessary updates
  const prevSubtitlesArrayRef = useRef(null);
  const prevTranslatedSubtitlesRef = useRef(null);

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
      setOptimizedVideoUrl('');
      setError('');

      if (!videoSource) {
        setError(t('preview.noVideo', 'No video source available. Please select a video first.'));
        return;
      }

      // If it's a blob URL (from file upload), use it directly
      if (videoSource.startsWith('blob:')) {
        console.log('Loading file URL:', videoSource);
        setVideoUrl(videoSource);

        // Check if we have an optimized version in localStorage
        const splitResult = JSON.parse(localStorage.getItem('split_result') || '{}');
        if (splitResult.optimized && splitResult.optimized.video) {
          console.log('Found optimized video:', splitResult.optimized);
          setOptimizedVideoUrl(`http://localhost:3004${splitResult.optimized.video}`);

          // Store the optimization info
          setOptimizedVideoInfo({
            resolution: splitResult.optimized.resolution || '360p',
            fps: splitResult.optimized.fps || 15,
            width: splitResult.optimized.width,
            height: splitResult.optimized.height
          });
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

  // Update VTT subtitles when subtitles change - with deep comparison to prevent infinite loops
  useEffect(() => {
    // Skip if subtitlesArray is the same as before (deep comparison)
    if (
      prevSubtitlesArrayRef.current &&
      subtitlesArray &&
      prevSubtitlesArrayRef.current.length === subtitlesArray.length &&
      JSON.stringify(prevSubtitlesArrayRef.current) === JSON.stringify(subtitlesArray)
    ) {
      return;
    }

    // Clean up previous blob URLs
    if (originalVttUrl) revokeVttBlobUrl(originalVttUrl);

    // Create new VTT for original subtitles
    if (subtitlesArray && subtitlesArray.length > 0) {
      const vttContent = subtitlesToVtt(subtitlesArray);
      const blobUrl = createVttBlobUrl(vttContent);
      setOriginalVttUrl(blobUrl);
    } else {
      setOriginalVttUrl('');
    }

    // Update the ref with the current value
    prevSubtitlesArrayRef.current = subtitlesArray;

    return () => {
      if (originalVttUrl) revokeVttBlobUrl(originalVttUrl);
    };
  }, [subtitlesArray]);

  // Update VTT subtitles for translations when they change - with deep comparison
  useEffect(() => {
    // Skip if translatedSubtitles is the same as before (deep comparison)
    if (
      prevTranslatedSubtitlesRef.current &&
      translatedSubtitles &&
      prevTranslatedSubtitlesRef.current.length === translatedSubtitles.length &&
      JSON.stringify(prevTranslatedSubtitlesRef.current) === JSON.stringify(translatedSubtitles)
    ) {
      return;
    }

    // Clean up previous blob URLs
    if (translatedVttUrl) revokeVttBlobUrl(translatedVttUrl);

    // Create new VTT for translated subtitles
    if (translatedSubtitles && translatedSubtitles.length > 0 && subtitlesArray) {
      const vttContent = subtitlesToVtt(translatedSubtitles, true, subtitlesArray);
      const blobUrl = createVttBlobUrl(vttContent);
      setTranslatedVttUrl(blobUrl);
    } else {
      setTranslatedVttUrl('');
    }

    // Update the ref with the current value
    prevTranslatedSubtitlesRef.current = translatedSubtitles;

    return () => {
      if (translatedVttUrl) revokeVttBlobUrl(translatedVttUrl);
    };
  }, [translatedSubtitles, subtitlesArray]);

  // Update active track when subtitle settings change
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Wait for tracks to be loaded
    const handleTracksLoaded = () => {
      if (videoElement.textTracks.length > 0) {
        // Disable all tracks first
        for (let i = 0; i < videoElement.textTracks.length; i++) {
          videoElement.textTracks[i].mode = 'hidden';
        }

        // Enable the appropriate track
        if (subtitleSettings.showTranslatedSubtitles && translatedVttUrl) {
          // Find the translated track
          for (let i = 0; i < videoElement.textTracks.length; i++) {
            if (videoElement.textTracks[i].language === 'translated') {
              videoElement.textTracks[i].mode = 'showing';
              break;
            }
          }
        } else if (originalVttUrl) {
          // Find the original track
          for (let i = 0; i < videoElement.textTracks.length; i++) {
            if (videoElement.textTracks[i].language === 'original') {
              videoElement.textTracks[i].mode = 'showing';
              break;
            }
          }
        }
      }
    };

    // Call immediately and also set up a listener for loadedmetadata
    handleTracksLoaded();
    videoElement.addEventListener('loadedmetadata', handleTracksLoaded);

    return () => {
      videoElement.removeEventListener('loadedmetadata', handleTracksLoaded);
    };
  }, [subtitleSettings.showTranslatedSubtitles, originalVttUrl, translatedVttUrl]);

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
          start: convertTimeStringToSeconds(sub.startTime),
          end: convertTimeStringToSeconds(sub.endTime),
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
              {/* Video quality toggle if optimized version is available */}
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
                    console.log('Optimized video failed to load, falling back to original video');
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
                      console.log('Optimized video source failed to load, falling back to original video');
                      e.target.src = videoUrl;
                    }
                  }}
                />

                {/* Original subtitles track */}
                {originalVttUrl && (
                  <track
                    kind="subtitles"
                    src={originalVttUrl}
                    srcLang="original"
                    label="Original"
                    default={!subtitleSettings.showTranslatedSubtitles}
                  />
                )}

                {/* Translated subtitles track */}
                {translatedVttUrl && subtitleSettings.showTranslatedSubtitles && (
                  <track
                    kind="subtitles"
                    src={translatedVttUrl}
                    srcLang="translated"
                    label="Translated"
                    default={subtitleSettings.showTranslatedSubtitles}
                  />
                )}

                {t('preview.videoNotSupported', 'Your browser does not support the video tag.')}
              </video>

              {/* Apply subtitle styling to the video element */}
              <style>
                {`
                  ::cue {
                    background-color: rgba(${parseInt(subtitleSettings.backgroundColor.slice(1, 3), 16)}, ${parseInt(subtitleSettings.backgroundColor.slice(3, 5), 16)}, ${parseInt(subtitleSettings.backgroundColor.slice(5, 7), 16)}, ${subtitleSettings.opacity});
                    color: ${subtitleSettings.textColor};
                    font-family: ${subtitleSettings.fontFamily};
                    font-size: ${subtitleSettings.fontSize}px;
                    font-weight: ${subtitleSettings.fontWeight};
                    line-height: ${subtitleSettings.lineSpacing || '1.4'};
                    text-align: ${subtitleSettings.textAlign || 'center'};
                    text-transform: ${subtitleSettings.textTransform || 'none'};
                    letter-spacing: ${subtitleSettings.letterSpacing || '0'}px;
                    text-shadow: ${subtitleSettings.textShadow === true || subtitleSettings.textShadow === 'true' ? '1px 1px 2px rgba(0, 0, 0, 0.8)' : 'none'};
                    white-space: pre-line;
                  }
                `}
              </style>
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