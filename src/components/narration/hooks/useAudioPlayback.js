import { useEffect, useRef } from 'react';

/**
 * Custom hook for audio playback
 * @param {Object} params - Parameters
 * @param {boolean} params.isPlaying - Whether audio is playing
 * @param {Object} params.currentAudio - Current audio being played
 * @param {Function} params.setIsPlaying - Function to set playing state
 * @returns {Object} - Audio playback handlers and refs
 */
const useAudioPlayback = ({
  isPlaying,
  currentAudio,
  setIsPlaying
}) => {
  // Create audio ref
  const audioRef = useRef(null);

  // Handle audio playback
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentAudio]);

  // Handle audio ended event
  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  return {
    audioRef,
    handleAudioEnded
  };
};

export default useAudioPlayback;
