import { useState, useRef, useEffect } from 'react';

/**
 * Drag-drop handlers + selected-video-file state for the video rendering section.
 *
 * @returns {{
 *   isDragging: boolean,
 *   selectedVideoFile: any,
 *   setSelectedVideoFile: Function,
 *   handleVideoUpload: Function,
 *   handleDragEnter: Function,
 *   handleDragLeave: Function,
 *   handleDragOver: Function,
 *   handleDrop: Function,
 * }}
 */
export const useVideoUpload = () => {
  const [selectedVideoFile, setSelectedVideoFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // Handle video file upload
  const handleVideoUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedVideoFile(file);
    }
  };

  // Drag and drop handlers (robust: use counter + global cleanup to avoid stuck overlay)
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Increment counter for nested dragenter/dragleave events
    dragCounterRef.current = (dragCounterRef.current || 0) + 1;
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Decrement counter and only clear when no more entered elements remain
    dragCounterRef.current = Math.max(0, (dragCounterRef.current || 0) - 1);
    if (dragCounterRef.current === 0) {
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
    // Reset counter and dragging state on drop
    dragCounterRef.current = 0;
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      const videoFile = files.find(file => file.type && file.type.startsWith && file.type.startsWith('video/'));
      if (videoFile) {
        setSelectedVideoFile(videoFile);
      }
    }
  };

  // Ensure overlay is cleared if drag ends outside the component or window
  useEffect(() => {
    const onWindowDragEnd = () => {
      dragCounterRef.current = 0;
      setIsDragging(false);
    };
    const onWindowDrop = () => {
      dragCounterRef.current = 0;
      setIsDragging(false);
    };

    window.addEventListener('dragend', onWindowDragEnd);
    window.addEventListener('drop', onWindowDrop);

    return () => {
      window.removeEventListener('dragend', onWindowDragEnd);
      window.removeEventListener('drop', onWindowDrop);
    };
  }, []);

  return {
    isDragging,
    selectedVideoFile,
    setSelectedVideoFile,
    handleVideoUpload,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
};

export default useVideoUpload;
