import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const LyricsHeader = ({
  allowEditing,
  isSticky,
  setIsSticky,
  canUndo,
  canRedo,
  isAtOriginalState,
  onUndo,
  onRedo,
  onReset,
  zoom,
  setZoom
}) => {
  const { t } = useTranslation();
  const durationRef = useRef(0);

  // Zoom drag functionality with increased sensitivity
  const handleZoomDragStart = (e) => {
    e.preventDefault();

    const startX = e.clientX;
    const startZoom = zoom;
    const minZoom = calculateMinZoom(durationRef.current);

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      // Increased sensitivity by using deltaX / 50 instead of deltaX / 100
      const newZoom = Math.max(minZoom, Math.min(100, startZoom + (deltaX / 10)));
      setZoom(newZoom);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Calculate minimum zoom level based on duration to limit view to 300 seconds
  const calculateMinZoom = (duration) => {
    if (!duration || duration <= 300) return 1;
    return duration / 300; // Ensure max visible time is 300 seconds
  };

  // Get current video duration from the video element
  useEffect(() => {
    const videoElement = document.querySelector('video');
    if (videoElement) {
      const updateDuration = () => {
        if (videoElement.duration && !isNaN(videoElement.duration)) {
          durationRef.current = videoElement.duration;

          // Enforce minimum zoom level when duration changes
          const minZoom = calculateMinZoom(durationRef.current);
          if (zoom < minZoom) {
            setZoom(minZoom);
          }
        }
      };

      // Update duration when metadata is loaded
      videoElement.addEventListener('loadedmetadata', updateDuration);

      // Check if duration is already available
      if (videoElement.duration && !isNaN(videoElement.duration)) {
        updateDuration();
      }

      return () => {
        videoElement.removeEventListener('loadedmetadata', updateDuration);
      };
    }
  }, [zoom, setZoom]);

  return (
    <div className="timeline-controls-container">
      <div className="combined-controls">
        {allowEditing && (
          <div className="editing-controls">
            <label className="sticky-toggle">
              <input
                type="checkbox"
                checked={isSticky}
                onChange={(e) => setIsSticky(e.target.checked)}
              />
              <span>{t('lyrics.stickyTimingsToggleShort', 'Stick')}</span>
            </label>

            <button
              className="undo-btn"
              onClick={onUndo}
              disabled={!canUndo}
              title={t('common.undo', 'Undo')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M3 10h10a4 4 0 0 1 4 4v0a4 4 0 0 1-4 4H3"></path>
                <polyline points="3 10 9 4 3 10 9 16"></polyline>
              </svg>
            </button>

            <button
              className="redo-btn"
              onClick={onRedo}
              disabled={!canRedo}
              title={t('common.redo', 'Redo')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M21 10h-10a4 4 0 0 0-4 4v0a4 4 0 0 0 4 4h10"></path>
                <polyline points="21 10 15 4 21 10 15 16"></polyline>
              </svg>
            </button>

            <button
              className="reset-btn"
              onClick={onReset}
              disabled={isAtOriginalState}
              title={t('common.reset', 'Reset')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M21 12a9 9 0 0 1-9 9c-4.97 0-9-4.03-9-9s4.03-9 9-9h4.5"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
              </svg>
            </button>
          </div>
        )}

        <div className="zoom-controls">
          <div
            className="zoom-slider"
            title={t('timeline.dragToZoom', 'Drag to adjust zoom')}
          >
            <div
              className="zoom-handle"
              onMouseDown={handleZoomDragStart}
            >
              <span>{Math.round(zoom * 100)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline container will be inserted here by LyricsDisplay */}
      <div className="timeline-placeholder"></div>
    </div>
  );
};

export default LyricsHeader;