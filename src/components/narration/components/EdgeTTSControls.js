import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SERVER_URL } from '../../../config';
import { FiChevronDown } from 'react-icons/fi';
import '../../../styles/narration/narrationAdvancedSettingsRedesign.css';
import '../../../styles/narration/narrationModelDropdown.css';

/**
 * Edge TTS Controls component for voice selection and speech parameters
 * @param {Object} props - Component props
 * @param {string} props.selectedVoice - Currently selected voice
 * @param {Function} props.setSelectedVoice - Function to set selected voice
 * @param {string} props.rate - Current speech rate
 * @param {Function} props.setRate - Function to set speech rate
 * @param {string} props.volume - Current speech volume
 * @param {Function} props.setVolume - Function to set speech volume
 * @param {string} props.pitch - Current speech pitch
 * @param {Function} props.setPitch - Function to set speech pitch
 * @param {boolean} props.isGenerating - Whether generation is in progress
 * @param {Object} props.detectedLanguage - Detected language from subtitles
 * @returns {JSX.Element} - Rendered component
 */
const EdgeTTSControls = ({
  selectedVoice,
  setSelectedVoice,
  rate,
  setRate,
  volume,
  setVolume,
  pitch,
  setPitch,
  isGenerating,
  detectedLanguage
}) => {
  const { t } = useTranslation();
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  // Load available voices on component mount
  useEffect(() => {
    const loadVoices = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${SERVER_URL}/api/narration/edge-tts/voices`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setVoices(data.voices || []);

        // Auto-select voice based on detected language
        if (!selectedVoice && data.voices && data.voices.length > 0) {
          let voiceToSelect = data.voices[0].name; // Default fallback

          if (detectedLanguage?.languageCode) {
            // Try to find a voice that matches the detected language
            const matchingVoice = data.voices.find(voice =>
              voice.language === detectedLanguage.languageCode ||
              voice.locale.startsWith(detectedLanguage.languageCode + '-')
            );

            if (matchingVoice) {
              voiceToSelect = matchingVoice.name;
            }
          }

          setSelectedVoice(voiceToSelect);
        }
      } catch (err) {
        console.error('Error loading Edge TTS voices:', err);
        setError('Failed to load voices');
      } finally {
        setLoading(false);
      }
    };

    loadVoices();
  }, [selectedVoice, setSelectedVoice, detectedLanguage]);

  // Handle voice selection change
  const handleVoiceChange = (e) => {
    const newVoice = e.target.value;
    setSelectedVoice(newVoice);
  };

  // Handle rate change
  const handleRateChange = (e) => {
    const newRate = e.target.value;
    setRate(newRate);
  };

  // Handle volume change
  const handleVolumeChange = (e) => {
    const newVolume = e.target.value;
    setVolume(newVolume);
  };

  // Handle pitch change
  const handlePitchChange = (e) => {
    const newPitch = e.target.value;
    setPitch(newPitch);
  };

  // Group voices by language for better organization
  const groupedVoices = voices.reduce((groups, voice) => {
    const language = voice.language || 'unknown';
    if (!groups[language]) {
      groups[language] = [];
    }
    groups[language].push(voice);
    return groups;
  }, {});

  // Handle voice modal
  const openVoiceModal = () => setIsVoiceModalOpen(true);
  const closeVoiceModal = () => setIsVoiceModalOpen(false);

  // Handle voice selection
  const handleVoiceSelect = (voiceName) => {
    setIsVoiceModalOpen(false);
    setSelectedVoice(voiceName);
  };

  // Get selected voice details
  const selectedVoiceDetails = voices.find(voice => voice.name === selectedVoice);

  return (
    <div className="edge-tts-controls">
      {/* Voice Selection */}
      <div className="narration-row edge-tts-control-row animated-row">
        <div className="row-label">
          <label>{t('narration.edgeTTSVoice', 'Giọng thuyết minh')}:</label>
        </div>
        <div className="row-content">
          {loading ? (
            <div className="loading-message">
              {t('narration.loadingVoices', 'Loading voices...')}
            </div>
          ) : error ? (
            <div className="error-message">
              {t('narration.voiceLoadError', 'Error loading voices: {{error}}', { error })}
            </div>
          ) : (
            <div className="model-dropdown-container narration-model-dropdown-container">
              <button
                className="model-dropdown-btn narration-model-dropdown-btn"
                title={t('narration.selectVoice', 'Select narration voice')}
                onClick={openVoiceModal}
                disabled={isGenerating}
              >
                <span className="model-dropdown-label">{t('narration.voiceLabel', 'Giọng thuyết minh')}:</span>
                <span className="model-dropdown-selected">
                  <span className="model-name">
                    {selectedVoiceDetails ?
                      `${selectedVoiceDetails.short_name} (${selectedVoiceDetails.gender})` :
                      selectedVoice || t('narration.selectVoice', 'Select voice')
                    }
                  </span>
                </span>
                <FiChevronDown className="dropdown-icon" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Speech Rate */}
      <div className="narration-row edge-tts-control-row animated-row">
        <div className="row-label">
          <label htmlFor="edge-tts-rate">{t('narration.edgeTTSRate', 'Speech Rate')}:</label>
        </div>
        <div className="row-content">
          <div className="slider-with-value">
            <div className={`custom-slider-container ${isGenerating ? 'disabled' : ''}`}>
              <div className="custom-slider-track">
                <div
                  className="custom-slider-fill"
                  style={{ width: `${((parseInt(rate.replace('%', '')) + 50) / 100) * 100}%` }}
                ></div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${((parseInt(rate.replace('%', '')) + 50) / 100) * 100}%` }}
                ></div>
              </div>
              <input
                type="range"
                id="edge-tts-rate"
                min="-50"
                max="50"
                step="5"
                value={parseInt(rate.replace('%', ''))}
                onChange={(e) => setRate(`${e.target.value >= 0 ? '+' : ''}${e.target.value}%`)}
                disabled={isGenerating}
                className="custom-slider-input"
                style={{ opacity: 0, position: 'absolute', width: '100%', height: '100%', cursor: 'pointer' }}
              />
            </div>
            <div className="slider-value-display">{rate}</div>
          </div>
        </div>
      </div>

      {/* Speech Volume */}
      <div className="narration-row edge-tts-control-row animated-row">
        <div className="row-label">
          <label htmlFor="edge-tts-volume">{t('narration.edgeTTSVolume', 'Volume')}:</label>
        </div>
        <div className="row-content">
          <div className="slider-with-value">
            <div className={`custom-slider-container ${isGenerating ? 'disabled' : ''}`}>
              <div className="custom-slider-track">
                <div
                  className="custom-slider-fill"
                  style={{ width: `${((parseInt(volume.replace('%', '')) + 50) / 100) * 100}%` }}
                ></div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${((parseInt(volume.replace('%', '')) + 50) / 100) * 100}%` }}
                ></div>
              </div>
              <input
                type="range"
                id="edge-tts-volume"
                min="-50"
                max="50"
                step="5"
                value={parseInt(volume.replace('%', ''))}
                onChange={(e) => setVolume(`${e.target.value >= 0 ? '+' : ''}${e.target.value}%`)}
                disabled={isGenerating}
                className="custom-slider-input"
                style={{ opacity: 0, position: 'absolute', width: '100%', height: '100%', cursor: 'pointer' }}
              />
            </div>
            <div className="slider-value-display">{volume}</div>
          </div>
        </div>
      </div>

      {/* Speech Pitch */}
      <div className="narration-row edge-tts-control-row animated-row">
        <div className="row-label">
          <label htmlFor="edge-tts-pitch">{t('narration.edgeTTSPitch', 'Pitch')}:</label>
        </div>
        <div className="row-content">
          <div className="slider-with-value">
            <div className={`custom-slider-container ${isGenerating ? 'disabled' : ''}`}>
              <div className="custom-slider-track">
                <div
                  className="custom-slider-fill"
                  style={{ width: `${((parseInt(pitch.replace('Hz', '')) + 50) / 100) * 100}%` }}
                ></div>
                <div
                  className="custom-slider-thumb"
                  style={{ left: `${((parseInt(pitch.replace('Hz', '')) + 50) / 100) * 100}%` }}
                ></div>
              </div>
              <input
                type="range"
                id="edge-tts-pitch"
                min="-50"
                max="50"
                step="5"
                value={parseInt(pitch.replace('Hz', ''))}
                onChange={(e) => setPitch(`${e.target.value >= 0 ? '+' : ''}${e.target.value}Hz`)}
                disabled={isGenerating}
                className="custom-slider-input"
                style={{ opacity: 0, position: 'absolute', width: '100%', height: '100%', cursor: 'pointer' }}
              />
            </div>
            <div className="slider-value-display">{pitch}</div>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="narration-row edge-tts-info-row">
        <div className="row-content">
          <div className="info-message">
            <span className="info-icon">ℹ️</span>
            {t('narration.edgeTTSInfo', 'Edge TTS uses Microsoft\'s high-quality neural voices. No API key required.')}
          </div>
        </div>
      </div>

      {/* Voice Selection Modal */}
      {isVoiceModalOpen && (
        <div className="modal-overlay" onClick={closeVoiceModal}>
          <div className="model-selection-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('narration.selectVoice', 'Select narration voice')}</h3>
              <button className="modal-close-btn" onClick={closeVoiceModal}>×</button>
            </div>
            <div className="modal-content">
              {voices.length > 0 ? (
                <>
                  {/* Recommended voices based on detected language */}
                  {detectedLanguage?.languageCode && (
                    <>
                      <div className="model-section">
                        <h4 className="model-section-title">
                          {t('narration.recommendedVoices', 'Recommended for {{language}}', {
                            language: detectedLanguage.languageName || detectedLanguage.languageCode
                          })}
                        </h4>
                        <div className="model-options-grid">
                          {voices
                            .filter(voice =>
                              voice.language === detectedLanguage.languageCode ||
                              voice.locale.startsWith(detectedLanguage.languageCode + '-')
                            )
                            .map(voice => (
                              <button
                                key={voice.name}
                                className={`model-option-card ${voice.name === selectedVoice ? 'selected' : ''}`}
                                onClick={() => handleVoiceSelect(voice.name)}
                              >
                                <div className="model-option-name">{voice.short_name}</div>
                                <div className="model-option-description">
                                  {voice.gender} • {voice.locale}
                                </div>
                              </button>
                            ))
                          }
                        </div>
                      </div>

                      {/* Other voices */}
                      <div className="model-section">
                        <h4 className="model-section-title">
                          {t('narration.otherVoices', 'Other voices')}
                        </h4>
                        <div className="model-options-grid">
                          {voices
                            .filter(voice =>
                              voice.language !== detectedLanguage.languageCode &&
                              !voice.locale.startsWith(detectedLanguage.languageCode + '-')
                            )
                            .slice(0, 20) // Limit to first 20 to avoid overwhelming UI
                            .map(voice => (
                              <button
                                key={voice.name}
                                className={`model-option-card ${voice.name === selectedVoice ? 'selected' : ''}`}
                                onClick={() => handleVoiceSelect(voice.name)}
                              >
                                <div className="model-option-name">{voice.short_name}</div>
                                <div className="model-option-description">
                                  {voice.gender} • {voice.locale}
                                </div>
                              </button>
                            ))
                          }
                        </div>
                      </div>
                    </>
                  )}

                  {/* If no language detected, show all voices grouped by language */}
                  {!detectedLanguage?.languageCode && (
                    <div className="model-section">
                      <h4 className="model-section-title">
                        {t('narration.availableVoices', 'Available voices')}
                      </h4>
                      <div className="model-options-grid">
                        {voices.slice(0, 30).map(voice => (
                          <button
                            key={voice.name}
                            className={`model-option-card ${voice.name === selectedVoice ? 'selected' : ''}`}
                            onClick={() => handleVoiceSelect(voice.name)}
                          >
                            <div className="model-option-name">{voice.short_name}</div>
                            <div className="model-option-description">
                              {voice.gender} • {voice.locale}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="no-models-message">
                  <div className="model-option-name">{t('narration.noVoicesAvailable', 'No voices available')}</div>
                  <div className="model-option-description">{t('narration.checkConnection', 'Please check your connection and try again')}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EdgeTTSControls;
