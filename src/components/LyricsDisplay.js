import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/LyricsDisplay.css';

const LyricsDisplay = ({ 
  matchedLyrics, 
  currentTime, 
  onLyricClick, 
  duration, 
  onUpdateLyrics, 
  allowEditing = false 
}) => {
  const { t } = useTranslation();

  // State for lyrics and editing
  const [lyrics, setLyrics] = useState([]);
  const [isSticky, setIsSticky] = useState(true);
  const [history, setHistory] = useState([]);
  const [originalLyrics, setOriginalLyrics] = useState([]);
  const [isAtOriginalState, setIsAtOriginalState] = useState(true);
  
  // Refs
  const timelineRef = useRef(null);
  const containerRef = useRef(null);
  const lastTimeRef = useRef(0);
  const dragInfo = useRef({ 
    dragging: false, 
    index: null, 
    field: null, 
    startX: 0, 
    startValue: 0,
    lastDragEnd: 0  // To track when the last drag ended
  });

  // Sync with incoming matchedLyrics prop
  useEffect(() => {
    if (matchedLyrics && matchedLyrics.length > 0) {
      setLyrics(matchedLyrics);
      // Store original lyrics for reset functionality
      if (originalLyrics.length === 0) {
        setOriginalLyrics(JSON.parse(JSON.stringify(matchedLyrics)));
      }
      // Check if current state matches original state
      setIsAtOriginalState(JSON.stringify(matchedLyrics) === JSON.stringify(originalLyrics));
    }
  }, [matchedLyrics, originalLyrics]);

  // Track whether current lyrics match original lyrics
  useEffect(() => {
    if (originalLyrics.length > 0) {
      const areEqual = lyrics.length === originalLyrics.length &&
        lyrics.every((lyric, index) => {
          const origLyric = originalLyrics[index];
          return (
            lyric.text === origLyric.text &&
            Math.abs(lyric.start - origLyric.start) < 0.001 &&
            Math.abs(lyric.end - origLyric.end) < 0.001
          );
        });

      if (isAtOriginalState !== areEqual) {
        setIsAtOriginalState(areEqual);
      }
    }
  }, [lyrics, originalLyrics, isAtOriginalState]);

  // Find current lyric index based on time
  const getCurrentLyricIndex = (time) => {
    return lyrics.findIndex((lyric, index) => {
      const nextLyric = lyrics[index + 1];
      return time >= lyric.start && 
        (nextLyric ? time < nextLyric.start : time <= lyric.end);
    });
  };
  
  const currentIndex = getCurrentLyricIndex(currentTime);
  
  // Handle the undo operation
  const handleUndo = () => {
    if (history.length > 0) {
      // Get the last state from history
      const lastState = history[history.length - 1];
      
      // Update the lyrics to the previous state
      setLyrics(lastState);
      
      // Notify parent component
      if (onUpdateLyrics) {
        onUpdateLyrics(lastState);
      }
      
      // Remove the used state from history
      setHistory(prevHistory => prevHistory.slice(0, -1));
    }
  };
  
  // Handle the reset operation
  const handleReset = () => {
    if (originalLyrics.length > 0) {
      const currentState = JSON.parse(JSON.stringify(lyrics));
      const originalState = JSON.parse(JSON.stringify(originalLyrics));
      
      // Only proceed if there are actual changes
      if (JSON.stringify(currentState) !== JSON.stringify(originalState)) {
        // Save current state to history before reset
        setHistory(prevHistory => [...prevHistory, currentState]);
        // Reset to original state
        setLyrics(originalState);
      
        // Notify parent component
        if (onUpdateLyrics) {
          onUpdateLyrics(originalState);
        }
      }
    }
  };
  
  // Start the drag operation
  const handleMouseDown = (e, index, field) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Save current state to history before making changes
    setHistory(prevHistory => [...prevHistory, JSON.parse(JSON.stringify(lyrics))]);
    
    const clientX = e.clientX;
    const value = field === 'start' ? lyrics[index].start : lyrics[index].end;
    
    // Store drag information
    dragInfo.current = {
      dragging: true,
      index: index,
      field: field,
      startX: clientX,
      startValue: value
    };
    
    // Add event listeners for dragging
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  // Handle mouse movement during drag
  const handleMouseMove = (e) => {
    const { dragging, index, field, startX, startValue } = dragInfo.current;
    if (!dragging) return;
    
    e.preventDefault();
    
    const deltaX = e.clientX - startX;
    const deltaTime = deltaX * 0.01; // 0.01 seconds per pixel
    let newValue = startValue + deltaTime;
    
    // Apply constraints
    const lyric = lyrics[index];
    if (field === 'start') {
      // Don't let start time go below 0 or above end time - 0.1
      newValue = Math.max(0, Math.min(lyric.end - 0.1, newValue));
    } else { // end
      // Don't let end time go below start time + 0.1 or above duration
      newValue = Math.max(lyric.start + 0.1, Math.min(duration || 9999, newValue));
    }
    
    // Round to 2 decimal places
    newValue = Math.round(newValue * 100) / 100;
    
    // Update lyrics
    updateTimings(index, field, newValue);
  };
  
  // End the drag operation
  const handleMouseUp = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Record the drag end time
    dragInfo.current.lastDragEnd = Date.now();
    
    // Add a small delay to prevent click events from firing
    setTimeout(() => {
      // Cleanup
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Reset drag info but keep lastDragEnd
      dragInfo.current = { 
        dragging: false, 
        index: null, 
        field: null, 
        startX: 0, 
        startValue: 0,
        lastDragEnd: dragInfo.current.lastDragEnd 
      };
    }, 10);
  };
  
  // Update the specified lyric and adjust all subsequent timings
  const updateTimings = (index, field, newValue) => {
    const oldLyrics = [...lyrics];
    const currentLyric = { ...oldLyrics[index] };
    const delta = newValue - currentLyric[field];
    
    if (Math.abs(delta) < 0.001) return; // Skip tiny changes
    
    const updatedLyrics = oldLyrics.map((lyric, i) => {
      if (i === index) {
        if (field === 'start') {
          // When changing start time, maintain the segment length by moving the end time
          const length = lyric.end - lyric.start;
          return {
            ...lyric,
            start: newValue,
            end: newValue + length
          };
        } else {
          // For end time changes, just update the end
          return { ...lyric, [field]: newValue };
        }
      } else if (i > index && isSticky) {
        // For all subsequent segments, shift both start and end by the same delta
        // Only if sticky mode is enabled
        const newStart = Math.max(0, lyric.start + delta);
        return {
          ...lyric,
          start: newStart,
          end: Math.max(newStart + 0.1, lyric.end + delta)
        };
      }
      return lyric;
    });
    
    setLyrics(updatedLyrics);
    if (onUpdateLyrics) {
      onUpdateLyrics(updatedLyrics);
    }
  };

  // Handle click on the timeline to seek
  const handleTimelineClick = (e) => {
    if (!timelineRef.current || !duration) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const timelineWidth = rect.width;
    
    // Find the max time to use same scale as drawing
    const maxLyricTime = lyrics.length > 0 
      ? Math.max(...lyrics.map(lyric => lyric.end))
      : duration;
    const timelineEnd = Math.max(maxLyricTime, duration) * 1.05;
    
    // Calculate the time based on click position
    const newTime = (clickX / timelineWidth) * timelineEnd;
    
    // Seek to the new time
    if (newTime >= 0 && newTime <= duration && onLyricClick) {
      onLyricClick(Math.min(duration, newTime));
    }
  };

  // Draw the timeline visualization
  const drawTimeline = useCallback(() => {
    const canvas = timelineRef.current;
    if (!canvas || !duration) return;
    
    const ctx = canvas.getContext('2d');
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    
    // Set canvas dimensions for proper resolution
    const dpr = window.devicePixelRatio || 1;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);
    
    // Clear canvas
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    
    // Draw background
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    
    // Find the max time to use same scale as drawing
    const maxLyricTime = lyrics.length > 0 
      ? Math.max(...lyrics.map(lyric => lyric.end))
      : duration;
    
    // Use the greater of actual duration or max lyric time 
    const timelineEnd = Math.max(maxLyricTime, duration) * 1.05; // Add 5% padding
    
    // Draw lyric segments FIRST (below time markers)
    lyrics.forEach((lyric, index) => {
      const startX = (lyric.start / timelineEnd) * displayWidth;
      const endX = (lyric.end / timelineEnd) * displayWidth;
      const segmentWidth = Math.max(1, endX - startX); // Ensure minimum width
      
      // Get a color based on the index
      const hue = (index * 30) % 360;
      ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.7)`;
      // Draw segments in lower 70% of canvas height
      ctx.fillRect(startX, displayHeight * 0.3, segmentWidth, displayHeight * 0.7);
      
      // Draw border
      ctx.strokeStyle = `hsla(${hue}, 70%, 40%, 0.9)`;
      ctx.strokeRect(startX, displayHeight * 0.3, segmentWidth, displayHeight * 0.7);
    });
    
    // Draw time markers ON TOP
    ctx.fillStyle = '#ddd';
    
    // Calculate proper spacing for time markers based on timeline length
    const timeStep = Math.max(1, Math.ceil(timelineEnd / 15));
    for (let i = 0; i <= timelineEnd; i += timeStep) {
      const x = (i / timelineEnd) * displayWidth;
      // Draw full-height vertical lines
      ctx.fillRect(x, 0, 1, displayHeight);
      
      // Draw time labels at the top
      ctx.fillStyle = '#666';
      ctx.font = '10px Arial';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText(`${i}s`, x + 3, 2);
      ctx.fillStyle = '#ddd';
    }
    
    // Draw current time indicator - make it more visible
    const currentX = (currentTime / timelineEnd) * displayWidth;
    
    // Draw indicator shadow for better visibility
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(currentX - 2, 0, 4, displayHeight);
    
    // Draw indicator
    ctx.fillStyle = 'red';
    ctx.fillRect(currentX - 1, 0, 3, displayHeight);
    
    // Draw playhead triangle at the top
    ctx.beginPath();
    ctx.moveTo(currentX - 6, 0);
    ctx.lineTo(currentX + 6, 0);
    ctx.lineTo(currentX, 6);
    ctx.closePath();
    ctx.fillStyle = 'red';
    ctx.fill();
  }, [lyrics, currentTime, duration]);

  // Initialize and resize the canvas for proper pixel density
  useEffect(() => {
    if (timelineRef.current) {
      const canvas = timelineRef.current;
      const container = canvas.parentElement;
      
      // Set canvas dimensions to match its display size to avoid blurry text
      const resizeCanvas = () => {
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        // Set display size (css pixels)
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = '50px';
        
        // Set actual size in memory (scaled for pixel density)
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = 50 * dpr;
        
        // Scale context to ensure correct drawing
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        
        drawTimeline();
      };
      
      window.addEventListener('resize', resizeCanvas);
      resizeCanvas();
      
      return () => {
        window.removeEventListener('resize', resizeCanvas);
      };
    }
  }, [drawTimeline]);
  
  // Draw timeline visualization when lyrics or currentTime change
  useEffect(() => {
    if (timelineRef.current && lyrics.length > 0) {
      // Store current time for comparison
      lastTimeRef.current = currentTime;
      drawTimeline();
    }
  }, [lyrics, currentTime, duration, drawTimeline]);
  
  // Force redraw timeline when currentTime changes
  useEffect(() => {
    // Only redraw if time actually changed
    if (Math.abs(lastTimeRef.current - currentTime) > 0.01) {
      lastTimeRef.current = currentTime;
      if (timelineRef.current) {
        drawTimeline();
      }
    }
  }, [currentTime, drawTimeline]);

  return (
    <div className="lyrics-display">
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
              onClick={handleUndo}
              disabled={history.length === 0}
            >
              {t('common.undo', 'Undo')}
            </button>

            <button
              className="reset-btn"
              onClick={handleReset}
              disabled={originalLyrics.length === 0 || isAtOriginalState}
            >
              {t('common.reset', 'Reset')}
            </button>
          </div>
        )}
      </div>
      
      {/* Timeline Visualization */}
      <div className="timeline-container">
        <canvas 
          ref={timelineRef}
          onClick={handleTimelineClick}
          className="subtitle-timeline"
        />
      </div>
      
      {/* Lyrics List */}
      <div className="lyrics-container" ref={containerRef}>
        {lyrics.map((lyric, index) => {
          const isCurrentLyric = index === currentIndex;
          const isDragging = dragInfo.current.dragging && dragInfo.current.index === index;
          
          return (
            <div
              key={index}
              data-lyric-index={index}
              className={`lyric-item ${isCurrentLyric ? 'current' : ''}`}
              onClick={(e) => {
                // Don't trigger click if we're in the middle of or just finished dragging
                if (dragInfo.current.dragging || Date.now() - dragInfo.current.lastDragEnd < 100) {
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
                    {/* Start Time */}
                    <span
                      className={`time-control start-time ${isDragging && dragInfo.current.field === 'start' ? 'dragging' : ''}`}
                      onMouseDown={(e) => handleMouseDown(e, index, 'start')}
                    >
                      {lyric.start.toFixed(2)}s
                    </span>
                    
                    <span className="time-separator">-</span>
                    
                    {/* End Time */}
                    <span
                      className={`time-control end-time ${isDragging && dragInfo.current.field === 'end' ? 'dragging' : ''}`}
                      onMouseDown={(e) => handleMouseDown(e, index, 'end')}
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
        })}
      </div>
      
      {allowEditing && (
        <div className="help-text">
          <p>
            {t('lyrics.timingInstructions', 'Drag the timestamps to adjust the timing of each subtitle. Sticky mode will adjust all following subtitles.')}
          </p>
        </div>
      )}
    </div>
  );
};

export default LyricsDisplay;