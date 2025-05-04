import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { GEMINI_VOICES } from '../../../services/gemini/geminiNarrationService';
import '../../../styles/narration/geminiVoiceSelectionMaterial.css';

/**
 * Component for selecting a Gemini voice
 * @param {Object} props - Component props
 * @param {string} props.selectedVoice - Currently selected voice
 * @param {Function} props.setSelectedVoice - Function to set selected voice
 * @param {boolean} props.isGenerating - Whether generation is in progress
 * @returns {JSX.Element} - Rendered component
 */
const GeminiVoiceSelection = ({
  selectedVoice,
  setSelectedVoice,
  isGenerating
}) => {
  const { t } = useTranslation();
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingVoice, setCurrentPlayingVoice] = useState(null);

  // Group voices by gender
  const femaleVoices = GEMINI_VOICES.filter(voice => voice.gender === 'Female');
  const maleVoices = GEMINI_VOICES.filter(voice => voice.gender === 'Male');

  const handleVoiceChange = (e) => {
    const newVoice = e.target.value;
    console.log('Voice changed:', newVoice);
    setSelectedVoice(newVoice);

    // Store in localStorage for persistence
    try {
      localStorage.setItem('gemini_voice', newVoice);
    } catch (e) {
      console.error('Error storing voice in localStorage:', e);
    }
  };

  const playVoiceSample = (voiceId) => {
    // If already playing this voice, stop it
    if (isPlaying && currentPlayingVoice === voiceId) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentPlayingVoice(null);
      return;
    }

    // Play the voice sample
    const audioPath = `/audio/voices/chirp3-hd-${voiceId.toLowerCase()}.wav`;

    if (audioRef.current) {
      audioRef.current.src = audioPath;
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setCurrentPlayingVoice(voiceId);
        })
        .catch(error => {
          console.error('Error playing audio:', error);
          setIsPlaying(false);
          setCurrentPlayingVoice(null);
        });
    }
  };

  // Handle audio ended event
  useEffect(() => {
    const handleAudioEnded = () => {
      setIsPlaying(false);
      setCurrentPlayingVoice(null);
    };

    if (audioRef.current) {
      audioRef.current.addEventListener('ended', handleAudioEnded);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleAudioEnded);
      }
    };
  }, []);

  return (
    <div className="narration-row gemini-voice-row">
      <div className="row-label">
        <label>{t('narration.voice', 'Voice')}:</label>
      </div>
      <div className="row-content">
        <div className="gemini-voice-selection">
          {/* Hidden audio element for playing voice samples */}
          <audio ref={audioRef} className="voice-sample-audio" />

          <div className="voice-groups">
            <div className="voice-group female-voices">
              <div className="group-label">{t('narration.femaleVoices', 'Female Voices')}</div>
              <div className="voice-options">
                {femaleVoices.map(voice => (
                  <div className="voice-option" key={voice.id}>
                    <input
                      type="radio"
                      id={`voice-${voice.id}`}
                      name="gemini-voice"
                      value={voice.id}
                      checked={selectedVoice === voice.id}
                      onChange={handleVoiceChange}
                      disabled={isGenerating}
                    />
                    <label htmlFor={`voice-${voice.id}`}>
                      {voice.name}
                      <button
                        type="button"
                        className={`play-voice-sample ${isPlaying && currentPlayingVoice === voice.id ? 'playing' : ''}`}
                        onClick={(e) => {
                          e.preventDefault();
                          playVoiceSample(voice.id);
                        }}
                        title={t('narration.playVoiceSample', 'Play voice sample')}
                      >
                        {isPlaying && currentPlayingVoice === voice.id ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="6" y="4" width="4" height="16"></rect>
                            <rect x="14" y="4" width="4" height="16"></rect>
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                          </svg>
                        )}
                      </button>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="voice-group male-voices">
              <div className="group-label">{t('narration.maleVoices', 'Male Voices')}</div>
              <div className="voice-options">
                {maleVoices.map(voice => (
                  <div className="voice-option" key={voice.id}>
                    <input
                      type="radio"
                      id={`voice-${voice.id}`}
                      name="gemini-voice"
                      value={voice.id}
                      checked={selectedVoice === voice.id}
                      onChange={handleVoiceChange}
                      disabled={isGenerating}
                    />
                    <label htmlFor={`voice-${voice.id}`}>
                      {voice.name}
                      <button
                        type="button"
                        className={`play-voice-sample ${isPlaying && currentPlayingVoice === voice.id ? 'playing' : ''}`}
                        onClick={(e) => {
                          e.preventDefault();
                          playVoiceSample(voice.id);
                        }}
                        title={t('narration.playVoiceSample', 'Play voice sample')}
                      >
                        {isPlaying && currentPlayingVoice === voice.id ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="6" y="4" width="4" height="16"></rect>
                            <rect x="14" y="4" width="4" height="16"></rect>
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                          </svg>
                        )}
                      </button>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeminiVoiceSelection;
