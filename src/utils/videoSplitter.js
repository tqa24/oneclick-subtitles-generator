/**
 * Utility for splitting media (videos and audio) into segments using the server
 */

// Server URL for the local server
const SERVER_URL = 'http://localhost:3004';

/**
 * Upload a media file (video or audio) to the server and split it into segments
 * @param {File} mediaFile - The media file (video or audio) to split
 * @param {number} segmentDuration - Duration of each segment in seconds (default: 600 seconds = 10 minutes)
 * @param {Function} onProgress - Progress callback function
 * @param {boolean} fastSplit - Whether to use fast splitting mode (uses stream copy instead of re-encoding)
 * @param {Object} options - Additional options
 * @param {boolean} options.optimizeVideos - Whether to optimize videos before splitting
 * @param {string} options.optimizedResolution - Resolution to use for optimized videos ('360p' or '240p')
 * @returns {Promise<Object>} - Object containing segment URLs and metadata
 */
export const splitVideoOnServer = async (mediaFile, segmentDuration = 600, onProgress = () => {}, fastSplit = false, options = {}) => {
  try {
    // Determine if this is a video or audio file based on MIME type
    const isAudio = mediaFile.type.startsWith('audio/');
    const mediaType = isAudio ? 'audio' : 'video';

    onProgress(10, `Uploading ${mediaType} to server...`);

    // Generate a unique ID for this media file
    const mediaId = `${mediaType}_${Date.now()}_${mediaFile.name.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Get video optimization settings from options
    // IMPORTANT: Set optimizeVideos to false by default since we're already optimizing in the optimize-video endpoint
    const optimizeVideos = options.optimizeVideos !== undefined ? options.optimizeVideos : false; // Default to false to avoid duplication
    const optimizedResolution = options.optimizedResolution || '360p'; // Default to 360p

    // Create URL with query parameters
    // IMPORTANT: Convert boolean to string 'false' explicitly to ensure server parses it correctly
    const optimizeVideosStr = optimizeVideos ? 'true' : 'false';
    const url = `${SERVER_URL}/api/split-video?mediaId=${mediaId}&segmentDuration=${segmentDuration}&fastSplit=${fastSplit}&mediaType=${mediaType}&optimizeVideos=${optimizeVideosStr}&optimizedResolution=${optimizedResolution}`;

    console.log(`Calling split-video endpoint with optimizeVideos=${optimizeVideosStr} (should be 'false' to avoid duplication)`);
    console.log(`File being sent: ${mediaFile.name}, size: ${mediaFile.size} bytes, type: ${mediaFile.type}`);

    // Upload the media file
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': mediaFile.type,
      },
      body: mediaFile, // Send the raw file
    });

    if (!response.ok) {
      console.error('Upload failed with status:', response.status);
      let errorMessage = `Failed to split ${mediaType} (Status: ${response.status})`;

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

    onProgress(80, `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} split into segments, processing...`);

    const data = await response.json();
    console.log(`${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} split into segments:`, data);

    onProgress(100, `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} segments ready`);

    // Log the actual segment durations for debugging
    if (data.segments && data.segments.length > 0) {
      console.log('Segment details:');
      let totalActualDuration = 0;
      let totalTheoreticalDuration = 0;

      data.segments.forEach((segment, index) => {
        // Calculate and log the difference between actual and theoretical values
        const actualStartTime = segment.startTime;
        const theoreticalStartTime = segment.theoreticalStartTime;
        const startTimeDiff = actualStartTime - theoreticalStartTime;

        const actualDuration = segment.duration;
        const theoreticalDuration = segment.theoreticalDuration;
        const durationDiff = actualDuration - theoreticalDuration;

        totalActualDuration += actualDuration;
        totalTheoreticalDuration += theoreticalDuration;

        console.log(`Segment ${index}:\n` +
          `  Actual:      startTime=${actualStartTime.toFixed(2)}s, duration=${actualDuration.toFixed(2)}s, endTime=${(actualStartTime + actualDuration).toFixed(2)}s\n` +
          `  Theoretical: startTime=${theoreticalStartTime.toFixed(2)}s, duration=${theoreticalDuration.toFixed(2)}s, endTime=${(theoreticalStartTime + theoreticalDuration).toFixed(2)}s\n` +
          `  Difference:  startTime=${startTimeDiff.toFixed(2)}s, duration=${durationDiff.toFixed(2)}s`);
      });

      console.log(`Total ${mediaType} duration:\n` +
        `  Actual: ${totalActualDuration.toFixed(2)}s\n` +
        `  Theoretical: ${totalTheoreticalDuration.toFixed(2)}s\n` +
        `  Difference: ${(totalActualDuration - totalTheoreticalDuration).toFixed(2)}s`);
    }

    return {
      success: true,
      originalMedia: data.originalMedia || data.originalVideo, // Support both new and old response formats
      mediaId: data.mediaId || data.videoId, // Support both new and old response formats
      segments: data.segments,
      message: data.message,
      mediaType: mediaType,
      optimized: data.optimized || null // Include optimized video information if available
    };
  } catch (error) {
    console.error(`Error splitting ${mediaFile.type.startsWith('audio/') ? 'audio' : 'video'}:`, error);
    throw error;
  }
};

/**
 * Fetch a media segment from the server
 * @param {string} segmentUrl - URL of the segment
 * @param {number} segmentIndex - Index of the segment (optional)
 * @param {string} mediaType - Type of media ('video' or 'audio')
 * @returns {Promise<File>} - File object representing the segment
 */
export const fetchSegment = async (segmentUrl, segmentIndex, mediaType = 'video') => {
  try {
    const response = await fetch(segmentUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch segment: ${response.statusText}`);
    }

    const blob = await response.blob();
    const filename = segmentUrl.split('/').pop();

    // Extract segment index from filename if not provided
    let index = segmentIndex;
    if (index === undefined) {
      // Try to extract index from filename (assuming format with _000, _001, etc.)
      const match = filename.match(/_([0-9]{3})\.[^.]+$/);
      if (match) {
        index = parseInt(match[1]);
      }
    }

    // Create file with segment metadata
    const mimeType = mediaType === 'audio' ? 'audio/mpeg' : 'video/mp4';
    const file = new File([blob], filename, { type: mimeType });

    // Add segment metadata if we have an index
    if (index !== undefined) {
      console.log(`Adding metadata for segment ${index}`);
      // Add segment index as a property
      file.segmentIndex = index;

      // Try to get segment metadata from the URL
      try {
        // Extract segment info from the URL query parameters if available
        const urlObj = new URL(segmentUrl, window.location.origin);
        const startTime = urlObj.searchParams.get('startTime');
        const duration = urlObj.searchParams.get('duration');

        if (startTime) {
          file.startTime = parseFloat(startTime);
          console.log(`Segment ${index} startTime from URL: ${file.startTime.toFixed(2)}s`);
        }

        if (duration) {
          file.duration = parseFloat(duration);
          console.log(`Segment ${index} duration from URL: ${file.duration.toFixed(2)}s`);
          console.log(`Segment ${index} calculated end time: ${(file.startTime + file.duration).toFixed(2)}s`);
        }

        // Log the theoretical values for comparison
        // Use a default segment duration of 3 minutes (180 seconds) for theoretical calculation
        const defaultSegmentDuration = 180;
        const theoreticalStartTime = index * defaultSegmentDuration;
        console.log(`Segment ${index} theoretical startTime: ${theoreticalStartTime.toFixed(2)}s (assuming ${defaultSegmentDuration}s segments)`);
        if (startTime) {
          const diff = file.startTime - theoreticalStartTime;
          console.log(`Segment ${index} startTime difference: ${diff.toFixed(2)}s (${diff > 0 ? 'later' : 'earlier'} than theoretical)`);
        }
      } catch (error) {
        console.warn('Could not parse segment URL for metadata:', error);
      }
    }

    return file;
  } catch (error) {
    console.error('Error fetching segment:', error);
    throw error;
  }
};
