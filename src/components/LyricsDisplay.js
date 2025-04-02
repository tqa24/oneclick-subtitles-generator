import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/LyricsDisplay.css';
import TimelineVisualization from './lyrics/TimelineVisualization';
import LyricItem from './lyrics/LyricItem';
import LyricsHeader from './lyrics/LyricsHeader';
import { useLyricsEditor } from '../hooks/useLyricsEditor';

const LyricsDisplay = ({ 
  matchedLyrics, 
  currentTime, 
  onLyricClick, 
  duration, 
  onUpdateLyrics, 
  allowEditing = false 
}) => {
  const { t } = useTranslation();
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  
  const {
    lyrics,
    isSticky,
    setIsSticky,
    isAtOriginalState,
    canUndo,
    handleUndo,
    handleReset,
    startDrag,
    handleDrag,
    endDrag,
    isDragging,
    getLastDragEnd
  } = useLyricsEditor(matchedLyrics, onUpdateLyrics);

  // Find current lyric index based on time
  const currentIndex = lyrics.findIndex((lyric, index) => {
    const nextLyric = lyrics[index + 1];
    return currentTime >= lyric.start && 
      (nextLyric ? currentTime < nextLyric.start : currentTime <= lyric.end);
  });

  // Setup drag event handlers
  const handleMouseDown = (e, index, field) => {
    e.preventDefault();
    e.stopPropagation();
    startDrag(index, field, e.clientX, lyrics[index][field]);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  const handleMouseMove = (e) => {
    e.preventDefault();
    handleDrag(e.clientX, duration);
  };
  
  const handleMouseUp = (e) => {
    e.preventDefault();
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    endDrag();
  };

  return (
    <div className="lyrics-display">
      <LyricsHeader 
        allowEditing={allowEditing}
        isSticky={isSticky}
        setIsSticky={setIsSticky}
        canUndo={canUndo}
        isAtOriginalState={isAtOriginalState}
        onUndo={handleUndo}
        onReset={handleReset}
        zoom={zoom}
        setZoom={setZoom}
        panOffset={panOffset}
        setPanOffset={setPanOffset}
      />
      
      <TimelineVisualization 
        lyrics={lyrics}
        currentTime={currentTime}
        duration={duration}
        onTimelineClick={onLyricClick}
        zoom={zoom}
        panOffset={panOffset}
        setPanOffset={setPanOffset}
      />
      
      <div className="lyrics-container">
        {lyrics.map((lyric, index) => (
          <LyricItem
            key={index}
            lyric={lyric}
            index={index}
            isCurrentLyric={index === currentIndex}
            currentTime={currentTime}
            allowEditing={allowEditing}
            isDragging={isDragging}
            onLyricClick={onLyricClick}
            onMouseDown={handleMouseDown}
            getLastDragEnd={getLastDragEnd}
          />
        ))}
      </div>
      
      {allowEditing && (
        <div className="help-text">
          <p>{t('lyrics.timingInstructions')}</p>
        </div>
      )}
    </div>
  );
};

export default LyricsDisplay;