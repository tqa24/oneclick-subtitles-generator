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
  setZoom,
  panOffset,
  setPanOffset
}) => {
  const { t } = useTranslation();
  const durationRef = useRef(0);

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

  // Set initial zoom level when component mounts
  useEffect(() => {
    const videoElement = document.querySelector('video');
    if (videoElement && videoElement.duration && !isNaN(videoElement.duration)) {
      durationRef.current = videoElement.duration;
      const minZoom = calculateMinZoom(durationRef.current);
      setZoom(minZoom);
    }
  }, [setZoom]);

  return (
    <div className="combined-controls">
      {/* Top row for editing controls */}
      <div className="controls-top-row">
        {allowEditing && (
          <div className="editing-controls">
            <button
              className="undo-btn"
              onClick={onUndo}
              disabled={!canUndo}
              title={t('common.undo', 'Undo')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M3 10h10c4.42 0 8 3.58 8 8v2M3 10l6-6M3 10l6 6"/>
              </svg>
            </button>

            <button
              className="redo-btn"
              onClick={onRedo}
              disabled={!canRedo}
              title={t('common.redo', 'Redo')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M21 10h-10c-4.42 0-8 3.58-8 8v2M21 10l-6-6M21 10l-6 6"/>
              </svg>
            </button>

            <button
              className="reset-btn"
              onClick={onReset}
              disabled={isAtOriginalState}
              title={t('common.reset', 'Reset')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" preserveAspectRatio="xMidYMid meet">
                <path d="M23 4v6h-6"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Bottom row for zoom controls and sticky toggle */}
      <div className="controls-bottom-row">
      <div className="zoom-controls">
          <div
            className="zoom-slider"
            title={t('timeline.dragToZoom', 'Drag to zoom')}
            onMouseDown={(e) => {
              const startX = e.clientX;
              const startZoom = zoom;
              const minZoom = calculateMinZoom(durationRef.current);

              const handleMouseMove = (moveEvent) => {
                const deltaX = moveEvent.clientX - startX;
                // Increased sensitivity for more responsive zooming
                // Increased maximum zoom level from 50 to 200 for more detailed view
                const newZoom = Math.max(minZoom, Math.min(200, startZoom + (deltaX * 0.05)));
                setZoom(newZoom);
              };

              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };

              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          >
            <span>{Math.round(zoom * 100)}%</span>
          </div>
        </div>
        {allowEditing && (
          <label className="sticky-toggle">
            <input
              type="checkbox"
              checked={isSticky}
              onChange={(e) => setIsSticky(e.target.checked)}
            />
            <span>{t('lyrics.stickyTimingsToggle', 'Stick')}</span>
          </label>
        )}


      </div>
    </div>
  );
};

export default LyricsHeader;