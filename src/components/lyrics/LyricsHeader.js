import React from 'react';
import { useTranslation } from 'react-i18next';

const LyricsHeader = ({ 
  allowEditing,
  isSticky,
  setIsSticky,
  canUndo,
  isAtOriginalState,
  onUndo,
  onReset
}) => {
  const { t } = useTranslation();

  return (
    <div className="lyrics-header">
      <h3>{t('lyrics.synchronizedLyrics', 'Synchronized Lyrics')}</h3>
      
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