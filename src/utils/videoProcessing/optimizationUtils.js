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

  // Check if video optimization is enabled and if this is a video file
  const optimizeVideos = localStorage.getItem('optimize_videos') === 'true';
  const isAudio = mediaFile.type.startsWith('audio/');

  // If optimization is disabled and this is a video file (not audio), return the original file
  if (!optimizeVideos && !isAudio) {
    console.log('[OPTIMIZE-VIDEO] Video optimization disabled, returning original file');
    return {
      optimizedFile: mediaFile,
      analysisFile: mediaFile
    };
  }

  // Check if video analysis is enabled
  const useVideoAnalysis = localStorage.getItem('use_video_analysis') !== 'false';

  // If the file is already on the server, use a different endpoint to avoid duplicate uploads
  if (mediaFile.isCopiedToServer && mediaFile.serverPath) {
    console.log('[OPTIMIZE-VIDEO] File already on server, using existing file for optimization');

    // Extract filename from serverPath
    const filename = mediaFile.serverPath.split('/').pop();

    // Call the optimize-existing-file endpoint instead
    const response = await fetch(`${SERVER_URL}/api/optimize-existing-file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filename: filename,
        resolution: optimizedResolution,
        fps: 1,
        useVideoAnalysis: useVideoAnalysis
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to optimize existing video: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    // Continue with the same logic as below...
    const timestamp = Date.now();
    localStorage.setItem('split_result', JSON.stringify({
      originalMedia: result.originalVideo,
      optimized: {
        video: result.optimizedVideo,
        resolution: result.resolution,
        fps: result.fps,
        width: result.width,
        height: result.height,
        wasOptimized: result.wasOptimized
      },
      analysis: result.analysis,
      timestamp: timestamp
    }));

    localStorage.setItem('last_optimization_timestamp', timestamp.toString());

    const optimizedVideoUrl = `${SERVER_URL}${result.optimizedVideo}`;
    const useAnalysisVideo = result.analysis && result.analysis.video;
    const videoToFetch = useAnalysisVideo ? `${SERVER_URL}${result.analysis.video}` : optimizedVideoUrl;

    const videoResponse = await fetch(optimizedVideoUrl);
    const videoBlob = await videoResponse.blob();
    const optimizedFile = new File([videoBlob], `optimized_${mediaFile.name}`, { type: mediaFile.type });

    // Preserve server properties
    optimizedFile.isCopiedToServer = mediaFile.isCopiedToServer;
    optimizedFile.serverPath = mediaFile.serverPath;

    let analysisFile = optimizedFile;
    if (useAnalysisVideo) {
      const analysisResponse = await fetch(videoToFetch);
      const analysisBlob = await analysisResponse.blob();
      analysisFile = new File([analysisBlob], `analysis_${mediaFile.name}`, { type: mediaFile.type });
    }

    return { optimizedFile, analysisFile };
  }

  // Call the optimize-video endpoint with 1 FPS for Gemini optimization using FormData for streaming
  const formData = new FormData();
  formData.append('file', mediaFile);

  const response = await fetch(`${SERVER_URL}/api/optimize-video?resolution=${optimizedResolution}&fps=1&useVideoAnalysis=${useVideoAnalysis}`, {
    method: 'POST',
    body: formData
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
  // If the analysis video is the same as the optimized video (≤500 frames), don't fetch it again
  const hasAnalysisVideo = result.analysis && result.analysis.video;
  const isAnalysisVideoSeparate = hasAnalysisVideo && result.analysis.video !== result.optimizedVideo;
  const useAnalysisVideo = isAnalysisVideoSeparate;
  const videoToFetch = useAnalysisVideo ?
    `${SERVER_URL}${result.analysis.video}` :
    optimizedVideoUrl;

  console.log('[OPTIMIZE-VIDEO] Analysis video info:', {
    hasAnalysisVideo,
    analysisVideoPath: result.analysis?.video,
    optimizedVideoPath: result.optimizedVideo,
    isAnalysisVideoSeparate,
    useAnalysisVideo,
    videoToFetch
  });

  // Log which video we're using for analysis
  if (useAnalysisVideo) {


  } else {

  }

  // Fetch the optimized video as a blob
  const videoResponse = await fetch(optimizedVideoUrl);
  const videoBlob = await videoResponse.blob();

  // Create a File object from the blob
  const optimizedFile = new File([videoBlob], `optimized_${mediaFile.name}`, { type: mediaFile.type });

  // Preserve server properties from the original file to prevent duplicate uploads
  if (mediaFile.isCopiedToServer && mediaFile.serverPath) {
    optimizedFile.isCopiedToServer = mediaFile.isCopiedToServer;
    optimizedFile.serverPath = mediaFile.serverPath;
    console.log('[OPTIMIZE-VIDEO] Preserved server properties:', optimizedFile.serverPath);
  }

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
