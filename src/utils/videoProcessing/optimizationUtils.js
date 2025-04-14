/**
 * Utilities for video optimization
 */

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

  // Call the optimize-video endpoint
  const response = await fetch(`http://localhost:3004/api/optimize-video?resolution=${optimizedResolution}&fps=15`, {
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
  console.log('Video optimization result:', result);

  // Store the optimization result in localStorage
  localStorage.setItem('split_result', JSON.stringify({
    originalMedia: result.originalVideo,
    optimized: {
      video: result.optimizedVideo,
      resolution: result.resolution,
      fps: result.fps,
      width: result.width,
      height: result.height
    }
  }));

  // Create a blob URL for the optimized video
  const optimizedVideoUrl = `http://localhost:3004${result.optimizedVideo}`;

  // Check if we have an analysis video available
  const useAnalysisVideo = result.analysis && result.analysis.video;
  const videoToFetch = useAnalysisVideo ?
    `http://localhost:3004${result.analysis.video}` :
    optimizedVideoUrl;

  // Log which video we're using for analysis
  if (useAnalysisVideo) {
    console.log(`Using analysis video with 500 frames for Gemini analysis`);
    console.log(result.analysis.message);
  } else {
    console.log('No analysis video available, using optimized video for analysis');
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
