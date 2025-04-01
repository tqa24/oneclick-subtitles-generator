import React, { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  downloadYoutubeVideo, 
  startYoutubeVideoDownload, 
  checkDownloadStatus,
  extractYoutubeVideoId 
} from '../../utils/videoDownloader';
import '../../styles/VideoPreview.css';

const VideoPreview = ({ currentTime, setCurrentTime, subtitle, setDuration, videoSource }) => {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [videoId, setVideoId] = useState(null);
  const [downloadCheckInterval, setDownloadCheckInterval] = useState(null);
  // Don't use embed player by default to avoid navigation issues with LyricsDisplay
  const [useCustomControls, setUseCustomControls] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const timeUpdateIntervalRef = useRef(null);
  const [videoDuration, setVideoDuration] = useState(300); // Default 5 minutes

  // Initialize video source
  useEffect(() => {
    const loadVideo = async () => {
      if (!videoSource) {
        // Try to load from localStorage as fallback
        const savedVideoUrl = localStorage.getItem('current_video_url');
        if (savedVideoUrl) {
          await processVideoUrl(savedVideoUrl);
        } else {
          setError(t('preview.noVideo', 'No video source available. Please select a video first.'));
        }
        return;
      }
      
      await processVideoUrl(videoSource);
    };
    
    loadVideo();
  }, [videoSource, t]);
  
  // Check download status at interval if we have a videoId
  useEffect(() => {
    if (!videoId) return;
    
    // Clear any existing interval
    if (downloadCheckInterval) {
      clearInterval(downloadCheckInterval);
    }
    
    // Set up a new interval to check download status
    const interval = setInterval(() => {
      const status = checkDownloadStatus(videoId);
      setDownloadProgress(status.progress);
      
      if (status.status === 'completed') {
        if (status.isEmbed) {
          // Instead of using embed player, use our custom controls
          setUseCustomControls(true);
          // Create a direct link that can be used for preview 
          // (not for playback, just for preview imagery)
          const previewUrl = `https://img.youtube.com/vi/${videoId}/0.jpg`;
          setVideoUrl(previewUrl);
        } else {
          setVideoUrl(status.url);
        }
        setIsDownloading(false);
        clearInterval(interval);
      } else if (status.status === 'error') {
        setError(t('preview.videoError', `Error loading video: ${status.error}`));
        setIsDownloading(false);
        clearInterval(interval);
      }
    }, 1000);
    
    setDownloadCheckInterval(interval);
    
    // Clean up on unmount
    return () => clearInterval(interval);
  }, [videoId, t]);
  
  // Process the video URL (download if it's YouTube)
  const processVideoUrl = async (url) => {
    console.log('Processing video URL:', url);
    
    // Reset states
    setError('');
    setIsLoaded(false);
    setUseCustomControls(false);
    
    // Check if it's a YouTube URL
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      try {
        setIsDownloading(true);
        setDownloadProgress(0);
        
        // Store the URL for future use
        localStorage.setItem('current_video_url', url); // Store the original YouTube URL
        
        // Extract and store videoId for our custom controls if needed
        const extractedVideoId = extractYoutubeVideoId(url);
        
        // Start the download process but don't wait for it to complete
        const id = startYoutubeVideoDownload(url);
        setVideoId(id);
        
        // Check initial status - it might already be complete if cached
        const initialStatus = checkDownloadStatus(id);
        if (initialStatus.status === 'completed') {
          if (initialStatus.isEmbed) {
            // Use custom controls instead of embed
            setUseCustomControls(true);
            // Create a direct link that can be used for preview 
            // (not for playback, just for preview imagery)
            const previewUrl = `https://img.youtube.com/vi/${extractedVideoId}/0.jpg`;
            setVideoUrl(previewUrl);
            // Set a default duration if not available
            setDuration(300); // 5 minutes as fallback
          } else {
            setVideoUrl(initialStatus.url);
          }
          setIsDownloading(false);
        }
      } catch (err) {
        console.error('Error starting YouTube video download:', err);
        setError(t('preview.videoError', `Error loading video: ${err.message}`));
        setIsDownloading(false);
      }
    } else {
      // Not a YouTube URL, use directly
      setVideoUrl(url);
    }
  };
  
  // Clean up interval on component unmount
  useEffect(() => {
    return () => {
      if (downloadCheckInterval) {
        clearInterval(downloadCheckInterval);
      }
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    };
  }, [downloadCheckInterval]);
  
  // Handle play/pause actions for custom controls
  const handlePlayPause = () => {
    if (useCustomControls) {
      setIsPlaying(!isPlaying);
      
      if (!isPlaying) {
        // Start advancing time automatically
        if (timeUpdateIntervalRef.current) {
          clearInterval(timeUpdateIntervalRef.current);
        }
        
        const startTime = currentTime;
        const startTimestamp = Date.now();
        
        timeUpdateIntervalRef.current = setInterval(() => {
          const elapsed = (Date.now() - startTimestamp) / 1000;
          const newTime = startTime + elapsed;
          
          if (newTime < videoDuration) {
            setCurrentTime(newTime);
          } else {
            // Reached the end
            setIsPlaying(false);
            clearInterval(timeUpdateIntervalRef.current);
            timeUpdateIntervalRef.current = null;
          }
        }, 100);
      } else {
        // Stop advancing time
        if (timeUpdateIntervalRef.current) {
          clearInterval(timeUpdateIntervalRef.current);
          timeUpdateIntervalRef.current = null;
        }
      }
    } else {
      // Use native video player controls
      const videoElement = videoRef.current;
      if (!videoElement) return;
      
      if (videoElement.paused) {
        videoElement.play()
          .then(() => setIsPlaying(true))
          .catch(error => {
            console.error('Error playing video:', error);
            setError(t('preview.videoError', `Error playing video: ${error.message}`));
          });
      } else {
        videoElement.pause();
        setIsPlaying(false);
      }
    }
  };
  
  // Handle native video element
  useEffect(() => {
    if (useCustomControls) return; // Skip for custom controls mode
    
    const videoElement = videoRef.current;
    if (!videoElement) return;
    
    // Validate the video URL
    if (!videoUrl) {
      console.error('Empty video URL provided');
      setError(t('preview.videoError', 'No video URL provided.'));
      return;
    }
    
    console.log('Setting up video element with URL:', videoUrl);
    
    // Event handlers
    const handleMetadataLoaded = () => {
      console.log('Video metadata loaded successfully for:', videoUrl);
      setIsLoaded(true);
      setDuration(videoElement.duration);
      setError(''); // Clear any previous errors
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
      
      // If there's a CORS error, try to provide a more helpful message
      if (errorDetails.includes('MIME type') || 
          errorDetails.includes('network error') ||
          (videoUrl && (videoUrl.includes('pipedapi') || videoUrl.includes('invidious') || videoUrl.includes('youtube')))) {
        errorDetails = 'The video could not be loaded due to browser restrictions. Using simplified player...';
        
        // Clear the problematic URL from cache and switch to custom controls
        if (videoSource && (videoSource.includes('youtube.com') || videoSource.includes('youtu.be'))) {
          const id = extractYoutubeVideoId(videoSource);
          if (id) {
            localStorage.removeItem(`yt-video-${id}`);
            console.log('Cleared cached URL for problematic video:', id);
            
            // Use custom controls instead of embed player
            setUseCustomControls(true);
            // Create a direct link to the YouTube thumbnail for preview
            const previewUrl = `https://img.youtube.com/vi/${id}/0.jpg`;
            setVideoUrl(previewUrl);
            // Set a default duration if not available
            setDuration(300); // 5 minutes as fallback
          }
        }
      } else {
        setError(t('preview.videoError', `Error loading video: ${errorDetails}`));
        setIsLoaded(false);
      }
    };
    
    const handleTimeUpdate = () => {
      setCurrentTime(videoElement.currentTime);
      setIsPlaying(!videoElement.paused);
    };
    
    const handlePlayPauseEvent = () => {
      setIsPlaying(!videoElement.paused);
    };
    
    // Add event listeners
    videoElement.addEventListener('loadedmetadata', handleMetadataLoaded);
    videoElement.addEventListener('error', handleError);
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('play', handlePlayPauseEvent);
    videoElement.addEventListener('pause', handlePlayPauseEvent);
    
    // Clean up
    return () => {
      videoElement.removeEventListener('loadedmetadata', handleMetadataLoaded);
      videoElement.removeEventListener('error', handleError);
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('play', handlePlayPauseEvent);
      videoElement.removeEventListener('pause', handlePlayPauseEvent);
    };
  }, [videoUrl, setCurrentTime, setDuration, t, useCustomControls, videoSource]);
  
  // Seek to time when currentTime changes externally (from LyricsDisplay)
  useEffect(() => {
    if (!isLoaded) return;
    
    if (useCustomControls) {
      // For custom controls, we just update the time display
      // No need to seek since we're controlling time manually
      if (timeUpdateIntervalRef.current) {
        // We're playing, so we want to continue from the new position
        clearInterval(timeUpdateIntervalRef.current);
        
        if (isPlaying) {
          const startTime = currentTime;
          const startTimestamp = Date.now();
          
          timeUpdateIntervalRef.current = setInterval(() => {
            const elapsed = (Date.now() - startTimestamp) / 1000;
            const newTime = startTime + elapsed;
            
            if (newTime < videoDuration) {
              setCurrentTime(newTime);
            } else {
              // Reached the end
              setIsPlaying(false);
              clearInterval(timeUpdateIntervalRef.current);
              timeUpdateIntervalRef.current = null;
            }
          }, 100);
        }
      }
    } else {
      const videoElement = videoRef.current;
      if (!videoElement) return;
      
      // Only seek if the difference is significant to avoid loops
      if (Math.abs(videoElement.currentTime - currentTime) > 0.1) {
        videoElement.currentTime = currentTime;
      }
    }
  }, [currentTime, isLoaded, useCustomControls, isPlaying, videoDuration]);
  
  // Format time in MM:SS format
  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="video-preview">
      <div className="video-container">
        {error && <div className="error">{error}</div>}
        
        {isDownloading ? (
          <div className="video-downloading">
            <div className="download-progress">
              <div className="progress-bar" style={{ width: `${downloadProgress}%` }}></div>
            </div>
            <div className="download-text">
              {t('preview.downloading', 'Preparing video...')} ({downloadProgress}%)
            </div>
          </div>
        ) : (
          videoUrl ? (
            useCustomControls ? (
              // Custom Video Player (YouTube alternative)
              <div className="custom-video-container">
                <div className="custom-video-preview" 
                     style={{backgroundImage: `url(${videoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center'}}
                >
                  {/* Play/Pause Button Overlay */}
                  <div className="custom-controls">
                    <button className="play-pause-button" onClick={handlePlayPause}>
                      {isPlaying ? '⏸️' : '▶️'}
                    </button>
                    <div className="time-display">
                      <span>{formatTime(currentTime)} / {formatTime(videoDuration)}</span>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="custom-progress-bar">
                    <div className="progress-track">
                      <div 
                        className="progress-fill" 
                        style={{width: `${(currentTime / videoDuration) * 100}%`}}
                      ></div>
                    </div>
                  </div>
                </div>
                <div className="video-subtitle">
                  {subtitle}
                </div>
                <div className="player-notice">
                  <p>Using simplified player mode for better compatibility with lyric navigation.</p>
                </div>
              </div>
            ) : (
              // Native Video Player
              <div className="native-video-container">
                <video 
                  ref={videoRef}
                  controls
                  crossOrigin="anonymous"
                  className="video-player"
                  playsInline
                  src={videoUrl}
                >
                  <source src={videoUrl} type="video/mp4" />
                  <source src={videoUrl} type="video/webm" />
                  <source src={videoUrl} type="video/ogg" />
                  {t('preview.videoNotSupported', 'Your browser does not support the video tag.')}
                </video>
                
                <div className="video-subtitle">
                  {subtitle}
                </div>
              </div>
            )
          ) : (
            <div className="no-video-message">
              {t('preview.noVideo', 'No video source available. Please select a video first.')}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default VideoPreview;