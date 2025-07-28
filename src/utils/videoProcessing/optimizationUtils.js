/**
 * Utilities for video optimization
 */

import { SERVER_URL } from '../../config';

/**
 * Optimize a video file using the server API
 * @param {File} mediaFile - The media file to optimize
 * @param {string} optimizedResolution - Target resolution (e.g., '360p')
 * @param {Function} onStatusUpdate - Callback for status updates
 * @param {Function} t - Translation function
 * @returns {Promise<Object>} - Optimization result with file and metadata
 */
export const optimizeVideo = async (mediaFile, optimizedResolution, onStatusUpdate, t) => {
  if (!mediaFile) throw new Error('No media file provided');

  // Check if video analysis is enabled
  const useVideoAnalysis = localStorage.getItem('use_video_analysis') !== 'false';

  // Call the optimize-video endpoint with 1 FPS for Gemini optimization
  const response = await fetch(`${SERVER_URL}/api/optimize-video?resolution=${optimizedResolution}&fps=1&useVideoAnalysis=${useVideoAnalysis}`, {
    method: 'POST',
    body: mediaFile,
    headers: {
      'Content-Type': mediaFile.type
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to optimize video: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();


  // Store the optimization result in localStorage with timestamp for matching
  const timestamp = Date.now();
  localStorage.setItem('split_result', JSON.stringify({
    originalMedia: result.originalVideo,
    optimized: {
      video: result.optimizedVideo,
      resolution: result.resolution,
      fps: result.fps,
      width: result.width,
      height: result.height
    },
    timestamp: timestamp,
    originalFileName: mediaFile.name // Store original file name for matching
  }));

  // Also store the timestamp separately for easier access
  localStorage.setItem('last_optimization_timestamp', timestamp.toString());

  // Create a blob URL for the optimized video
  const optimizedVideoUrl = `${SERVER_URL}${result.optimizedVideo}`;

  // Check if we have an analysis video available
  const useAnalysisVideo = result.analysis && result.analysis.video;
  const videoToFetch = useAnalysisVideo ?
    `${SERVER_URL}${result.analysis.video}` :
    optimizedVideoUrl;

  // Log which video we're using for analysis
  if (useAnalysisVideo) {


  } else {

  }

  // Fetch the optimized video as a blob
  const videoResponse = await fetch(optimizedVideoUrl);
  const videoBlob = await videoResponse.blob();

  // Create a File object from the blob
  const optimizedFile = new File([videoBlob], `optimized_${mediaFile.name}`, { type: mediaFile.type });

  // Fetch the analysis video if available
  let analysisFile = optimizedFile;
  if (useAnalysisVideo) {
    const analysisResponse = await fetch(videoToFetch);
    const analysisBlob = await analysisResponse.blob();
    analysisFile = new File([analysisBlob], `analysis_${mediaFile.name}`, { type: mediaFile.type });
  }

  return {
    optimizedFile,
    analysisFile,
    result
  };
};
