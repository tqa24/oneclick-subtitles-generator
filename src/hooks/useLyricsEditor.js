import { useState, useRef, useEffect } from 'react';

export const useLyricsEditor = (initialLyrics, onUpdateLyrics) => {
  const [lyrics, setLyrics] = useState([]);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
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
      const currentState = JSON.parse(JSON.stringify(lyrics));

      // Save current state to redo stack
      setRedoStack(prevRedoStack => [...prevRedoStack, currentState]);

      // Apply the previous state
      setLyrics(lastState);
      if (onUpdateLyrics) {
        onUpdateLyrics(lastState);
      }

      // Remove the last state from history
      setHistory(prevHistory => prevHistory.slice(0, -1));
    }
  };

  const handleRedo = () => {
    if (redoStack.length > 0) {
      const nextState = redoStack[redoStack.length - 1];
      const currentState = JSON.parse(JSON.stringify(lyrics));

      // Save current state to history
      setHistory(prevHistory => [...prevHistory, currentState]);

      // Apply the next state
      setLyrics(nextState);
      if (onUpdateLyrics) {
        onUpdateLyrics(nextState);
      }

      // Remove the next state from redo stack
      setRedoStack(prevRedoStack => prevRedoStack.slice(0, -1));
    }
  };

  const handleReset = () => {
    if (originalLyrics.length > 0) {
      const currentState = JSON.parse(JSON.stringify(lyrics));
      const originalState = JSON.parse(JSON.stringify(originalLyrics));

      if (JSON.stringify(currentState) !== JSON.stringify(originalState)) {
        // Save current state to history
        setHistory(prevHistory => [...prevHistory, currentState]);

        // Clear redo stack when resetting
        setRedoStack([]);

        // Apply original state
        setLyrics(originalState);
        if (onUpdateLyrics) {
          onUpdateLyrics(originalState);
        }
      }
    }
  };

  // Keep track of the last updated value to avoid unnecessary updates
  const lastUpdatedValueRef = useRef({ index: -1, field: null, value: 0 });

  const updateTimings = (index, field, newValue, duration) => {
    // Skip if the value hasn't changed significantly
    if (lastUpdatedValueRef.current.index === index &&
        lastUpdatedValueRef.current.field === field &&
        Math.abs(lastUpdatedValueRef.current.value - newValue) < 0.001) {
      return;
    }

    // Update the last updated value
    lastUpdatedValueRef.current = { index, field, value: newValue };

    const oldLyrics = [...lyrics];
    const currentLyric = oldLyrics[index]; // Avoid unnecessary spread
    const delta = newValue - currentLyric[field];

    if (Math.abs(delta) < 0.001) return;

    // Create a new array only if we're actually changing something
    const updatedLyrics = [];

    // Only process lyrics that need to be updated
    for (let i = 0; i < oldLyrics.length; i++) {
      const lyric = oldLyrics[i];

      if (i === index) {
        // Update the current lyric
        if (field === 'start') {
          const length = lyric.end - lyric.start;
          updatedLyrics.push({
            ...lyric,
            start: newValue,
            end: newValue + length
          });
        } else {
          updatedLyrics.push({ ...lyric, [field]: newValue });
        }
      } else if (i > index && isSticky) {
        // Update subsequent lyrics if sticky mode is on
        const newStart = Math.max(0, lyric.start + delta);
        updatedLyrics.push({
          ...lyric,
          start: newStart,
          end: Math.max(newStart + 0.1, lyric.end + delta)
        });
      } else {
        // Keep unchanged lyrics as-is (no spread needed)
        updatedLyrics.push(lyric);
      }
    }

    // Save current state to history before updating
    setHistory(prevHistory => [...prevHistory, JSON.parse(JSON.stringify(lyrics))]);

    // Clear redo stack when making new changes
    setRedoStack([]);

    // Update lyrics
    setLyrics(updatedLyrics);
    if (onUpdateLyrics) {
      onUpdateLyrics(updatedLyrics);
    }
  };

  const startDrag = (index, field, startX, startValue) => {
    // Save current state to history
    setHistory(prevHistory => [...prevHistory, JSON.parse(JSON.stringify(lyrics))]);

    // Clear redo stack when starting a new drag
    setRedoStack([]);

    dragInfo.current = {
      dragging: true,
      index,
      field,
      startX,
      startValue
    };
  };

  // Throttle state to reduce updates
  const lastUpdateTimeRef = useRef(0);
  const pendingUpdateRef = useRef(null);

  const handleDrag = (clientX, duration) => {
    const { dragging, index, field, startX, startValue } = dragInfo.current;
    if (!dragging) return;

    // Calculate the new value
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

    // Throttle updates to reduce rendering
    const now = performance.now();
    if (now - lastUpdateTimeRef.current < 30) { // Limit to ~33fps
      // If we already have a pending update, cancel it
      if (pendingUpdateRef.current) {
        cancelAnimationFrame(pendingUpdateRef.current);
      }

      // Schedule a new update
      pendingUpdateRef.current = requestAnimationFrame(() => {
        updateTimings(index, field, newValue, duration);
        pendingUpdateRef.current = null;
      });
      return;
    }

    // Update immediately if enough time has passed
    lastUpdateTimeRef.current = now;
    updateTimings(index, field, newValue, duration);
  };

  const endDrag = () => {
    // Cancel any pending animation frame
    if (pendingUpdateRef.current) {
      cancelAnimationFrame(pendingUpdateRef.current);
      pendingUpdateRef.current = null;
    }

    // Record the time of the drag end
    dragInfo.current.lastDragEnd = Date.now();

    // Reset drag state
    dragInfo.current = {
      ...dragInfo.current,
      dragging: false,
      index: null,
      field: null,
      startX: 0,
      startValue: 0
    };

    // Reset the last updated value reference
    lastUpdatedValueRef.current = { index: -1, field: null, value: 0 };
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

  // Merge the current lyric with the next one
  const handleMergeLyrics = (index) => {
    // Make sure there's a next lyric to merge with
    if (index >= lyrics.length - 1) return;

    // Save current state to history
    setHistory(prevHistory => [...prevHistory, JSON.parse(JSON.stringify(lyrics))]);

    // Clear redo stack when merging lyrics
    setRedoStack([]);

    const currentLyric = lyrics[index];
    const nextLyric = lyrics[index + 1];

    // Create a new merged lyric
    const mergedLyric = {
      text: `${currentLyric.text} ${nextLyric.text}`.trim(),
      start: currentLyric.start,
      end: nextLyric.end
    };

    // Create updated lyrics array with the merged lyric
    const updatedLyrics = [
      ...lyrics.slice(0, index),
      mergedLyric,
      ...lyrics.slice(index + 2)
    ];

    // Update state
    setLyrics(updatedLyrics);
    if (onUpdateLyrics) {
      onUpdateLyrics(updatedLyrics);
    }
  };

  return {
    lyrics,
    isSticky,
    setIsSticky,
    isAtOriginalState,
    canUndo: history.length > 0,
    canRedo: redoStack.length > 0,
    handleUndo,
    handleRedo,
    handleReset,
    startDrag,
    handleDrag,
    endDrag,
    isDragging,
    getLastDragEnd,
    handleDeleteLyric,
    handleTextEdit,
    handleInsertLyric,
    handleMergeLyrics
  };
};