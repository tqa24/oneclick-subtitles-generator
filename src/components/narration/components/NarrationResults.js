import React from 'react';
import { useTranslation } from 'react-i18next';

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
 * @returns {JSX.Element} - Rendered component
 */
const NarrationResults = ({
  generationResults,
  playAudio,
  currentAudio,
  isPlaying,
  getAudioUrl,
  onRetry,
  retryingSubtitleId
}) => {
  const { t } = useTranslation();

  // Always show the results section, even when there are no results yet
  // This ensures the section is visible as soon as the first result comes in

  return (
    <div className="results-section">
      <h4>{t('narration.results', 'Generated Narration')}</h4>

      <div className="results-list">
        {(!generationResults || generationResults.length === 0) ? (
          <div className="no-results-message">
            {t('narration.waitingForResults', 'Waiting for narration results...')}
          </div>
        ) : (
          generationResults.map((result) => (
          <div
            key={result.subtitle_id}
            className={`result-item ${result.success ? '' : 'failed'} ${currentAudio && currentAudio.id === result.subtitle_id ? 'playing' : ''}`}
          >
            <div className="result-text">
              <span className="result-id">{result.subtitle_id}.</span>
              {result.text}
            </div>

            <div className="result-controls">
              {result.success ? (
                <>
                  <button
                    className="pill-button primary"
                    onClick={() => playAudio(result)}
                  >
                    {currentAudio && currentAudio.id === result.subtitle_id && isPlaying ? (
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
                  )}
                </>
              ) : (
                <>
                  <span className="error-message">
                    {t('narration.failed', 'Generation failed')}
                  </span>
                  {onRetry && (
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
                  )}
                </>
              )}
            </div>
          </div>
        )))}
      </div>
    </div>
  );
};

export default NarrationResults;
