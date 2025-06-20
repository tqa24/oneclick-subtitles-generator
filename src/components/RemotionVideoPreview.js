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
  const [videoDimensions, setVideoDimensions] = useState(null);
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

            // Get actual video dimensions for proper aspect ratio
            // Check if this is a video file by examining the file type or video properties
            const isActualVideo = (videoFile instanceof File && videoFile.type.startsWith('video/')) ||
                                 (typeof videoFile === 'string' && videoFile.includes('.mp4')) ||
                                 (videoFile && videoFile.isActualVideo) ||
                                 (tempVideo.videoWidth && tempVideo.videoHeight);

            if (isActualVideo) {
              // Wait a bit for video metadata to fully load
              setTimeout(() => {
                if (tempVideo.videoWidth && tempVideo.videoHeight) {
                  const videoWidth = tempVideo.videoWidth;
                  const videoHeight = tempVideo.videoHeight;
                  console.log(`[RemotionVideoPreview] Detected video dimensions: ${videoWidth}x${videoHeight}`);
                  setVideoDimensions({
                    width: videoWidth,
                    height: videoHeight,
                    aspectRatio: videoWidth / videoHeight
                  });
                } else {
                  console.warn('[RemotionVideoPreview] Could not detect video dimensions, using fallback');
                }
              }, 100);
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
      setVideoDimensions(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoFile]);

  // Debug effect to track videoDimensions changes
  useEffect(() => {
    console.log('[RemotionVideoPreview] videoDimensions changed:', videoDimensions);
  }, [videoDimensions]);

  // Calculate composition dimensions based on actual video dimensions or resolution fallback
  const getCompositionDimensions = () => {
    // If we have actual video dimensions, use them with the target resolution height
    if (videoDimensions && isVideoFile) {
      const resolution = subtitleCustomization?.resolution || '1080p';
      let targetHeight;

      switch (resolution) {
        case '360p':
          targetHeight = 360;
          break;
        case '480p':
          targetHeight = 480;
          break;
        case '720p':
          targetHeight = 720;
          break;
        case '1440p':
          targetHeight = 1440;
          break;
        case '2K':
          targetHeight = 1080;
          break;
        case '4K':
          targetHeight = 2160;
          break;
        case '8K':
          targetHeight = 4320;
          break;
        case '1080p':
        default:
          targetHeight = 1080;
          break;
      }

      // Calculate width based on actual aspect ratio
      const targetWidth = Math.round(targetHeight * videoDimensions.aspectRatio);

      // Ensure dimensions are even numbers (required for video encoding)
      const width = targetWidth % 2 === 0 ? targetWidth : targetWidth + 1;
      const height = targetHeight % 2 === 0 ? targetHeight : targetHeight + 1;

      console.log(`[RemotionVideoPreview] Using actual video dimensions: ${width}x${height} (aspect ratio: ${videoDimensions.aspectRatio.toFixed(2)})`);
      return { width, height };
    }

    // Fallback to default 16:9 dimensions for audio files or when video dimensions aren't available yet
    const resolution = subtitleCustomization?.resolution || '1080p';
    switch (resolution) {
      case '360p':
        return { width: 640, height: 360 };
      case '480p':
        return { width: 854, height: 480 };
      case '720p':
        return { width: 1280, height: 720 };
      case '1440p':
        return { width: 2560, height: 1440 };
      case '2K':
        return { width: 2048, height: 1080 };
      case '4K':
        return { width: 3840, height: 2160 };
      case '8K':
        return { width: 7680, height: 4320 };
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
      <>
        <div className="placeholder-content">
          <div className="placeholder-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
          </div>
          <p>No video selected</p>
          <small>Select a video file to see preview</small>
          <div className="powered-by-remotion">
            <span>powered by Remotion</span>
          </div>
        </div>
      </>
    );
  }

  const { width, height } = getCompositionDimensions();
  const durationInFrames = getDurationInFrames();
  const frameRate = subtitleCustomization?.frameRate || 30;

  // Debug logging
  console.log('[RemotionVideoPreview] Composition dimensions:', { width, height, videoDimensions, isVideoFile });

  // Ensure we have valid dimensions
  const safeWidth = width > 0 ? width : 1920;
  const safeHeight = height > 0 ? height : 1080;

  return (
    <>
      <Player
        key={`${safeWidth}x${safeHeight}`} // Force re-render when dimensions change
        ref={playerRef}
        component={SubtitledVideoComposition}
        durationInFrames={durationInFrames}
        compositionWidth={safeWidth}
        compositionHeight={safeHeight}
        fps={frameRate}
        controls
        style={{
          width: '100%',
          height: '100%',
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


    </>
  );
};

export default RemotionVideoPreview;
