/**
 * Utility functions for downloading and handling YouTube videos
 */

// Global download queue to track video download status
const downloadQueue = {};

// Track active download intervals for cancellation
const activeDownloadIntervals = {};

// Server URL for the local YouTube download server
const SERVER_URL = 'http://localhost:3004';

/**
 * Starts downloading a YouTube video to the local videos folder
 * This allows starting the download process in parallel with other operations
 * @param {string} youtubeUrl - The YouTube video URL
 * @param {boolean} forceRefresh - Force a fresh download even if the video exists in cache
 * @returns {string} - The video ID that can be used to check download status
 */
export const startYoutubeVideoDownload = (youtubeUrl, forceRefresh = false) => {
  const videoId = extractYoutubeVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  // Check if already in the queue and not forcing refresh
  if (downloadQueue[videoId] && !forceRefresh) {
    return videoId;
  }

  // Initialize download queue entry
  downloadQueue[videoId] = {
    status: 'checking',
    progress: 0,
    url: null,
    error: null,
    forceRefresh: forceRefresh // Store the forceRefresh flag
  };

  // Start the download process asynchronously
  (async () => {
    try {
      console.log('Starting YouTube video download for:', videoId);

      // Check if the video already exists on the server (unless forceRefresh is true)
      if (!downloadQueue[videoId].forceRefresh) {
        const checkResponse = await fetch(`${SERVER_URL}/api/video-exists/${videoId}`);
        const checkData = await checkResponse.json();

        if (checkData.exists) {
          // Video already exists, no need to download
          console.log('Video already exists on server:', videoId);
          downloadQueue[videoId].status = 'completed';
          downloadQueue[videoId].progress = 100;
          downloadQueue[videoId].url = `${SERVER_URL}${checkData.url}`;
          return;
        }
      } else {
        console.log('Skipping cache check due to forceRefresh flag for video:', videoId);
      }

      // If not, start the download
      downloadQueue[videoId].status = 'downloading';
      downloadQueue[videoId].progress = 10;

      // Get the quality from the queue if available
      const quality = downloadQueue[videoId].quality || '360p';

      console.log(`[QUALITY DEBUG] Sending download request with quality: ${quality}`);

      // Request server to download the video with the specified quality
      const downloadResponse = await fetch(`${SERVER_URL}/api/download-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId,
          quality,
          forceRefresh: downloadQueue[videoId].forceRefresh // Pass the forceRefresh flag to the server
        }),
      });

      console.log(`[QUALITY DEBUG] Server response status: ${downloadResponse.status}`);

      if (!downloadResponse.ok) {
        const errorData = await downloadResponse.json();
        throw new Error(errorData.error || 'Failed to download video');
      }

      const downloadData = await downloadResponse.json();

      // Update queue entry with success
      downloadQueue[videoId].status = 'completed';
      downloadQueue[videoId].progress = 100;
      downloadQueue[videoId].url = `${SERVER_URL}${downloadData.url}`;
      console.log('Video downloaded successfully:', videoId);

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
    // Not in queue, check if it might exist on server directly
    return {
      status: 'checking',
      progress: 0,
      url: null,
      error: null
    };
  }

  return downloadQueue[videoId];
};

/**
 * Downloads a YouTube video and waits for completion
 * @param {string} youtubeUrl - The YouTube video URL
 * @param {Function} onProgress - Progress callback (0-100)
 * @param {string} quality - The desired video quality (e.g., '144p', '360p', '720p')
 * @param {boolean} forceRefresh - Force a fresh download even if the video exists in cache
 * @returns {Promise<string>} - A promise that resolves to a video URL
 */
export const downloadYoutubeVideo = async (youtubeUrl, onProgress = () => {}, quality = '360p', forceRefresh = false) => {
  // If forceRefresh is true, remove any existing download from the queue
  const videoId = extractYoutubeVideoId(youtubeUrl);

  if (forceRefresh && downloadQueue[videoId]) {
    console.log('Forcing fresh download for video:', videoId);
    delete downloadQueue[videoId];
  }

  // Start the download process
  startYoutubeVideoDownload(youtubeUrl, forceRefresh);

  // Store the original URL for potential redownload
  const originalUrl = youtubeUrl;

  // Store the quality in the download queue
  if (downloadQueue[videoId]) {
    downloadQueue[videoId].quality = quality;
  }

  console.log(`[QUALITY DEBUG] Starting download for video ${videoId} with quality: ${quality}`);

  // Poll for completion
  return new Promise((resolve, reject) => {
    let attempts = 0;
    // No maximum attempts - we'll wait indefinitely
    let simulatedProgress = 5;

    const checkInterval = setInterval(async () => {
      const status = checkDownloadStatus(videoId);

      // If status is 'downloading', simulate progress
      if (status.status === 'downloading' && status.progress < 95) {
        // Increment progress by a small amount each time
        simulatedProgress = Math.min(95, simulatedProgress + 5);
        downloadQueue[videoId].progress = simulatedProgress;
        onProgress(simulatedProgress);
      } else {
        onProgress(status.progress);
      }

      if (status.status === 'completed') {
        // Check if the video URL is valid by making a HEAD request
        try {
          const checkResponse = await fetch(status.url, { method: 'HEAD' });
          if (!checkResponse.ok) {
            // Video file doesn't exist anymore, restart the download silently
            console.log('Video file not found on server, restarting download...');
            clearInterval(checkInterval);

            // Remove the video from the download queue
            delete downloadQueue[videoId];

            // Restart the download process
            const newVideoId = startYoutubeVideoDownload(originalUrl);

            // Set up a new interval to check the download status
            const newCheckInterval = setInterval(async () => {
              const newStatus = checkDownloadStatus(newVideoId);
              onProgress(newStatus.progress);

              if (newStatus.status === 'completed') {
                clearInterval(newCheckInterval);
                resolve(newStatus.url);
              } else if (newStatus.status === 'error') {
                clearInterval(newCheckInterval);
                reject(new Error(newStatus.error || 'Unknown download error'));
              }
            }, 500);

            return;
          }
        } catch (error) {
          console.warn('Error checking video existence with HEAD request:', error);
          // Continue with the resolve anyway, the App.js error handling will catch any issues
        }

        clearInterval(checkInterval);
        resolve(status.url);
      } else if (status.status === 'error') {
        clearInterval(checkInterval);
        reject(new Error(status.error || 'Unknown download error'));
      } else if (status.status === 'checking') {
        // Check if the video exists on the server
        try {
          const checkResponse = await fetch(`${SERVER_URL}/api/video-exists/${videoId}`);
          const checkData = await checkResponse.json();

          if (checkData.exists) {
            // Video exists, update status and resolve
            downloadQueue[videoId] = {
              status: 'completed',
              progress: 100,
              url: `${SERVER_URL}${checkData.url}`,
              error: null
            };
            clearInterval(checkInterval);
            resolve(`${SERVER_URL}${checkData.url}`);
            return;
          }
        } catch (error) {
          console.warn('Error checking video existence:', error);
        }
      }

      // Increment attempts counter (for logging purposes)
      ++attempts;

      // Log every 30 seconds to show we're still waiting
      if (attempts % 60 === 0) {
        console.log(`[QUALITY DEBUG] Still waiting for download to complete. Attempts: ${attempts}`);
      }
    }, 500);
    // Store the interval for potential cancellation
    activeDownloadIntervals[videoId] = checkInterval;
  });
};

/**
 * Cancels an ongoing YouTube video download
 * @param {string} videoId - The video ID to cancel
 * @returns {boolean} - True if the download was cancelled, false if it wasn't found
 */
export const cancelYoutubeVideoDownload = (videoId) => {
  // Check if the video is in the download queue
  if (!downloadQueue[videoId]) {
    console.log('No download found for video ID:', videoId);
    return false;
  }

  // Clear any active interval for this download
  if (activeDownloadIntervals[videoId]) {
    clearInterval(activeDownloadIntervals[videoId]);
    delete activeDownloadIntervals[videoId];
  }

  // Try to cancel the download on the server
  fetch(`${SERVER_URL}/api/cancel-download/${videoId}`, { method: 'POST' })
    .then(response => response.json())
    .then(data => {
      console.log('Server response for cancel request:', data);
    })
    .catch(error => {
      console.error('Error cancelling download on server:', error);
    });

  // Update the download queue entry
  downloadQueue[videoId].status = 'cancelled';
  downloadQueue[videoId].error = 'Download cancelled by user';

  console.log('Download cancelled for video ID:', videoId);
  return true;
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