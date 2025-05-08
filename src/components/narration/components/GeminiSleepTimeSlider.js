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

  // Convert milliseconds to seconds for display
  const sleepTimeInSeconds = sleepTime / 1000;
  // Calculate percentage for slider fill and thumb position (0-30 seconds range)
  const sliderPercentage = (sleepTime / 30000) * 100;

  return (
    <div className="narration-row gemini-sleep-time-row animated-row">
      <div className="row-label">
        <label>{t('narration.sleepTime', 'Delay Between Batches')}:</label>
      </div>
      <div className="row-content">
        <div className="split-duration-slider-container">
          <div className="slider-control-row">
            <div className="slider-with-value">
              {!isGenerating ? (
                <div className="custom-slider-container gemini-sleep-time-slider">
                  <div className="custom-slider-track">
                    <div
                      className="custom-slider-fill"
                      style={{ width: `${sliderPercentage}%` }}
                    ></div>
                    <div
                      className="custom-slider-thumb"
                      style={{ left: `${sliderPercentage}%` }}
                    ></div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30000"
                    step="500"
                    value={sleepTime}
                    onChange={handleSleepTimeChange}
                    className="custom-slider-input"
                    title={t('narration.sleepTimeTooltip', 'Delay between narration generation requests')}
                  />
                </div>
              ) : (
                <div className="custom-slider-container gemini-sleep-time-slider disabled">
                  <div className="custom-slider-track">
                    <div
                      className="custom-slider-fill"
                      style={{ width: `${sliderPercentage}%` }}
                    ></div>
                    <div
                      className="custom-slider-thumb"
                      style={{ left: `${sliderPercentage}%` }}
                    ></div>
                  </div>
                </div>
              )}
              <div className="slider-value-display">
                {sleepTime === 0
                  ? t('narration.noDelay', 'No delay')
                  : `${sleepTimeInSeconds.toFixed(1)} ${t('narration.seconds', 'sec')}`}
              </div>
            </div>
          </div>
        </div>

        <div
          className="help-icon-container"
          title={t('narration.sleepTimeHelp', 'Adds a delay between narration requests to help avoid exceeding Gemini\'s rate limits. Higher values (5-30s) may prevent errors but will slow down generation.')}
        >
          <svg className="help-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default GeminiSleepTimeSlider;
