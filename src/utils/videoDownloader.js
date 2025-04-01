/**
 * Utility functions for downloading and handling YouTube videos
 */

// Global download queue to track video download status
const downloadQueue = {};

// List of proxy services to try (in order)
const PROXY_SERVICES = [
  {
    name: 'Piped API',
    url: (videoId) => `https://pipedapi.kavin.rocks/streams/${videoId}`,
    process: async (data, videoId) => {
      const videoStreams = data.videoStreams || [];
      let bestUrl = null;
      
      // Find an mp4 format with resolution <= 720p
      const mp4Formats = videoStreams.filter(f => 
        f.format === 'MPEG-4' || 
        f.mimeType?.includes('mp4') ||
        f.container === 'mp4'
      );
      
      if (mp4Formats.length > 0) {
        // Try to get a reasonable quality version
        const mediumQuality = mp4Formats.find(f => 
          f.quality && parseInt(f.quality) <= 720
        );
        
        bestUrl = mediumQuality ? mediumQuality.url : mp4Formats[0].url;
      } else if (videoStreams.length > 0) {
        // Fallback to any available format
        bestUrl = videoStreams[0].url;
      }
      
      return bestUrl;
    }
  },
  {
    name: 'Piped API (Alternative Instance)',
    url: (videoId) => `https://piped-api.lunar.icu/streams/${videoId}`,
    process: async (data, videoId) => {
      const videoStreams = data.videoStreams || [];
      let bestUrl = null;
      
      // Find an mp4 format with resolution <= 720p
      const mp4Formats = videoStreams.filter(f => 
        f.format === 'MPEG-4' || 
        f.mimeType?.includes('mp4') ||
        f.container === 'mp4'
      );
      
      if (mp4Formats.length > 0) {
        const mediumQuality = mp4Formats.find(f => 
          f.quality && parseInt(f.quality) <= 720
        );
        
        bestUrl = mediumQuality ? mediumQuality.url : mp4Formats[0].url;
      } else if (videoStreams.length > 0) {
        bestUrl = videoStreams[0].url;
      }
      
      return bestUrl;
    }
  },
  {
    name: 'Invidious API',
    url: (videoId) => `https://invidious.snopyta.org/api/v1/videos/${videoId}`,
    process: async (data, videoId) => {
      const formatStreams = data.formatStreams || [];
      const adaptiveFormats = data.adaptiveFormats || [];
      
      // Try formatStreams first (combined audio/video)
      const formats = [...formatStreams, ...adaptiveFormats];
      
      // Find a medium quality mp4 format
      const mp4Formats = formats.filter(f => 
        f.type?.includes('video/mp4') || 
        f.container === 'mp4' || 
        f.ext === 'mp4'
      );
      
      if (mp4Formats.length > 0) {
        // Sort by quality
        mp4Formats.sort((a, b) => {
          const qualityA = a.quality || a.resolution || '0p';
          const qualityB = b.quality || b.resolution || '0p';
          
          const heightA = parseInt(qualityA.replace('p', ''));
          const heightB = parseInt(qualityB.replace('p', ''));
          
          // Prefer qualities below 720p but get the highest of those
          if (heightA <= 720 && heightB <= 720) {
            return heightB - heightA;
          }
          
          // If one is above 720p and one is below, prefer the one below
          if (heightA <= 720) return -1;
          if (heightB <= 720) return 1;
          
          // If both are above 720p, get the lower one
          return heightA - heightB;
        });
        
        return mp4Formats[0].url;
      } else if (formats.length > 0) {
        return formats[0].url;
      }
      
      return null;
    }
  },
  {
    name: 'Y2Mate API',
    url: (videoId) => `https://yt5s.io/api/ajaxSearch?q=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D${videoId}`,
    process: async (data, videoId) => {
      if (data && data.links && data.links.mp4) {
        // Get all MP4 formats
        const formats = Object.values(data.links.mp4);
        
        // Find a suitable quality (360p or 480p is good for previews)
        const medium = formats.find(f => f.q === '480p' || f.q === '360p');
        
        if (medium) {
          return medium.url || medium.k;
        } else if (formats.length > 0) {
          return formats[0].url || formats[0].k;
        }
      }
      return null;
    }
  }
];

/**
 * Starts downloading a YouTube video but doesn't wait for it to complete
 * This allows starting the download process in parallel with other operations
 * @param {string} youtubeUrl - The YouTube video URL
 * @returns {string} - The video ID that can be used to check download status
 */
export const startYoutubeVideoDownload = (youtubeUrl) => {
  const videoId = extractYoutubeVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  // Check if already in the queue
  if (downloadQueue[videoId]) {
    return videoId;
  }

  // Check if we have cached this video ID
  const cachedVideoKey = `yt-video-${videoId}`;
  const cachedVideoUrl = localStorage.getItem(cachedVideoKey);
  
  if (cachedVideoUrl) {
    console.log('Found cached video URL for:', videoId);
    // Mark as completed in queue
    downloadQueue[videoId] = {
      status: 'completed',
      progress: 100,
      url: cachedVideoUrl,
      error: null
    };
    return videoId;
  }

  // Initialize download queue entry
  downloadQueue[videoId] = {
    status: 'downloading',
    progress: 0,
    url: null,
    error: null
  };

  // Start the download process asynchronously
  (async () => {
    try {
      console.log('Starting background download for YouTube video:', videoId);
      downloadQueue[videoId].progress = 5;
      
      // Try each proxy service in sequence until one works
      for (let i = 0; i < PROXY_SERVICES.length; i++) {
        const service = PROXY_SERVICES[i];
        const progressStart = 5 + (i * 20); // Distribute progress across services
        const progressEnd = progressStart + 15;
        
        try {
          console.log(`Trying ${service.name} service for ${videoId}...`);
          downloadQueue[videoId].progress = progressStart;
          
          // Make the request to the proxy service
          const response = await fetch(service.url(videoId), {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            },
            // Set longer timeout for slow proxy services
            signal: AbortSignal.timeout(10000)
          });
          
          if (!response.ok) {
            throw new Error(`${service.name} returned status: ${response.status}`);
          }
          
          downloadQueue[videoId].progress = progressEnd - 5;
          const data = await response.json();
          downloadQueue[videoId].progress = progressEnd;
          
          // Process the data to extract the video URL
          const videoUrl = await service.process(data, videoId);
          
          if (videoUrl) {
            // Verify the URL is accessible by making a HEAD request
            try {
              const urlCheck = await fetch(videoUrl, { 
                method: 'HEAD',
                signal: AbortSignal.timeout(5000)
              });
              
              if (!urlCheck.ok) {
                throw new Error(`URL validation failed: ${urlCheck.status}`);
              }
              
              // Cache the URL for future use
              localStorage.setItem(cachedVideoKey, videoUrl);
              
              // Update queue entry
              downloadQueue[videoId].status = 'completed';
              downloadQueue[videoId].progress = 100;
              downloadQueue[videoId].url = videoUrl;
              console.log(`Successfully downloaded video URL using ${service.name} for:`, videoId);
              return;
            } catch (urlCheckError) {
              console.warn(`URL validation failed for ${service.name}:`, urlCheckError);
              // Continue to next service
            }
          }
        } catch (serviceError) {
          console.warn(`${service.name} failed:`, serviceError);
          // Continue to next service
        }
      }
      
      // All proxy services failed, attempt to use YouTube player API as last resort
      console.log('All proxy services failed, using YouTube player as fallback');
      downloadQueue[videoId].progress = 90;
      
      // Create a YouTube embed URL that we'll use in an iframe
      const embedUrl = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=0&controls=1`;
      localStorage.setItem(cachedVideoKey, embedUrl);
      
      downloadQueue[videoId].status = 'completed';
      downloadQueue[videoId].progress = 100;
      downloadQueue[videoId].url = embedUrl;
      downloadQueue[videoId].isEmbed = true; // Flag that this is an embed URL
      
      console.log('Using YouTube embed as fallback');
      
    } catch (error) {
      console.error('Error in background download process:', error);
      downloadQueue[videoId].status = 'error';
      downloadQueue[videoId].error = error.message;
    }
  })();
  
  return videoId;
};

/**
 * Checks the status of a YouTube video download
 * @param {string} videoId - The YouTube video ID
 * @returns {Object} - Status object with properties: status, progress, url, error
 */
export const checkDownloadStatus = (videoId) => {
  if (!downloadQueue[videoId]) {
    // Not in queue, check if it might be in localStorage
    const cachedVideoKey = `yt-video-${videoId}`;
    const cachedVideoUrl = localStorage.getItem(cachedVideoKey);
    
    if (cachedVideoUrl) {
      return {
        status: 'completed',
        progress: 100,
        url: cachedVideoUrl,
        error: null,
        isEmbed: cachedVideoUrl.includes('youtube.com/embed/')
      };
    }
    
    return {
      status: 'not_found',
      progress: 0,
      url: null,
      error: 'Video download not started'
    };
  }
  
  return downloadQueue[videoId];
};

/**
 * Downloads a YouTube video and waits for completion
 * @param {string} youtubeUrl - The YouTube video URL
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<string>} - A promise that resolves to a video URL
 */
export const downloadYoutubeVideo = async (youtubeUrl, onProgress = () => {}) => {
  const videoId = startYoutubeVideoDownload(youtubeUrl);
  
  // Poll for completion with timeout
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 60; // 30 seconds max wait time
    
    const checkInterval = setInterval(() => {
      const status = checkDownloadStatus(videoId);
      onProgress(status.progress);
      
      if (status.status === 'completed') {
        clearInterval(checkInterval);
        resolve(status.url);
      } else if (status.status === 'error') {
        clearInterval(checkInterval);
        reject(new Error(status.error || 'Unknown download error'));
      } else if (++attempts >= maxAttempts) {
        clearInterval(checkInterval);
        // If timeout, but we had started downloading, return whatever URL we have as fallback
        if (status.url) {
          resolve(status.url);
        } else {
          // Create a YouTube embed URL as absolute last resort
          const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=0&controls=1`;
          resolve(embedUrl);
        }
      }
    }, 500);
  });
};

/**
 * Extract YouTube video ID from various YouTube URL formats
 * @param {string} url - The YouTube URL
 * @returns {string|null} - The video ID or null if invalid
 */
export const extractYoutubeVideoId = (url) => {
  if (!url) return null;
  
  // Handle both youtube.com and youtu.be formats
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7] && match[7].length === 11) ? match[7] : null;
};