import { getVideoDuration, getMaxSegmentDurationSeconds } from '../../utils/durationUtils';
import { splitVideoOnServer } from '../../utils/videoSplitter';
import { extractYoutubeVideoId, downloadYoutubeVideo } from '../../utils/videoDownloader';

/**
 * Prepare video for segment processing by optimizing and splitting
 * @param {File} videoFile - The video file to prepare
 * @param {Function} setStatus - Function to update status
 * @param {Function} setVideoSegments - Function to update video segments
 * @param {Function} setSegmentsStatus - Function to update segments status
 * @param {Function} t - Translation function
 * @returns {Promise<Object>} - Object containing segment information
 */
export const prepareVideoForSegments = async (videoFile, setStatus, setVideoSegments, setSegmentsStatus, t = (key, defaultValue) => defaultValue) => {
  try {
    // Get video optimization settings from localStorage
    const optimizeVideos = localStorage.getItem('optimize_videos') !== 'false'; // Default to true
    const optimizedResolution = localStorage.getItem('optimized_resolution') || '360p'; // Default to 360p

    // Set status to loading
    setStatus({ message: t('output.preparingVideo', 'Preparing video for segment processing...'), type: 'loading' });

    // Get video duration
    const duration = await getVideoDuration(videoFile);
    console.log(`Video duration: ${duration} seconds`);

    // Calculate number of segments
    const numSegments = Math.ceil(duration / getMaxSegmentDurationSeconds());
    console.log(`Splitting video into ${numSegments} segments`);

    // Upload the media to the server and split it into segments
    const splitResult = await splitVideoOnServer(
      videoFile,
      getMaxSegmentDurationSeconds(),
      (progress, message) => {
        setStatus({
          message: `${message} (${progress}%)`,
          type: 'loading'
        });
      },
      true, // Enable fast splitting by default
      {
        optimizeVideos,
        optimizedResolution
      }
    );

    console.log('Video split into segments:', splitResult);

    // Store the split result in localStorage for later use
    localStorage.setItem('split_result', JSON.stringify(splitResult));

    // Directly update videoSegments state
    setVideoSegments(splitResult.segments);

    // Also dispatch event with segments for potential retries later
    const segmentsEvent = new CustomEvent('videoSegmentsUpdate', {
      detail: splitResult.segments
    });
    window.dispatchEvent(segmentsEvent);

    // Initialize segment status array
    const initialSegmentStatus = splitResult.segments.map((segment, index) => {
      // Calculate time range for this segment
      const startTime = segment.startTime !== undefined ? segment.startTime : index * getMaxSegmentDurationSeconds();
      const segmentDuration = segment.duration !== undefined ? segment.duration : getMaxSegmentDurationSeconds();
      const endTime = startTime + segmentDuration;

      // Format time range for display
      const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      };

      const timeRange = `${formatTime(startTime)} - ${formatTime(endTime)}`;

      return {
        status: 'success', // 'success' status will show the retry button
        message: t('output.segmentReady', 'Ready for processing'),
        shortMessage: t('output.ready', 'Ready'),
        timeRange
      };
    });

    // Update segment status
    setSegmentsStatus(initialSegmentStatus);

    return splitResult;
  } catch (error) {
    console.error('Error preparing video for segments:', error);
    setStatus({
      message: t('errors.videoPreparationFailed', 'Video preparation failed: {{message}}', { message: error.message }),
      type: 'error'
    });
    throw error;
  }
};

/**
 * Download a YouTube video and prepare it for segment processing
 * This is used when subtitles are loaded from cache for a YouTube video
 */
export const downloadAndPrepareYouTubeVideo = async (
  selectedVideo,
  setIsDownloading,
  setDownloadProgress,
  setStatus,
  setCurrentDownloadId,
  setActiveTab,
  setUploadedFile,
  setIsSrtOnlyMode,
  prepareVideoForSegments,
  t = (key, defaultValue) => defaultValue
) => {
  if (!selectedVideo) {
    console.error('No YouTube video selected');
    return;
  }

  try {
    // Set downloading state to true to disable the generate button
    setIsDownloading(true);
    setDownloadProgress(0);
    setStatus({ message: t('output.downloadingVideo', 'Downloading video...'), type: 'loading' });

    // Download the YouTube video with the selected quality
    // Extract video ID and set it as current download
    const videoId = extractYoutubeVideoId(selectedVideo.url);
    setCurrentDownloadId(videoId);

    const videoUrl = await downloadYoutubeVideo(
      selectedVideo.url,
      (progress) => {
        setDownloadProgress(progress);
      },
      selectedVideo.quality || '360p' // Use the selected quality or default to 360p
    );

    // Clear the current download ID when done
    setCurrentDownloadId(null);

    try {
      // Create a fetch request to get the video as a blob
      const response = await fetch(videoUrl);

      // Check if the response is ok
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();

      // Check if the blob has content (not empty)
      if (blob.size === 0) {
        throw new Error('Downloaded video is empty. The file may have been deleted from the server.');
      }

      // Create a File object from the blob
      const filename = `${selectedVideo.title || 'youtube_video'}.mp4`;
      const file = new File([blob], filename, { type: 'video/mp4' });

      // Switch to the upload tab without resetting state
      localStorage.setItem('lastActiveTab', 'file-upload');
      setActiveTab('file-upload');

      // Process the file as if it was uploaded
      const objectUrl = URL.createObjectURL(file);
      localStorage.setItem('current_file_url', objectUrl);

      // Set the uploaded file
      setUploadedFile(file);

      // If we're in SRT-only mode, switch to normal mode since we now have a video
      if (setIsSrtOnlyMode) {
        setIsSrtOnlyMode(false);
      }

      // Reset downloading state
      setIsDownloading(false);
      setDownloadProgress(100);

      // Prepare the video for segment processing
      await prepareVideoForSegments(file);

      // Update status to show that segments are ready
      setStatus({ message: t('output.segmentsReady', 'Video segments are ready for processing!'), type: 'success' });

      // Return the file for further processing
      return file;
    } catch (error) {
      console.error('Error processing downloaded video:', error);
      // Reset downloading state
      setIsDownloading(false);
      setDownloadProgress(0);
      setStatus({
        message: t('errors.videoProcessingFailed', 'Video processing failed: {{message}}', { message: error.message }),
        type: 'error'
      });
    }
  } catch (error) {
    console.error('Error downloading video:', error);
    // Reset downloading state
    setIsDownloading(false);
    setDownloadProgress(0);
    setStatus({ message: `${t('errors.videoDownloadFailed', 'Video download failed')}: ${error.message}`, type: 'error' });
  }
};
