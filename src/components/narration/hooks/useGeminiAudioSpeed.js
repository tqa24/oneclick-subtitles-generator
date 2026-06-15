import { SERVER_URL } from '../../../config';

// Gated debug logging (enable in the browser console: localStorage.debug_logs = 'true')
const DEBUG_LOGS = (typeof window !== 'undefined') && (localStorage.getItem('debug_logs') === 'true');
const dbg = (...args) => { if (DEBUG_LOGS) console.log(...args); };

const getBackupName = (fn) => {
  if (!fn) return null;
  const lastSlash = fn.lastIndexOf('/');
  const dir = lastSlash >= 0 ? fn.slice(0, lastSlash) : '';
  const base = lastSlash >= 0 ? fn.slice(lastSlash + 1) : fn;
  return `${dir ? dir + '/' : ''}backup_${base}`;
};

/**
 * Hook providing batch + single audio trim/speed editing and duration fetching.
 * State (itemSpeeds/itemTrims/itemDurations + processing flags) is owned by the host
 * component and threaded in; this hook returns the action functions.
 *
 * @param {Object} params
 * @param {Array} params.generationResults
 * @param {number} params.speedValue
 * @param {Object} params.itemSpeeds
 * @param {Object} params.itemTrims
 * @param {Object} params.itemDurations
 * @param {Function} params.setItemSpeeds
 * @param {Function} params.setItemDurations
 * @param {Function} params.setItemProcessing
 * @param {Function} params.setIsProcessing
 * @param {Function} params.setProcessingProgress
 * @param {Function} params.setCurrentFile
 * @param {Object} params.processedCountRef
 * @param {Object} params.seenItemsRef
 * @param {Function} params.t
 * @returns {{ modifyAudioSpeed: Function, modifySingleAudioEditCombined: Function, fetchDurationsBatch: Function }}
 */
const useGeminiAudioSpeed = ({
  generationResults,
  speedValue,
  itemSpeeds,
  itemTrims,
  itemDurations,
  setItemSpeeds,
  setItemDurations,
  setItemProcessing,
  setIsProcessing,
  setProcessingProgress,
  setCurrentFile,
  processedCountRef,
  seenItemsRef,
  t
}) => {
  const fetchDurationsBatch = async (filenames) => {
    if (!Array.isArray(filenames) || filenames.length === 0) return;
    try {
      const resp = await fetch(`${SERVER_URL}/api/narration/batch-get-audio-durations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames })
      });
      if (!resp.ok) return;
      const data = await resp.json();
      if (data?.success && data.durations) {
        setItemDurations(prev => ({ ...prev, ...data.durations }));
      }
    } catch (e) {
      // ignore
    }
  };

  // Function to modify audio speed (global batch)
  const modifyAudioSpeed = async () => {
    if (!generationResults || generationResults.length === 0) {
      return;
    }

    try {
      // Get all successful narrations with filenames
      const successfulNarrations = generationResults.filter(
        result => result.success && result.filename
      );

      if (successfulNarrations.length === 0) {
        setIsProcessing(false);
        return;
      }

      // Adjust all individual sliders to match global speed (including 1x)
      {
        const newSpeeds = {};
        successfulNarrations.forEach(r => { newSpeeds[r.subtitle_id] = Number(speedValue); });
        setItemSpeeds(prev => ({ ...prev, ...newSpeeds }));
      }


      // Start processing
      setIsProcessing(true);
      // Only count files we will actually process
      setProcessingProgress({ current: 0, total: successfulNarrations.length });
      // Show first filename as "preparing" hint
      try {
        const firstName = successfulNarrations[0]?.filename || '';
        const base = firstName ? String(firstName).split('/').pop() : '';
        setCurrentFile(base);
      } catch (_) {
        setCurrentFile('');
      }

      dbg(`Modifying speed of ${successfulNarrations.length} narration files to ${speedValue}x`);

      // Use new batch combined endpoint to process all files at once
      const apiUrl = `${SERVER_URL}/api/narration/batch-modify-audio-trim-speed-combined`;

      const items = successfulNarrations.map(r => {
        const id = r.subtitle_id;
        const filename = r.filename;
        const backupName = getBackupName(filename);
        const total = (backupName && typeof itemDurations[backupName] === 'number')
          ? itemDurations[backupName]
          : (typeof itemDurations[filename] === 'number')
            ? itemDurations[filename]
            : undefined;
        const [start, end] = itemTrims[id] || [0, total || 0];
        let normalizedStart = 0, normalizedEnd = 1;
        if (typeof total === 'number' && total > 0) {
          const s = typeof start === 'number' ? start : 0;
          const e = typeof end === 'number' ? end : total;
          normalizedStart = s / total;
          normalizedEnd = e / total;
        }
        return { filename, normalizedStart, normalizedEnd, speedFactor: speedValue };
      });

      // Reset streaming progress trackers
      processedCountRef.current = 0;
      seenItemsRef.current = new Set();

      // Use fetch with streaming response to get real-time progress updates
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items })
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      // Set up a reader to read the streaming response (SSE parsing)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Stream ended: immediately mark processing done
          setIsProcessing(false);
          setCurrentFile('');
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        let sep;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const chunk = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          if (!chunk.startsWith('data: ')) continue;
          try {
            const obj = JSON.parse(chunk.slice(6));
            if (obj.status === 'progress') {
              const total = obj.total ?? items.length;
              // Determine processed count robustly
              let processedNum = 0;
              if (typeof obj.processed === 'number') {
                processedNum = obj.processed;
              } else if (typeof obj.current === 'number') {
                processedNum = obj.current;
              } else {
                // Infer from current filename if provided
                if (obj.current) {
                  const key = String(obj.current);
                  if (!seenItemsRef.current.has(key)) {
                    seenItemsRef.current.add(key);
                    processedCountRef.current += 1;
                  }
                }
                processedNum = processedCountRef.current;
              }

              setProcessingProgress({ current: processedNum, total });

              if (obj.current) {
                const filename = String(obj.current).split('/').pop();
                setCurrentFile(filename || '');
              }
            } else if (obj.status === 'completed') {
              setProcessingProgress({ current: obj.processed ?? items.length, total: obj.total ?? items.length });
              setCurrentFile('');
              if (typeof window.resetAlignedNarration === 'function') {
                window.resetAlignedNarration();
              }
              window.dispatchEvent(new CustomEvent('narration-speed-modified', {
                detail: { speed: speedValue, timestamp: Date.now() }
              }));
            }
          } catch (e) {
            // ignore malformed chunks
          }
        }
      }

      dbg(`Successfully applied combined trim+speed to ${items.length} files`);

      // Optionally refresh durations in background (non-blocking UI)
      try {
        const filenames = successfulNarrations.map(r => r.filename).filter(Boolean);
        const backupFilenames = filenames.map(getBackupName).filter(Boolean);
        const allFilenames = [...new Set([...filenames, ...backupFilenames])];
        const resp = await fetch(`${SERVER_URL}/api/narration/batch-get-audio-durations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filenames: allFilenames })
        });
        if (resp.ok) {
          const data = await resp.json();
          const durations = data?.durations || {};
          setItemDurations(prev => ({ ...prev, ...durations }));
        }
      } catch (e) {
        // ignore duration refresh errors
      }
    } catch (error) {
      console.error('Error calling audio speed modification API:', error);
    } finally {
      // End processing
      setIsProcessing(false);
      setCurrentFile('');
    }
  };

  // Combined edit (trim + speed) for a single item; called on slider drop
  const modifySingleAudioEditCombined = async (result) => {
    if (!result?.filename) return;
    const id = result.subtitle_id;
    const [start, end] = itemTrims[id] || [undefined, undefined];
    const speed = itemSpeeds[id];

    // Compute normalized range relative to backup duration to keep UI mapping stable
    const backupName = getBackupName(result.filename);
    const total = (backupName && typeof itemDurations[backupName] === 'number')
      ? itemDurations[backupName]
      : (typeof itemDurations[result.filename] === 'number')
        ? itemDurations[result.filename]
        : undefined;

    let normalizedStart;
    let normalizedEnd;

    if (typeof total === 'number' && total > 0) {
      const s = typeof start === 'number' ? start : 0;
      const e = typeof end === 'number' ? end : total;
      normalizedStart = s / total;
      normalizedEnd = e / total;
    } else {
      const isDefaultTrim = typeof start !== 'number' && typeof end !== 'number';
      if (isDefaultTrim) {
        normalizedStart = 0; normalizedEnd = 1;
      } else {
        window.addToast(t('narration.durationNotReady', 'Audio duration not ready yet. Please wait a moment and try again.'), 'error');
        return;
      }
    }

    setItemProcessing(prev => ({ ...prev, [id]: { inProgress: true } }));
    try {
      const apiUrl = `${SERVER_URL}/api/narration/modify-audio-trim-speed-combined`;
      const body = { filename: result.filename, normalizedStart, normalizedEnd };
      if (typeof speed === 'number') {
        body.speedFactor = speed;
      }
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(`Server responded with status: ${response.status} - ${await response.text()}`);
      // Drain
      const reader = response.body.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
      if (typeof window !== 'undefined') {
        if (typeof window.resetAlignedNarration === 'function') {
          window.resetAlignedNarration();
        }
        window.dispatchEvent(new CustomEvent('narration-edit-modified', { detail: { start, end, speed, id, timestamp: Date.now() } }));
      }
    } catch (e) {
      console.error('Error applying combined audio edit:', e);
      window.addToast(t('narration.trimModificationError', `Error applying edit: ${e.message}`), 'error');
    } finally {
      setItemProcessing(prev => ({ ...prev, [id]: { inProgress: false } }));
    }
  };

  return { modifyAudioSpeed, modifySingleAudioEditCombined, fetchDurationsBatch };
};

export default useGeminiAudioSpeed;
