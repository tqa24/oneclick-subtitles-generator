import { google } from 'googleapis';
import { getAuthorizedClient } from './googleAuthService';

/**
 * Search YouTube videos using OAuth authentication
 * @param {string} query - Search query
 * @param {number} maxResults - Maximum number of results to return
 * @returns {Promise<Array>} Array of video results
 */
export const searchYouTubeVideos = async (query, maxResults = 5) => {
  const oauth2Client = await getAuthorizedClient();
  
  if (!oauth2Client) {
    throw new Error('Not authenticated with YouTube');
  }

  const youtube = google.youtube({
    version: 'v3',
    auth: oauth2Client
  });

  try {
    const response = await youtube.search.list({
      part: 'snippet',
      q: query,
      maxResults: maxResults,
      type: 'video'
    });

    if (response.data.items && response.data.items.length > 0) {
      return response.data.items.map(item => ({
        id: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.default.url,
        channel: item.snippet.channelTitle,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error searching YouTube:', error);
    throw error;
  }
};

/**
 * Get video details by ID using OAuth authentication
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Object>} Video details
 */
export const getVideoDetails = async (videoId) => {
  const oauth2Client = await getAuthorizedClient();
  
  if (!oauth2Client) {
    throw new Error('Not authenticated with YouTube');
  }

  const youtube = google.youtube({
    version: 'v3',
    auth: oauth2Client
  });

  try {
    const response = await youtube.videos.list({
      part: 'snippet',
      id: videoId
    });

    if (response.data.items && response.data.items.length > 0) {
      const video = response.data.items[0];
      return {
        id: video.id,
        title: video.snippet.title,
        description: video.snippet.description,
        thumbnail: video.snippet.thumbnails.high.url,
        channel: video.snippet.channelTitle,
        publishedAt: video.snippet.publishedAt
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching video details:', error);
    throw error;
  }
};
