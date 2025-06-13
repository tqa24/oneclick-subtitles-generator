import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import SubtitleCustomizationPanel, { defaultCustomization } from './SubtitleCustomizationPanel';
import RemotionVideoPreview from './RemotionVideoPreview';
import QueueManagerPanel from './QueueManagerPanel';
import '../styles/VideoRenderingSection.css';

const VideoRenderingSection = ({
  selectedVideo,
  uploadedFile,
  actualVideoUrl,
  subtitlesData,
  translatedSubtitles,
  narrationResults,
  autoFillData = null
}) => {
  const { t } = useTranslation();
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStatus, setRenderStatus] = useState('');
  const [renderedVideoUrl, setRenderedVideoUrl] = useState('');
  const [error, setError] = useState('');

  // Form state
  const [selectedVideoFile, setSelectedVideoFile] = useState(null);
  const [selectedSubtitles, setSelectedSubtitles] = useState('original');
  const [selectedNarration, setSelectedNarration] = useState('none');
  const [renderSettings, setRenderSettings] = useState({
    resolution: '1080p',
    frameRate: 60,
    videoType: 'Subtitled Video',
    originalAudioVolume: 100,
    narrationVolume: 100
  });

  // New feature states
  const [subtitleCustomization, setSubtitleCustomization] = useState(defaultCustomization);
  const [renderQueue, setRenderQueue] = useState([]);
  const [currentQueueItem, setCurrentQueueItem] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isRefreshingNarration, setIsRefreshingNarration] = useState(false);

  // Panel resizing states
  const [leftPanelWidth, setLeftPanelWidth] = useState(66.67); // Default 2fr = 66.67%
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef(null);

  // Collapsible state - matching background-generator pattern
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Panel resizing functionality
  const handleMouseDown = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isResizing || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

    // Constrain between 30% and 80%
    const constrainedWidth = Math.min(Math.max(newLeftWidth, 30), 80);
    setLeftPanelWidth(constrainedWidth);
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  // Add global mouse event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const eventSourceRef = useRef(null);
  const sectionRef = useRef(null);

  // Auto-fill data when autoFillData changes
  useEffect(() => {
    if (autoFillData) {
      // Expand the section if requested
      if (autoFillData.expand) {
        setIsCollapsed(false);
      }

      // Auto-fill video using the actual video URL from the player
      if (actualVideoUrl) {
        // Create a video file object that represents the actual playing video
        setSelectedVideoFile({
          url: actualVideoUrl,
          name: selectedVideo?.title || uploadedFile?.name || 'Current Video',
          isActualVideo: true
        });
      }

      // Auto-fill subtitles based on available data
      if (translatedSubtitles && translatedSubtitles.length > 0) {
        setSelectedSubtitles('translated');
      } else if (subtitlesData && subtitlesData.length > 0) {
        setSelectedSubtitles('original');
      }

      // Auto-fill narration if available
      if (narrationResults && narrationResults.length > 0) {
        setSelectedNarration('generated');
      }

      // Scroll to section
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [autoFillData, actualVideoUrl, selectedVideo, uploadedFile, subtitlesData, translatedSubtitles, narrationResults]);

  // Auto-process queue when it changes
  useEffect(() => {
    if (!isRendering && !currentQueueItem && renderQueue.length > 0) {
      const hasPendingItems = renderQueue.some(item => item.status === 'pending');
      if (hasPendingItems) {
        // Small delay to avoid rapid processing
        const timer = setTimeout(() => processNextQueueItem(), 500);
        return () => clearTimeout(timer);
      }
    }
  }, [renderQueue, isRendering, currentQueueItem]);

  // Get current subtitles based on selection
  const getCurrentSubtitles = () => {
    if (selectedSubtitles === 'translated' && translatedSubtitles && translatedSubtitles.length > 0) {
      return translatedSubtitles;
    }
    return subtitlesData || [];
  };

  // Check if aligned narration is available (same logic as refresh narration button)
  const isAlignedNarrationAvailable = () => {
    return window.isAlignedNarrationAvailable === true && window.alignedNarrationCache?.url;
  };

  // Check if individual narration segments are available (not the aligned audio)
  const hasNarrationSegments = () => {
    // Check props first
    if (narrationResults && narrationResults.length > 0) {
      // Check if any narration has success=true (meaning individual segments exist)
      const hasSuccessfulNarrations = narrationResults.some(result => result.success === true);
      if (hasSuccessfulNarrations) return true;
    }

    // Check window objects (where narrations are actually stored)
    const originalNarrations = window.originalNarrations || [];
    const translatedNarrations = window.translatedNarrations || [];
    const groupedNarrations = window.groupedNarrations || [];

    // Check if any narration segments have success=true
    const hasOriginalSegments = originalNarrations.some(result => result.success === true);
    const hasTranslatedSegments = translatedNarrations.some(result => result.success === true);
    const hasGroupedSegments = groupedNarrations.some(result => result.success === true);

    return hasOriginalSegments || hasTranslatedSegments || hasGroupedSegments;
  };

  // Get narration audio URL if available - same as refresh narration button
  const getNarrationAudioUrl = async () => {
    // First check if aligned narration is already available
    if (isAlignedNarrationAvailable()) {
      return window.alignedNarrationCache.url;
    }

    // If not available and user selected generated narration, try to generate it
    if (selectedNarration === 'generated' && narrationResults && narrationResults.length > 0) {
      try {
        // Use the same logic as the refresh narration button
        const narrationData = narrationResults.map(result => ({
          filename: result.filename,
          start_time: result.start_time,
          end_time: result.end_time,
          subtitle_id: result.subtitle_id
        }));

        // Call the same endpoint as refresh narration button
        const response = await fetch(`http://localhost:3007/api/narration/download-aligned`, {
          method: 'POST',
          mode: 'cors',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'audio/wav'
          },
          body: JSON.stringify({ narrations: narrationData })
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);

          // Update the cache like the refresh button does
          window.alignedNarrationCache = {
            blob: blob,
            url: url,
            timestamp: Date.now(),
            subtitleTimestamps: {}
          };
          window.isAlignedNarrationAvailable = true;

          return url;
        }
      } catch (error) {
        console.error('Failed to get aligned narration:', error);
      }
    }
    return null;
  };

  // Refresh narration function - same logic as the main video player
  const handleRefreshNarration = async () => {
    if (isRefreshingNarration) return;

    try {
      setIsRefreshingNarration(true);

      // Get narrations from window object
      const isUsingGroupedSubtitles = window.useGroupedSubtitles || false;
      const groupedNarrations = window.groupedNarrations || [];
      const originalNarrations = window.originalNarrations || [];

      // Use grouped narrations if available and enabled, otherwise use original narrations
      const narrations = (isUsingGroupedSubtitles && groupedNarrations.length > 0)
        ? groupedNarrations
        : originalNarrations;

      console.log(`Using ${isUsingGroupedSubtitles ? 'grouped' : 'original'} narrations for alignment. Found ${narrations.length} narrations.`);

      // Check if we have any narration results
      if (!narrations || narrations.length === 0) {
        console.error('No narration results available in window objects');

        // Try to reconstruct narration results from the file system
        const allSubtitles = window.subtitlesData || window.originalSubtitles || [];

        if (allSubtitles.length === 0) {
          throw new Error('No narration results or subtitles available for alignment');
        }

        // Create synthetic narration objects based on subtitles
        const syntheticNarrations = allSubtitles.map(subtitle => ({
          subtitle_id: subtitle.id,
          filename: `subtitle_${subtitle.id}/1.wav`,
          success: true,
          start: subtitle.start,
          end: subtitle.end,
          text: subtitle.text
        }));

        // Use these synthetic narrations
        narrations.length = 0;
        narrations.push(...syntheticNarrations);

        // Also update the window object for future use
        window.originalNarrations = [...syntheticNarrations];
      }

      // Force reset the aligned narration cache
      if (typeof window.resetAlignedNarration === 'function') {
        window.resetAlignedNarration();
      }

      // Clean up any existing audio elements
      if (window.alignedAudioElement) {
        try {
          window.alignedAudioElement.pause();
          window.alignedAudioElement.src = '';
          window.alignedAudioElement.load();
          window.alignedAudioElement = null;
        } catch (e) {
          console.warn('Error cleaning up window.alignedAudioElement:', e);
        }
      }

      // Get all subtitles from the window object
      const allSubtitles = isUsingGroupedSubtitles && window.groupedSubtitles ?
        window.groupedSubtitles :
        (window.subtitlesData || window.originalSubtitles || []);

      // Create a map for faster lookup
      const subtitleMap = {};
      allSubtitles.forEach(sub => {
        if (sub.id !== undefined) {
          subtitleMap[sub.id] = sub;
        }
      });

      // Prepare the data for the aligned narration with correct timing
      const narrationData = narrations
        .filter(result => {
          if (result.success && result.filename) {
            return true;
          }
          if (result.success && !result.filename && result.subtitle_id) {
            result.filename = `subtitle_${result.subtitle_id}/1.wav`;
            return true;
          }
          return false;
        })
        .map(result => {
          const subtitle = subtitleMap[result.subtitle_id];
          if (subtitle && typeof subtitle.start === 'number' && typeof subtitle.end === 'number') {
            return {
              filename: result.filename,
              subtitle_id: result.subtitle_id,
              start: subtitle.start,
              end: subtitle.end,
              text: subtitle.text || result.text || ''
            };
          }
          return {
            filename: result.filename,
            subtitle_id: result.subtitle_id,
            start: 0,
            end: 5,
            text: result.text || ''
          };
        });

      // Sort by start time to ensure correct order
      narrationData.sort((a, b) => a.start - b.start);

      if (narrationData.length === 0) {
        throw new Error('No valid narration files found. Please generate narrations first.');
      }

      // Call the same endpoint as refresh narration button
      const response = await fetch(`http://localhost:3007/api/narration/download-aligned`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'audio/wav'
        },
        body: JSON.stringify({ narrations: narrationData })
      });

      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error && errorJson.error.includes('Audio file not found')) {
            throw new Error(`Some narration files are missing. Please regenerate narrations before refreshing.`);
          } else {
            throw new Error(`Failed to generate aligned audio: ${errorJson.error || response.statusText}`);
          }
        } catch (jsonError) {
          throw new Error(`Failed to generate aligned audio: ${errorText || response.statusText}`);
        }
      }

      // Get the blob from the response
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      // Update the aligned narration cache
      window.alignedNarrationCache = {
        blob: blob,
        url: url,
        timestamp: Date.now(),
        subtitleTimestamps: {}
      };

      // Set a flag to indicate that aligned narration is available
      window.isAlignedNarrationAvailable = true;

      // Notify the system that aligned narration is available
      window.dispatchEvent(new CustomEvent('aligned-narration-ready', {
        detail: {
          url: url,
          timestamp: Date.now()
        }
      }));

    } catch (error) {
      console.error('Error during aligned narration regeneration:', error);
      setError(error.message || 'Failed to refresh narration');
    } finally {
      setIsRefreshingNarration(false);
    }
  };

  // Handle video file upload
  const handleVideoUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedVideoFile(file);
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const videoFile = files.find(file => file.type.startsWith('video/') || file.type.startsWith('audio/'));
      if (videoFile) {
        setSelectedVideoFile(videoFile);
      }
    }
  };

  // Upload file to video-renderer server
  const uploadFileToRenderer = async (file, type = 'video') => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`http://localhost:3010/upload/${type}`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Failed to upload ${type}`);
    }

    const data = await response.json();
    return data.filename;
  };

  // Download video from URL and upload to renderer
  const downloadVideoFromUrl = async (videoUrl) => {
    // Handle blob URLs differently - they can't be fetched from server
    if (videoUrl.startsWith('blob:')) {
      throw new Error('Blob URLs cannot be downloaded from server. Please upload the original file.');
    }

    // Fetch the video from the URL
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error('Failed to download video from URL');
    }

    // Convert to blob
    const blob = await response.blob();

    // Create a File object from the blob
    const file = new File([blob], 'video.mp4', { type: 'video/mp4' });

    // Upload to renderer
    return await uploadFileToRenderer(file, 'video');
  };

  // Convert blob URL to File object for upload
  const convertBlobUrlToFile = async (blobUrl, filename = 'video.mp4') => {
    try {
      // Fetch the blob from the blob URL
      const response = await fetch(blobUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch blob');
      }

      const blob = await response.blob();

      // Create a File object from the blob
      return new File([blob], filename, { type: blob.type || 'video/mp4' });
    } catch (error) {
      console.error('Error converting blob URL to file:', error);
      throw new Error('Failed to convert blob URL to file');
    }
  };

  // Unified render function that handles both immediate rendering and queueing
  const handleRender = async () => {
    // If currently rendering, add to queue instead
    if (isRendering || currentQueueItem) {
      await addToQueue();
      return;
    }

    // Otherwise, start rendering immediately
    await handleStartRender();
  };

  // Start rendering
  const handleStartRender = async () => {
    try {
      setIsRendering(true);
      setRenderProgress(0);
      setRenderStatus(t('videoRendering.starting', 'Starting render...'));
      setError('');
      setRenderedVideoUrl('');

      // Validate inputs
      if (!selectedVideoFile) {
        throw new Error(t('videoRendering.noVideoSelected', 'Please select a video file'));
      }

      const currentSubtitles = getCurrentSubtitles();
      if (!currentSubtitles || currentSubtitles.length === 0) {
        throw new Error(t('videoRendering.noSubtitles', 'No subtitles available'));
      }

      // Upload video file if it's a File object
      let audioFile;
      if (selectedVideoFile instanceof File) {
        setRenderStatus(t('videoRendering.uploadingVideo', 'Uploading video...'));
        audioFile = await uploadFileToRenderer(selectedVideoFile, 'video');
      } else if (selectedVideoFile && typeof selectedVideoFile === 'object' && selectedVideoFile.url) {
        // If it's the actual video URL from the player
        if (selectedVideoFile.isActualVideo) {
          // Check if it's a blob URL
          if (selectedVideoFile.url.startsWith('blob:')) {
            setRenderStatus(t('videoRendering.convertingVideo', 'Converting video...'));
            // Convert blob URL to File and upload
            const videoFile = await convertBlobUrlToFile(selectedVideoFile.url, selectedVideoFile.name || 'video.mp4');
            setRenderStatus(t('videoRendering.uploadingVideo', 'Uploading video...'));
            audioFile = await uploadFileToRenderer(videoFile, 'video');
          } else {
            setRenderStatus(t('videoRendering.downloadingVideo', 'Downloading video...'));
            audioFile = await downloadVideoFromUrl(selectedVideoFile.url);
          }
        } else {
          throw new Error(t('videoRendering.urlNotSupported', 'URL videos not yet supported. Please upload a file.'));
        }
      } else {
        throw new Error(t('videoRendering.invalidVideoFile', 'Invalid video file. Please select a valid video file.'));
      }

      // Upload narration audio if selected and get HTTP URL
      let narrationUrl = null;
      if (selectedNarration === 'generated') {
        setRenderStatus(t('videoRendering.preparingNarration', 'Preparing narration...'));
        const narrationBlobUrl = await getNarrationAudioUrl();
        if (narrationBlobUrl) {
          setRenderStatus(t('videoRendering.uploadingNarration', 'Uploading narration...'));

          // Handle blob URLs for narration audio
          let narrationFileObj;
          if (narrationBlobUrl.startsWith('blob:')) {
            // Convert blob URL to File object (client-side)
            const narrationResponse = await fetch(narrationBlobUrl);
            const narrationBlob = await narrationResponse.blob();
            narrationFileObj = new File([narrationBlob], 'narration.wav', { type: 'audio/wav' });
          } else {
            // Handle HTTP URLs
            const narrationResponse = await fetch(narrationBlobUrl);
            if (!narrationResponse.ok) {
              throw new Error('Failed to download narration from URL');
            }
            const narrationBlob = await narrationResponse.blob();
            narrationFileObj = new File([narrationBlob], 'narration.wav', { type: 'audio/wav' });
          }

          // Upload the file to renderer and get HTTP URL
          const uploadedNarrationFilename = await uploadFileToRenderer(narrationFileObj, 'audio');
          narrationUrl = `http://localhost:3010/uploads/${uploadedNarrationFilename}`;
        }
      }

      // Prepare render request
      const renderRequest = {
        compositionId: 'subtitled-video',
        audioFile: audioFile,
        lyrics: currentSubtitles,
        metadata: renderSettings,
        narrationUrl: narrationUrl, // Use HTTP URL instead of blob URL
        isVideoFile: true
      };

      setRenderStatus(t('videoRendering.rendering', 'Rendering video...'));

      // Start Server-Sent Events connection for progress
      eventSourceRef.current = new EventSource('http://localhost:3010/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(renderRequest)
      });

      // Actually send the POST request
      const response = await fetch('http://localhost:3010/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(renderRequest)
      });

      if (!response.ok) {
        throw new Error(`Render request failed: ${response.status}`);
      }

      // Handle Server-Sent Events
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              // Handle Chrome download progress for first-time users
              if (data.chromeDownload) {
                const { downloaded, total } = data.chromeDownload;
                const downloadProgress = Math.round((downloaded / total) * 100);
                setRenderProgress(downloadProgress);
                setRenderStatus(t('videoRendering.downloadingChrome', 'First-time setup: Downloading Chrome browser... {{progress}}%', {
                  progress: downloadProgress
                }));
              }
              // Handle bundling progress
              else if (data.bundling) {
                setRenderProgress(10);
                setRenderStatus(t('videoRendering.bundling', 'Preparing video components...'));
              }
              // Handle composition selection
              else if (data.composition) {
                setRenderProgress(20);
                setRenderStatus(t('videoRendering.selectingComposition', 'Setting up video composition...'));
              }
              // Handle regular render progress
              else if (data.progress !== undefined) {
                setRenderProgress(Math.round(data.progress * 100));
                setRenderStatus(t('videoRendering.renderingFrames', 'Processing video frames...'));
              }

              if (data.status === 'complete' && data.videoUrl) {
                setRenderedVideoUrl(data.videoUrl);
                setRenderStatus(t('videoRendering.complete', 'Render complete!'));
                setRenderProgress(100);

                // Process next item in queue if available
                setTimeout(() => processNextQueueItem(), 1000); // Small delay to show completion
                break;
              }

              if (data.status === 'error') {
                throw new Error(data.error || t('videoRendering.unknownError', 'Unknown error occurred'));
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', parseError);
            }
          }
        }
      }

    } catch (error) {
      console.error('Render error:', error);
      setError(error.message);
      setRenderStatus(t('videoRendering.failed', 'Render failed'));
    } finally {
      setIsRendering(false);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Process next item in queue even if current one failed
      setTimeout(() => processNextQueueItem(), 1000);
    }
  };

  // Cancel rendering
  const handleCancelRender = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsRendering(false);
    setRenderStatus(t('videoRendering.cancelled', 'Render cancelled'));
  };

  // Queue management functions
  const addToQueue = async () => {
    if (!selectedVideoFile || getCurrentSubtitles().length === 0) return;

    // Validate video file
    if (!(selectedVideoFile instanceof File) &&
        !(typeof selectedVideoFile === 'object' && selectedVideoFile.url)) {
      setError(t('videoRendering.invalidVideoFile', 'Invalid video file. Please select a valid video file.'));
      return;
    }

    // Get narration URL asynchronously
    const narrationUrl = await getNarrationAudioUrl();

    const queueItem = {
      id: Date.now().toString(),
      videoFile: selectedVideoFile,
      subtitles: getCurrentSubtitles(),
      narrationUrl: narrationUrl,
      settings: renderSettings,
      customization: subtitleCustomization,
      status: 'pending',
      progress: 0,
      timestamp: Date.now()
    };

    setRenderQueue(prev => [...prev, queueItem]);
    setError(''); // Clear any previous errors
  };

  const removeFromQueue = (id) => {
    setRenderQueue(prev => prev.filter(item => item.id !== id));
  };

  const clearQueue = () => {
    setRenderQueue(prev => prev.filter(item => item.status === 'processing'));
  };

  const retryQueueItem = (id) => {
    setRenderQueue(prev => prev.map(item =>
      item.id === id ? { ...item, status: 'pending', progress: 0, error: null } : item
    ));
  };

  // Process next item in queue
  const processNextQueueItem = async () => {
    // Don't process if already rendering
    if (isRendering || currentQueueItem) return;

    // Find next pending item
    const nextItem = renderQueue.find(item => item.status === 'pending');
    if (!nextItem) return;

    try {
      // Set as current processing item
      setCurrentQueueItem(nextItem);
      setRenderQueue(prev => prev.map(item =>
        item.id === nextItem.id ? { ...item, status: 'processing' } : item
      ));

      // Set up the render with the queue item's settings
      setSelectedVideoFile(nextItem.videoFile);
      setSelectedSubtitles(nextItem.subtitles === getCurrentSubtitles() ? selectedSubtitles : 'original');
      setRenderSettings(nextItem.settings);
      setSubtitleCustomization(nextItem.customization);

      // Start the render
      await handleStartRender();

      // Mark as complete
      setRenderQueue(prev => prev.map(item =>
        item.id === nextItem.id ? { ...item, status: 'complete' } : item
      ));
    } catch (error) {
      // Mark as failed
      setRenderQueue(prev => prev.map(item =>
        item.id === nextItem.id ? { ...item, status: 'failed', error: error.message } : item
      ));
    } finally {
      setCurrentQueueItem(null);
    }
  };

  return (
    <div
      ref={sectionRef}
      className={`video-rendering-section ${isCollapsed ? 'collapsed' : ''} ${isDragging ? 'dragging' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header - matching background-generator-header */}
      <div className="video-rendering-header">
        <div className="header-left">
          <h2>{t('videoRendering.title', 'Video Rendering')}</h2>
        </div>
        <button
          className="collapse-button"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </div>

      {/* Drag overlay */}
      {isDragging && (
        <div className="drag-overlay">
          <div className="drag-content">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <h3>{t('videoRendering.dropVideo', 'Drop video file here')}</h3>
          </div>
        </div>
      )}

      {/* Collapsed content */}
      {isCollapsed ? (
        <div className="video-rendering-collapsed-content">
          <p className="helper-message">
            {t('videoRendering.helperMessage', 'Configure video rendering settings and generate your final video with subtitles and narration')}
          </p>
        </div>
      ) : (
        /* Expanded content */
        <div className="video-rendering-content">
          {/* First row: Video Input, Subtitle Source, and Narration Audio in one line */}
          <div className="input-selection-row">
            {/* Video Input */}
            <div className="video-input-compact">
              <h4>{t('videoRendering.videoInput', 'Video Input')}</h4>
              {selectedVideoFile ? (
                <div className="selected-video-info">
                  <span className="video-name">
                    {(selectedVideoFile instanceof File ? selectedVideoFile.name :
                      (selectedVideoFile.name || selectedVideoFile.title || 'Current Video'))}
                  </span>
                  {selectedVideoFile.isActualVideo && (
                    <span className="video-source-indicator">
                      {t('videoRendering.fromPlayer', '(from video player)')}
                    </span>
                  )}
                  <button
                    className="pill-button secondary"
                    onClick={() => document.getElementById('video-upload-input').click()}
                  >
                    {t('videoRendering.changeVideo', 'Change')}
                  </button>
                </div>
              ) : (
                <div className="upload-drop-zone">
                  <button
                    className="pill-button primary"
                    onClick={() => document.getElementById('video-upload-input').click()}
                  >
                    {t('videoRendering.selectVideo', 'Select Video File')}
                  </button>
                  <span className="drop-text">
                    {t('videoRendering.orDragDrop', 'or drag and drop here')}
                  </span>
                </div>
              )}
              <input
                id="video-upload-input"
                type="file"
                accept="video/*,audio/*"
                onChange={handleVideoUpload}
                style={{ display: 'none' }}
              />
            </div>

            {/* Subtitle Selection */}
            <div className="subtitle-selection-compact">
              <h4>{t('videoRendering.subtitleSource', 'Subtitle Source')}</h4>
              <div className="radio-group">
                <div className="radio-option">
                  <input
                    type="radio"
                    id="subtitle-original"
                    value="original"
                    checked={selectedSubtitles === 'original'}
                    onChange={(e) => setSelectedSubtitles(e.target.value)}
                    disabled={!subtitlesData || subtitlesData.length === 0}
                  />
                  <label htmlFor="subtitle-original">
                    {t('videoRendering.originalSubtitles', 'Original Subtitles')}
                    <span className="item-count">
                      ({subtitlesData ? subtitlesData.length : 0} {t('videoRendering.items', 'items')})
                    </span>
                  </label>
                </div>
                <div className="radio-option">
                  <input
                    type="radio"
                    id="subtitle-translated"
                    value="translated"
                    checked={selectedSubtitles === 'translated'}
                    onChange={(e) => setSelectedSubtitles(e.target.value)}
                    disabled={!translatedSubtitles || translatedSubtitles.length === 0}
                  />
                  <label htmlFor="subtitle-translated">
                    {t('videoRendering.translatedSubtitles', 'Translated Subtitles')}
                    <span className="item-count">
                      ({translatedSubtitles ? translatedSubtitles.length : 0} {t('videoRendering.items', 'items')})
                    </span>
                  </label>
                </div>
              </div>

              {/* Original Audio Volume Control */}
              <div className="compact-volume-control">
                <label className="volume-label">{t('videoRendering.originalAudioVolume', 'Original Audio Volume')}: {renderSettings.originalAudioVolume}%</label>
                <div className="volume-slider">
                  <div className="custom-slider-track">
                    <div
                      className="custom-slider-fill"
                      style={{ width: `${renderSettings.originalAudioVolume}%` }}
                    ></div>
                  </div>
                  <div
                    className="custom-slider-thumb"
                    style={{ left: `${renderSettings.originalAudioVolume}%` }}
                  ></div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={renderSettings.originalAudioVolume}
                    onChange={(e) => setRenderSettings(prev => ({ ...prev, originalAudioVolume: parseInt(e.target.value) }))}
                    className="custom-slider-input"
                  />
                </div>
              </div>
            </div>

            {/* Narration Selection */}
            <div className="narration-selection-compact">
              <h4>{t('videoRendering.narrationSource', 'Narration Audio')}</h4>
              <div className="radio-group">
                <div className="radio-option">
                  <input
                    type="radio"
                    id="narration-none"
                    value="none"
                    checked={selectedNarration === 'none'}
                    onChange={(e) => setSelectedNarration(e.target.value)}
                  />
                  <label htmlFor="narration-none">
                    {t('videoRendering.noNarration', 'No Narration')}
                  </label>
                </div>
                <div className="radio-option" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <input
                      type="radio"
                      id="narration-generated"
                      value="generated"
                      checked={selectedNarration === 'generated'}
                      onChange={(e) => setSelectedNarration(e.target.value)}
                      disabled={!isAlignedNarrationAvailable()}
                    />
                    <label htmlFor="narration-generated">
                      {isAlignedNarrationAvailable()
                        ? t('videoRendering.alignedNarration', 'Aligned Narration (ready)')
                        : (hasNarrationSegments()
                            ? t('videoRendering.narrationNotAligned', 'Narration not aligned')
                            : t('videoRendering.noNarrationGenerated', 'No narration generated')
                          )
                      }
                    </label>
                  </div>
                  {/* Refresh button for narration alignment - always visible, grayed out when not needed */}
                  <button
                    type="button"
                    className="pill-button secondary"
                    onClick={handleRefreshNarration}
                    disabled={isRefreshingNarration || isAlignedNarrationAvailable() || !hasNarrationSegments()}
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.8rem',
                      height: '28px',
                      minWidth: '28px',
                      flexShrink: 0,
                      opacity: (isAlignedNarrationAvailable() || !hasNarrationSegments()) ? 0.5 : 1,
                      animation: (!isAlignedNarrationAvailable() && hasNarrationSegments() && !isRefreshingNarration)
                        ? 'breathe 2s ease-in-out infinite'
                        : 'none'
                    }}
                    title={
                      isAlignedNarrationAvailable()
                        ? t('videoRendering.narrationAlreadyReady', 'Narration already aligned')
                        : (!hasNarrationSegments())
                          ? t('videoRendering.generateNarrationFirst', 'Generate narration first')
                          : t('videoRendering.refreshNarration', 'Click to align narration for video rendering')
                    }
                  >
                    {isRefreshingNarration ? (
                      <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" style={{ animation: 'rotate 1.5s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3"></circle>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Narration Volume Control */}
              <div className="compact-volume-control">
                <label className="volume-label">{t('videoRendering.narrationVolume', 'Narration Volume')}: {renderSettings.narrationVolume}%</label>
                <div className={`volume-slider ${selectedNarration === 'none' ? 'disabled' : ''}`}>
                  <div className="custom-slider-track">
                    <div
                      className="custom-slider-fill"
                      style={{ width: `${renderSettings.narrationVolume}%` }}
                    ></div>
                  </div>
                  <div
                    className="custom-slider-thumb"
                    style={{ left: `${renderSettings.narrationVolume}%` }}
                  ></div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={renderSettings.narrationVolume}
                    onChange={(e) => setRenderSettings(prev => ({ ...prev, narrationVolume: parseInt(e.target.value) }))}
                    className="custom-slider-input"
                    disabled={selectedNarration === 'none'}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Second row: Video Preview and Subtitle Customization side by side */}
          <div
            ref={containerRef}
            className="preview-customization-row"
            style={{
              '--left-panel-width': `${leftPanelWidth}%`,
              '--right-panel-width': `${100 - leftPanelWidth}%`
            }}
          >
            {/* Video Preview Panel */}
            <div
              className="video-preview-panel"
              style={{ flex: `0 0 ${leftPanelWidth}%` }}
              tabIndex={0}
            >
              <RemotionVideoPreview
                videoFile={selectedVideoFile}
                subtitles={getCurrentSubtitles()}
                narrationAudioUrl={isAlignedNarrationAvailable() ? window.alignedNarrationCache?.url : null}
                subtitleCustomization={{
                  ...subtitleCustomization,
                  resolution: renderSettings.resolution,
                  frameRate: renderSettings.frameRate
                }}
                originalAudioVolume={renderSettings.originalAudioVolume}
                narrationVolume={renderSettings.narrationVolume}
              />
            </div>

            {/* Resizable Divider */}
            <div
              className="panel-resizer"
              onMouseDown={handleMouseDown}
            ></div>

            {/* Subtitle Customization Panel */}
            <div
              className="customization-panel"
              style={{ flex: `0 0 ${100 - leftPanelWidth}%` }}
            >
              <SubtitleCustomizationPanel
                customization={subtitleCustomization}
                onChange={setSubtitleCustomization}
              />
            </div>
          </div>



          {/* Render Settings and Controls - compact single row */}
          <div className="rendering-row">
            <div className="row-label">
              <label>{t('videoRendering.resolution', 'Resolution')}</label>
            </div>
            <div className="row-content">
              <select
                value={renderSettings.resolution}
                onChange={(e) => setRenderSettings(prev => ({ ...prev, resolution: e.target.value }))}
                className="setting-select"
                style={{ marginRight: '1rem' }}
              >
                <option value="480p">480p</option>
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
                <option value="2K">2K</option>
              </select>

              <label style={{ marginRight: '0.5rem', fontWeight: '500', color: 'var(--text-primary)' }}>
                {t('videoRendering.frameRate', 'Frame Rate')}:
              </label>
              <select
                value={renderSettings.frameRate}
                onChange={(e) => setRenderSettings(prev => ({ ...prev, frameRate: parseInt(e.target.value) }))}
                className="setting-select"
                style={{ marginRight: '1rem' }}
              >
                <option value={30}>30 FPS</option>
                <option value={60}>60 FPS</option>
              </select>

              {!isRendering ? (
                <button
                  className="pill-button primary"
                  onClick={handleRender}
                  disabled={!selectedVideoFile || getCurrentSubtitles().length === 0}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  {(currentQueueItem || renderQueue.some(item => item.status === 'processing'))
                    ? t('videoRendering.addToQueue', 'Add to Queue')
                    : t('videoRendering.render', 'Render')
                  }
                </button>
              ) : (
                <button
                  className="pill-button cancel"
                  onClick={handleCancelRender}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="6" y="6" width="12" height="12"></rect>
                  </svg>
                  {t('videoRendering.cancel', 'Cancel')}
                </button>
              )}

            </div>
          </div>

          {/* Progress Display */}
          {(isRendering || renderProgress > 0) && (
            <div className="rendering-row">
              <div className="row-label">
                <label>{t('videoRendering.progress', 'Progress')}</label>
              </div>
              <div className="row-content">
                <div className="render-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${renderProgress}%` }}
                    ></div>
                  </div>
                  <div className="progress-text">
                    <span className="progress-status">{renderStatus}</span>
                    <span className="progress-percentage">{renderProgress}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="rendering-row">
              <div className="row-label">
                <label>{t('videoRendering.error', 'Error')}</label>
              </div>
              <div className="row-content">
                <div className="status-message error">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                  {error}
                </div>
              </div>
            </div>
          )}

          {/* Rendered Video Results */}
          {renderedVideoUrl && (
            <div className="rendering-row">
              <div className="row-label">
                <label>{t('videoRendering.result', 'Rendered Video')}</label>
              </div>
              <div className="row-content">
                <div className="video-result-content">
                  <video controls width="100%" style={{ maxWidth: '600px' }}>
                    <source src={renderedVideoUrl} type="video/mp4" />
                    {t('videoRendering.videoNotSupported', 'Your browser does not support the video tag.')}
                  </video>
                  <div className="video-actions">
                    <a
                      href={renderedVideoUrl}
                      download
                      className="pill-button primary"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      {t('videoRendering.download', 'Download Video')}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Queue Manager - always visible to match app aesthetics */}
          <div className="rendering-row">
            <div className="row-label">
              <label>{t('videoRendering.renderQueue', 'Render Queue')}</label>
            </div>
            <div className="row-content">
              <QueueManagerPanel
                queue={renderQueue}
                currentQueueItem={currentQueueItem}
                onRemoveItem={removeFromQueue}
                onClearQueue={clearQueue}
                onRetryItem={retryQueueItem}
                isExpanded={true}
                onToggle={() => {}}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoRenderingSection;
