import React from 'react';
import { useTranslation } from 'react-i18next';
import '../../../styles/narration/geminiSleepTimeSliderMaterial.css';

/**
 * Component for controlling the sleep time between Gemini narration requests
 * @param {Object} props - Component props
 * @param {number} props.sleepTime - Current sleep time in milliseconds
 * @param {Function} props.setSleepTime - Function to set sleep time
 * @param {boolean} props.isGenerating - Whether generation is in progress
 * @returns {JSX.Element} - Rendered component
 */
const GeminiSleepTimeSlider = ({
  sleepTime,
  setSleepTime,
  isGenerating
}) => {
  const { t } = useTranslation();

  const handleSleepTimeChange = (e) => {
    const newValue = parseInt(e.target.value);
    console.log('Sleep time changed:', newValue);
    setSleepTime(newValue);

    // Store in localStorage for persistence
    try {
      localStorage.setItem('gemini_sleep_time', newValue.toString());
    } catch (e) {
      console.error('Error storing sleep time in localStorage:', e);
    }
  };

  return (
    <div className="narration-row gemini-sleep-time-row">
      <div className="row-label">
        <label>{t('narration.sleepTime', 'Delay Between Batches')}:</label>
      </div>
      <div className="row-content">
        <div className="gemini-sleep-time-slider">
          <div className="slider-container">
            <input
              type="range"
              min="0"
              max="30000"
              step="500"
              value={sleepTime}
              onChange={handleSleepTimeChange}
              disabled={isGenerating}
              className="sleep-time-slider"
            />
            <div className="slider-labels">
              <span>0s</span>
              <span>15s</span>
              <span>30s</span>
            </div>
          </div>
          <div className="current-value">
            {(sleepTime / 1000).toFixed(1)}s
          </div>
        </div>
        <div className="sleep-time-description">
          {t('narration.sleepTimeDescription', 'Adjust the delay between batches to avoid rate limiting. Higher values (10-30s) may prevent errors but will slow down generation.')}
        </div>
      </div>
    </div>
  );
};

export default GeminiSleepTimeSlider;
