import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../../../styles/narration/geminiNarrationResults.css';
import { VariableSizeList as List } from 'react-window';

// Import utility functions
import { downloadAlignedAudio as downloadAlignedAudioUtil } from '../../../utils/narrationServerUtils';
import { getAudioUrl } from '../../../services/narrationService';

// Constants for localStorage keys
const NARRATION_CACHE_KEY = 'gemini_narration_cache';
const CURRENT_VIDEO_ID_KEY = 'current_youtube_url';
const CURRENT_FILE_ID_KEY = 'current_file_cache_id';

/**
 * Component for displaying Gemini narration results with audio playback
 * @param {Object} props - Component props
 * @param {Array} props.generationResults - Array of narration results
 * @param {Function} props.onRetry - Function to retry generation for a specific subtitle
 * @param {number|null} props.retryingSubtitleId - ID of the subtitle currently being retried
 * @param {Function} props.onRetryFailed - Function to retry all failed narrations
 * @param {boolean} props.hasGenerationError - Whether there was an error during generation
 * @returns {JSX.Element} - Rendered component
 */
// Virtualized row renderer for Gemini narration results
const GeminiResultRow = ({ index, style, data }) => {
  const {
    generationResults,
    onRetry,
    retryingSubtitleId,
    currentlyPlaying,
    isPlaying,
    playAudio,
    downloadAudio,
    t
  } = data;

  const item = generationResults[index];
  const subtitle_id = item.subtitle_id;
  const text = item.text;

  return (
    <div
      style={style}
      className={`gemini-result-item
        ${item.success ? 'success' : 'failed'}
        ${item.pending ? 'pending' : ''}
        ${currentlyPlaying === subtitle_id ? 'playing' : ''}
        ${retryingSubtitleId === subtitle_id ? 'retrying' : ''}`}
    >
      <div className="gemini-result-text">
        <span className="gemini-result-id">{subtitle_id}.</span>
        {text}
      </div>

      <div className="audio-controls">
        {item.success && item.audioData ? (
          // Successful generation with audio data
          <>
            <button
              className="pill-button primary"
              onClick={() => playAudio(item)}
            >
              {currentlyPlaying === subtitle_id && isPlaying ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="4" width="4" height="16" fill="currentColor" />
                    <rect x="14" y="4" width="4" height="16" fill="currentColor" />
                  </svg>
                  {t('narration.pause', 'Pause')}
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                  </svg>
                  {t('narration.play', 'Play')}
                </>
              )}
            </button>
            <button
              className="pill-button secondary"
              onClick={() => downloadAudio(item)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t('narration.download', 'Download')}
            </button>
            <button
              className={`pill-button secondary retry-button ${retryingSubtitleId === subtitle_id ? 'retrying' : ''}`}
              onClick={() => onRetry(subtitle_id)}
              title={t('narration.retry', 'Retry generation')}
              disabled={retryingSubtitleId === subtitle_id}
            >
              {retryingSubtitleId === subtitle_id ? (
                <>
                  <svg className="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  {t('narration.retrying', 'Retrying...')}
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 4v6h6" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                  {t('narration.retry', 'Retry')}
                </>
              )}
            </button>
          </>
        ) : item.pending ? (
          // Pending generation - show generate button
          <>
            <span className="gemini-status-message pending">
              {t('narration.pending', 'Pending generation...')}
            </span>
            <button
              className={`pill-button secondary generate-button ${retryingSubtitleId === subtitle_id ? 'retrying' : ''}`}
              onClick={() => onRetry(subtitle_id)}
              title={t('narration.generate', 'Generate this narration')}
              disabled={retryingSubtitleId === subtitle_id}
            >
              {retryingSubtitleId === subtitle_id ? (
                <>
                  <svg className="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  {t('narration.generating', 'Generating...')}
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                  </svg>
                  {t('narration.generate', 'Generate')}
                </>
              )}
            </button>
          </>
        ) : (
          // Failed generation
          <>
            <span className="gemini-error-message">
              {t('narration.failed', 'Generation failed')}
            </span>
            <button
              className={`pill-button secondary retry-button ${retryingSubtitleId === subtitle_id ? 'retrying' : ''}`}
              onClick={() => onRetry(subtitle_id)}
              title={t('narration.retry', 'Retry generation')}
              disabled={retryingSubtitleId === subtitle_id}
            >
              {retryingSubtitleId === subtitle_id ? (
                <>
                  <svg className="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  {t('narration.retrying', 'Retrying...')}
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 4v6h6" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                  {t('narration.retry', 'Retry')}
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Helper function to generate a hash for subtitles to use as a cache key
 * @param {Array} subtitles - Array of subtitle objects
 * @returns {string} - Hash string
 */
const generateSubtitleHash = (subtitles) => {
  if (!subtitles || !subtitles.length) return '';

  // Create a string representation of the subtitles (just IDs and text)
  const subtitleString = subtitles.map(s => `${s.subtitle_id}:${s.text}`).join('|');

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
 * Helper function to get the current video/file identifier
 * @returns {string|null} - Current video/file ID or null if not found
 */
const getCurrentMediaId = () => {
  // Check for YouTube URL first
  const youtubeUrl = localStorage.getItem(CURRENT_VIDEO_ID_KEY);
  if (youtubeUrl) {
    // Extract video ID from URL
    const match = youtubeUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
  }

  // Check for file cache ID
  return localStorage.getItem(CURRENT_FILE_ID_KEY);
};

const GeminiNarrationResults = ({
  generationResults,
  onRetry,
  retryingSubtitleId,
  onRetryFailed,
  hasGenerationError = false
}) => {
  const { t } = useTranslation();
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const listRef = useRef(null);
  const rowHeights = useRef({});
  const [loadedFromCache, setLoadedFromCache] = useState(false);

  // Check if there are any failed narrations
  const hasFailedNarrations = generationResults && generationResults.some(result => !result.success);

  // Function to calculate row height based on text content
  const getRowHeight = index => {
    // If we already calculated this height, return it
    if (rowHeights.current[index] !== undefined) {
      return rowHeights.current[index];
    }

    const item = generationResults[index];
    if (!item) return 80; // Default height

    // Calculate height based on text length
    const text = item.text || '';
    const lineCount = text.split('\n').length; // Count actual line breaks
    const estimatedLines = Math.ceil(text.length / 40); // Estimate based on characters per line
    const lines = Math.max(lineCount, estimatedLines);

    // Base height + additional height per line + space for controls
    const height = 80 + (lines > 1 ? (lines - 1) * 20 : 0);

    // Cache the calculated height
    rowHeights.current[index] = height;
    return height;
  };

  // Reset row heights when results change
  useEffect(() => {
    rowHeights.current = {};
    if (listRef.current) {
      listRef.current.resetAfterIndex(0);
    }

    // Save narrations to cache when they change
    if (generationResults && generationResults.length > 0) {
      try {
        // Get current media ID
        const mediaId = getCurrentMediaId();
        if (!mediaId) return;

        // Generate a hash of the subtitles
        const subtitleHash = generateSubtitleHash(generationResults);

        // Create cache entry
        const cacheEntry = {
          mediaId,
          subtitleHash,
          timestamp: Date.now(),
          narrations: generationResults
        };

        // Save to localStorage
        localStorage.setItem(NARRATION_CACHE_KEY, JSON.stringify(cacheEntry));
        console.log('Saved narrations to cache:', cacheEntry);
      } catch (error) {
        console.error('Error saving narrations to cache:', error);
      }
    }
  }, [generationResults]);

  // Load narrations from cache on component mount
  useEffect(() => {
    // Only try to load from cache if we don't have results yet
    if (generationResults && generationResults.length > 0) return;

    try {
      // Get current media ID
      const mediaId = getCurrentMediaId();
      if (!mediaId) return;

      // Get cache entry
      const cacheEntryJson = localStorage.getItem(NARRATION_CACHE_KEY);
      if (!cacheEntryJson) return;

      const cacheEntry = JSON.parse(cacheEntryJson);

      // Check if cache entry is for the current media
      if (cacheEntry.mediaId !== mediaId) return;

      // Check if we have narrations
      if (!cacheEntry.narrations || !cacheEntry.narrations.length) return;

      console.log('Found cached narrations for current media:', cacheEntry);

      // Set loading state first
      setLoadedFromCache(true);

      // Use a small timeout to ensure the loading state is rendered
      setTimeout(() => {
        // Dispatch an event to notify other components about the loaded narrations
        const event = new CustomEvent('narrations-loaded-from-cache', {
          detail: {
            narrations: cacheEntry.narrations,
            timestamp: Date.now()
          }
        });
        window.dispatchEvent(event);
      }, 100);
    } catch (error) {
      console.error('Error loading narrations from cache:', error);
    }
  }, [generationResults]);

  // Listen for narrations-updated event to update the component
  useEffect(() => {
    const handleNarrationsUpdated = (event) => {
      if (event.detail && event.detail.narrations && event.detail.fromCache) {
        console.log('GeminiNarrationResults received narrations-updated event with fromCache flag:', event.detail);
        // Reset loading state since we now have the narrations
        setLoadedFromCache(false);
      }
    };

    // Add event listener
    window.addEventListener('narrations-updated', handleNarrationsUpdated);

    // Clean up
    return () => {
      window.removeEventListener('narrations-updated', handleNarrationsUpdated);
    };
  }, []);

  // Show a loading message while waiting for narrations to load
  useEffect(() => {
    // If we have loaded from cache but don't have results yet, show a loading message
    if (loadedFromCache && (!generationResults || generationResults.length === 0)) {
      console.log('Showing loading message while waiting for narrations to load from cache');
    }
  }, [loadedFromCache, generationResults]);

  // Play audio function - simplified approach like F5-TTS
  const playAudio = (result) => {
    // If already playing this audio, stop it
    if (currentlyPlaying === result.subtitle_id && isPlaying) {
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      return;
    }

    // Set up the audio element with the new source
    if (audioRef.current) {
      // Set the source to the new audio file
      audioRef.current.src = getAudioUrl(result.filename);

      // Update state to show we're playing this subtitle
      setCurrentlyPlaying(result.subtitle_id);
      setIsPlaying(true);

      // Play the audio
      audioRef.current.play().catch(error => {
        console.error(`Error playing audio for subtitle ${result.subtitle_id}:`, error);
        setIsPlaying(false);
      });
    }
  };

  // Handle audio ended event
  const handleAudioEnded = () => {
    console.log('Audio playback ended');
    setIsPlaying(false);
  };

  // Download audio as WAV file
  const downloadAudio = (result) => {
    if (result.filename) {
      // Create a download link
      const a = document.createElement('a');
      a.href = getAudioUrl(result.filename);
      a.download = `narration_${result.subtitle_id}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      console.error('No filename available for download');
      alert(t('narration.downloadError', 'No audio file available for download'));
    }
  };

  // Download all audio files
  const downloadAllAudio = () => {
    // Download each audio file individually
    generationResults.forEach(result => {
      if (result.success && result.filename) {
        downloadAudio(result);
      }
    });
  };

  // Download aligned narration audio (one file)
  const handleDownloadAlignedAudio = async () => {
    await downloadAlignedAudioUtil(generationResults, t);
  };

  return (
    <div className="gemini-narration-results">
      <div className="results-header">
        <h4>{t('narration.geminiResults', 'Generated Narration (Gemini)')}</h4>

        {/* Retry Failed Narrations button */}
        {hasFailedNarrations && onRetryFailed && (
          <button
            className="pill-button secondary retry-failed-button"
            onClick={onRetryFailed}
            disabled={retryingSubtitleId !== null}
            title={t('narration.retryFailedTooltip', 'Retry all failed narrations')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4v6h6" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            {t('narration.retryFailed', 'Retry Failed Narrations')}
          </button>
        )}
      </div>

      <div className="gemini-results-list">
        {(!generationResults || generationResults.length === 0) && !hasGenerationError ? (
          loadedFromCache ? (
            // Show loading indicator when loading from cache
            <div className="loading-from-cache-message">
              <div className="loading-spinner-small"></div>
              {t('narration.loadingFromCache', 'Loading narrations from previous session...')}
            </div>
          ) : (
            // Show waiting message when no results and not loading from cache
            <div className="no-results-message">
              {t('narration.waitingForResults', 'Waiting for narration results...')}
            </div>
          )
        ) : (
          // Use virtualized list for better performance with large datasets
          <List
            ref={listRef}
            className="gemini-results-virtualized-list"
            height={400} // Fixed height for the virtualized container
            width="100%"
            itemCount={generationResults ? generationResults.length : 0}
            itemSize={getRowHeight} // Dynamic row heights based on content
            overscanCount={5} // Number of items to render outside of the visible area
            itemData={{
              generationResults: generationResults || [],
              onRetry,
              retryingSubtitleId,
              currentlyPlaying,
              isPlaying,
              playAudio,
              downloadAudio,
              t
            }}
          >
            {GeminiResultRow}
          </List>
        )}
      </div>

      {/* Download buttons - styled like the F5-TTS section */}
      <div className="gemini-export-controls">
        <div className="pill-button-group">
          <button
            className="pill-button secondary download-all-btn"
            onClick={downloadAllAudio}
            title={t('narration.downloadAllTooltip', 'Download all generated audio files')}
            disabled={!generationResults || generationResults.length === 0 || !generationResults.some(r => r.success && r.audioData)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t('narration.downloadAll', 'Download All')}
          </button>
          <button
            className="pill-button secondary"
            onClick={handleDownloadAlignedAudio}
            title={t('narration.downloadAlignedTooltip', 'Download a single aligned narration file')}
            disabled={!generationResults || generationResults.length === 0 || !generationResults.some(r => r.success && r.audioData)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t('narration.downloadAligned', 'Download as aligned on timeline')}
          </button>
        </div>
      </div>

      {/* Hidden audio player for playback */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        style={{ display: 'none' }}
        data-testid="hidden-audio-player"
        preload="auto"
      />
    </div>
  );
};

export default GeminiNarrationResults;
