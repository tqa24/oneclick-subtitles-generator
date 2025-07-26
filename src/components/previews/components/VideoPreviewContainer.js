import React, { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Import custom hooks
import { useVideoState } from '../hooks/useVideoState';
import { useVideoControls } from '../hooks/useVideoControls';
import { useFullscreenManager } from '../hooks/useFullscreenManager';
import { useSubtitleDisplay } from '../hooks/useSubtitleDisplay';
import { useVideoDownloader } from '../hooks/useVideoDownloader';

// Import components
import VideoPlayer from './VideoPlayer';
import VideoControls from './VideoControls';
import SubtitleOverlay from './SubtitleOverlay';
import VideoLoadingStates from './VideoLoadingStates';
import VideoActionButtons from './VideoActionButtons';

/**
 * Container component that orchestrates all video preview functionality
 * Maintains the same external API as the original VideoPreview component
 */
const VideoPreviewContainer = ({
  currentTime,
  setCurrentTime,
  setDuration,
  videoSource,
  onSeek,
  translatedSubtitles,
  subtitlesArray,
  onVideoUrlReady,
  onReferenceAudioChange,
  onRenderVideo
}) => {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  
  // Additional state for narration refresh
  const [isRefreshingNarration, setIsRefreshingNarration] = useState(false);

  // Initialize custom hooks
  const videoState = useVideoState(videoSource, onVideoUrlReady);
  
  const videoControls = useVideoControls(videoRef, currentTime, setCurrentTime);
  
  const subtitleDisplay = useSubtitleDisplay(
    currentTime,
    subtitlesArray,
    translatedSubtitles,
    videoControls.isFullscreen || false
  );
  
  const fullscreenManager = useFullscreenManager(
    videoRef,
    subtitleDisplay.subtitleSettings,
    videoControls.setControlsVisible,
    videoControls.setIsVideoHovered
  );
  
  const videoDownloader = useVideoDownloader(
    videoState.effectiveVideoUrl,
    videoSource,
    subtitlesArray,
    translatedSubtitles,
    subtitleDisplay.subtitleSettings
  );

  // Handle mouse movement for fullscreen controls auto-hide
  useEffect(() => {
    if (!fullscreenManager.isFullscreen) return;

    const handleMouseMove = () => {
      // Only set controlsVisible in fullscreen mode
      if (fullscreenManager.isFullscreen) {
        videoControls.setControlsVisible(true);

        // Always restore cursor when showing controls
        const videoContainer = document.querySelector('.native-video-container');
        if (videoContainer) {
          videoContainer.style.cursor = 'default';
        }

        // Clear existing timer
        if (videoControls.hideControlsTimeoutRef.current) {
          clearTimeout(videoControls.hideControlsTimeoutRef.current);
        }

        // Set new timer to hide controls after 1 second
        videoControls.hideControlsTimeoutRef.current = setTimeout(() => {
          videoControls.setControlsVisible(false);
          // Hide cursor too
          const videoContainer = document.querySelector('.native-video-container');
          if (videoContainer) {
            videoContainer.style.cursor = 'none';
          }
        }, 1000);
      }
    };

    const videoContainer = document.querySelector('.native-video-container');
    if (videoContainer) {
      videoContainer.addEventListener('mousemove', handleMouseMove);
      return () => {
        videoContainer.removeEventListener('mousemove', handleMouseMove);
        if (videoControls.hideControlsTimeoutRef.current) {
          clearTimeout(videoControls.hideControlsTimeoutRef.current);
        }
      };
    }
  }, [fullscreenManager.isFullscreen, videoControls]);

  // Seek to time when currentTime changes externally (from LyricsDisplay)
  useEffect(() => {
    if (!videoState.isLoaded) return;

    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Only seek if the difference is significant to avoid loops
    if (Math.abs(videoElement.currentTime - currentTime) > 0.2) {
      // Set the seek lock to prevent timeupdate from overriding our seek
      videoControls.seekLockRef.current = true;

      // Store the playing state
      const wasPlaying = !videoElement.paused;
      videoControls.lastPlayStateRef.current = wasPlaying;

      // Set the new time
      videoElement.currentTime = currentTime;

      // Update the last time update reference
      videoControls.lastTimeUpdateRef.current = performance.now();

      // Release the seek lock after a short delay
      setTimeout(() => {
        videoControls.seekLockRef.current = false;
      }, 50);
    }
  }, [currentTime, videoState.isLoaded, videoControls]);

  // Listen for aligned narration generation events
  useEffect(() => {
    const handleAlignedNarrationStatus = (event) => {
      if (event.detail) {
        const { status, message, isStillGenerating } = event.detail;

        if (status === 'complete' && !isStillGenerating) {
          setIsRefreshingNarration(false);
        }

        if (status === 'error' && !isStillGenerating) {
          console.error('Error during aligned narration regeneration:', message);
          setIsRefreshingNarration(false);
        }
      }
    };

    const handleAlignedNarrationGeneratingState = (event) => {
      if (event.detail) {
        const { isGenerating } = event.detail;

        if (!isGenerating && !isRefreshingNarration) {
          return;
        }

        if (!isGenerating) {
          setIsRefreshingNarration(false);
        }
      }
    };

    window.addEventListener('aligned-narration-status', handleAlignedNarrationStatus);
    window.addEventListener('aligned-narration-generating-state', handleAlignedNarrationGeneratingState);

    return () => {
      window.removeEventListener('aligned-narration-status', handleAlignedNarrationStatus);
      window.removeEventListener('aligned-narration-generating-state', handleAlignedNarrationGeneratingState);
    };
  }, [isRefreshingNarration]);

  // Clean up aligned narration resources when component unmounts
  useEffect(() => {
    return () => {
      if (typeof window.resetAlignedNarration === 'function') {
        console.log('Cleaning up aligned narration on component unmount');
        window.resetAlignedNarration();
      }

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

  // Set showCustomControls based on video loading state
  useEffect(() => {
    videoControls.setShowCustomControls(videoState.isLoaded);
  }, [videoState.isLoaded, videoControls]);

  if (!videoState.effectiveVideoUrl) {
    return (
      <div className="video-container">
        <VideoLoadingStates
          error={videoState.error}
          isDownloading={videoState.isDownloading}
          downloadProgress={videoState.downloadProgress}
          isVideoLoading={false}
          isBuffering={false}
          isRenderingVideo={videoDownloader.isRenderingVideo}
          renderProgress={videoDownloader.renderProgress}
          isRefreshingNarration={isRefreshingNarration}
        />
      </div>
    );
  }

  return (
    <div className="video-container">
      <div
        className="native-video-container"
        onMouseEnter={() => !fullscreenManager.isFullscreen && videoControls.setIsVideoHovered(true)}
        onMouseLeave={() => !fullscreenManager.isFullscreen && videoControls.setIsVideoHovered(false)}
      >
        {/* Action Buttons */}
        <VideoActionButtons
          isLoaded={videoState.isLoaded}
          isVideoHovered={videoControls.isVideoHovered}
          controlsVisible={videoControls.controlsVisible}
          isFullscreen={fullscreenManager.isFullscreen}
          isAudioDownloading={videoDownloader.isAudioDownloading}
          hasOptimizedVersion={videoState.hasOptimizedVersion}
          useOptimizedPreview={videoState.useOptimizedPreview}
          optimizedVideoInfo={videoState.optimizedVideoInfo}
          handleRefreshNarration={videoDownloader.handleRefreshNarration}
          handleDownloadAudio={videoDownloader.handleDownloadAudio}
          setUseOptimizedPreview={videoState.setUseOptimizedPreview}
          setIsRefreshingNarration={setIsRefreshingNarration}
          videoRef={videoRef}
        />

        <div className="video-wrapper" style={{ position: 'relative' }}>
          {/* Video Player */}
          <VideoPlayer
            videoRef={videoRef}
            videoUrl={videoState.videoUrl}
            optimizedVideoUrl={videoState.optimizedVideoUrl}
            useOptimizedPreview={videoState.useOptimizedPreview}
            isPlaying={videoControls.isPlaying}
            onLoadedMetadata={videoControls.handleLoadedMetadata}
            onError={videoControls.handleError}
            onTimeUpdate={videoControls.handleTimeUpdate}
            onPlay={videoControls.handlePlay}
            onPause={videoControls.handlePause}
            onSeeking={videoControls.handleSeeking}
            onSeeked={videoControls.handleSeeked}
            onWaiting={videoControls.handleWaiting}
            onCanPlay={videoControls.handleCanPlay}
            onLoadStart={videoControls.handleLoadStart}
            onCanPlayThrough={videoControls.handleCanPlayThrough}
            onSeek={onSeek}
            setDuration={setDuration}
            setError={videoState.setError}
          />

          {/* Loading States */}
          <VideoLoadingStates
            error={videoState.error}
            isDownloading={videoState.isDownloading}
            downloadProgress={videoState.downloadProgress}
            isVideoLoading={videoControls.isVideoLoading}
            isBuffering={videoControls.isBuffering}
            isRenderingVideo={videoDownloader.isRenderingVideo}
            renderProgress={videoDownloader.renderProgress}
            isRefreshingNarration={isRefreshingNarration}
          />

          {/* Video Controls */}
          <VideoControls
            isPlaying={videoControls.isPlaying}
            videoDuration={videoControls.videoDuration}
            currentTime={currentTime}
            volume={videoControls.volume}
            isMuted={videoControls.isMuted}
            playbackSpeed={videoControls.playbackSpeed}
            bufferedProgress={videoControls.bufferedProgress}
            showCustomControls={videoControls.showCustomControls}
            controlsVisible={videoControls.controlsVisible}
            isVideoHovered={videoControls.isVideoHovered}
            isFullscreen={fullscreenManager.isFullscreen}
            isDragging={videoControls.isDragging}
            dragTime={videoControls.dragTime}
            isVolumeSliderVisible={videoControls.isVolumeSliderVisible}
            isVolumeDragging={videoControls.isVolumeDragging}
            isSpeedMenuVisible={videoControls.isSpeedMenuVisible}
            setIsVolumeSliderVisible={videoControls.setIsVolumeSliderVisible}
            setIsSpeedMenuVisible={videoControls.setIsSpeedMenuVisible}
            togglePlayPause={videoControls.togglePlayPause}
            handleVolumeChange={videoControls.handleVolumeChange}
            toggleMute={videoControls.toggleMute}
            handleSpeedChange={videoControls.handleSpeedChange}
            handleTimelineMouseDown={videoControls.handleTimelineMouseDown}
            handleTimelineTouchStart={videoControls.handleTimelineTouchStart}
            handleVolumeMouseDown={videoControls.handleVolumeMouseDown}
            enterFullscreen={fullscreenManager.enterFullscreen}
            handleFullscreenExit={fullscreenManager.handleFullscreenExit}
          />
        </div>

        {/* Subtitle Overlay */}
        <SubtitleOverlay
          currentSubtitleText={subtitleDisplay.currentSubtitleText}
          subtitleSettings={subtitleDisplay.subtitleSettings}
          getSubtitleCSSVariables={subtitleDisplay.getSubtitleCSSVariables}
          getSubtitleStyles={subtitleDisplay.getSubtitleStyles}
        />
      </div>
    </div>
  );
};

export default VideoPreviewContainer;
