import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import SliderWithValue from '../../common/SliderWithValue';
import StandardSlider from '../../common/StandardSlider';
import LoadingIndicator from '../../common/LoadingIndicator';
import HelpIcon from '../../common/HelpIcon';
import '../../../utils/functionalScrollbar';
import { VariableSizeList as List } from 'react-window';
import { SERVER_URL } from '../../../config';
import { enhanceF5TTSNarrations } from '../../../utils/narrationEnhancer';
import { formatTime } from '../../../utils/timeFormatter';

// Constants for localStorage keys
const CURRENT_VIDEO_ID_KEY = 'current_video_url';
const CURRENT_FILE_ID_KEY = 'current_file_cache_id';

/**
 * Virtualized row renderer for F5-TTS narration results
 */
const ResultRow = ({ index, style, data }) => {
  const {
    generationResults,
    onRetry,
    retryingSubtitleId,
    currentAudio,
    isPlaying,
    playAudio,
    downloadAudio,
    t
  } = data;

  const result = generationResults[index];
  const subtitle_id = result.subtitle_id;

  const isTransformed = result.transformations && result.transformations.transformed;

  // Generate tooltip content for transformations
  const getTransformationTooltip = () => {
    if (!isTransformed || !result.transformations) return null;

    const parts = [];
    if (result.transformations.punctuation_replaced && result.transformations.punctuation_replaced.length > 0) {
      parts.push(t('narration.transformations.punctuationReplaced', {
        punctuation: result.transformations.punctuation_replaced.join('')
      }));
    }

    const hasNumbers = result.transformations.numbers_converted && result.transformations.numbers_converted.length > 0;
    const hasDates = result.transformations.dates_converted && result.transformations.dates_converted.length > 0;

    if (hasNumbers && hasDates) {
      parts.push(t('narration.transformations.numbersAndDatesConverted'));
    } else if (hasNumbers) {
      parts.push(t('narration.transformations.numbersConverted'));
    } else if (hasDates) {
      parts.push(t('narration.transformations.datesConverted'));
    }

    return parts.join(', ');
  };

  const tooltipContent = getTransformationTooltip();

  const resultItem = (
    <div
      style={style}
      className={`result-item
        ${result.success ? '' : result.pending ? 'pending' : 'failed'}
        ${currentAudio && currentAudio.id === subtitle_id ? 'playing' : ''}
        ${retryingSubtitleId === subtitle_id ? 'retrying' : ''}
        ${isTransformed ? 'transformed' : ''}`}
    >
      <div className="result-text hide-native-scrollbar">
        {/* Display 1-based row number for user-friendly sequential numbering */}
        <span className="result-id">{index + 1}.</span>
        {result.text}
        {isTransformed && tooltipContent && (
          <HelpIcon
            title={tooltipContent}
            size={12}
            className="transformation-help-icon"
            style={{ marginLeft: '8px', verticalAlign: 'middle' }}
          />
        )}
      </div>

      <div className="result-controls">
        {result.pending ? (
          <>
            <span className="status-message pending">
              {t('narration.pending', 'Pending generation...')}
            </span>
            {onRetry && (
              <button
                className={`pill-button secondary generate-button ${retryingSubtitleId === subtitle_id ? 'retrying' : ''}`}
                onClick={() => onRetry(subtitle_id)}
                title={t('narration.generate', 'Generate this narration')}
                disabled={retryingSubtitleId === subtitle_id}
              >
                {retryingSubtitleId === subtitle_id ? (
                  <>
                    <LoadingIndicator
                      theme="dark"
                      showContainer={false}
                      size={14}
                      className="generate-loading-indicator"
                    />
                    {t('narration.generating', 'Generating...')}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>play_arrow</span>
                    {t('narration.generate', 'Generate')}
                  </>
                )}
              </button>
            )}
          </>
        ) : result.success ? (
          <>
            {/* Per-item trim range slider */}
            {result && (
              <div className="per-item-trim-controls" style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
                {(() => {
                  const getBackupForTrimName = (fn) => {
                    if (!fn) return null;
                    const lastSlash = fn.lastIndexOf('/');
                    const dir = lastSlash >= 0 ? fn.slice(0, lastSlash) : '';
                    const base = lastSlash >= 0 ? fn.slice(lastSlash + 1) : fn;
                    return `${dir ? dir + '/' : ''}backup_for_trim_${base}`;
                  };
                  const backupName = getBackupForTrimName(result.filename);
                  const backupDuration = (backupName && data.itemDurations && typeof data.itemDurations[backupName] === 'number')
                    ? data.itemDurations[backupName]
                    : null;
                  const currentDuration = (typeof result.filename === 'string' && data.itemDurations && typeof data.itemDurations[result.filename] === 'number')
                    ? data.itemDurations[result.filename]
                    : null;
                  const totalDuration = (typeof backupDuration === 'number' && backupDuration > 0)
                    ? backupDuration
                    : (typeof currentDuration === 'number' && currentDuration > 0)
                      ? currentDuration
                      : (typeof result.audioDuration === 'number' && result.audioDuration > 0)
                        ? result.audioDuration
                        : (typeof result.start === 'number' && typeof result.end === 'number' && result.end > result.start)
                          ? (result.end - result.start)
                          : 10;
                  const trim = data.itemTrims[subtitle_id] ?? [0, totalDuration];
                  const [trimStart, trimEnd] = trim;
                  return (
                    <>
                      <span style={{ minWidth: 70, maxWidth: 70, display: 'inline-block', textAlign: 'center', fontSize: '1.15em', fontFamily: 'monospace', fontWeight: 500 }}>
                        {formatTime(trimStart, 'hms_ms')}
                      </span>
                      <StandardSlider
                        range
                        value={[trimStart, trimEnd]}
                        min={0}
                        max={totalDuration}
                        step={0.01}
                        onChange={([start, end]) => data.setItemTrim(subtitle_id, [start, end])}
                        onDragEnd={() => data.modifySingleAudioTrim(result, [trimStart, trimEnd])}
                        orientation="Horizontal"
                        size="XSmall"
                        width="compact"
                        showValueIndicator={false}
                        showStops={false}
                        className="per-item-trim-slider"
                        style={{ width: 200 }}
                      />
                      <span style={{ minWidth: 70, maxWidth: 70, display: 'inline-block', textAlign: 'center', fontSize: '1.15em', fontFamily: 'monospace', fontWeight: 500 }}>
                        {formatTime(trimEnd, 'hms_ms')}
                      </span>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Per-item speed slider */}
            {result.filename && (
              <SliderWithValue
                value={data.itemSpeeds[subtitle_id] ?? 1.0}
                onChange={(v) => data.setItemSpeed(subtitle_id, parseFloat(v))}
                onDragEnd={() => data.modifySingleAudioSpeed(result, data.itemSpeeds[subtitle_id] ?? 1.0)}
                min={0.5}
                max={2.0}
                step={0.01}
                defaultValue={1.0}
                orientation="Horizontal"
                size="XSmall"
                state={data.itemProcessing[subtitle_id]?.inProgress ? 'Disabled' : 'Enabled'}
                width="compact"
                className="standard-slider-container width-compact orientation-horizontal size-XSmall state-Enabled speed-control-slider"
                style={{ width: '120px', marginRight: '8px' }}
                id={`item-speed-${subtitle_id}`}
                ariaLabel={t('narration.speed', 'Speed')}
                formatValue={(val) => `${Number(val).toFixed(2)}x`}
              />
            )}

            <button
              className="pill-button primary"
              onClick={() => playAudio(result)}
              disabled={!!data.itemProcessing[subtitle_id]?.inProgress}
            >
              {currentAudio && currentAudio.id === subtitle_id && isPlaying ? (
                <>
                  <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>pause</span>
                  {t('narration.pause', 'Pause')}
                </>
              ) : (
                <>
                  <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>play_arrow</span>
                  {t('narration.play', 'Play')}
                </>
              )}
            </button>
            <button
              className="pill-button secondary"
              onClick={() => downloadAudio(result)}
              disabled={!!data.itemProcessing[subtitle_id]?.inProgress}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>download</span>
              {t('narration.download', 'Download')}
            </button>
            {onRetry && (
              <button
                className={`pill-button secondary retry-button ${retryingSubtitleId === subtitle_id ? 'retrying' : ''}`}
                onClick={() => onRetry(subtitle_id)}
                title={t('narration.retry', 'Retry generation')}
                disabled={retryingSubtitleId === subtitle_id || !!data.itemProcessing[subtitle_id]?.inProgress}
              >
                {retryingSubtitleId === subtitle_id ? (
                  <>
                    <LoadingIndicator
                      theme="dark"
                      showContainer={false}
                      size={14}
                      className="retry-loading-indicator"
                    />
                    {t('narration.retrying', 'Retrying...')}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>refresh</span>
                    {t('narration.retry', 'Retry')}
                  </>
                )}
              </button>
            )}
          </>
        ) : (
          <>
            <span className="error-message">
              {t('narration.failed', 'Generation failed')}
            </span>
            {onRetry && (
              <button
                className={`pill-button secondary retry-button ${retryingSubtitleId === subtitle_id ? 'retrying' : ''}`}
                onClick={() => onRetry(subtitle_id)}
                title={t('narration.retry', 'Retry generation')}
                disabled={retryingSubtitleId === subtitle_id}
              >
                {retryingSubtitleId === subtitle_id ? (
                  <>
                    <LoadingIndicator
                      theme="dark"
                      showContainer={false}
                      size={14}
                      className="retry-loading-indicator"
                    />
                    {t('narration.retrying', 'Retrying...')}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>refresh</span>
                    {t('narration.retry', 'Retry')}
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );

  return resultItem;
};

/**
 * Helper function to get current media ID (either YouTube URL or file ID)
 */
const getCurrentMediaId = () => {
  const youtubeUrl = localStorage.getItem(CURRENT_VIDEO_ID_KEY);
  const fileId = localStorage.getItem(CURRENT_FILE_ID_KEY);
  return youtubeUrl || fileId || null;
};

/**
 * Helper function to generate a simple hash of subtitles for cache validation
 */
const generateSubtitleHash = (results) => {
  if (!results || !results.length) return '';

  // Create a string of all subtitle IDs and text
  const subtitleString = results.map(r => `${r.subtitle_id}:${r.text}`).join('|');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < subtitleString.length; i++) {
    const char = subtitleString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
};

/**
 * Narration Results component
 * @param {Object} props - Component props
 * @param {Array} props.generationResults - Generation results
 * @param {Function} props.playAudio - Function to play audio
 * @param {Object} props.currentAudio - Current audio being played
 * @param {boolean} props.isPlaying - Whether audio is playing
 * @param {Function} props.getAudioUrl - Function to get audio URL
 * @param {Function} props.onRetry - Function to retry generation for a specific subtitle
 * @param {number|null} props.retryingSubtitleId - ID of the subtitle currently being retried
 * @param {Function} props.onRetryFailed - Function to retry all failed narrations
 * @returns {JSX.Element} - Rendered component
 */
const NarrationResults = ({
  generationResults,
  playAudio,
  currentAudio,
  isPlaying,
  getAudioUrl,
  onRetry,
  retryingSubtitleId,
  onRetryFailed,
  onGenerateAllPending,
  subtitleSource,
  isGenerating,
  plannedSubtitles
}) => {
  const { t } = useTranslation();

  const listRef = useRef(null);
  const rowHeights = useRef({});

  // Derive a displayed list that immediately shows the full "true" list during generation (like Gemini)
  const trueSubtitles = (() => {
    // If caller provided an explicit plan, always prefer it
    if (Array.isArray(plannedSubtitles) && plannedSubtitles.length > 0) {
      return plannedSubtitles;
    }
    // Prefer grouped subtitles when enabled (from global state)
    if (typeof window !== 'undefined' && window.useGroupedSubtitles && Array.isArray(window.groupedSubtitles) && window.groupedSubtitles.length > 0) {
      return window.groupedSubtitles;
    }
    // Otherwise infer from selected source using globals populated elsewhere
    if (subtitleSource === 'translated' && typeof window !== 'undefined' && Array.isArray(window.translatedSubtitles) && window.translatedSubtitles.length > 0) {
      return window.translatedSubtitles;
    }
    if (typeof window !== 'undefined') {
      return window.originalSubtitles || window.subtitlesData || [];
    }
    return [];
  })();

  const displayedResults = (() => {
    // Always show all planned subtitles, with status based on generation results
    if (trueSubtitles.length > 0) {
      const completedIds = new Set();
      const failedIds = new Set();

      // Track completed and failed results
      if (generationResults && generationResults.length > 0) {
        generationResults.forEach(result => {
          if (result.success) {
            completedIds.add(result.subtitle_id);
          } else if (!result.pending) {
            failedIds.add(result.subtitle_id);
          }
        });
      }

      // Create results for all subtitles
      const results = trueSubtitles.map((subtitle, index) => {
        const subtitleId = subtitle.id ?? subtitle.subtitle_id ?? (index + 1);
        const existingResult = generationResults?.find(r => r.subtitle_id === subtitleId);

        if (existingResult) {
          // Use existing result
          return existingResult;
        } else {
          // Create pending result
          return {
            subtitle_id: subtitleId,
            text: subtitle.text || '',
            success: false,
            pending: true,
            start: subtitle.start,
            end: subtitle.end,
            original_ids: subtitle.original_ids || (subtitle.id ? [subtitle.id] : [])
          };
        }
      });

      // Sort by subtitle_id to maintain order
      results.sort((a, b) => a.subtitle_id - b.subtitle_id);
      return results;
    }

    // Fallback: show generation results if no planned subtitles
    return generationResults || [];
  })();

  // Speed control state

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

  // Load durations for both main files and their trim backups
  useEffect(() => {
    const getBackupForTrimName = (fn) => {
      if (!fn) return null;
      const lastSlash = fn.lastIndexOf('/');
      const dir = lastSlash >= 0 ? fn.slice(0, lastSlash) : '';
      const base = lastSlash >= 0 ? fn.slice(lastSlash + 1) : fn;
      return `${dir ? dir + '/' : ''}backup_for_trim_${base}`;
    };

    const filenames = (displayedResults || [])
      .map(r => r && r.filename)
      .filter(Boolean);

    const backupFilenames = filenames.map(getBackupForTrimName).filter(Boolean);

    const allFilenames = [...new Set([...filenames, ...backupFilenames])];

    if (allFilenames.length > 0) {
      fetchDurationsBatch(allFilenames);
    }
  }, [displayedResults]);

  const [speedValue, setSpeedValue] = useState(1.0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const [currentFile, setCurrentFile] = useState('');

  // Download audio as WAV file
  const downloadAudio = (result) => {
    if (result.filename) {
      try {


        // Get the audio URL
        const audioUrl = getAudioUrl(result.filename);


        // Use fetch to get the file as a blob
        fetch(audioUrl)

          .then(response => {
            if (!response.ok) {
              throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }
            return response.blob();
          })
          .then(blob => {
            // Create a blob URL
            const blobUrl = URL.createObjectURL(blob);

            // Create a download link
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `narration_${result.subtitle_id}.wav`;
            a.style.display = 'none';
            document.body.appendChild(a);

            // Trigger the download
            a.click();

            // Clean up
            setTimeout(() => {
              document.body.removeChild(a);
              URL.revokeObjectURL(blobUrl);
            }, 100);


          })
          .catch(error => {
            console.error('Error downloading audio file:', error);
            alert(t('narration.downloadError', `Error downloading audio file: ${error.message}`));
          });
      } catch (error) {
        console.error('Error initiating download:', error);
        alert(t('narration.downloadError', `Error initiating download: ${error.message}`));
      }
    } else {
      console.error('No filename available for download');
      alert(t('narration.downloadError', 'No audio file available for download'));
    }
  };

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
    setProcessingProgress({ current: 0, total: successfulNarrations.length });
    setCurrentFile('');

    try {
      const apiUrl = `${SERVER_URL}/api/narration/batch-modify-audio-speed`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filenames: successfulNarrations.map(r => r.filename),
          speedFactor: speedValue
        })
      });
      if (!response.ok) throw new Error(`Server responded with status: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.status === 'progress') {
                setProcessingProgress({ current: data.current, total: data.total });
                setCurrentFile(data.filename || '');
              } else if (data.status === 'completed') {
                setProcessingProgress({ current: data.total, total: data.total });
                setCurrentFile('');
              } else if (data.status === 'error') {
                throw new Error(data.error || 'Unknown error occurred');
              }
            } catch (e) {
              console.error('Error parsing progress data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error modifying audio speed:', error);
      alert(t('narration.speedModificationError', `Error modifying audio speed: ${error.message}`));
    } finally {
      setIsProcessing(false);
      setProcessingProgress({ current: 0, total: 0 });
      setCurrentFile('');
    }
  };

  // Modify speed for a single item; auto-apply on mouse drop
  const modifySingleAudioSpeed = async (result, speed) => {
    if (!result?.filename) return;
    const id = result.subtitle_id;
    setItemProcessing(prev => ({ ...prev, [id]: { inProgress: true } }));
    try {
      const apiUrl = `${SERVER_URL}/api/narration/batch-modify-audio-speed`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames: [result.filename], speedFactor: speed })
      });
      if (!response.ok) throw new Error(`Server responded with status: ${response.status}`);
      // Consume stream quickly; we don't need per-chunk UI for single item
      const reader = response.body.getReader();
      // Drain
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
      // Notify other parts to refresh aligned narration if needed
      if (typeof window !== 'undefined') {
        if (typeof window.resetAlignedNarration === 'function') {
          window.resetAlignedNarration();
        }
        window.dispatchEvent(new CustomEvent('narration-speed-modified', { detail: { speed, id, timestamp: Date.now() } }));
      }
    } catch (e) {
      console.error('Error modifying single audio speed:', e);
      alert(t('narration.speedModificationError', `Error modifying audio speed: ${e.message}`));
    } finally {
      setItemProcessing(prev => ({ ...prev, [id]: { inProgress: false } }));
    }
  };

  // Modify trim for a single item; auto-apply on range drop
  const modifySingleAudioTrim = async (result, [start, end]) => {
    if (!result?.filename) return;
    const id = result.subtitle_id;
    setItemProcessing(prev => ({ ...prev, [id]: { inProgress: true } }));
    try {
      const apiUrl = `${SERVER_URL}/api/narration/modify-audio-trim`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: result.filename, start, end })
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
        window.dispatchEvent(new CustomEvent('narration-trim-modified', { detail: { start, end, id, timestamp: Date.now() } }));
      }
    } catch (e) {
      console.error('Error modifying single audio trim:', e);
      alert(t('narration.trimModificationError', `Error modifying audio trim: ${e.message}`));
    } finally {
      setItemProcessing(prev => ({ ...prev, [id]: { inProgress: false } }));
    }
  };


  // Check if there are any failed narrations (exclude pending items)
  const hasFailedNarrations = generationResults && generationResults.some(result => !result.success && !result.pending);

  // Check if there are any pending narrations
  const hasPendingNarrations = displayedResults && displayedResults.some(result => result.pending);

  // Function to calculate row height based on explicit line breaks only (stable like LyricsDisplay)
  const getRowHeight = (index) => {
    // Return cached height if available
    if (rowHeights.current[index] !== undefined) return rowHeights.current[index];

    const result = displayedResults[index];
    if (!result) return 60; // Default height for a single-line item with controls

    // Only count explicit line breaks to avoid jitter from soft-wrap estimation
    const text = result.text || '';
    const lineCount = Math.max(1, text.split('\n').length);

    // Base height + additional height per extra line
    const height = 60 + (lineCount - 1) * 20;

    // Cache the calculated height
    rowHeights.current[index] = height;
    return height;
  };

  // Function to save audio to server
  const saveAudioToServer = async (result) => {
    if (!result || !result.audioData) return null;

    try {
      // Send the audio data to the server
      const response = await fetch(`${SERVER_URL}/api/narration/save-f5tts-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioData: result.audioData,
          subtitle_id: result.subtitle_id,
          sampleRate: result.sampleRate || 24000,
          mimeType: result.mimeType || 'audio/pcm'
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();

      if (data.success) {
        // Return the filename
        return data.filename;
      } else {
        throw new Error(data.error || 'Unknown error saving audio to server');
      }
    } catch (error) {
      console.error(`Error saving audio for subtitle ${result.subtitle_id}:`, error);
      return null;
    }
  };

  // Reset row heights when results change
  useEffect(() => {
    rowHeights.current = {};
    if (listRef.current) {
      listRef.current.resetAfterIndex(0);
    }

    // Save narrations to file system when they change
    if (generationResults && generationResults.length > 0) {
      try {
        // Process each narration result that has audioData but no filename
        const savePromises = generationResults
          .filter(result => result.success && result.audioData && !result.filename)
          .map(async (result) => {
            const filename = await saveAudioToServer(result);
            if (filename) {
              // Update the result with the filename
              result.filename = filename;
              // Remove the audioData to save memory once it's saved to the server
              delete result.audioData;
            }
            return result;
          });

        // Wait for all save operations to complete
        Promise.all(savePromises)
          .then(updatedResults => {
            if (updatedResults.length > 0) {
              // Get subtitles from window object for enhancing narrations with timing information
              const subtitles = window.originalSubtitles || window.subtitlesData || [];

              // Enhance narrations with timing information from subtitles
              const enhancedResults = enhanceF5TTSNarrations(generationResults, subtitles);

              // Make sure all narrations have the filename property set
              // This is critical for the "Refresh Narration" button to work
              const resultsWithFilenames = enhancedResults.map(result => {
                // If the result already has a filename, use it
                if (result.filename) {
                  return result;
                }

                // If the result doesn't have a filename but has audioData, it means
                // we're still in the process of saving it to the server
                if (result.audioData) {
                  console.warn(`Narration for subtitle ${result.subtitle_id} has audioData but no filename yet`);
                  return result;
                }

                // If the result has neither filename nor audioData, it's likely a failed narration
                if (!result.success) {
                  return result;
                }

                // For any other case, construct a default filename based on the subtitle_id
                return {
                  ...result,
                  filename: `subtitle_${result.subtitle_id}/f5tts_1.wav`
                };
              });

              // Update window.originalNarrations with enhanced results for alignment
              window.originalNarrations = [...resultsWithFilenames];

              // Dispatch an event to notify other components that narrations have been updated
              const event = new CustomEvent('narrations-updated', {
                detail: {
                  source: 'original', // Assuming F5-TTS narrations are for original subtitles
                  narrations: resultsWithFilenames
                }
              });
              window.dispatchEvent(event);
            }
          })
          .catch(error => {
            console.error('Error saving F5-TTS narrations to server:', error);
          });

      } catch (error) {
        console.error('Error processing F5-TTS narrations for saving:', error);
      }
    }
  }, [generationResults]);



  return (
    <div className="results-section">
      <div className="results-header">
        <h4>{t('narration.results', 'Generated Narration')}</h4>

        {/* Generate All Pending Narrations button */}
        {hasPendingNarrations && onGenerateAllPending && (
          <button
            className="pill-button secondary generate-all-pending-button"
            onClick={onGenerateAllPending}
            disabled={retryingSubtitleId !== null}
            title={t('narration.generateAllPendingTooltip', 'Generate all pending narrations')}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>play_arrow</span>
            {t('narration.generateAllPending', 'Generate All Pending')}
          </button>
        )}

        {/* Retry Failed Narrations button */}
        {hasFailedNarrations && onRetryFailed && (
          <button
            className="pill-button secondary retry-failed-button"
            onClick={onRetryFailed}
            disabled={retryingSubtitleId !== null}
            title={t('narration.retryFailedTooltip', 'Retry all failed narrations')}
          >
            <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>refresh</span>
            {t('narration.retryFailed', 'Retry Failed Narrations')}
          </button>
        )}

        {/* Speed Control Slider */}
        {generationResults && generationResults.length > 0 && (
          <div className="speed-control-container">
            <span className="speed-control-label">{t('narration.speed', 'Speed')}:</span>
            <SliderWithValue
              value={speedValue}
              onChange={(value) => setSpeedValue(parseFloat(value))}
              min={0.5}
              max={2.0}
              step={0.01}
              orientation="Horizontal"
              size="XSmall"
              state={isProcessing ? "Disabled" : "Enabled"}
              width="compact"
              className="standard-slider-container width-compact orientation-horizontal size-XSmall state-Enabled speed-control-slider"
              style={{ width: '150px' }}
              id="narration-speed-control"
              ariaLabel={t('narration.speed', 'Speed')}
              formatValue={(v) => `${Number(v).toFixed(2)}x`}
            />
            {isProcessing ? (
              <div className="speed-control-progress">
                <div className="speed-control-spinner"></div>
                <div className="speed-control-progress-info">
                  <span>{processingProgress.current}/{processingProgress.total}</span>
                  {currentFile && (
                    <span className="speed-control-filename" title={currentFile}>
                      {currentFile}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <button
                className="speed-control-apply-button"
                onClick={modifyAudioSpeed}
                disabled={!generationResults || generationResults.length === 0}
              >
                {t('narration.apply', 'Apply')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="results-list">
        {displayedResults.length === 0 ? (
          <div className="no-results-message">
            {t('narration.waitingForResults', 'Waiting for narration results...')}
          </div>
        ) : (
          // Use virtualized list for better performance with large datasets
          <List
            ref={listRef}
            className="results-virtualized-list"
            height={700} // Increased height for the F5-TTS virtualized container to show more results
            width="100%"
            itemCount={displayedResults.length}
            itemSize={getRowHeight} // Dynamic row heights based on content
            overscanCount={18} // Increase overscan to reduce blanking during fast scrolls
            itemKey={(index, data) => (data.generationResults[index] && data.generationResults[index].subtitle_id) ?? index}
            itemData={{
              generationResults: displayedResults,
              onRetry,
              retryingSubtitleId,
              currentAudio,
              isPlaying,
              playAudio,
              getAudioUrl,
              downloadAudio,
              // per-item trim and speed control
              itemTrims,
              setItemTrim,
              itemSpeeds,
              setItemSpeed,
              modifySingleAudioSpeed,
              modifySingleAudioTrim,
              itemProcessing,
              itemDurations,
              t
            }}
          >
            {ResultRow}
          </List>
        )}
      </div>
    </div>
  );
};

export default NarrationResults;
