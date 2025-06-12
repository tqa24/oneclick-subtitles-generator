import React, { useState, useEffect, useRef } from 'react';
import { Player } from '@remotion/player';
import { SubtitledVideoComposition } from './SubtitledVideoComposition';
import '../styles/VideoPreviewPanel.css';

const RemotionVideoPreview = ({
  videoFile,
  subtitles,
  narrationAudioUrl,
  subtitleCustomization,
  originalAudioVolume = 100,
  narrationVolume = 100,
  onTimeUpdate,
  onDurationChange,
  onPlay,
  onPause,
  onSeek
}) => {
  const [videoUrl, setVideoUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isVideoFile, setIsVideoFile] = useState(false);
  const playerRef = useRef(null);

  // Create video URL from file
  useEffect(() => {
    if (videoFile) {

      // Clean up previous URL
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }

      let url = null;

      try {
        // Check if videoFile is a proper File/Blob object
        if (videoFile instanceof File || videoFile instanceof Blob) {
          // Create new URL from File/Blob
          url = URL.createObjectURL(videoFile);
          setVideoUrl(url);

          // Check if it's a video file
          const videoTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/mkv', 'video/webm', 'video/m4v', 'video/quicktime'];
          setIsVideoFile(videoTypes.includes(videoFile.type));
        } else if (typeof videoFile === 'string') {
          // If it's already a URL string, use it directly
          setVideoUrl(videoFile);
          // Assume it's a video if it has video file extensions
          const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
          setIsVideoFile(videoExtensions.some(ext => videoFile.toLowerCase().includes(ext)));
        } else if (videoFile && typeof videoFile === 'object' && videoFile.url) {
          // If it's an object with a url property
          setVideoUrl(videoFile.url);
          setIsVideoFile(videoFile.isActualVideo || false);
        } else {
          console.warn('Invalid videoFile type:', typeof videoFile, videoFile);
          setVideoUrl(null);
          setIsVideoFile(false);
          return;
        }

        // Get duration for File/Blob objects or URL strings
        const urlToUse = url || (typeof videoFile === 'string' ? videoFile : videoFile.url);
        if (urlToUse) {
          const tempVideo = document.createElement('video');
          tempVideo.src = urlToUse;
          tempVideo.addEventListener('loadedmetadata', () => {
            const videoDuration = tempVideo.duration;
            setDuration(videoDuration);
            if (onDurationChange) {
              onDurationChange(videoDuration);
            }
          });
          tempVideo.addEventListener('error', (e) => {
            console.warn('Error loading video for duration:', e);
          });
        }
      } catch (error) {
        console.error('Error processing videoFile:', error);
        setVideoUrl(null);
        setIsVideoFile(false);
      }

      // Cleanup function
      return () => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      };
    } else {
      // Reset state when no video file
      setVideoUrl(null);
      setIsVideoFile(false);
      setDuration(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoFile]);

  // Calculate composition dimensions based on resolution
  const getCompositionDimensions = () => {
    const resolution = subtitleCustomization?.resolution || '1080p';
    switch (resolution) {
      case '480p':
        return { width: 854, height: 480 };
      case '720p':
        return { width: 1280, height: 720 };
      case '2K':
        return { width: 2560, height: 1440 };
      case '1080p':
      default:
        return { width: 1920, height: 1080 };
    }
  };

  // Calculate duration in frames
  const getDurationInFrames = () => {
    const frameRate = subtitleCustomization?.frameRate || 30;
    if (duration > 0) {
      return Math.ceil(duration * frameRate);
    }
    // Fallback: calculate from subtitles
    if (subtitles && subtitles.length > 0) {
      const lastSubtitle = subtitles[subtitles.length - 1];
      return Math.ceil((lastSubtitle.end + 2) * frameRate); // Add 2 second buffer
    }
    return 30 * frameRate; // Default 30 seconds
  };

  // Handle player events
  const handlePlayerTimeUpdate = (frame) => {
    const frameRate = subtitleCustomization?.frameRate || 30;
    const timeInSeconds = frame / frameRate;
    setCurrentTime(timeInSeconds);
    if (onTimeUpdate) {
      onTimeUpdate(timeInSeconds);
    }
  };

  const handlePlay = () => {
    setIsPlaying(true);
    if (onPlay) {
      onPlay();
    }
  };

  const handlePause = () => {
    setIsPlaying(false);
    if (onPause) {
      onPause();
    }
  };

  const handleSeek = (frame) => {
    const frameRate = subtitleCustomization?.frameRate || 30;
    const timeInSeconds = frame / frameRate;
    setCurrentTime(timeInSeconds);
    if (onSeek) {
      onSeek(timeInSeconds);
    }
  };

  // Spacebar handler for play/pause
  useEffect(() => {
    const handleSpacebar = (event) => {
      // Only handle spacebar if the preview panel is focused
      if (event.code === 'Space' && event.target.closest('.video-preview-panel')) {
        event.preventDefault();
        event.stopPropagation();
        
        if (playerRef.current) {
          if (isPlaying) {
            playerRef.current.pause();
          } else {
            playerRef.current.play();
          }
        }
      }
    };

    document.addEventListener('keydown', handleSpacebar);
    return () => {
      document.removeEventListener('keydown', handleSpacebar);
    };
  }, [isPlaying]);

  if (!videoFile || !videoUrl) {
    return (
      <div className="video-preview-panel">
        <div className="video-preview-placeholder">
          <div className="placeholder-content">
            <div className="placeholder-icon">🎥</div>
            <p>No video selected</p>
            <small>Select a video file to see preview</small>
          </div>
        </div>
      </div>
    );
  }

  const { width, height } = getCompositionDimensions();
  const durationInFrames = getDurationInFrames();
  const frameRate = subtitleCustomization?.frameRate || 30;

  return (
    <div 
      className="video-preview-panel"
      tabIndex={0}
      style={{
        outline: 'none',
        border: '2px solid transparent',
        borderRadius: '8px',
        transition: 'border-color 0.2s ease',
      }}
      onFocus={(e) => {
        e.target.style.borderColor = '#007bff';
        e.target.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.25)';
      }}
      onBlur={(e) => {
        e.target.style.borderColor = 'transparent';
        e.target.style.boxShadow = 'none';
      }}
    >
      <div className="video-preview-container">
        <Player
          ref={playerRef}
          component={SubtitledVideoComposition}
          durationInFrames={durationInFrames}
          compositionWidth={width}
          compositionHeight={height}
          fps={frameRate}
          controls
          style={{
            width: '100%',
            aspectRatio: '16/9',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
          inputProps={{
            videoUrl: videoUrl,
            narrationUrl: narrationAudioUrl,
            subtitles: subtitles || [],
            metadata: {
              subtitleCustomization: subtitleCustomization,
              resolution: subtitleCustomization?.resolution || '1080p',
              frameRate: frameRate,
            },
            isVideoFile: isVideoFile,
            originalAudioVolume: originalAudioVolume,
            narrationVolume: narrationVolume,
          }}
          onFrame={handlePlayerTimeUpdate}
          onPlay={handlePlay}
          onPause={handlePause}
          onSeek={handleSeek}
        />
      </div>
      
      <div className="video-preview-info">
        <div className="video-info-row">
          <span className="video-info-label">Duration:</span>
          <span className="video-info-value">
            {duration > 0 ? `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}` : '--:--'}
          </span>
        </div>
        <div className="video-info-row">
          <span className="video-info-label">Current Time:</span>
          <span className="video-info-value">
            {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
          </span>
        </div>
        <div className="video-info-row">
          <span className="video-info-label">Resolution:</span>
          <span className="video-info-value">{subtitleCustomization?.resolution || '1080p'}</span>
        </div>
        <div className="video-info-row">
          <span className="video-info-label">Frame Rate:</span>
          <span className="video-info-value">{frameRate} FPS</span>
        </div>
      </div>

      <div className="video-preview-hint">
        <small>💡 Click on this panel and press spacebar to play/pause</small>
      </div>
    </div>
  );
};

export default RemotionVideoPreview;
