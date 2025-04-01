import React, { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const VideoPreview = ({ currentTime, setCurrentTime, subtitle, setDuration, videoSource }) => {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const youtubePlayerRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState('');
  const [isYouTube, setIsYouTube] = useState(false);
  const [youtubePlayer, setYoutubePlayer] = useState(null);
  
  // Helper function to extract YouTube video ID
  const extractYouTubeVideoId = (url) => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  };
  
  // Initialize video source
  useEffect(() => {
    if (videoSource) {
      // Check if it's a YouTube URL
      const youtubeId = extractYouTubeVideoId(videoSource);
      if (youtubeId) {
        setIsYouTube(true);
        setVideoUrl(`https://www.youtube.com/embed/${youtubeId}?enablejsapi=1`);
        
        // Load YouTube API if needed
        if (!window.YT) {
          const tag = document.createElement('script');
          tag.src = 'https://www.youtube.com/iframe_api';
          const firstScriptTag = document.getElementsByTagName('script')[0];
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        }
      } else {
        setIsYouTube(false);
        setVideoUrl(videoSource);
      }
    } else {
      // Try to load from localStorage as fallback
      const savedVideoUrl = localStorage.getItem('current_video_url');
      if (savedVideoUrl) {
        const youtubeId = extractYouTubeVideoId(savedVideoUrl);
        if (youtubeId) {
          setIsYouTube(true);
          setVideoUrl(`https://www.youtube.com/embed/${youtubeId}?enablejsapi=1`);
        } else {
          setIsYouTube(false);
          setVideoUrl(savedVideoUrl);
        }
      }
    }
  }, [videoSource]);
  
  // Set up YouTube player when iframe is loaded
  useEffect(() => {
    if (!isYouTube || !videoUrl || !window.YT || !window.YT.Player) return;
    
    const setupYouTubePlayer = () => {
      // Store the player in the state to use it later
      setYoutubePlayer(
        new window.YT.Player(youtubePlayerRef.current, {
          videoId: extractYouTubeVideoId(videoUrl),
          events: {
            onReady: (event) => {
              setYoutubePlayer(event.target);
              setIsLoaded(true);
              setDuration(event.target.getDuration());
            },
            onStateChange: (event) => {
              // Update current time when playing
              if (event.data === window.YT.PlayerState.PLAYING) {
                const timeUpdateInterval = setInterval(() => {
                  if (event.target.getPlayerState() !== window.YT.PlayerState.PLAYING) {
                    clearInterval(timeUpdateInterval);
                    return;
                  }
                  setCurrentTime(event.target.getCurrentTime());
                }, 100);
                
                // Clear interval when component unmounts or video stops
                return () => clearInterval(timeUpdateInterval);
              }
            },
            onError: () => {
              setError(t('preview.videoError', 'Error loading YouTube video.'));
              setIsLoaded(false);
            }
          }
        })
      );
    };
    
    // Initialize YouTube player when API is ready
    if (window.YT && window.YT.Player) {
      setupYouTubePlayer();
    } else {
      window.onYouTubeIframeAPIReady = setupYouTubePlayer;
    }
    
    return () => {
      if (youtubePlayer) {
        youtubePlayer.destroy();
      }
    };
  }, [isYouTube, videoUrl, setCurrentTime, setDuration, t]);
  
  // Handle native video element
  useEffect(() => {
    if (isYouTube) return;
    
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
  }, [isYouTube, setCurrentTime, setDuration, t]);
  
  // Seek to time when currentTime changes externally
  useEffect(() => {
    if (!isLoaded) return;
    
    if (isYouTube && youtubePlayer) {
      // Only seek if the difference is significant to avoid loops
      const ytCurrentTime = youtubePlayer.getCurrentTime();
      if (Math.abs(ytCurrentTime - currentTime) > 0.5) {
        youtubePlayer.seekTo(currentTime, true);
      }
    } else {
      const videoElement = videoRef.current;
      if (!videoElement) return;
      
      // Only seek if the difference is significant to avoid loops
      if (Math.abs(videoElement.currentTime - currentTime) > 0.1) {
        videoElement.currentTime = currentTime;
      }
    }
  }, [currentTime, isLoaded, isYouTube, youtubePlayer]);
  
  return (
    <div className="video-preview">
      <div className="video-container">
        {error && <div className="error">{error}</div>}
        
        {isYouTube ? (
          <div className="youtube-container">
            <div ref={youtubePlayerRef} id="youtube-player"></div>
          </div>
        ) : (
          <video 
            ref={videoRef}
            controls
            className="video-player"
            src={videoUrl}
          >
            {t('preview.videoNotSupported', 'Your browser does not support the video tag.')}
          </video>
        )}
        
        <div className="video-subtitle">
          {subtitle}
        </div>
      </div>
    </div>
  );
};

export default VideoPreview;