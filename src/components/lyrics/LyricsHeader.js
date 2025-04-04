import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const LyricsHeader = ({
  allowEditing,
  isSticky,
  setIsSticky,
  canUndo,
  isAtOriginalState,
  onUndo,
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

  return (
    <div className="lyrics-header">
      <div className="zoom-controls">
        <button
          onClick={() => {
            const minZoom = calculateMinZoom(durationRef.current);
            setZoom(Math.max(minZoom, zoom / 1.5));
          }}
          disabled={zoom <= calculateMinZoom(durationRef.current)}
          title={t('timeline.zoomOut', 'Zoom out')}
        >
          -
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom(Math.min(50, zoom * 1.5))}
          disabled={zoom >= 50}
          title={t('timeline.zoomIn', 'Zoom in')}
        >
          +
        </button>
        <button
          onClick={() => {
            const minZoom = calculateMinZoom(durationRef.current);
            setZoom(minZoom);
            setPanOffset(0);
          }}
          disabled={(zoom === calculateMinZoom(durationRef.current)) && panOffset === 0}
          title={t('timeline.resetZoom', 'Reset zoom')}
        >
          Reset
        </button>
      </div>

      {allowEditing && (
        <div className="editing-controls">
          <label className="sticky-toggle">
            <input
              type="checkbox"
              checked={isSticky}
              onChange={(e) => setIsSticky(e.target.checked)}
            />
            <span>{t('lyrics.stickyTimingsToggle', 'Sticky Timings')}</span>
          </label>

          <button
            className="undo-btn"
            onClick={onUndo}
            disabled={!canUndo}
          >
            {t('common.undo', 'Undo')}
          </button>

          <button
            className="reset-btn"
            onClick={onReset}
            disabled={isAtOriginalState}
          >
            {t('common.reset', 'Reset')}
          </button>
        </div>
      )}
    </div>
  );
};

export default LyricsHeader;