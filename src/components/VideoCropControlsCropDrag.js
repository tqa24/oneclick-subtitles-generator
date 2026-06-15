import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Owns the crop-rectangle drag interaction: drag state, the working `tempCrop`
 * (in display space), and the aspect-ratio-aware resize math for all 8
 * corner/edge handles.
 *
 * @param {Object} params
 * @param {Object} params.cropAreaRef - ref to the crop overlay element (shared with parent).
 * @param {number|string|null} params.selectedAspectRatio - active aspect ratio constraint.
 * @param {Object} params.videoDimensions - { width, height } of the source video.
 * @param {Function} params.onCropChange - called with the logical crop on drag end.
 * @param {Function} params.fromDisplayCrop - maps display-space crop -> logical crop.
 * @param {Object} params.initialCrop - initial crop value for `tempCrop`.
 *
 * Returns { tempCrop, setTempCrop, isDragging, dragType, handlers: { handleMouseDown } }.
 */
export default function useCropDrag({
  cropAreaRef,
  selectedAspectRatio,
  videoDimensions,
  onCropChange,
  fromDisplayCrop,
  initialCrop,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [tempCrop, setTempCrop] = useState(initialCrop);

  const dragBaseRectRef = useRef(null);
  const dragBaseCropRef = useRef(null);

  const handleMouseDown = (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragType(type);
    setDragStart({ x: e.clientX, y: e.clientY });
    // Capture base rect and base crop to make deltas stable even if preview resizes during drag
    if (cropAreaRef.current) {
      dragBaseRectRef.current = cropAreaRef.current.getBoundingClientRect();
    }
    dragBaseCropRef.current = { ...tempCrop };
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !dragType || !cropAreaRef.current) return;

    const baseRect = dragBaseRectRef.current || cropAreaRef.current.getBoundingClientRect();
    const baseCrop = dragBaseCropRef.current || tempCrop;
    const deltaX = ((e.clientX - dragStart.x) / baseRect.width) * 100;
    const deltaY = ((e.clientY - dragStart.y) / baseRect.height) * 100;

    let newCrop = { ...tempCrop };

    switch (dragType) {

      case 'nw':
        if (selectedAspectRatio && selectedAspectRatio !== 'custom' && selectedAspectRatio !== null) {
          // For aspect ratio, use the dominant movement direction
          const aspectRatio = selectedAspectRatio;
          const videoAspect = videoDimensions.width / videoDimensions.height;

          // Determine which direction moved more
          const absDeltaX = Math.abs(deltaX);
          const absDeltaY = Math.abs(deltaY);

          if (absDeltaX > absDeltaY) {
            // X movement is dominant
            newCrop.x = baseCrop.x + deltaX;
            newCrop.width = baseCrop.x + baseCrop.width - newCrop.x;
            // Calculate height based on aspect ratio
            newCrop.height = newCrop.width / aspectRatio * videoAspect;
            newCrop.y = baseCrop.y + baseCrop.height - newCrop.height;
          } else {
            // Y movement is dominant
            newCrop.y = baseCrop.y + deltaY;
            newCrop.height = baseCrop.y + baseCrop.height - newCrop.y;
            // Calculate width based on aspect ratio
            newCrop.width = newCrop.height * aspectRatio / videoAspect;
            newCrop.x = baseCrop.x + baseCrop.width - newCrop.width;
          }


        } else {
          // Free resize
          newCrop.x = baseCrop.x + deltaX;
          newCrop.y = baseCrop.y + deltaY;
          newCrop.width = baseCrop.x + baseCrop.width - newCrop.x;
          newCrop.height = baseCrop.y + baseCrop.height - newCrop.y;
        }
        break;

      case 'ne':
        if (selectedAspectRatio && selectedAspectRatio !== 'custom' && selectedAspectRatio !== null) {
          const aspectRatio = selectedAspectRatio;
          const videoAspect = videoDimensions.width / videoDimensions.height;

          const absDeltaX = Math.abs(deltaX);
          const absDeltaY = Math.abs(deltaY);

          if (absDeltaX > absDeltaY) {
            // X movement is dominant
            newCrop.width = baseCrop.width + deltaX;
            newCrop.x = baseCrop.x;
            // Calculate height based on aspect ratio
            newCrop.height = newCrop.width / aspectRatio * videoAspect;
            newCrop.y = baseCrop.y + baseCrop.height - newCrop.height;
          } else {
            // Y movement is dominant
            newCrop.y = baseCrop.y + deltaY;
            newCrop.height = baseCrop.y + baseCrop.height - newCrop.y;
            // Calculate width based on aspect ratio
            newCrop.width = newCrop.height * aspectRatio / videoAspect;
            newCrop.x = baseCrop.x;
          }
        } else {
          // Free resize
          newCrop.x = baseCrop.x;
          newCrop.y = baseCrop.y + deltaY;
          newCrop.width = baseCrop.width + deltaX;
          newCrop.height = baseCrop.y + baseCrop.height - newCrop.y;
        }
        break;

      case 'sw':
        if (selectedAspectRatio && selectedAspectRatio !== 'custom' && selectedAspectRatio !== null) {
          const aspectRatio = selectedAspectRatio;
          const videoAspect = videoDimensions.width / videoDimensions.height;

          const absDeltaX = Math.abs(deltaX);
          const absDeltaY = Math.abs(deltaY);

          if (absDeltaX > absDeltaY) {
            // X movement is dominant
            newCrop.x = baseCrop.x + deltaX;
            newCrop.width = baseCrop.x + baseCrop.width - newCrop.x;
            // Calculate height based on aspect ratio
            newCrop.height = newCrop.width / aspectRatio * videoAspect;
            newCrop.y = baseCrop.y;
          } else {
            // Y movement is dominant
            newCrop.height = baseCrop.height + deltaY;
            newCrop.y = baseCrop.y;
            // Calculate width based on aspect ratio
            newCrop.width = newCrop.height * aspectRatio / videoAspect;
            newCrop.x = baseCrop.x + baseCrop.width - newCrop.width;
          }


        } else {
          // Free resize
          newCrop.x = baseCrop.x + deltaX;
          newCrop.y = baseCrop.y;
          newCrop.width = baseCrop.x + baseCrop.width - newCrop.x;
          newCrop.height = baseCrop.height + deltaY;
        }
        break;

      case 'se':
        if (selectedAspectRatio && selectedAspectRatio !== 'custom' && selectedAspectRatio !== null) {
          const aspectRatio = selectedAspectRatio;
          const videoAspect = videoDimensions.width / videoDimensions.height;

          const absDeltaX = Math.abs(deltaX);
          const absDeltaY = Math.abs(deltaY);

          if (absDeltaX > absDeltaY) {
            // X movement is dominant
            newCrop.width = baseCrop.width + deltaX;
            // Calculate height based on aspect ratio
            newCrop.height = newCrop.width / aspectRatio * videoAspect;
            newCrop.x = baseCrop.x;
            newCrop.y = baseCrop.y;
          } else {
            // Y movement is dominant
            newCrop.height = baseCrop.height + deltaY;
            // Calculate width based on aspect ratio
            newCrop.width = newCrop.height * aspectRatio / videoAspect;
            newCrop.x = baseCrop.x;
            newCrop.y = baseCrop.y;
          }


        } else {
          // Free resize
          newCrop.x = baseCrop.x;
          newCrop.y = baseCrop.y;
          newCrop.width = baseCrop.width + deltaX;
          newCrop.height = baseCrop.height + deltaY;
        }
        break;

      case 'n':
        if (typeof selectedAspectRatio === 'number') {
          const aspectRatio = selectedAspectRatio;
          const videoAspect = videoDimensions.width / videoDimensions.height;
          const centerX = baseCrop.x + baseCrop.width / 2;
          const newHeight = baseCrop.height - deltaY;
          const newWidth = newHeight * aspectRatio / videoAspect;
          newCrop.y = baseCrop.y + deltaY;
          newCrop.height = newHeight;
          newCrop.width = newWidth;
          newCrop.x = centerX - newWidth / 2;
        } else {
          newCrop.x = baseCrop.x;
          newCrop.y = baseCrop.y + deltaY;
          newCrop.width = baseCrop.width;
          newCrop.height = baseCrop.y + baseCrop.height - newCrop.y;
        }
        break;

      case 's':
        if (typeof selectedAspectRatio === 'number') {
          const aspectRatio = selectedAspectRatio;
          const videoAspect = videoDimensions.width / videoDimensions.height;
          const centerX = baseCrop.x + baseCrop.width / 2;
          const newHeight = baseCrop.height + deltaY;
          const newWidth = newHeight * aspectRatio / videoAspect;
          newCrop.y = baseCrop.y;
          newCrop.height = newHeight;
          newCrop.width = newWidth;
          newCrop.x = centerX - newWidth / 2;
        } else {
          newCrop.x = baseCrop.x;
          newCrop.y = baseCrop.y;
          newCrop.width = baseCrop.width;
          newCrop.height = baseCrop.height + deltaY;
        }
        break;

      case 'e':
        if (typeof selectedAspectRatio === 'number') {
          const aspectRatio = selectedAspectRatio;
          const videoAspect = videoDimensions.width / videoDimensions.height;
          const centerY = baseCrop.y + baseCrop.height / 2;
          const newWidth = baseCrop.width + deltaX;
          const newHeight = newWidth / aspectRatio * videoAspect;
          newCrop.x = baseCrop.x;
          newCrop.width = newWidth;
          newCrop.height = newHeight;
          newCrop.y = centerY - newHeight / 2;
        } else {
          newCrop.x = baseCrop.x;
          newCrop.y = baseCrop.y;
          newCrop.width = baseCrop.width + deltaX;
          newCrop.height = baseCrop.height;
        }
        break;

      case 'w':
        if (typeof selectedAspectRatio === 'number') {
          const aspectRatio = selectedAspectRatio;
          const videoAspect = videoDimensions.width / videoDimensions.height;
          const centerY = baseCrop.y + baseCrop.height / 2;
          const newWidth = baseCrop.width - deltaX;
          const newHeight = newWidth / aspectRatio * videoAspect;
          newCrop.x = baseCrop.x + deltaX;
          newCrop.width = newWidth;
          newCrop.height = newHeight;
          newCrop.y = centerY - newHeight / 2;
        } else {
          newCrop.x = baseCrop.x + deltaX;
          newCrop.y = baseCrop.y;
          newCrop.width = baseCrop.x + baseCrop.width - newCrop.x;
          newCrop.height = baseCrop.height;
        }
        break;

      default:
        break;
    }

    // Ensure minimum size
    newCrop.width = Math.max(10, newCrop.width);
    newCrop.height = Math.max(10, newCrop.height);

    setTempCrop(newCrop);
  }, [isDragging, dragType, dragStart, tempCrop, selectedAspectRatio, videoDimensions, cropAreaRef]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setDragType(null);
      // Convert display-space crop back to logical crop for consumers
      onCropChange(fromDisplayCrop(tempCrop));
    }
  }, [isDragging, tempCrop, onCropChange, fromDisplayCrop]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = (dragType === 'n' || dragType === 's')
        ? 'ns-resize'
        : (dragType === 'e' || dragType === 'w')
          ? 'ew-resize'
          : 'nwse-resize';
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
  }, [isDragging, handleMouseMove, handleMouseUp, dragType]);

  return {
    tempCrop,
    setTempCrop,
    isDragging,
    dragType,
    handlers: { handleMouseDown },
  };
}
