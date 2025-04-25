import { getVideoDuration, getMaxSegmentDurationSeconds } from '../../utils/durationUtils';
import { splitVideoOnServer } from '../../utils/videoSplitter';
import { extractYoutubeVideoId, downloadYoutubeVideo } from '../../utils/videoDownloader';
import { extractDouyinVideoId, downloadDouyinVideo } from '../../utils/douyinDownloader';
import { downloadGenericVideo, cancelGenericVideoDownload } from '../../utils/allSitesDownloader';

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
    if (!videoFile) {
      throw new Error('No video file provided');
    }

    // Log the video file details
    console.log(`Preparing video file: ${videoFile.name}, size: ${videoFile.size} bytes, type: ${videoFile.type}`);

    // Check if the file size is reasonable
    if (videoFile.size < 100 * 1024) { // Less than 100KB
      console.error(`Video file is too small (${videoFile.size} bytes), likely not a valid video`);
      throw new Error(`Video file is too small (${videoFile.size} bytes), likely not a valid video`);
    }

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

    // For downloaded videos, ensure we have a proper file name and type
    let processedVideoFile = videoFile;

    // If the file doesn't have a proper name or type, create a new File object
    if (!videoFile.name || !videoFile.type) {
      console.log('Creating a new File object with proper metadata');

      // Create a new File object with proper metadata
      processedVideoFile = new File(
        [videoFile],
        videoFile.name || `video_${Date.now()}.mp4`,
        { type: videoFile.type || 'video/mp4' }
      );

      console.log(`Created new File object: ${processedVideoFile.name}, size: ${processedVideoFile.size} bytes, type: ${processedVideoFile.type}`);
    }

    // Upload the media to the server and split it into segments
    const splitResult = await splitVideoOnServer(
      processedVideoFile,
      getMaxSegmentDurationSeconds(),
      (progress, messageKey, defaultMessage) => {
        // Handle translation keys properly
        const translatedMessage = messageKey && messageKey.startsWith('output.')
          ? t(messageKey, defaultMessage)
          : (defaultMessage || messageKey);

        setStatus({
          message: `${translatedMessage} (${progress}%)`,
          type: 'loading'
        });
      },
      true, // Enable fast splitting by default
      {
        optimizeVideos: false, // Set to false to avoid duplication - we'll optimize on the server if needed
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
 * Download a YouTube or Douyin video and prepare it for segment processing
 * This is used when subtitles are loaded from cache for a video
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
    console.error('No video selected');
    return;
  }

  try {
    // Set downloading state to true to disable the generate button
    setIsDownloading(true);
    setDownloadProgress(0);
    setStatus({ message: t('output.downloadingVideo', 'Downloading video...'), type: 'loading' });

    let videoId;
    let videoUrl;

    // Check the source of the video
    if (selectedVideo.source === 'douyin') {
      // Extract Douyin video ID and set it as current download
      videoId = extractDouyinVideoId(selectedVideo.url);
      setCurrentDownloadId(videoId);

      videoUrl = await downloadDouyinVideo(
        selectedVideo.url,
        (progress) => {
          setDownloadProgress(progress);
        }
      );
    } else if (selectedVideo.source === 'all-sites') {
      // For generic URLs using yt-dlp
      videoId = selectedVideo.id;
      setCurrentDownloadId(videoId);

      try {
        console.log(`Processing All Sites URL with ID: ${videoId}`);

        // downloadGenericVideo now returns a File object directly
        const videoFile = await downloadGenericVideo(
          selectedVideo.url,
          (progress) => {
            setDownloadProgress(progress);
          }
        );

        // Validate the file
        if (!videoFile || !(videoFile instanceof File)) {
          console.error('Invalid video file returned from downloadGenericVideo');
          throw new Error('Invalid video file returned');
        }

        console.log(`Successfully downloaded video file: ${videoFile.name}, size: ${videoFile.size} bytes`);

        // Create an object URL for the file
        videoUrl = URL.createObjectURL(videoFile);

        // Store the file for later use
        window.downloadedVideoFile = videoFile;
      } catch (error) {
        console.error('Error downloading video from all-sites:', error);

        // Try to fetch the video directly as a fallback
        console.log('Trying fallback method to fetch video...');

        try {
          // The videoId might have changed during the download process
          // Try to get the latest videoId from the error message or use the original one
          let latestVideoId = videoId;
          if (error.message && error.message.includes('site_')) {
            const match = error.message.match(/site_[a-zA-Z0-9_]+/);
            if (match) {
              latestVideoId = match[0];
              console.log(`Extracted videoId from error message: ${latestVideoId}`);
            }
          }

          const response = await fetch(`/videos/${latestVideoId}.mp4`);

          if (!response.ok) {
            throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
          }

          const blob = await response.blob();

          // Check if the blob has a reasonable size
          if (blob.size < 1000) { // Less than 1KB
            throw new Error(`Video file is too small (${blob.size} bytes), likely not a valid video`);
          }

          const videoFile = new File([blob], `${latestVideoId}.mp4`, { type: 'video/mp4' });

          console.log(`Successfully fetched video file: ${videoFile.name}, size: ${videoFile.size} bytes`);

          // Create an object URL for the file
          videoUrl = URL.createObjectURL(videoFile);

          // Store the file for later use
          window.downloadedVideoFile = videoFile;
        } catch (fallbackError) {
          console.error('Fallback method failed:', fallbackError);
          throw new Error(`Failed to download video: ${error.message}. Fallback also failed: ${fallbackError.message}`);
        }
      }
    } else {
      // Default to YouTube
      // Extract video ID and set it as current download
      videoId = extractYoutubeVideoId(selectedVideo.url);
      setCurrentDownloadId(videoId);

      videoUrl = await downloadYoutubeVideo(
        selectedVideo.url,
        (progress) => {
          setDownloadProgress(progress);
        }
      );
    }

    // Clear the current download ID when done
    setCurrentDownloadId(null);

    try {
      // Initialize blob variable
      let blob;

      // Check if we already have a downloaded file
      if (selectedVideo.source === 'all-sites' && window.downloadedVideoFile) {
        console.log('Using already downloaded file instead of fetching from URL');
        blob = window.downloadedVideoFile;
        console.log(`Using file: ${blob.name}, size: ${blob.size} bytes, type: ${blob.type}`);
      } else {
        // For blob URLs, we need to handle them differently
        if (videoUrl.startsWith('blob:')) {
          console.log('URL is a blob URL, using window.downloadedVideoFile instead');

          // If we have a downloaded file, use it directly
          if (window.downloadedVideoFile) {
            console.log(`Using downloaded file: ${window.downloadedVideoFile.name}, size: ${window.downloadedVideoFile.size} bytes`);
            blob = window.downloadedVideoFile;

            // Check if the blob has a reasonable size
            if (blob.size < 100 * 1024) { // Less than 100KB
              console.error(`Downloaded file is too small (${blob.size} bytes), likely not a valid video`);
              throw new Error(`Downloaded file is too small (${blob.size} bytes), likely not a valid video`);
            }
          } else {
            // If we don't have a downloaded file, try to fetch the video ID from the server
            console.log('No downloaded file available, trying to fetch from server');

            // Extract the video ID from the selectedVideo
            const videoId = selectedVideo.id;

            if (!videoId) {
              throw new Error('No video ID available to fetch from server');
            }

            // Fetch the video directly from the server
            const serverUrl = 'http://localhost:3007';
            const directResponse = await fetch(`${serverUrl}/videos/${videoId}.mp4?t=${Date.now()}`, {
              method: 'GET',
              cache: 'no-cache'
            });

            if (!directResponse.ok) {
              throw new Error(`Failed to fetch video from server: ${directResponse.status} ${directResponse.statusText}`);
            }

            console.log(`Fetched video directly from server, Content-Length: ${directResponse.headers.get('Content-Length')} bytes`);
            const directBlob = await directResponse.blob();
            console.log(`Created blob from direct response: size: ${directBlob.size} bytes, type: ${directBlob.type}`);

            // Check if the blob has a reasonable size
            if (directBlob.size < 100 * 1024) { // Less than 100KB
              throw new Error(`Downloaded blob is too small (${directBlob.size} bytes), likely not a valid video`);
            }

            // Create a File object from the blob
            const file = new File([directBlob], `${videoId}.mp4`, { type: 'video/mp4' });
            window.downloadedVideoFile = file;
            blob = file;
          }
        } else {
          // For regular URLs, fetch as normal
          // Add a timestamp to avoid caching issues
          const fetchUrl = videoUrl.includes('?')
            ? `${videoUrl}&t=${Date.now()}`
            : `${videoUrl}?t=${Date.now()}`;

          console.log(`Fetching video from URL: ${fetchUrl}`);

          try {
            const response = await fetch(fetchUrl, {
              method: 'GET',
              cache: 'no-cache' // Ensure we don't get a cached response
            });

            // Check if the response is ok
            if (!response.ok) {
              throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
            }

            console.log(`Fetched video, Content-Length: ${response.headers.get('Content-Length')} bytes`);
            blob = await response.blob();
            console.log(`Created blob from response: size: ${blob.size} bytes, type: ${blob.type}`);
          } catch (error) {
            console.error('Error fetching video:', error);

            // If this is an all-sites video, try to fetch it directly from the server
            if (selectedVideo.source === 'all-sites') {
              console.log('Trying to fetch the video directly from the server');

              // Extract the video ID from the URL or use the selectedVideo.id
              const videoId = selectedVideo.id;

              // Fetch the video directly from the server
              const serverUrl = 'http://localhost:3007';
              const retryResponse = await fetch(`${serverUrl}/videos/${videoId}.mp4?t=${Date.now()}`, {
                method: 'GET',
                cache: 'no-cache'
              });

              if (!retryResponse.ok) {
                throw new Error(`Failed to fetch video from server: ${retryResponse.status} ${retryResponse.statusText}`);
              }

              console.log(`Fetched video directly from server, Content-Length: ${retryResponse.headers.get('Content-Length')} bytes`);
              const retryBlob = await retryResponse.blob();
              console.log(`Created blob from retry response: size: ${retryBlob.size} bytes, type: ${retryBlob.type}`);

              // Check if the blob has a reasonable size
              if (retryBlob.size < 100 * 1024) { // Less than 100KB
                throw new Error(`Downloaded blob is too small (${retryBlob.size} bytes), likely not a valid video`);
              }

              // Create a File object from the blob
              const file = new File([retryBlob], `${videoId}.mp4`, { type: 'video/mp4' });
              window.downloadedVideoFile = file;
              blob = file;
            } else {
              throw error;
            }
          }
        }
      }

      // Check if the blob has content (not empty)
      if (blob.size === 0) {
        throw new Error('Downloaded video is empty. The file may have been deleted from the server.');
      }

      // Check if the blob has a reasonable size
      if (blob.size < 100 * 1024) { // Less than 100KB
        console.error(`Downloaded blob is too small (${blob.size} bytes), likely not a valid video`);

        // If this is an all-sites video, try to fetch it directly from the server
        if (selectedVideo.source === 'all-sites') {
          console.log('Trying to fetch the video directly from the server');

          // Extract the video ID from the URL or use the selectedVideo.id
          const videoId = selectedVideo.id;

          // Fetch the video directly from the server
          const serverUrl = 'http://localhost:3007';
          const retryResponse = await fetch(`${serverUrl}/videos/${videoId}.mp4?t=${Date.now()}`, {
            method: 'GET',
            cache: 'no-cache'
          });

          if (retryResponse.ok) {
            console.log(`Retry fetched video file: ${videoId}.mp4, Content-Length: ${retryResponse.headers.get('Content-Length')} bytes`);
            const retryBlob = await retryResponse.blob();
            console.log(`Retry created blob: size: ${retryBlob.size} bytes, type: ${retryBlob.type}`);

            // Check if the retry blob has a reasonable size
            if (retryBlob.size < 100 * 1024) { // Less than 100KB
              throw new Error(`Retry blob is too small (${retryBlob.size} bytes), likely not a valid video`);
            }

            // Use the retry blob instead
            blob = retryBlob;
          } else {
            console.error(`Error fetching video file on retry: ${retryResponse.status} ${retryResponse.statusText}`);
          }
        }

        throw new Error(`Downloaded blob is too small (${blob.size} bytes), likely not a valid video`);
      }

      // Create a File object from the blob
      let file;
      if (selectedVideo.source === 'all-sites' && window.downloadedVideoFile) {
        // Use the already downloaded file
        file = window.downloadedVideoFile;

        // Log the file details
        console.log(`Using already downloaded file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);

        // Check if the file size is reasonable
        if (file.size < 100 * 1024) { // Less than 100KB
          console.error(`Downloaded file is too small (${file.size} bytes), likely not a valid video`);
          throw new Error(`Downloaded file is too small (${file.size} bytes), likely not a valid video`);
        }

        // Clear the reference
        window.downloadedVideoFile = null;
      } else {
        // Create a new file from the blob
        const filename = `${selectedVideo.title || 'video'}.mp4`;
        file = new File([blob], filename, { type: 'video/mp4' });

        // Log the file details
        console.log(`Created new file from blob: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);

        // Check if the file size is reasonable
        if (file.size < 100 * 1024) { // Less than 100KB
          console.error(`Created file is too small (${file.size} bytes), likely not a valid video`);
          throw new Error(`Created file is too small (${file.size} bytes), likely not a valid video`);
        }
      }

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
