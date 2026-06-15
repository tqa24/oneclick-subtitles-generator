import { useEffect, useState, useRef, useCallback } from 'react';

/**
 * Owns timeline seek-dragging (mouse + touch), volume-slider dragging, the
 * mobile "tap outside to collapse the volume slider" behaviour, and the
 * external seek (when currentTime changes from outside, e.g. LyricsDisplay).
 *
 * Shared refs (videoRef, seekLockRef, lastPlayStateRef, lastTimeUpdateRef) stay
 * in the parent and are passed in. Drag state + the volume-slider state are
 * owned here and returned so the render + VideoBottomControls can consume them.
 *
 * Returns { isDragging, setIsDragging, dragTime, setDragTime, dragTimeRef,
 *           isVolumeSliderVisible, setIsVolumeSliderVisible,
 *           isVolumeDragging, setIsVolumeDragging,
 *           handleTimelineMouseDown, handleTimelineTouchStart }.
 */
const useVideoSeek = ({
  videoRef,
  seekLockRef,
  lastPlayStateRef,
  lastTimeUpdateRef,
  videoDuration,
  currentTime,
  isLoaded,
  setCurrentTime,
  setVolume,
  setIsMuted,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const dragTimeRef = useRef(0);
  const [isVolumeSliderVisible, setIsVolumeSliderVisible] = useState(false);
  const [isVolumeDragging, setIsVolumeDragging] = useState(false);

  const handleTimelineMouseDown = useCallback((e) => {
    if (!videoRef.current || videoDuration === 0) return;

    // Store the timeline container reference for consistent dragging
    const timelineContainer = e.currentTarget;
    const rect = timelineContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min((clickX / rect.width) * videoDuration, videoDuration));

    // Set seek lock to prevent timeupdate interference
    seekLockRef.current = true;

    // Set initial drag state
    setIsDragging(true);
    setDragTime(newTime);
    dragTimeRef.current = newTime;

    // Add global mouse event listeners
    const handleMouseMove = (e) => {
      // Use the stored timeline container reference instead of searching for it
      const rect = timelineContainer.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const newTime = Math.max(0, Math.min((clickX / rect.width) * videoDuration, videoDuration));
      setDragTime(newTime);
      dragTimeRef.current = newTime;
    };

    const handleMouseUp = () => {
      // Always apply the final time, whether moved or just clicked
      if (videoRef.current) {
        videoRef.current.currentTime = dragTimeRef.current;
        setCurrentTime(dragTimeRef.current);
      }

      // Reset drag state
      setIsDragging(false);

      // Release seek lock after a short delay to allow video to settle
      setTimeout(() => {
        seekLockRef.current = false;
      }, 100);

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [videoRef, seekLockRef, dragTimeRef, videoDuration, setCurrentTime]);

  // Touch support for timeline
  const handleTimelineTouchStart = useCallback((e) => {
    if (!videoRef.current || videoDuration === 0) return;

    e.preventDefault();
    // Store the timeline container reference for consistent dragging
    const timelineContainer = e.currentTarget;
    const rect = timelineContainer.getBoundingClientRect();
    const touch = e.touches[0];
    const touchX = touch.clientX - rect.left;
    const newTime = Math.max(0, Math.min((touchX / rect.width) * videoDuration, videoDuration));

    // Set seek lock to prevent timeupdate interference
    seekLockRef.current = true;

    // Set initial drag state
    setIsDragging(true);
    setDragTime(newTime);
    dragTimeRef.current = newTime;

    // Add global touch event listeners
    const handleTouchMove = (e) => {
      e.preventDefault();
      // Use the stored timeline container reference instead of searching for it
      if (e.touches[0]) {
        const rect = timelineContainer.getBoundingClientRect();
        const touchX = e.touches[0].clientX - rect.left;
        const newTime = Math.max(0, Math.min((touchX / rect.width) * videoDuration, videoDuration));
        setDragTime(newTime);
        dragTimeRef.current = newTime;
      }
    };

    const handleTouchEnd = () => {
      // Always apply the final time
      if (videoRef.current) {
        videoRef.current.currentTime = dragTimeRef.current;
        setCurrentTime(dragTimeRef.current);
      }

      // Reset drag state
      setIsDragging(false);

      // Release seek lock after a short delay to allow video to settle
      setTimeout(() => {
        seekLockRef.current = false;
      }, 100);

      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  }, [videoRef, seekLockRef, dragTimeRef, videoDuration, setCurrentTime]);

  // Handle volume slider dragging
  useEffect(() => {
    if (!isVolumeDragging) return;

    const volumeSlider = document.querySelector('.expanding-volume-slider');

    const updateFromClientY = (clientY) => {
      if (!volumeSlider) return;
      const rect = volumeSlider.getBoundingClientRect();
      const newVolume = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
      setVolume(newVolume);
      if (videoRef.current) {
        videoRef.current.volume = newVolume;
        videoRef.current.muted = newVolume === 0;
        setIsMuted(newVolume === 0);
      }
    };

    const handleMouseMove = (e) => {
      updateFromClientY(e.clientY);
    };

    const handleMouseUp = () => {
      setIsVolumeDragging(false);
    };

    const handleTouchMove = (e) => {
      // Prevent scrolling while dragging the volume slider
      e.preventDefault();
      const touch = e.touches && e.touches[0];
      if (touch) {
        updateFromClientY(touch.clientY);
      }
    };

    const handleTouchEnd = () => {
      setIsVolumeDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isVolumeDragging, videoRef, setVolume, setIsMuted]);

  // Mobile: keep volume slider expanded after touch until user taps outside
  useEffect(() => {
    const handleOutside = (e) => {
      if (!isVolumeSliderVisible) return;
      const wrapper = document.querySelector('.volume-pill-wrapper');
      if (wrapper && !wrapper.contains(e.target)) {
        setIsVolumeSliderVisible(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [isVolumeSliderVisible, setIsVolumeSliderVisible]);

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
  }, [currentTime, isLoaded, videoRef, seekLockRef, lastPlayStateRef, lastTimeUpdateRef]);

  return {
    isDragging,
    setIsDragging,
    dragTime,
    setDragTime,
    dragTimeRef,
    isVolumeSliderVisible,
    setIsVolumeSliderVisible,
    isVolumeDragging,
    setIsVolumeDragging,
    handleTimelineMouseDown,
    handleTimelineTouchStart,
  };
};

export default useVideoSeek;
