import { useState, useRef, useEffect } from 'react';

export const useLyricsEditor = (initialLyrics, onUpdateLyrics) => {
  const [lyrics, setLyrics] = useState([]);
  const [history, setHistory] = useState([]);
  const [originalLyrics, setOriginalLyrics] = useState([]);
  const [isAtOriginalState, setIsAtOriginalState] = useState(true);
  const [isSticky, setIsSticky] = useState(true);

  const dragInfo = useRef({ 
    dragging: false, 
    index: null, 
    field: null, 
    startX: 0, 
    startValue: 0,
    lastDragEnd: 0
  });

  // Sync with incoming lyrics
  useEffect(() => {
    if (initialLyrics && initialLyrics.length > 0) {
      setLyrics(initialLyrics);
      if (originalLyrics.length === 0) {
        setOriginalLyrics(JSON.parse(JSON.stringify(initialLyrics)));
      }
      setIsAtOriginalState(JSON.stringify(initialLyrics) === JSON.stringify(originalLyrics));
    }
  }, [initialLyrics, originalLyrics]);

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

      setIsAtOriginalState(areEqual);
    }
  }, [lyrics, originalLyrics]);

  const handleUndo = () => {
    if (history.length > 0) {
      const lastState = history[history.length - 1];
      setLyrics(lastState);
      if (onUpdateLyrics) {
        onUpdateLyrics(lastState);
      }
      setHistory(prevHistory => prevHistory.slice(0, -1));
    }
  };

  const handleReset = () => {
    if (originalLyrics.length > 0) {
      const currentState = JSON.parse(JSON.stringify(lyrics));
      const originalState = JSON.parse(JSON.stringify(originalLyrics));
      
      if (JSON.stringify(currentState) !== JSON.stringify(originalState)) {
        setHistory(prevHistory => [...prevHistory, currentState]);
        setLyrics(originalState);
        if (onUpdateLyrics) {
          onUpdateLyrics(originalState);
        }
      }
    }
  };

  const updateTimings = (index, field, newValue, duration) => {
    const oldLyrics = [...lyrics];
    const currentLyric = { ...oldLyrics[index] };
    const delta = newValue - currentLyric[field];
    
    if (Math.abs(delta) < 0.001) return;
    
    const updatedLyrics = oldLyrics.map((lyric, i) => {
      if (i === index) {
        if (field === 'start') {
          const length = lyric.end - lyric.start;
          return {
            ...lyric,
            start: newValue,
            end: newValue + length
          };
        } else {
          return { ...lyric, [field]: newValue };
        }
      } else if (i > index && isSticky) {
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

  const startDrag = (index, field, startX, startValue) => {
    setHistory(prevHistory => [...prevHistory, JSON.parse(JSON.stringify(lyrics))]);
    dragInfo.current = {
      dragging: true,
      index,
      field,
      startX,
      startValue
    };
  };

  const handleDrag = (clientX, duration) => {
    const { dragging, index, field, startX, startValue } = dragInfo.current;
    if (!dragging) return;
    
    const deltaX = clientX - startX;
    const deltaTime = deltaX * 0.01;
    let newValue = startValue + deltaTime;
    
    const lyric = lyrics[index];
    if (field === 'start') {
      newValue = Math.max(0, Math.min(lyric.end - 0.1, newValue));
    } else {
      newValue = Math.max(lyric.start + 0.1, Math.min(duration || 9999, newValue));
    }
    
    newValue = Math.round(newValue * 100) / 100;
    updateTimings(index, field, newValue, duration);
  };

  const endDrag = () => {
    dragInfo.current.lastDragEnd = Date.now();
    dragInfo.current = { 
      ...dragInfo.current,
      dragging: false, 
      index: null, 
      field: null, 
      startX: 0, 
      startValue: 0
    };
  };

  const isDragging = (index, field) => 
    dragInfo.current.dragging && 
    dragInfo.current.index === index && 
    dragInfo.current.field === field;

  const getLastDragEnd = () => dragInfo.current.lastDragEnd;

  const handleDeleteLyric = (index) => {
    setHistory(prevHistory => [...prevHistory, JSON.parse(JSON.stringify(lyrics))]);
    const updatedLyrics = lyrics.filter((_, i) => i !== index);
    setLyrics(updatedLyrics);
    if (onUpdateLyrics) {
      onUpdateLyrics(updatedLyrics);
    }
  };

  const handleTextEdit = (index, newText) => {
    setHistory(prevHistory => [...prevHistory, JSON.parse(JSON.stringify(lyrics))]);
    const updatedLyrics = lyrics.map((lyric, i) => 
      i === index ? { ...lyric, text: newText } : lyric
    );
    setLyrics(updatedLyrics);
    if (onUpdateLyrics) {
      onUpdateLyrics(updatedLyrics);
    }
  };

  const handleInsertLyric = (index) => {
    setHistory(prevHistory => [...prevHistory, JSON.parse(JSON.stringify(lyrics))]);
    
    const prevLyric = lyrics[index];
    const nextLyric = lyrics[index + 1];
    
    // Calculate the gap between the two lyrics
    const gap = nextLyric.start - prevLyric.end;
    
    // If the gap is too small (less than 0.2s), expand it by moving the next lyric
    const minGap = 0.2;
    let newStartTime = prevLyric.end;
    let newEndTime = nextLyric.start;
    
    if (gap < minGap) {
      // Move the next lyric to create minimum gap
      const lengthToAdd = minGap - gap;
      newEndTime = nextLyric.start + lengthToAdd;
      
      // Update all following lyrics to maintain gaps
      const updatedLyrics = lyrics.map((lyric, i) => {
        if (i <= index) return lyric;
        return {
          ...lyric,
          start: lyric.start + lengthToAdd,
          end: lyric.end + lengthToAdd
        };
      });
      
      const newLyric = {
        text: '',
        start: newStartTime,
        end: newEndTime - minGap
      };
      
      const finalLyrics = [
        ...updatedLyrics.slice(0, index + 1),
        newLyric,
        ...updatedLyrics.slice(index + 1)
      ];
      
      setLyrics(finalLyrics);
      if (onUpdateLyrics) {
        onUpdateLyrics(finalLyrics);
      }
    } else {
      // If gap is large enough, insert in the middle
      const midPoint = prevLyric.end + gap / 2;
      const newLyric = {
        text: '',
        start: prevLyric.end,
        end: midPoint + (gap / 4) // Give the new lyric 75% of the first half of the gap
      };
      
      const updatedLyrics = [
        ...lyrics.slice(0, index + 1),
        newLyric,
        ...lyrics.slice(index + 1)
      ];
      
      setLyrics(updatedLyrics);
      if (onUpdateLyrics) {
        onUpdateLyrics(updatedLyrics);
      }
    }
  };

  return {
    lyrics,
    isSticky,
    setIsSticky,
    isAtOriginalState,
    canUndo: history.length > 0,
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
  };
};