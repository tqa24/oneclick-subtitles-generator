import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import SubtitleSplitModal from './SubtitleSplitModal';

const LyricsHeader = ({
  allowEditing,
  isSticky,
  setIsSticky,
  canUndo,
  canRedo,
  canJumpToCheckpoint,
  isAtOriginalState,
  isAtSavedState,
  onUndo,
  onRedo,
  onReset,
  onJumpToCheckpoint,
  onSave,
  autoScrollEnabled,
  setAutoScrollEnabled,
  lyrics,
  onSplitSubtitles
}) => {
  const { t } = useTranslation();
  const [showSplitModal, setShowSplitModal] = useState(false);

  // Global keyboard shortcuts for editor actions
  useEffect(() => {
    const shouldIgnore = (e) => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      const editable = el.isContentEditable;
      return editable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const onKeyDown = (e) => {
      if (!allowEditing) return;
      if (shouldIgnore(e)) return;

      // Normalize key
      const key = e.key.toLowerCase();
      const isCtrl = e.ctrlKey || e.metaKey; // support Cmd on macOS

      // Undo: Ctrl+Z
      if (isCtrl && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo && typeof onUndo === 'function') onUndo();
        return;
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((isCtrl && key === 'y') || (isCtrl && key === 'z' && e.shiftKey)) {
        e.preventDefault();
        if (canRedo && typeof onRedo === 'function') onRedo();
        return;
      }

      // Save: Ctrl+S
      if (isCtrl && key === 's') {
        e.preventDefault();
        if (typeof onSave === 'function') onSave();
        return;
      }

      // Open Split modal: Ctrl+Shift+X
      if (isCtrl && e.shiftKey && key === 'x') {
        e.preventDefault();
        setShowSplitModal(true);
        return;
      }

      // Jump to checkpoint: Ctrl+J
      if (isCtrl && key === 'j') {
        e.preventDefault();
        if (canJumpToCheckpoint && typeof onJumpToCheckpoint === 'function') onJumpToCheckpoint();
        return;
      }

      // Toggle sticky timings: Ctrl+Shift+T
      if (isCtrl && e.shiftKey && key === 't') {
        e.preventDefault();
        if (typeof setIsSticky === 'function') setIsSticky(!isSticky);
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [allowEditing, canUndo, canRedo, canJumpToCheckpoint, onUndo, onRedo, onSave, onJumpToCheckpoint, setIsSticky, isSticky]);

  return (
    <div className="combined-controls">
      {/* First row for auto-scroll and sticky toggle */}
      <div className="controls-top-row">
        {/* Auto-scroll toggle switch */}
        <div
          className={`auto-scroll-toggle ${autoScrollEnabled ? 'active' : ''}`}
          onClick={() => setAutoScrollEnabled(!autoScrollEnabled)}
          title={autoScrollEnabled ? t('lyrics.autoScrollDisable', 'Disable auto-scroll') : t('lyrics.autoScrollEnable', 'Enable auto-scroll')}
        >
          {autoScrollEnabled ? (
            <svg className="auto-scroll-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
              <path d="M12 2v20"/>
              <path d="m19 15-7 7-7-7"/>
              <path d="m19 9-7-7-7 7"/>
            </svg>
          ) : (
            <svg className="auto-scroll-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
              <path d="M9 9h6v6h-6z"/>
              <path d="M21 3H3v18h18V3z"/>
            </svg>
          )}
          <span>{t('lyrics.autoScroll', 'Cuộn')}</span>
        </div>

        {allowEditing && (
          <div
            className={`sticky-toggle ${isSticky ? 'active' : ''}`}
            onClick={() => setIsSticky(!isSticky)}
            title={t('lyrics.stickyTimingsToggleWithShortcut', isSticky ? 'Disable sticky timings (Ctrl+Shift+T)' : 'Enable sticky timings (Ctrl+Shift+T)')}
          >
            {isSticky ? (
              <svg className="sticky-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
            ) : (
              <svg className="sticky-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
                <path d="M6 8a4 4 0 0 1 0 8 4 4 0 0 1 0-8"/>
                <path d="M18 8a4 4 0 0 0 0 8 4 4 0 0 0 0-8"/>
              </svg>
            )}
            <span>{t('lyrics.stickyTimingsToggle', 'Dính')}</span>
          </div>
        )}
      </div>

      {/* Second row for save and reset buttons */}
      <div className="controls-middle-row">
        {allowEditing && (
          <div className="middle-row-buttons">
            <button
              className="split-sub-btn"
              onClick={() => setShowSplitModal(true)}
              title={t('lyrics.splitWithShortcut', 'Split subtitles (Ctrl+Shift+X)')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                {/* Left rectangle (before cut) */}
                <path d="M2 8L8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 16L8 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 8L2 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                
                {/* Right rectangle (after cut) */}
                <path d="M16 8L22 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 16L22 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 8L22 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                
                {/* Vertical cutting line (knife) */}
                <path d="M12 4L12 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <button
              className="lyrics-save-btn"
              onClick={onSave}
              disabled={isAtSavedState}
              title={isAtSavedState ? t('common.saveDisabled', 'No changes to save') : t('common.saveWithShortcut', 'Save (Ctrl+S)')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
            </button>

            <button
              className="reset-btn"
              onClick={onReset}
              disabled={isAtSavedState}
              title={t('common.resetWithShortcut', 'Reset to saved state')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" preserveAspectRatio="xMidYMid meet">
                <path d="M23 4v6h-6"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Third row for undo and redo buttons */}
      <div className="controls-bottom-row">
        {allowEditing && (
          <div className="bottom-row-buttons">
            <button
              className="checkpoint-btn"
              onClick={onJumpToCheckpoint}
              disabled={!canJumpToCheckpoint}
              title={t('common.jumpToCheckpointWithShortcut', 'Jump to last checkpoint (Ctrl+J)')}
            >
              {/* Flag with curved arrow icon - active */}
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                <path d="M3 5V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 5H14L11 8L14 11H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 13C21 15.5 18.5 18 15 18H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M13 20L11 18L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              
              {/* Clock with reverse arrow icon - alternative (commented out) */}
              {/* <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                <path d="M10 9V12H12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5 12C5 15.866 8.13401 19 12 19C15.866 19 19 15.866 19 12C19 8.13401 15.866 5 12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4"/>
                <path d="M5 12V7L7 8L5 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg> */}
            </button>
            
            <button
              className="undo-btn"
              onClick={onUndo}
              disabled={!canUndo}
              title={t('common.undoWithShortcut', 'Undo (Ctrl+Z)')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M3 10h10c4.42 0 8 3.58 8 8v2M3 10l6-6M3 10l6 6"/>
              </svg>
            </button>

            <button
              className="redo-btn"
              onClick={onRedo}
              disabled={!canRedo}
              title={t('common.redoWithShortcut', 'Redo (Ctrl+Y or Ctrl+Shift+Z)')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M21 10h-10c-4.42 0-8 3.58-8 8v2M21 10l-6-6M21 10l-6 6"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Subtitle Split Modal */}
      <SubtitleSplitModal
        isOpen={showSplitModal}
        onClose={() => setShowSplitModal(false)}
        lyrics={lyrics}
        onSplitSubtitles={onSplitSubtitles}
      />
    </div>
  );
};

export default LyricsHeader;