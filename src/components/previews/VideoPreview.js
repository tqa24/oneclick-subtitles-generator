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
  const [isPlaying, setIsPlaying] = useState(false);

  // Initialize video source
  useEffect(() => {
    const loadVideo = async () => {
      // Reset video state when source changes
      setIsLoaded(false);
      setVideoUrl('');
      setError('');
      
      if (!videoSource) {
        setError(t('preview.noVideo', 'No video source available. Please select a video first.'));
        return;
      }

      // If it's a blob URL (from file upload), use it directly
      if (videoSource.startsWith('blob:')) {
        console.log('Loading file URL:', videoSource);
        setVideoUrl(videoSource);
        return;
      }
      
      // If it's a YouTube URL, handle download
      if (videoSource.includes('youtube.com') || videoSource.includes('youtu.be')) {
        await processVideoUrl(videoSource);
        return;
      }

      // For any other URL, try to use it directly
      setVideoUrl(videoSource);
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
        setVideoUrl(status.url);
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
    
    // Check if it's a YouTube URL
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      try {
        setIsDownloading(true);
        setDownloadProgress(0);
        
        // Store the URL for future use
        localStorage.setItem('current_video_url', url);
        
        // Extract video ID
        const extractedVideoId = extractYoutubeVideoId(url);
        
        // Start the download process but don't wait for it to complete
        const id = startYoutubeVideoDownload(url);
        setVideoId(id);
        
        // Check initial status - it might already be complete if cached
        const initialStatus = checkDownloadStatus(id);
        if (initialStatus.status === 'completed') {
          setVideoUrl(initialStatus.url);
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
    };
  }, [downloadCheckInterval]);
  
  // Handle native video element
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    
    // Validate the video URL
    if (!videoUrl) {
      console.log('Empty video URL provided');
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
      setError(t('preview.videoError', `Error loading video: ${errorDetails}`));
      setIsLoaded(false);
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
  }, [videoUrl, setCurrentTime, setDuration, t]);
  
  // Seek to time when currentTime changes externally (from LyricsDisplay)
  useEffect(() => {
    if (!isLoaded) return;
    
    const videoElement = videoRef.current;
    if (!videoElement) return;
    
    // Only seek if the difference is significant to avoid loops
    if (Math.abs(videoElement.currentTime - currentTime) > 0.1) {
      videoElement.currentTime = currentTime;
    }
  }, [currentTime, isLoaded]);
  
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
              {t('preview.downloading', 'Downloading video...')} ({downloadProgress}%)
            </div>
          </div>
        ) : (
          videoUrl ? (
            <div className="native-video-container">
              <video 
                ref={videoRef}
                controls
                className="video-player"
                playsInline
                src={videoUrl}
              >
                <source src={videoUrl} type="video/mp4" />
                {t('preview.videoNotSupported', 'Your browser does not support the video tag.')}
              </video>
              
              <div className="video-subtitle">
                {subtitle}
              </div>
            </div>
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