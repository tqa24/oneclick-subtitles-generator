import React, { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const VideoPreview = ({ currentTime, setCurrentTime, subtitle, setDuration }) => {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState('');
  
  // Load the video when available
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    
    // Event handlers
    const handleMetadataLoaded = () => {
      setIsLoaded(true);
      setDuration(videoElement.duration);
    };
    
    const handleError = () => {
      setError(t('preview.videoError', 'Error loading video.'));
      setIsLoaded(false);
    };
    
    const handleTimeUpdate = () => {
      setCurrentTime(videoElement.currentTime);
    };
    
    // Add event listeners
    videoElement.addEventListener('loadedmetadata', handleMetadataLoaded);
    videoElement.addEventListener('error', handleError);
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    
    // Clean up
    return () => {
      videoElement.removeEventListener('loadedmetadata', handleMetadataLoaded);
      videoElement.removeEventListener('error', handleError);
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [setCurrentTime, setDuration, t]);
  
  // Load the YouTube video or file
  useEffect(() => {
    const videoUrl = localStorage.getItem('current_video_url');
    if (videoUrl) {
      setVideoUrl(videoUrl);
    }
  }, []);
  
  // Seek to time when currentTime changes externally
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !isLoaded) return;
    
    // Only seek if the difference is significant to avoid loops
    if (Math.abs(videoElement.currentTime - currentTime) > 0.1) {
      videoElement.currentTime = currentTime;
    }
  }, [currentTime, isLoaded]);
  
  return (
    <div className="video-preview">
      <div className="video-container">
        {error && <div className="error">{error}</div>}
        
        <video 
          ref={videoRef}
          controls
          className="video-player"
          src={videoUrl}
        >
          {t('preview.videoNotSupported', 'Your browser does not support the video tag.')}
        </video>
        
        <div className="video-subtitle">
          {subtitle}
        </div>
      </div>
    </div>
  );
};

export default VideoPreview;