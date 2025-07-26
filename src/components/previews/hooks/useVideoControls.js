import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing video controls state and interactions
 * @param {React.RefObject} videoRef - Reference to the video element
 * @param {number} currentTime - Current video time
 * @param {function} setCurrentTime - Function to update current time
 * @returns {object} Video controls state and handlers
 */
export const useVideoControls = (videoRef, currentTime, setCurrentTime) => {
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  // UI state
  const [showCustomControls, setShowCustomControls] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [isVideoHovered, setIsVideoHovered] = useState(false);
  
  // Timeline state
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const dragTimeRef = useRef(0);
  
  // Volume control state
  const [isVolumeSliderVisible, setIsVolumeSliderVisible] = useState(false);
  const [isVolumeDragging, setIsVolumeDragging] = useState(false);
  
  // Speed menu state
  const [isSpeedMenuVisible, setIsSpeedMenuVisible] = useState(false);
  
  // Buffer state
  const [bufferedProgress, setBufferedProgress] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  
  // Refs for tracking
  const seekLockRef = useRef(false);
  const lastTimeUpdateRef = useRef(0);
  const lastPlayStateRef = useRef(false);
  const hideControlsTimeoutRef = useRef(null);

  // Play/Pause toggle
  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(console.error);
      }
    }
  }, [videoRef, isPlaying]);

  // Volume control
  const handleVolumeChange = useCallback((newVolume) => {
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      videoRef.current.muted = newVolume === 0;
      setIsMuted(newVolume === 0);
    }
  }, [videoRef]);

  // Mute toggle
  const toggleMute = useCallback(() => {
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
  }, [videoRef, volume]);

  // Speed control
  const handleSpeedChange = useCallback((speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setIsSpeedMenuVisible(false);
  }, [videoRef]);

  // Timeline drag handlers
  const handleTimelineMouseDown = useCallback((e) => {
    if (!videoRef.current || videoDuration === 0) return;
    
    e.preventDefault();
    setIsDragging(true);
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * videoDuration;
    
    setDragTime(newTime);
    dragTimeRef.current = newTime;
    
    // Set seek lock to prevent time updates during drag
    seekLockRef.current = true;
  }, [videoRef, videoDuration]);

  const handleTimelineTouchStart = useCallback((e) => {
    if (!videoRef.current || videoDuration === 0) return;
    
    e.preventDefault();
    setIsDragging(true);
    
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const newTime = (touchX / rect.width) * videoDuration;
    
    setDragTime(newTime);
    dragTimeRef.current = newTime;
    
    seekLockRef.current = true;
  }, [videoRef, videoDuration]);

  // Global mouse/touch handlers for timeline dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      if (!videoRef.current || videoDuration === 0) return;
      
      const timelineElement = document.querySelector('.timeline-container');
      if (!timelineElement) return;
      
      const rect = timelineElement.getBoundingClientRect();
      const moveX = e.clientX - rect.left;
      const newTime = Math.max(0, Math.min(videoDuration, (moveX / rect.width) * videoDuration));
      
      setDragTime(newTime);
      dragTimeRef.current = newTime;
    };

    const handleTouchMove = (e) => {
      if (!videoRef.current || videoDuration === 0) return;
      
      const timelineElement = document.querySelector('.timeline-container');
      if (!timelineElement) return;
      
      const touch = e.touches[0];
      const rect = timelineElement.getBoundingClientRect();
      const moveX = touch.clientX - rect.left;
      const newTime = Math.max(0, Math.min(videoDuration, (moveX / rect.width) * videoDuration));
      
      setDragTime(newTime);
      dragTimeRef.current = newTime;
    };

    const handleMouseUp = () => {
      if (videoRef.current && isDragging) {
        videoRef.current.currentTime = dragTimeRef.current;
        setCurrentTime(dragTimeRef.current);
      }
      setIsDragging(false);
      seekLockRef.current = false;
    };

    const handleTouchEnd = () => {
      if (videoRef.current && isDragging) {
        videoRef.current.currentTime = dragTimeRef.current;
        setCurrentTime(dragTimeRef.current);
      }
      setIsDragging(false);
      seekLockRef.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, videoRef, videoDuration, setCurrentTime]);

  // Volume drag handlers
  const handleVolumeMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsVolumeDragging(true);
    
    const rect = e.currentTarget.getBoundingClientRect();
    const newVolume = Math.max(0, Math.min(1, (rect.bottom - e.clientY) / rect.height));
    handleVolumeChange(newVolume);
  }, [handleVolumeChange]);

  // Global volume drag handlers
  useEffect(() => {
    if (!isVolumeDragging) return;

    const handleMouseMove = (e) => {
      const volumeSlider = document.querySelector('.expanding-volume-slider');
      if (!volumeSlider) return;
      
      const rect = volumeSlider.getBoundingClientRect();
      const newVolume = Math.max(0, Math.min(1, (rect.bottom - e.clientY) / rect.height));
      handleVolumeChange(newVolume);
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
  }, [isVolumeDragging, handleVolumeChange]);

  // Update buffered progress
  const updateBufferedProgress = useCallback(() => {
    if (videoRef.current && videoDuration > 0) {
      const buffered = videoRef.current.buffered;
      if (buffered.length > 0) {
        const bufferedEnd = buffered.end(buffered.length - 1);
        const progress = (bufferedEnd / videoDuration) * 100;
        setBufferedProgress(progress);
      }
    }
  }, [videoRef, videoDuration]);

  // Video event handlers
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
      setIsVideoLoading(false);
    }
  }, [videoRef]);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    lastPlayStateRef.current = true;
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    lastPlayStateRef.current = false;
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (!seekLockRef.current && !isDragging && videoRef.current) {
      const now = performance.now();
      if (now - lastTimeUpdateRef.current > 100) {
        setCurrentTime(videoRef.current.currentTime);
        lastTimeUpdateRef.current = now;
      }
    }
    updateBufferedProgress();
  }, [videoRef, isDragging, setCurrentTime, updateBufferedProgress]);

  const handleWaiting = useCallback(() => {
    setIsBuffering(true);
  }, []);

  const handleCanPlay = useCallback(() => {
    setIsBuffering(false);
  }, []);

  const handleLoadStart = useCallback(() => {
    setIsVideoLoading(true);
  }, []);

  const handleCanPlayThrough = useCallback(() => {
    setIsVideoLoading(false);
  }, []);

  return {
    // State
    isPlaying,
    videoDuration,
    volume,
    isMuted,
    playbackSpeed,
    showCustomControls,
    controlsVisible,
    isVideoHovered,
    isDragging,
    dragTime,
    isVolumeSliderVisible,
    isVolumeDragging,
    isSpeedMenuVisible,
    bufferedProgress,
    isBuffering,
    isVideoLoading,
    
    // Setters
    setShowCustomControls,
    setControlsVisible,
    setIsVideoHovered,
    setIsVolumeSliderVisible,
    setIsSpeedMenuVisible,
    
    // Actions
    togglePlayPause,
    handleVolumeChange,
    toggleMute,
    handleSpeedChange,
    handleTimelineMouseDown,
    handleTimelineTouchStart,
    handleVolumeMouseDown,
    
    // Event handlers
    handleLoadedMetadata,
    handlePlay,
    handlePause,
    handleTimeUpdate,
    handleWaiting,
    handleCanPlay,
    handleLoadStart,
    handleCanPlayThrough,
    
    // Refs
    seekLockRef,
    lastTimeUpdateRef,
    lastPlayStateRef,
    hideControlsTimeoutRef,
    dragTimeRef
  };
};
