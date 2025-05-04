import React, { useState, useEffect } from 'react';
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

  return (
    <div className="narration-row gemini-voice-row">
      <div className="row-label">
        <label>{t('narration.voice', 'Voice')}:</label>
      </div>
      <div className="row-content">
        <div className="gemini-voice-selection">
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
                    <label htmlFor={`voice-${voice.id}`}>{voice.name}</label>
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
                    <label htmlFor={`voice-${voice.id}`}>{voice.name}</label>
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
