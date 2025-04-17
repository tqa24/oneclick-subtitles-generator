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
 * @returns {JSX.Element} - Rendered component
 */
const NarrationResults = ({
  generationResults,
  playAudio,
  currentAudio,
  isPlaying,
  getAudioUrl
}) => {
  const { t } = useTranslation();

  if (!generationResults || generationResults.length === 0) {
    return null;
  }

  return (
    <div className="results-section">
      <h4>{t('narration.results', 'Generated Narration')}</h4>

      <div className="results-list">
        {generationResults.map((result) => (
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
                </>
              ) : (
                <span className="error-message">
                  {t('narration.failed', 'Generation failed')}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NarrationResults;
