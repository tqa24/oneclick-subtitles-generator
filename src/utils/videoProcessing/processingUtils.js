/**
 * Core processing utilities for video/audio processing
 */

import { callGeminiApi } from '../../services/geminiService';
import { splitVideoOnServer } from '../videoSplitter';
import { getVideoDuration, getMaxSegmentDurationSeconds } from '../durationUtils';
import { processSegment } from '../../services/segmentProcessingService';
import { getCacheIdForMedia } from './cacheUtils';
import { createSegmentStatusUpdater, formatTime } from './segmentUtils';
import { optimizeVideo } from './optimizationUtils';
import { analyzeVideoAndWaitForUserChoice } from './analysisUtils';
import { setCurrentCacheId as setRulesCacheId } from '../transcriptionRulesStore';
import { setCurrentCacheId as setSubtitlesCacheId } from '../userSubtitlesStore';

/**
 * Process a short video/audio file (shorter than max segment duration)
 * @param {File} mediaFile - The media file
 * @param {Function} onStatusUpdate - Callback for status updates
 * @param {Function} t - Translation function
 * @param {Object} options - Processing options
 * @returns {Promise<Array>} - Array of subtitle objects
 */
export const processShortMedia = async (mediaFile, onStatusUpdate, t, options = {}) => {
  const { userProvidedSubtitles } = options;
  const isAudio = mediaFile.type.startsWith('audio/');
  const mediaType = isAudio ? 'audio' : 'video';
  
  // Get video optimization settings from localStorage
  const optimizeVideos = localStorage.getItem('optimize_videos') !== 'false'; // Default to true
  const optimizedResolution = localStorage.getItem('optimized_resolution') || '360p'; // Default to 360p

  // For videos that don't need splitting, still optimize if enabled
  // For audio files, always convert to video first
  if (isAudio || (!isAudio && optimizeVideos)) {
    onStatusUpdate({
      message: isAudio
        ? t('output.processingAudio', 'Processing audio file...')
        : t('output.optimizingVideo', 'Optimizing video for processing...'),
      type: 'loading'
    });

    try {
      // Optimize the video
      const { optimizedFile, analysisFile } = await optimizeVideo(mediaFile, optimizedResolution, onStatusUpdate, t);

      // Check if we should skip analysis when user-provided subtitles are present
      const skipAnalysis = !!userProvidedSubtitles;

      if (skipAnalysis) {
        console.log('Skipping video analysis because user-provided subtitles are present');
        // Update status message to indicate we're using custom subtitles
        onStatusUpdate({
          message: t('output.processingWithCustomSubtitles', 'Processing video with your provided subtitles...'),
          type: 'loading'
        });
        // Skip directly to processing with user-provided subtitles
        console.log('Using user-provided subtitles for direct processing (short video)');
        return await callGeminiApi(optimizedFile, 'file-upload', { userProvidedSubtitles });
      }

      try {
        // Analyze the video and wait for user choice
        await analyzeVideoAndWaitForUserChoice(analysisFile, onStatusUpdate, t);

        // Use the optimized file for processing
        onStatusUpdate({
          message: t('output.processingOptimizedVideo', 'Processing optimized video...'),
          type: 'loading'
        });

        console.log('Using user-provided subtitles after analysis');
        return await callGeminiApi(optimizedFile, 'file-upload', { userProvidedSubtitles });
      } catch (analysisError) {
        console.error('Error analyzing video:', analysisError);
        onStatusUpdate({
          message: t('output.analysisError', 'Video analysis failed, proceeding with default settings.'),
          type: 'warning'
        });

        // Continue with processing without analysis
        console.log('Using user-provided subtitles after analysis error');
        return await callGeminiApi(optimizedFile, 'file-upload', { userProvidedSubtitles });
      }
    } catch (error) {
      console.error('Error optimizing video:', error);
      onStatusUpdate({
        message: t('output.optimizationFailed', 'Video optimization failed, using original video.'),
        type: 'warning'
      });
      // Fall back to using the original file
      console.log('Using user-provided subtitles after optimization error');
      return await callGeminiApi(mediaFile, 'file-upload', { userProvidedSubtitles });
    }
  } else {
    // For audio or when optimization is disabled, process directly
    console.log('Using user-provided subtitles for direct processing (optimization disabled)');
    return await callGeminiApi(mediaFile, 'file-upload', { userProvidedSubtitles });
  }
};

/**
 * Process a long video/audio file by splitting it into segments
 * @param {File} mediaFile - The media file
 * @param {Function} onStatusUpdate - Callback for status updates
 * @param {Function} t - Translation function
 * @param {Object} options - Processing options
 * @returns {Promise<Array>} - Array of subtitle objects
 */
export const processLongVideo = async (mediaFile, onStatusUpdate, t, options = {}) => {
  // Extract options
  const { userProvidedSubtitles } = options;

  // Set cache ID for the current video
  const cacheId = getCacheIdForMedia(mediaFile);
  if (cacheId) {
    // Set cache ID for both stores
    setRulesCacheId(cacheId);
    setSubtitlesCacheId(cacheId);
    console.log('Set cache ID for current video:', cacheId);
  }
  
  // Set processing flag to indicate we're working on a video
  localStorage.setItem('video_processing_in_progress', 'true');
  console.log('Set video_processing_in_progress flag to true');
  
  // Determine if this is a video or audio file based on MIME type
  const isAudio = mediaFile.type.startsWith('audio/');
  const mediaType = isAudio ? 'audio' : 'video';
  
  // Check if using a strong model (Gemini 2.5 Pro or Gemini 2.0 Flash Thinking)
  const currentModel = localStorage.getItem('gemini_model') || 'gemini-2.0-flash';
  const strongModels = ['gemini-2.5-pro-exp-03-25', 'gemini-2.0-flash-thinking-exp-01-21'];
  const isUsingStrongModel = strongModels.includes(currentModel);

  // Create an array to track segment status
  const segmentStatusArray = [];
  const updateSegmentStatus = createSegmentStatusUpdater(segmentStatusArray, t);

  try {
    // Get media duration
    const duration = await getVideoDuration(mediaFile);
    console.log(`${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} duration: ${duration} seconds`);

    // If media is shorter than the maximum segment duration, process it directly
    if (duration <= getMaxSegmentDurationSeconds()) {
      return await processShortMedia(mediaFile, onStatusUpdate, t, options);
    }

    // Calculate number of segments
    const numSegments = Math.ceil(duration / getMaxSegmentDurationSeconds());
    console.log(`Splitting ${mediaType} into ${numSegments} segments`);

    // Initialize segment status array with pending status
    for (let i = 0; i < numSegments; i++) {
      // Calculate theoretical time range for initial display
      const startTime = i * getMaxSegmentDurationSeconds();
      const endTime = Math.min((i + 1) * getMaxSegmentDurationSeconds(), duration);
      const timeRange = `${formatTime(startTime)} - ${formatTime(endTime)}`;

      updateSegmentStatus(i, 'pending', t('output.pendingProcessing', 'Waiting to be processed...'), timeRange);
    }

    // Notify user about long media processing
    onStatusUpdate({
      message: isAudio
        ? t('output.longAudioProcessing', 'Processing audio longer than 30 minutes. This may take a while...')
        : t('output.longVideoProcessing', 'Processing video longer than 30 minutes. This may take a while...'),
      type: 'loading'
    });

    // Use server-side splitting to physically split the media into segments
    console.log(`Using server-side ${mediaType} splitting`);
    onStatusUpdate({
      message: isAudio
        ? t('output.serverSplittingAudio', 'Uploading and splitting audio on server...')
        : t('output.serverSplitting', 'Uploading and splitting video on server...'),
      type: 'loading'
    });

    // Get video optimization settings from localStorage
    const optimizeVideos = localStorage.getItem('optimize_videos') !== 'false'; // Default to true
    const optimizedResolution = localStorage.getItem('optimized_resolution') || '360p'; // Default to 360p

    // For videos and audio files, optimize and analyze before splitting
    let analysisResult = null;
    let userChoice = null;
    let optimizedFile = mediaFile;

    // Always process audio files through the optimize-video endpoint
    // For videos, only if optimization is enabled
    if (isAudio || (!isAudio && optimizeVideos)) {
      try {
        // First optimize the video or process audio
        onStatusUpdate({
          message: isAudio
            ? t('output.processingAudio', 'Processing audio file...')
            : t('output.optimizingVideo', 'Optimizing video for processing...'),
          type: 'loading'
        });

        // Optimize the video
        const optimizationResult = await optimizeVideo(mediaFile, optimizedResolution, onStatusUpdate, t);
        optimizedFile = optimizationResult.optimizedFile;
        const analysisFile = optimizationResult.analysisFile;

        // Check if video analysis is enabled in settings
        // For audio files, we always want to analyze the converted video
        // Skip analysis if user-provided subtitles are present
        const useVideoAnalysis = !userProvidedSubtitles && (isAudio || localStorage.getItem('use_video_analysis') !== 'false'); // Default to true if not set

        if (useVideoAnalysis) {
          // Analyze the video and wait for user choice
          const analysisData = await analyzeVideoAndWaitForUserChoice(analysisFile, onStatusUpdate, t);
          analysisResult = analysisData.analysisResult;
          userChoice = analysisData.userChoice;

          // Update status message to indicate we're moving to the next step
          onStatusUpdate({
            message: t('output.preparingSplitting', 'Preparing to split video into segments...'),
            type: 'loading'
          });
        } else {
          if (userProvidedSubtitles) {
            console.log('Skipping video analysis because user-provided subtitles are present');
            // Update status message to indicate we're using custom subtitles
            onStatusUpdate({
              message: t('output.processingWithCustomSubtitles', 'Processing video with your provided subtitles...'),
              type: 'loading'
            });
          } else {
            console.log('Video analysis is disabled in settings, skipping analysis step');
          }
        }
      } catch (error) {
        console.error('Error optimizing or analyzing video:', error);
        onStatusUpdate({
          message: t('output.analysisError', 'Video analysis failed, proceeding with default settings.'),
          type: 'warning'
        });
        // Continue with the original file if optimization fails
        optimizedFile = mediaFile;
      }
    }

    // Upload the media to the server and split it into segments
    const splitResult = await splitVideoOnServer(
      optimizedFile, // Use the optimized file if available
      getMaxSegmentDurationSeconds(),
      (progress, message) => {
        onStatusUpdate({
          message: `${message} (${progress}%)`,
          type: 'loading'
        });
      },
      true, // Enable fast splitting by default
      {
        optimizeVideos: false, // IMPORTANT: We've already optimized the video in the optimize-video endpoint
        optimizedResolution
      }
    );

    // Clear the processing flag now that splitting is complete
    localStorage.removeItem('video_processing_in_progress');

    console.log(`${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} split into segments:`, splitResult);

    // Store the split result in localStorage for later use
    localStorage.setItem('split_result', JSON.stringify(splitResult));

    // Process all segments in parallel
    const segments = splitResult.segments;

    // Dispatch event with segments for potential retries later
    const segmentsEvent = new CustomEvent('videoSegmentsUpdate', {
      detail: segments
    });
    window.dispatchEvent(segmentsEvent);

    // For strong model (Gemini 2.5 Pro), show warning and don't process automatically
    if (isUsingStrongModel) {
      onStatusUpdate({
        message: t('output.strongModelWarning', 'You are choosing an easily overloaded model, please process each segment one by one'),
        type: 'warning'
      });

      // Initialize all segments as pending but don't process them
      segments.forEach((segment, i) => {
        // Calculate time range for this segment
        const startTime = segment.startTime !== undefined ? segment.startTime : i * getMaxSegmentDurationSeconds();
        const segmentDuration = segment.duration !== undefined ? segment.duration : getMaxSegmentDurationSeconds();
        const endTime = startTime + segmentDuration;
        const timeRange = `${formatTime(startTime)} - ${formatTime(endTime)}`;

        updateSegmentStatus(i, 'pending', t('output.pendingProcessing', 'Waiting to be processed...'), timeRange);
      });

      // Create an empty array for subtitles that will be filled as segments are processed
      // We return an empty array but segments will be processed one by one on demand
      // and combined in the retrySegmentProcessing function
      return [];
    }

    // For other models, process in parallel as usual
    onStatusUpdate({
      message: t('output.processingInParallel', 'Processing in parallel...'),
      type: 'loading'
    });

    // Create an array to hold the processing promises for each segment
    const segmentPromises = segments.map(async (segment, i) => {
      const segmentIndex = i;

      // ALWAYS use the actual start time from the segment if available
      // This is critical for correct subtitle stitching with stream-copy segments
      const startTime = segment.startTime !== undefined ? segment.startTime : segmentIndex * getMaxSegmentDurationSeconds();
      const segmentDuration = segment.duration !== undefined ? segment.duration : getMaxSegmentDurationSeconds();
      const endTime = startTime + segmentDuration;
      const timeRange = `${formatTime(startTime)} - ${formatTime(endTime)}`;

      // Log detailed information about this segment's timing
      console.log(`Processing segment ${segmentIndex + 1}:`);
      console.log(`  Using startTime=${startTime.toFixed(2)}s, duration=${segmentDuration.toFixed(2)}s, endTime=${endTime.toFixed(2)}s`);

      // Log if we're using user-provided subtitles
      if (userProvidedSubtitles) {
        console.log(`  Using user-provided subtitles for segment ${segmentIndex + 1} in parallel processing`);
      }

      if (segment.startTime !== undefined) {
        const theoreticalStart = segmentIndex * getMaxSegmentDurationSeconds();
        console.log(`  Actual start time differs from theoretical by ${(startTime - theoreticalStart).toFixed(2)}s`);
        console.log(`  This ensures correct subtitle timing when segments have variable durations`);
      }

      // Update the segment status with time range
      updateSegmentStatus(i, 'pending', t('output.pendingProcessing', 'Waiting to be processed...'), timeRange);

      // Generate cache ID for this segment
      const segmentCacheId = `segment_${segment.name}`;

      try {
        // First check if we have this segment cached
        updateSegmentStatus(i, 'loading', t('output.checkingCache', 'Checking cache...'));
        const response = await fetch(`http://localhost:3004/api/subtitle-exists/${segmentCacheId}`);
        const data = await response.json();

        if (data.exists && !userProvidedSubtitles) {
          // Only use cache if we don't have user-provided subtitles
          console.log(`Loaded cached subtitles for segment ${i+1}`);
          updateSegmentStatus(i, 'cached', t('output.loadedFromCache', 'Loaded from cache'));

          // Return the cached subtitles with adjusted timestamps
          return data.subtitles.map(subtitle => ({
            ...subtitle,
            start: subtitle.start + startTime,
            end: subtitle.end + startTime
          }));
        } else if (userProvidedSubtitles && data.exists) {
          console.log(`Ignoring cache for segment ${i+1} because user-provided subtitles are present`);
        }

        // If not cached, process the segment
        updateSegmentStatus(i, 'loading', t('output.processing', 'Processing...'), timeRange);
        
        // Determine if this is a video or audio file
        const isAudio = mediaFile.type.startsWith('audio/');
        const mediaType = isAudio ? 'audio' : 'video';
        
        // Pass userProvidedSubtitles to processSegment if available
        if (userProvidedSubtitles) {
          console.log(`Using user-provided subtitles for segment ${segmentIndex+1} in parallel processing`);
        }

        // Get the total duration of the video
        const totalDuration = await getVideoDuration(mediaFile);
        console.log(`Total video duration for segment processing: ${totalDuration}s`);

        // Pass userProvidedSubtitles and totalDuration to processSegment
        const result = await processSegment(segment, segmentIndex, startTime, segmentCacheId, onStatusUpdate, t, mediaType, {
          userProvidedSubtitles,
          totalDuration
        });
        updateSegmentStatus(i, 'success', t('output.processingComplete', 'Processing complete'), timeRange);
        return result;
      } catch (error) {
        console.error(`Error processing segment ${i+1}:`, error);
        updateSegmentStatus(i, 'error', error.message || t('output.processingFailed', 'Processing failed'), timeRange);
        throw error; // Re-throw to be caught by Promise.allSettled
      }
    });

    // Wait for all segment processing to complete (even if some fail)
    const results = await Promise.allSettled(segmentPromises);

    // Collect all successful results
    const allSubtitles = [];
    let hasFailures = false;

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        // Add successful subtitles to the combined results
        allSubtitles.push(...result.value);
      } else {
        // Log the error for failed segments
        console.error(`Segment ${i+1} failed:`, result.reason);
        hasFailures = true;
      }
    });

    // Warn the user if some segments failed
    if (hasFailures) {
      onStatusUpdate({
        message: t('output.someSegmentsFailed', 'Some segments failed to process. The subtitles may be incomplete.'),
        type: 'warning'
      });
    }

    // Sort subtitles by start time
    allSubtitles.sort((a, b) => a.start - b.start);

    // Renumber IDs
    allSubtitles.forEach((subtitle, index) => {
      subtitle.id = index + 1;
    });

    return allSubtitles;
  } catch (error) {
    console.error(`Error processing long ${mediaType}:`, error);

    // Clear the processing flag on error
    localStorage.removeItem('video_processing_in_progress');

    // Provide more helpful error messages for common issues
    if (error.message && error.message.includes('timeout')) {
      throw new Error(`${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} upload timed out. This may be due to the large file size. Please try a smaller or lower quality ${mediaType}.`);
    } else if (error.message && error.message.includes('ffmpeg')) {
      throw new Error(`Error splitting ${mediaType}: ` + error.message);
    } else {
      throw error;
    }
  }
};

/**
 * Alias for processLongVideo to maintain backward compatibility
 * @param {File} mediaFile - The media file (video or audio)
 * @param {Function} onStatusUpdate - Callback for status updates
 * @param {Function} t - Translation function
 * @returns {Promise<Array>} - Array of subtitle objects
 */
export const processLongMedia = processLongVideo;
