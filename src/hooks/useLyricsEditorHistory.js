import { useState, useCallback } from 'react';

// Debug logging gate (enable by setting localStorage.debug_logs = 'true')
const DEBUG_LOGS = (typeof window !== 'undefined') && (localStorage.getItem('debug_logs') === 'true');
const dbg = (...args) => { if (DEBUG_LOGS) console.log(...args); };

/**
 * Undo / redo / checkpoint management for the lyrics editor.
 *
 * Owns the undo `history`, `redoStack`, and `checkpointHistory` state, and the
 * handlers that mutate them. Closes over parent state (lyrics/setLyrics/
 * onUpdateLyrics/savedLyrics) via params.
 *
 * @param {Object}   params
 * @param {Array}    params.lyrics           Current lyrics array.
 * @param {Function} params.setLyrics        Setter for the lyrics array.
 * @param {Function} params.onUpdateLyrics   Callback invoked with updated lyrics.
 * @param {Array}    params.savedLyrics      Last saved lyrics (used by handleReset).
 */
export const useLyricsEditorHistory = ({ lyrics, setLyrics, onUpdateLyrics, savedLyrics }) => {
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [checkpointHistory, setCheckpointHistory] = useState([]); // Stack of saved checkpoints

  const handleUndo = useCallback(() => {
    if (history.length > 0) {
      // Get the current state and the last history state
      const currentState = JSON.parse(JSON.stringify(lyrics));
      const lastState = history[history.length - 1];

      // Add current state to redo stack
      setRedoStack(prevRedoStack => [...prevRedoStack, currentState]);

      // Set lyrics to the last history state
      setLyrics(lastState);
      if (onUpdateLyrics) {
        onUpdateLyrics(lastState);
      }

      // Remove the last state from history
      setHistory(prevHistory => prevHistory.slice(0, -1));
    }
  }, [history, lyrics, setLyrics, onUpdateLyrics]);

  // Use useCallback to prevent handleRedo from changing on every render
  const handleRedo = useCallback(() => {
    if (redoStack.length > 0) {
      // Get the current state and the last redo state
      const currentState = JSON.parse(JSON.stringify(lyrics));
      const redoState = redoStack[redoStack.length - 1];

      // Add current state to history
      setHistory(prevHistory => [...prevHistory, currentState]);

      // Set lyrics to the redo state
      setLyrics(redoState);
      if (onUpdateLyrics) {
        onUpdateLyrics(redoState);
      }

      // Remove the last state from redo stack
      setRedoStack(prevRedoStack => prevRedoStack.slice(0, -1));
    }
  }, [redoStack, lyrics, setLyrics, onUpdateLyrics]);

  const handleReset = useCallback(() => {
    if (savedLyrics.length > 0) {
      const currentState = JSON.parse(JSON.stringify(lyrics));
      const savedState = JSON.parse(JSON.stringify(savedLyrics));

      if (JSON.stringify(currentState) !== JSON.stringify(savedState)) {
        // Add current state to history
        setHistory(prevHistory => [...prevHistory, currentState]);

        // Clear redo stack when resetting
        setRedoStack([]);

        // Set lyrics to saved state instead of original state
        setLyrics(savedState);
        if (onUpdateLyrics) {
          onUpdateLyrics(savedState);
        }
      }
    }
  }, [savedLyrics, lyrics, setLyrics, onUpdateLyrics]);

  // Function to create a checkpoint (called when save happens)
  const createCheckpoint = useCallback(() => {
    const currentState = JSON.parse(JSON.stringify(lyrics));
    // Limit checkpoint history to 10 entries to avoid memory issues
    setCheckpointHistory(prevCheckpoints => {
      const newCheckpoints = [...prevCheckpoints, currentState];
      if (newCheckpoints.length > 10) {
        return newCheckpoints.slice(-10); // Keep only the last 10 checkpoints
      }
      return newCheckpoints;
    });
    dbg('[LyricsEditor] Created checkpoint at save');
  }, [lyrics]);

  // Function to jump to previous checkpoints (cycles through checkpoint history)
  const handleJumpToCheckpoint = useCallback(() => {
    if (checkpointHistory.length > 0) {
      const currentState = JSON.parse(JSON.stringify(lyrics));

      // Find the most recent checkpoint that differs from current state
      let targetCheckpointIndex = -1;
      for (let i = checkpointHistory.length - 1; i >= 0; i--) {
        const checkpoint = checkpointHistory[i];
        if (JSON.stringify(checkpoint) !== JSON.stringify(currentState)) {
          targetCheckpointIndex = i;
          break;
        }
      }

      // If no different checkpoint found, use the oldest one (index 0)
      if (targetCheckpointIndex === -1) {
        // If we're already at all checkpoints, jump to the oldest
        if (checkpointHistory.length > 1) {
          targetCheckpointIndex = 0;
        } else {
          dbg('[LyricsEditor] No different checkpoint available');
          return;
        }
      }

      const targetCheckpoint = checkpointHistory[targetCheckpointIndex];

      // Save current state to regular history for normal undo
      setHistory(prevHistory => [...prevHistory, currentState]);

      // Clear redo stack
      setRedoStack([]);

      // Jump to the checkpoint
      setLyrics(targetCheckpoint);
      if (onUpdateLyrics) {
        onUpdateLyrics(targetCheckpoint);
      }

      // Remove all checkpoints after the one we jumped to (keep earlier ones)
      setCheckpointHistory(prevCheckpoints => prevCheckpoints.slice(0, targetCheckpointIndex));

      dbg(`[LyricsEditor] Jumped to checkpoint ${targetCheckpointIndex + 1} of ${checkpointHistory.length}`);
    }
  }, [checkpointHistory, lyrics, setLyrics, onUpdateLyrics]);

  // Function to capture state before merging operations for undo/redo
  const captureStateBeforeMerge = useCallback(() => {
    const currentState = JSON.parse(JSON.stringify(lyrics));
    setHistory(prevHistory => [...prevHistory, currentState]);
    // Clear redo stack since we're making a new change
    setRedoStack([]);
    dbg('[LyricsEditor] Captured state before merge operation for undo/redo');
  }, [lyrics]);

  return {
    history,
    setHistory,
    redoStack,
    setRedoStack,
    checkpointHistory,
    setCheckpointHistory,
    handleUndo,
    handleRedo,
    handleReset,
    createCheckpoint,
    handleJumpToCheckpoint,
    captureStateBeforeMerge
  };
};
