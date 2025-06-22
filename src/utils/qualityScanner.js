/**
 * Client-side utility for scanning video qualities
 */

const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:3007';

/**
 * Scan available video qualities for a given URL
 * @param {string} videoUrl - The video URL to scan
 * @returns {Promise<Array>} - Array of available quality options
 */
export const scanVideoQualities = async (videoUrl) => {
  try {
    console.log('[qualityScanner] Scanning qualities for:', videoUrl);
    
    const response = await fetch(`${SERVER_URL}/api/scan-video-qualities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: videoUrl
      }),
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('[qualityScanner] Found qualities:', data.qualities);
      return data.qualities;
    } else {
      throw new Error(data.error || 'Failed to scan video qualities');
    }
  } catch (error) {
    console.error('[qualityScanner] Error scanning qualities:', error);
    throw error;
  }
};

/**
 * Get video information including title and duration
 * @param {string} videoUrl - The video URL to get info for
 * @returns {Promise<Object>} - Video information
 */
export const getVideoInfo = async (videoUrl) => {
  try {
    console.log('[qualityScanner] Getting video info for:', videoUrl);
    
    const response = await fetch(`${SERVER_URL}/api/get-video-info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: videoUrl
      }),
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('[qualityScanner] Got video info:', data.info);
      return data.info;
    } else {
      throw new Error(data.error || 'Failed to get video info');
    }
  } catch (error) {
    console.error('[qualityScanner] Error getting video info:', error);
    throw error;
  }
};

/**
 * Download video with specific quality
 * @param {string} videoUrl - The video URL
 * @param {string} quality - The quality to download (e.g., '720p', '1080p')
 * @param {string} videoId - Video ID for progress tracking
 * @returns {Promise<Object>} - Download result
 */
export const downloadVideoWithQuality = async (videoUrl, quality, videoId) => {
  try {
    console.log('[qualityScanner] Downloading video:', { videoUrl, quality, videoId });
    
    const response = await fetch(`${SERVER_URL}/api/download-video-quality`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: videoUrl,
        quality: quality,
        videoId: videoId
      }),
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('[qualityScanner] Download started:', data);
      return data;
    } else {
      throw new Error(data.error || 'Failed to start video download');
    }
  } catch (error) {
    console.error('[qualityScanner] Error downloading video:', error);
    throw error;
  }
};

/**
 * Get download progress for a video
 * @param {string} videoId - Video ID to check progress for
 * @returns {Promise<Object>} - Progress information
 */
export const getDownloadProgress = async (videoId) => {
  try {
    const response = await fetch(`${SERVER_URL}/api/quality-download-progress/${videoId}`);
    const data = await response.json();
    
    if (data.success) {
      return {
        progress: data.progress || 0,
        status: data.status || 'unknown'
      };
    } else {
      throw new Error(data.error || 'Failed to get download progress');
    }
  } catch (error) {
    console.error('[qualityScanner] Error getting download progress:', error);
    throw error;
  }
};
