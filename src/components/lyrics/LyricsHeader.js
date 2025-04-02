import React from 'react';
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

  return (
    <div className="lyrics-header">
      <div className="zoom-controls">
        <button 
          onClick={() => setZoom(Math.max(1, zoom / 1.5))}
          disabled={zoom <= 1}
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
            setZoom(1);
            setPanOffset(0);
          }}
          disabled={zoom === 1 && panOffset === 0}
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