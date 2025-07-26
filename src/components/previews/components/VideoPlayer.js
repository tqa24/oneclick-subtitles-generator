import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Core video player component that handles the video element and basic playback
 * @param {object} props - Component props
 * @returns {JSX.Element} Video player component
 */
const VideoPlayer = ({
  videoRef,
  videoUrl,
  optimizedVideoUrl,
  useOptimizedPreview,
  isPlaying,
  onLoadedMetadata,
  onError,
  onTimeUpdate,
  onPlay,
  onPause,
  onSeeking,
  onSeeked,
  onWaiting,
  onCanPlay,
  onLoadStart,
  onCanPlayThrough,
  onSeek,
  setDuration,
  setError
}) => {
  const { t } = useTranslation();

  // Get the effective video URL
  const effectiveVideoUrl = useOptimizedPreview && optimizedVideoUrl ? optimizedVideoUrl : videoUrl;

  // Handle video element events
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !effectiveVideoUrl) return;

    // Event handlers
    const handleMetadataLoaded = () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[VideoPlayer] Video metadata loaded');
      }
      setDuration(videoElement.duration);
      if (onLoadedMetadata) onLoadedMetadata();
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
      if (onError) onError(e);
    };

    const handleSeeking = () => {
      if (onSeeking) onSeeking();
    };

    const handleSeeked = () => {
      // Notify parent component about the seek operation
      if (onSeek) {
        onSeek(videoElement.currentTime);
      }
      if (onSeeked) onSeeked();
    };

    // Add event listeners
    videoElement.addEventListener('loadedmetadata', handleMetadataLoaded);
    videoElement.addEventListener('error', handleError);
    videoElement.addEventListener('timeupdate', onTimeUpdate);
    videoElement.addEventListener('play', onPlay);
    videoElement.addEventListener('pause', onPause);
    videoElement.addEventListener('seeking', handleSeeking);
    videoElement.addEventListener('seeked', handleSeeked);
    videoElement.addEventListener('waiting', onWaiting);
    videoElement.addEventListener('canplay', onCanPlay);
    videoElement.addEventListener('loadstart', onLoadStart);
    videoElement.addEventListener('canplaythrough', onCanPlayThrough);

    // Clean up
    return () => {
      videoElement.removeEventListener('loadedmetadata', handleMetadataLoaded);
      videoElement.removeEventListener('error', handleError);
      videoElement.removeEventListener('timeupdate', onTimeUpdate);
      videoElement.removeEventListener('play', onPlay);
      videoElement.removeEventListener('pause', onPause);
      videoElement.removeEventListener('seeking', handleSeeking);
      videoElement.removeEventListener('seeked', handleSeeked);
      videoElement.removeEventListener('waiting', onWaiting);
      videoElement.removeEventListener('canplay', onCanPlay);
      videoElement.removeEventListener('loadstart', onLoadStart);
      videoElement.removeEventListener('canplaythrough', onCanPlayThrough);
    };
  }, [
    videoRef,
    effectiveVideoUrl,
    onLoadedMetadata,
    onError,
    onTimeUpdate,
    onPlay,
    onPause,
    onSeeking,
    onSeeked,
    onWaiting,
    onCanPlay,
    onLoadStart,
    onCanPlayThrough,
    onSeek,
    setDuration,
    setError,
    t
  ]);

  // Handle click to play/pause
  const handleVideoClick = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(console.error);
      }
    }
  };

  // Handle touch events for mobile
  const handleTouchEnd = (e) => {
    // Prevent double-tap zoom on mobile
    e.preventDefault();
    handleVideoClick();
  };

  // Handle video source errors and fallback
  const handleSourceError = (e) => {
    console.error('Source error:', e);
    // If optimized video fails to load, fall back to original video
    if (useOptimizedPreview && optimizedVideoUrl && e.target.src === optimizedVideoUrl) {
      console.log('[VideoPlayer] Optimized video failed, falling back to original');
      e.target.src = videoUrl;
    }
  };

  const handleVideoError = (e) => {
    console.error('Video error:', e);
    // If optimized video fails to load, fall back to original video
    if (useOptimizedPreview && optimizedVideoUrl && e.target.src === optimizedVideoUrl) {
      console.log('[VideoPlayer] Optimized video failed, falling back to original');
      e.target.src = videoUrl;
      e.target.load();
    }
  };

  if (!effectiveVideoUrl) {
    return null;
  }

  return (
    <video
      ref={videoRef}
      className="video-player"
      onClick={handleVideoClick}
      onTouchEnd={handleTouchEnd}
      onError={handleVideoError}
      style={{
        cursor: 'pointer',
        touchAction: 'manipulation',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        display: 'block'
      }}
      playsInline
      controlsList="nodownload nofullscreen noremoteplayback"
      disablePictureInPicture={false}
      src={effectiveVideoUrl}
      crossOrigin="anonymous"
    >
      <source
        src={effectiveVideoUrl}
        type="video/mp4"
        onError={handleSourceError}
      />
      {t('preview.videoNotSupported', 'Your browser does not support the video tag.')}
    </video>
  );
};

export default VideoPlayer;
