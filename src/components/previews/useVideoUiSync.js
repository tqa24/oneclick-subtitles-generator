import { useEffect } from 'react';

/**
 * Small UI-sync effects for the video preview:
 *   - apply external volume changes coming from the narration menu
 *     (`video-volume-change` window event) to the <video> element + state;
 *   - detect "compact mode" (video shorter than 400px) on load / resize / poll
 *     so the controls can adapt.
 *
 * videoRef + the volume/compact state stay in the parent and are passed in.
 */
const useVideoUiSync = ({
  videoRef,
  isMuted,
  setVolume,
  setIsMuted,
  setIsCompactMode,
}) => {
  // Listen for video volume changes from narration menu
  useEffect(() => {
    const handleVideoVolumeChange = (event) => {
      if (event.detail && typeof event.detail.volume === 'number') {
        const newVolume = event.detail.volume;
        setVolume(newVolume);
        if (videoRef.current) {
          videoRef.current.volume = newVolume;
          const newMuted = newVolume <= 0;
          if (isMuted !== newMuted) {
            videoRef.current.muted = newMuted;
            setIsMuted(newMuted);
          }
        }
      }
    };

    window.addEventListener('video-volume-change', handleVideoVolumeChange);

    return () => {
      window.removeEventListener('video-volume-change', handleVideoVolumeChange);
    };
  }, [isMuted, videoRef, setVolume, setIsMuted]);

  // Detect compact mode based on video height
  useEffect(() => {
    const checkCompactMode = () => {
      if (videoRef.current) {
        const height = videoRef.current.offsetHeight;
        setIsCompactMode(height < 400);
      }
    };

    // Check on video load
    const videoElement = videoRef.current;
    if (videoElement) {
      videoElement.addEventListener('loadedmetadata', checkCompactMode);
      videoElement.addEventListener('resize', checkCompactMode);
    }

    // Also check periodically in case of dynamic resizing
    const interval = setInterval(checkCompactMode, 1000);

    return () => {
      if (videoElement) {
        videoElement.removeEventListener('loadedmetadata', checkCompactMode);
        videoElement.removeEventListener('resize', checkCompactMode);
      }
      clearInterval(interval);
    };
  }, [videoRef, setIsCompactMode]);
};

export default useVideoUiSync;
