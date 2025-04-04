/**
 * Utility for splitting videos into segments using the server
 */

// Server URL for the local server
const SERVER_URL = 'http://localhost:3004';

/**
 * Upload a video to the server and split it into segments
 * @param {File} videoFile - The video file to split
 * @param {number} segmentDuration - Duration of each segment in seconds (default: 600 seconds = 10 minutes)
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<Object>} - Object containing segment URLs and metadata
 */
export const splitVideoOnServer = async (videoFile, segmentDuration = 600, onProgress = () => {}) => {
  try {
    onProgress(10, 'Uploading video to server...');
    
    // Generate a unique ID for this video
    const videoId = `video_${Date.now()}_${videoFile.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    // Create URL with query parameters
    const url = `${SERVER_URL}/api/split-video?videoId=${videoId}&segmentDuration=${segmentDuration}`;
    
    // Upload the video file
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': videoFile.type,
      },
      body: videoFile, // Send the raw file
    });
    
    if (!response.ok) {
      console.error('Upload failed with status:', response.status);
      let errorMessage = `Failed to split video (Status: ${response.status})`;
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        console.error('Error parsing error response:', e);
        // Try to get the text response instead
        try {
          const textResponse = await response.text();
          console.error('Error response text:', textResponse);
          errorMessage += ` - Server response: ${textResponse.substring(0, 100)}...`;
        } catch (textError) {
          console.error('Error getting response text:', textError);
        }
      }
      
      throw new Error(errorMessage);
    }
    
    onProgress(80, 'Video split into segments, processing...');
    
    const data = await response.json();
    console.log('Video split into segments:', data);
    
    onProgress(100, 'Video segments ready');
    
    return {
      success: true,
      originalVideo: data.originalVideo,
      videoId: data.videoId,
      segments: data.segments,
      message: data.message
    };
  } catch (error) {
    console.error('Error splitting video:', error);
    throw error;
  }
};

/**
 * Fetch a video segment from the server
 * @param {string} segmentUrl - URL of the segment
 * @returns {Promise<File>} - File object representing the segment
 */
export const fetchSegment = async (segmentUrl) => {
  try {
    const response = await fetch(segmentUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch segment: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    const filename = segmentUrl.split('/').pop();
    
    return new File([blob], filename, { type: 'video/mp4' });
  } catch (error) {
    console.error('Error fetching segment:', error);
    throw error;
  }
};
