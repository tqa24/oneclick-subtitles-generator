import React, { useState, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';

const LyricItem = ({
  lyric,
  index,
  isCurrentLyric,
  currentTime,
  allowEditing,
  isDragging,
  onLyricClick,
  onMouseDown,
  getLastDragEnd,
  onDelete,
  onTextEdit,
  onInsert,
  onMerge,
  hasNextLyric
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(lyric.text);
  const [showInsertButton, setShowInsertButton] = useState(false);
  const textInputRef = useRef(null);

  const handleEditClick = (e) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditText(lyric.text);
    setTimeout(() => textInputRef.current?.focus(), 0);
  };

  const handleTextSubmit = () => {
    if (editText.trim() !== lyric.text) {
      onTextEdit(index, editText.trim());
    }
    setIsEditing(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleTextSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditText(lyric.text);
    }
  };

  return (
    <div
      className="lyric-item-container"
      onMouseEnter={() => setShowInsertButton(true)}
      onMouseLeave={() => setShowInsertButton(false)}
    >
      <div
        data-lyric-index={index}
        className={`lyric-item ${isCurrentLyric ? 'current' : ''}`}
        onClick={(e) => {
          if (Date.now() - getLastDragEnd() < 100) {
            return;
          }
          onLyricClick(lyric.start);
        }}
      >
        <div className="lyric-content">
          {allowEditing && (
            <div className="lyric-controls">
              <button
                className="edit-lyric-btn"
                onClick={handleEditClick}
                title={t('lyrics.editTooltip')}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button
                className="delete-lyric-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(index);
                }}
                title={t('lyrics.deleteTooltip')}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          )}

          <div className="lyric-text">
            {isEditing ? (
              <input
                ref={textInputRef}
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={handleTextSubmit}
                onKeyDown={handleKeyPress}
                className="lyric-text-input"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span onClick={(e) => {
                e.stopPropagation(); // Stop propagation to prevent double click handling
                if (!isEditing) {
                  onLyricClick(lyric.start);
                }
              }}>{lyric.text}</span>
            )}
          </div>

          {allowEditing && (
            <div className="timing-controls">
              <span
                className={`time-control start-time ${isDragging(index, 'start') ? 'dragging' : ''}`}
                onMouseDown={(e) => onMouseDown(e, index, 'start')}
              >
                {lyric.start.toFixed(2)}s
              </span>

              <span className="time-separator">-</span>

              <span
                className={`time-control end-time ${isDragging(index, 'end') ? 'dragging' : ''}`}
                onMouseDown={(e) => onMouseDown(e, index, 'end')}
              >
                {lyric.end.toFixed(2)}s
              </span>
            </div>
          )}
        </div>

        {isCurrentLyric && (
          <div
            className="progress-indicator"
            style={{
              width: '100%',
              transform: `scaleX(${Math.min(1, Math.max(0, (currentTime - lyric.start) / (lyric.end - lyric.start)))})`
            }}
          />
        )}
      </div>

      {allowEditing && hasNextLyric && showInsertButton && (
        <div className="between-lyrics-controls">
          <div
            className="insert-lyric-button"
            onClick={(e) => {
              e.stopPropagation();
              onInsert(index);
            }}
            title={t('lyrics.insertTooltip')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </div>

          <div
            className="merge-lyrics-button"
            onClick={(e) => {
              e.stopPropagation();
              onMerge(index);
            }}
            title={t('lyrics.mergeTooltip')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
              <path d="M8 18h8M8 6h8M12 2v20"/>
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

// Use memo to prevent unnecessary re-renders
const MemoizedLyricItem = memo(LyricItem, (prevProps, nextProps) => {
  // Only re-render if these props change
  if (prevProps.isCurrentLyric !== nextProps.isCurrentLyric) return false;
  if (prevProps.isCurrentLyric && prevProps.currentTime !== nextProps.currentTime) return false;
  if (prevProps.lyric !== nextProps.lyric) return false;
  if (prevProps.isDragging !== nextProps.isDragging) return false;
  if (prevProps.showInsertButton !== nextProps.showInsertButton) return false;
  if (prevProps.isEditing !== nextProps.isEditing) return false;

  // Don't re-render for other prop changes
  return true;
});

export default MemoizedLyricItem;