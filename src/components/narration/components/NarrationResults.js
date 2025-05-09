import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { VariableSizeList as List } from 'react-window';

// Constants for localStorage keys
const NARRATION_CACHE_KEY = 'f5tts_narration_cache';
const CURRENT_VIDEO_ID_KEY = 'current_youtube_url';
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
    getAudioUrl,
    t
  } = data;

  const result = generationResults[index];
  const subtitle_id = result.subtitle_id;

  return (
    <div
      style={style}
      className={`result-item
        ${result.success ? '' : 'failed'}
        ${currentAudio && currentAudio.id === subtitle_id ? 'playing' : ''}
        ${retryingSubtitleId === subtitle_id ? 'retrying' : ''}`}
    >
      <div className="result-text">
        <span className="result-id">{subtitle_id}.</span>
        {result.text}
      </div>

      <div className="result-controls">
        {result.success ? (
          <>
            <button
              className="pill-button primary"
              onClick={() => playAudio(result)}
            >
              {currentAudio && currentAudio.id === subtitle_id && isPlaying ? (
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
            <a
              href={getAudioUrl(result.filename)}
              download={`narration_${result.subtitle_id}.wav`}
              className="pill-button secondary"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t('narration.download', 'Download')}
            </a>
            {onRetry && (
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
            )}
          </>
        )}
      </div>
    </div>
  );
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
  onRetryFailed
}) => {
  const { t } = useTranslation();
  const listRef = useRef(null);
  const rowHeights = useRef({});
  const [loadedFromCache, setLoadedFromCache] = useState(false);

  // Check if there are any failed narrations
  const hasFailedNarrations = generationResults && generationResults.some(result => !result.success);

  // Function to calculate row height based on content
  const getRowHeight = (index) => {
    // Return cached height if available
    if (rowHeights.current[index]) return rowHeights.current[index];

    // Calculate height based on content
    const result = generationResults[index];
    if (!result) return 60; // Default height

    // Calculate height based on text length
    const text = result.text || '';
    const lineCount = text.split('\n').length; // Count actual line breaks
    const estimatedLines = Math.ceil(text.length / 40); // Estimate based on characters per line
    const lines = Math.max(lineCount, estimatedLines);

    // Base height + additional height per line + space for controls
    const height = 60 + (lines > 1 ? (lines - 1) * 20 : 0);

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
        console.log('Saved F5-TTS narrations to cache:', cacheEntry);
      } catch (error) {
        console.error('Error saving F5-TTS narrations to cache:', error);
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

      console.log('Found cached F5-TTS narrations for current media:', cacheEntry);

      // Set loading state first
      setLoadedFromCache(true);

      // Use a small timeout to ensure the loading state is rendered
      setTimeout(() => {
        // Dispatch an event to notify other components about the loaded narrations
        const event = new CustomEvent('f5tts-narrations-loaded-from-cache', {
          detail: {
            narrations: cacheEntry.narrations,
            timestamp: Date.now()
          }
        });
        window.dispatchEvent(event);
      }, 100);
    } catch (error) {
      console.error('Error loading F5-TTS narrations from cache:', error);
    }
  }, [generationResults]);

  // Listen for narrations-updated event to update the component
  useEffect(() => {
    const handleNarrationsUpdated = (event) => {
      if (event.detail && event.detail.narrations && event.detail.fromCache) {
        console.log('NarrationResults received narrations-updated event with fromCache flag:', event.detail);
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

  return (
    <div className="results-section">
      <div className="results-header">
        <h4>{t('narration.results', 'Generated Narration')}</h4>

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

      <div className="results-list">
        {(!generationResults || generationResults.length === 0) ? (
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
            className="results-virtualized-list"
            height={700} // Increased height for the F5-TTS virtualized container to show more results
            width="100%"
            itemCount={generationResults ? generationResults.length : 0}
            itemSize={getRowHeight} // Dynamic row heights based on content
            overscanCount={5} // Number of items to render outside of the visible area
            itemData={{
              generationResults: generationResults || [],
              onRetry,
              retryingSubtitleId,
              currentAudio,
              isPlaying,
              playAudio,
              getAudioUrl,
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
