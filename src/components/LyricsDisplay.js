import React, { useState, useRef, useEffect } from 'react';
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
  const [centerTimelineAt, setCenterTimelineAt] = useState(null);
  const lyricsContainerRef = useRef(null);
  const lastTimeRef = useRef(currentTime); // Track the last currentTime value

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
    getLastDragEnd,
    handleDeleteLyric,
    handleTextEdit,
    handleInsertLyric
  } = useLyricsEditor(matchedLyrics, onUpdateLyrics);

  // Find current lyric index based on time
  const currentIndex = lyrics.findIndex((lyric, index) => {
    const nextLyric = lyrics[index + 1];
    return currentTime >= lyric.start &&
      (nextLyric ? currentTime < nextLyric.start : currentTime <= lyric.end);
  });

  // Auto-scroll to the current lyric with accurate positioning
  useEffect(() => {
    if (currentIndex >= 0 && lyricsContainerRef.current) {
      const container = lyricsContainerRef.current;
      const lyricElement = container.children[currentIndex];

      if (lyricElement) {
        // Get precise measurements of the container and element
        const containerRect = container.getBoundingClientRect();
        const elementRect = lyricElement.getBoundingClientRect();

        // Calculate relative positions
        const containerScrollTop = container.scrollTop;
        const elementRelativeTop = elementRect.top - containerRect.top + containerScrollTop;

        // Calculate the ideal scroll position to center the current lyric
        const idealScrollTop = elementRelativeTop - (containerRect.height / 2) + (elementRect.height / 2);

        // Only scroll if the element is not already in view with some margin
        const margin = containerRect.height * 0.2; // 20% margin
        const isInView = (
          elementRelativeTop >= containerScrollTop + margin &&
          elementRelativeTop + elementRect.height <= containerScrollTop + containerRect.height - margin
        );

        if (!isInView) {
          container.scrollTo({
            top: idealScrollTop,
            behavior: 'smooth'
          });
        }
      }
    }
  }, [currentIndex]);

  // Center the timeline view when currentTime changes significantly (due to seeking)
  useEffect(() => {
    // Calculate the time difference
    const timeDiff = Math.abs(currentTime - lastTimeRef.current);

    // If the time difference is significant (more than 1 second), it's likely a seek operation
    if (timeDiff > 1) {
      // Center the timeline on the new time
      setCenterTimelineAt(currentTime);

      // Reset the center time in the next frame to allow future updates
      requestAnimationFrame(() => {
        setCenterTimelineAt(null);
      });
    }

    // Update the last time reference
    lastTimeRef.current = currentTime;
  }, [currentTime]);

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
        centerOnTime={centerTimelineAt}
      />

      <div className="lyrics-container" ref={lyricsContainerRef}>
        {lyrics.map((lyric, index) => (
          <LyricItem
            key={index}
            lyric={lyric}
            index={index}
            isCurrentLyric={index === currentIndex}
            currentTime={currentTime}
            allowEditing={allowEditing}
            isDragging={isDragging}
            onLyricClick={(time) => {
              // Center the timeline on the clicked lyric
              setCenterTimelineAt(time);
              // Reset the center time in the next frame to allow future clicks to work
              requestAnimationFrame(() => {
                setCenterTimelineAt(null);
              });
              // Call the original onLyricClick function
              onLyricClick(time);
            }}
            onMouseDown={handleMouseDown}
            getLastDragEnd={getLastDragEnd}
            onDelete={handleDeleteLyric}
            onTextEdit={handleTextEdit}
            onInsert={handleInsertLyric}
            hasNextLyric={index < lyrics.length - 1}
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