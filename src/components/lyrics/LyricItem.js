import React from 'react';

const LyricItem = ({ 
  lyric, 
  index, 
  isCurrentLyric, 
  currentTime,
  allowEditing,
  isDragging,
  onLyricClick,
  onMouseDown,
  getLastDragEnd
}) => {
  return (
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
        <div className="lyric-text">
          <span>{lyric.text}</span>
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
            width: `${Math.min(100, Math.max(0, ((currentTime - lyric.start) / (lyric.end - lyric.start)) * 100))}%`
          }}
        />
      )}
    </div>
  );
};

export default LyricItem;