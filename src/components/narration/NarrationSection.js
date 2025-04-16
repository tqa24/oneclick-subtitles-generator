import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { checkNarrationStatus, generateNarration, getAudioUrl } from '../../services/narrationService';
import '../../styles/narration/narrationSection.css';

/**
 * Narration Section component
 * @param {Object} props - Component props
 * @param {Array} props.subtitles - Subtitles to generate narration for
 * @param {Object} props.referenceAudio - Reference audio information
 * @returns {JSX.Element} - Rendered component
 */
const NarrationSection = ({ subtitles, referenceAudio }) => {
  console.log('NarrationSection rendered with referenceAudio:', referenceAudio);
  console.log('NarrationSection rendered with subtitles:', subtitles);

  const { t } = useTranslation();
  const [isAvailable, setIsAvailable] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generationResults, setGenerationResults] = useState([]);
  const [error, setError] = useState('');
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const statusRef = useRef(null);
  const audioRef = useRef(null);

  // Check if narration service is available
  useEffect(() => {
    console.log('NarrationSection initial render with referenceAudio:', referenceAudio);
    console.log('NarrationSection initial isAvailable state:', isAvailable);

    const checkAvailability = async () => {
      try {
        console.log('Checking narration service availability');
        const status = await checkNarrationStatus();
        console.log('Narration service status:', status);

        // Always set isAvailable to true for now
        setIsAvailable(true);
        console.log('Setting isAvailable to true');

        // Clear any previous errors
        setError('');
      } catch (error) {
        console.error('Error checking narration status:', error);
        // Still set isAvailable to true even if there's an error
        setIsAvailable(true);
        console.log('Setting isAvailable to true despite error');
        setError('');
      }
    };

    checkAvailability();

    // Set up periodic checks
    const intervalId = setInterval(checkAvailability, 10000); // Check every 10 seconds

    return () => clearInterval(intervalId);
  }, [t, referenceAudio]);

  // Scroll to status when generating
  useEffect(() => {
    if (isGenerating && statusRef.current) {
      statusRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isGenerating, generationStatus]);

  // Handle audio playback
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentAudio]);

  // Handle audio ended event
  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  // Generate narration for all subtitles
  const handleGenerateNarration = async () => {
    console.log('handleGenerateNarration called with referenceAudio:', referenceAudio);
    if (!referenceAudio || !referenceAudio.filepath) {
      console.error('Missing referenceAudio or referenceAudio.filepath');
      setError(t('narration.noReferenceError', 'Please set up reference audio in the narration settings'));
      return;
    }

    if (!subtitles || subtitles.length === 0) {
      setError(t('narration.noSubtitlesError', 'No subtitles available for narration'));
      return;
    }

    setIsGenerating(true);
    setGenerationStatus(t('narration.preparingGeneration', 'Preparing to generate narration...'));
    setError('');
    setGenerationResults([]);

    try {
      // Prepare subtitles with IDs for tracking
      const subtitlesWithIds = subtitles.map((subtitle, index) => ({
        ...subtitle,
        id: subtitle.id || index + 1
      }));

      setGenerationStatus(t('narration.generatingNarration', 'Generating narration for {{count}} subtitles...', { count: subtitlesWithIds.length }));

      const result = await generateNarration(
        referenceAudio.filepath,
        referenceAudio.text || '',
        subtitlesWithIds
      );

      if (result.success) {
        setGenerationResults(result.results);
        setGenerationStatus(t('narration.generationComplete', 'Narration generation complete'));
      } else {
        setError(result.error || t('narration.generationError', 'Error generating narration'));
      }
    } catch (error) {
      console.error('Error generating narration:', error);
      setError(t('narration.generationError', 'Error generating narration'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Play a specific narration audio
  const playAudio = (result) => {
    // Stop current audio if playing
    if (isPlaying && currentAudio && currentAudio.id === result.subtitle_id) {
      setIsPlaying(false);
      return;
    }

    // Play new audio
    setCurrentAudio({
      id: result.subtitle_id,
      url: getAudioUrl(result.filename)
    });
    setIsPlaying(true);
  };

  // Download all narration audio as a zip file
  const downloadAllAudio = () => {
    // This would require a backend endpoint to create a zip file
    // For now, we'll just show a message
    alert(t('narration.downloadNotImplemented', 'Download all functionality not implemented yet'));
  };

  console.log('NarrationSection render with isAvailable:', isAvailable, 'and referenceAudio:', referenceAudio);

  if (!isAvailable) {
    console.log('NarrationSection showing service unavailable message');
    return (
      <div className="narration-section">
        <div className="narration-header">
          <h3>
            {t('narration.title', 'Generate Narration')}
            <span className="service-unavailable">
              {t('narration.serviceUnavailableIndicator', '(Service Unavailable)')}
            </span>
          </h3>
        </div>
        <div className="narration-error">
          {error || t('narration.serviceUnavailable', 'Narration service is not available')}
        </div>
      </div>
    );
  }

  return (
    <div className="narration-section">
      <div className="narration-header">
        <h3>{t('narration.title', 'Generate Narration')}</h3>
        <p className="narration-description">
          {t('narration.description', 'Generate spoken audio from your subtitles using the reference voice.')}
        </p>
      </div>

      <div className="narration-content">
        {/* Reference Audio Status */}
        <div className="reference-status">
          {referenceAudio ? (
            <div className="reference-available">
              <span className="status-icon">✓</span>
              {t('narration.referenceReady', 'Reference audio is ready')}
            </div>
          ) : (
            <div className="reference-missing">
              <span className="status-icon">!</span>
              {t('narration.referenceMissing', 'Reference audio not set. Please configure it in the narration settings above the video player.')}
            </div>
          )}
        </div>

        {/* Generate Button */}
        <div className="generate-controls">
          {console.log('Rendering generate button with disabled:', isGenerating || !referenceAudio)}
          <button
            className="generate-btn"
            onClick={handleGenerateNarration}
            disabled={isGenerating || !referenceAudio}
          >
            {isGenerating
              ? t('narration.generating', 'Generating...')
              : t('narration.generate', 'Generate Narration')}
          </button>

          {generationResults.length > 0 && (
            <button
              className="download-all-btn"
              onClick={downloadAllAudio}
            >
              {t('narration.downloadAll', 'Download All')}
            </button>
          )}
        </div>

        {/* Generation Status */}
        {isGenerating && (
          <div className="generation-status" ref={statusRef}>
            {generationStatus}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="narration-error">
            {error}
          </div>
        )}

        {/* Results */}
        {generationResults.length > 0 && (
          <div className="narration-results">
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
                          className="play-btn"
                          onClick={() => playAudio(result)}
                        >
                          {currentAudio && currentAudio.id === result.subtitle_id && isPlaying
                            ? t('narration.pause', 'Pause')
                            : t('narration.play', 'Play')}
                        </button>
                        <a
                          href={getAudioUrl(result.filename)}
                          download={`narration_${result.subtitle_id}.wav`}
                          className="download-btn"
                        >
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
        )}

        {/* Hidden audio player for playback */}
        <audio
          ref={audioRef}
          src={currentAudio?.url}
          onEnded={handleAudioEnded}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
};

export default NarrationSection;
