import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../../../styles/narration/geminiNarrationResults.css';

// Import utility functions
import { downloadAlignedAudio as downloadAlignedAudioUtil } from '../../../utils/narrationServerUtils';
import { playAudio as playAudioHandler, downloadAudio as downloadAudioHandler, downloadAllAudio as downloadAllAudioHandler } from '../../../utils/audioPlaybackHandlers';

/**
 * Component for displaying Gemini narration results with audio playback
 * @param {Object} props - Component props
 * @param {Array} props.generationResults - Array of narration results
 * @param {Function} props.onRetry - Function to retry generation for a specific subtitle
 * @param {number|null} props.retryingSubtitleId - ID of the subtitle currently being retried
 * @param {Function} props.onRetryFailed - Function to retry all failed narrations
 * @returns {JSX.Element} - Rendered component
 */
const GeminiNarrationResults = ({ generationResults, onRetry, retryingSubtitleId, onRetryFailed }) => {
  const { t } = useTranslation();
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const audioRef = useRef(null);
  // Audio player reference for Web Audio API
  const [activeAudioPlayer, setActiveAudioPlayer] = useState(null);

  // Check if there are any failed narrations
  const hasFailedNarrations = generationResults && generationResults.some(result => !result.success);

  // Clean up audio resources when component unmounts
  useEffect(() => {
    return () => {
      // Clean up any active audio player
      if (activeAudioPlayer) {
        try {
          activeAudioPlayer.stop();
        } catch (error) {
          console.error('Error stopping audio player during cleanup:', error);
        }
      }
    };
  }, [activeAudioPlayer]);

  // Always show the results section, even when there are no results yet
  // This ensures the section is visible as soon as the first result comes in

  // Play audio from base64 data
  const playAudio = async (result) => {
    await playAudioHandler(
      result,
      currentlyPlaying,
      setCurrentlyPlaying,
      activeAudioPlayer,
      setActiveAudioPlayer,
      audioRef,
      t
    );
  };

  // Handle audio ended event
  const handleAudioEnded = () => {
    console.log('Audio playback ended');
    setCurrentlyPlaying(null);
    setActiveAudioPlayer(null);
  };

  // Add an effect to listen for audio ended events from the hidden audio element
  useEffect(() => {
    // This effect ensures the play/pause button state is updated when audio ends
    const handleGlobalAudioEnded = (event) => {
      // Check if this is one of our audio elements
      if (event.target && event.target.dataset && event.target.dataset.narrationId) {
        const subtitleId = parseInt(event.target.dataset.narrationId);
        if (currentlyPlaying === subtitleId) {
          console.log(`Audio ended for subtitle ${subtitleId}, updating UI`);
          setCurrentlyPlaying(null);
          setActiveAudioPlayer(null);
        }
      }
    };

    // Add global event listener
    document.addEventListener('ended', handleGlobalAudioEnded, true);

    // Clean up
    return () => {
      document.removeEventListener('ended', handleGlobalAudioEnded, true);
    };
  }, [currentlyPlaying]);

  // Download audio as WAV file
  const downloadAudio = async (result) => {
    await downloadAudioHandler(result, t);
  };

  // Note: Audio is automatically saved to server by the geminiNarrationService

  // Download all audio files
  const downloadAllAudio = () => {
    downloadAllAudioHandler(generationResults, t);
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
        {(!generationResults || generationResults.length === 0) ? (
          <div className="no-results-message">
            {t('narration.waitingForResults', 'Waiting for narration results...')}
          </div>
        ) : (
          generationResults.map((result) => (
          <div
            key={result.subtitle_id}
            className={`gemini-result-item ${result.success ? '' : 'failed'} ${currentlyPlaying === result.subtitle_id ? 'playing' : ''} ${retryingSubtitleId === result.subtitle_id ? 'retrying' : ''}`}
          >
            <div className="gemini-result-text">
              <span className="gemini-result-id">{result.subtitle_id}.</span>
              {result.text}
            </div>

            <div className="audio-controls">
              {result.success && result.audioData ? (
                <>
                  <button
                    className="pill-button primary"
                    onClick={() => playAudio(result)}
                  >
                    {currentlyPlaying === result.subtitle_id ? (
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
                    onClick={() => downloadAudio(result)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    {t('narration.download', 'Download')}
                  </button>
                  <button
                    className={`pill-button secondary retry-button ${retryingSubtitleId === result.subtitle_id ? 'retrying' : ''}`}
                    onClick={() => onRetry(result.subtitle_id)}
                    title={t('narration.retry', 'Retry generation')}
                    disabled={retryingSubtitleId === result.subtitle_id}
                  >
                    {retryingSubtitleId === result.subtitle_id ? (
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
              ) : (
                !result.success && (
                  <>
                    <span className="gemini-error-message">
                      {t('narration.failed', 'Generation failed')}
                    </span>
                    <button
                      className={`pill-button secondary retry-button ${retryingSubtitleId === result.subtitle_id ? 'retrying' : ''}`}
                      onClick={() => onRetry(result.subtitle_id)}
                      title={t('narration.retry', 'Retry generation')}
                      disabled={retryingSubtitleId === result.subtitle_id}
                    >
                      {retryingSubtitleId === result.subtitle_id ? (
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
                )
              )}
            </div>
          </div>
        )))}
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
      />
    </div>
  );
};

export default GeminiNarrationResults;
