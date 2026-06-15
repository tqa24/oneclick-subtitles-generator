import { useState, useRef } from 'react';
import { SERVER_URL } from '../../../config';

const getBackupName = (fn) => {
  if (!fn) return null;
  const lastSlash = fn.lastIndexOf('/');
  const dir = lastSlash >= 0 ? fn.slice(0, lastSlash) : '';
  const base = lastSlash >= 0 ? fn.slice(lastSlash + 1) : fn;
  return `${dir ? dir + '/' : ''}backup_${base}`;
};

/**
 * Encapsulates per-item and global speed/trim editing of narration audio,
 * including the server-side combined trim+speed API calls and the real
 * file-duration state used to drive the trim slider maxima.
 *
 * @param {Object} params
 * @param {Array} params.generationResults - Raw generation results from props
 * @param {Function} params.t - i18next translation function (for error alerts)
 * @returns {Object} state + handlers consumed by NarrationResults / ResultRow
 */
const useNarrationAudioSpeed = ({ generationResults, t }) => {
  // Real file durations from server for slider max
  const [itemDurations, setItemDurations] = useState({}); // { [filename]: seconds }

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

  const [speedValue, setSpeedValue] = useState(1.0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const [currentFile, setCurrentFile] = useState('');
  // Track processed count robustly during streaming and unique items seen
  const processedCountRef = useRef(0);
  const seenItemsRef = useRef(new Set());

  // Per-item speed state
  const [itemSpeeds, setItemSpeeds] = useState({}); // { [subtitle_id]: number }
  const [itemProcessing, setItemProcessing] = useState({}); // { [subtitle_id]: { inProgress: boolean } }

  // Per-item trim state: { [subtitle_id]: [startSec, endSec] }
  const [itemTrims, setItemTrims] = useState({});

  const setItemSpeed = (id, val) => {
    setItemSpeeds(prev => ({ ...prev, [id]: val }));
  };
  const setItemTrim = (id, range) => {
    setItemTrims(prev => ({ ...prev, [id]: range }));
  };

  // Modify speed for all successful items (existing global control)
  const modifyAudioSpeed = async () => {
    if (!generationResults || generationResults.length === 0) return;

    const successfulNarrations = generationResults.filter(r => r.success && r.filename);
    if (successfulNarrations.length === 0) return;

    // Adjust all individual sliders to match global speed (including 1x)
    {
      const newSpeeds = {};
      successfulNarrations.forEach(r => { newSpeeds[r.subtitle_id] = Number(speedValue); });
      setItemSpeeds(prev => ({ ...prev, ...newSpeeds }));
    }

    setIsProcessing(true);
    // Use only the actual files we will process for total
    setProcessingProgress({ current: 0, total: successfulNarrations.length });
    // Do not show current filename in UI (keep state but blank)
    setCurrentFile('');

    try {
      // Build items with normalized trim (if any) relative to backup duration
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

      const apiUrl = `${SERVER_URL}/api/narration/batch-modify-audio-trim-speed-combined`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });
      if (!response.ok) throw new Error(`Server responded with status: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';


      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // finalize immediately
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
              // Robust processed computation: prefer 'processed', else numeric 'current', else infer via unique keys
              let processedNum = 0;
              if (typeof obj.processed === 'number') {
                processedNum = obj.processed;
              } else if (typeof obj.current === 'number') {
                processedNum = obj.current;
              } else {
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
              // Do not update currentFile for UI; omit filename display under progress
            } else if (obj.status === 'completed') {
              setProcessingProgress({ current: obj.processed ?? items.length, total: obj.total ?? items.length });
              setCurrentFile('');
              if (typeof window.resetAlignedNarration === 'function') {
                window.resetAlignedNarration();
              }
              window.dispatchEvent(new CustomEvent('narration-speed-modified', { detail: { speed: speedValue, timestamp: Date.now() } }));
              setIsProcessing(false);
            }
          } catch (e) {
            // ignore malformed chunk
          }
        }
      }

      // Background duration refresh, non-blocking
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
        // ignore
      }
    } catch (error) {
      console.error('Error applying batch combined edit:', error);
      alert(t('narration.speedModificationError', `Error applying batch edit: ${error.message}`));
    }
  };


  // Combined edit (trim + speed) for a single item; called on slider drop
  const modifySingleAudioEditCombined = async (result) => {
    if (!result?.filename) return;
    const id = result.subtitle_id;
    const [start, end] = itemTrims[id] || [undefined, undefined];
    const speed = itemSpeeds[id];

    // Compute normalized range relative to backup duration
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
        alert(t('narration.durationNotReady', 'Audio duration not ready yet. Please wait a moment and try again.'));
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
      if (!response.ok) throw new Error(`Server responded with status: ${response.status}`);
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
      alert(t('narration.trimModificationError', `Error applying edit: ${e.message}`));
    } finally {
      setItemProcessing(prev => ({ ...prev, [id]: { inProgress: false } }));
    }
  };

  return {
    itemDurations,
    setItemDurations,
    fetchDurationsBatch,
    speedValue,
    setSpeedValue,
    isProcessing,
    processingProgress,
    itemSpeeds,
    setItemSpeed,
    itemProcessing,
    itemTrims,
    setItemTrim,
    modifyAudioSpeed,
    modifySingleAudioEditCombined
  };
};

export default useNarrationAudioSpeed;
