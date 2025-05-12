import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../../styles/components/custom-slider.css';

/**
 * Component for configuring the number of concurrent Gemini WebSocket clients
 */
const GeminiConcurrentClientsSettings = () => {
  const { t } = useTranslation();
  const [concurrentClients, setConcurrentClients] = useState(5);

  // Load the current setting from localStorage on component mount
  useEffect(() => {
    const storedValue = localStorage.getItem('gemini_concurrent_clients');
    if (storedValue) {
      setConcurrentClients(parseInt(storedValue, 10));
    }
  }, []);

  // Save the setting to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('gemini_concurrent_clients', concurrentClients.toString());
  }, [concurrentClients]);

  // Handle slider change
  const handleSliderChange = (e) => {
    const value = parseInt(e.target.value, 10);
    setConcurrentClients(value);
  };

  // Handle number input change
  const handleNumberInputChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= 10) {
      setConcurrentClients(value);
    }
  };

  // Calculate slider percentage for styling
  const sliderPercentage = ((concurrentClients - 1) / 9) * 100;

  return (
    <div className="compact-setting">
      <label htmlFor="concurrent-clients-slider">
        {t('settings.geminiConcurrentClients', 'Concurrent WebSocket Clients')}
      </label>
      <p className="setting-description">
        {t(
          'settings.geminiConcurrentClientsDescription',
          'Number of concurrent WebSocket connections to use for Gemini narration. Higher values may improve performance but use more resources.'
        )}
      </p>
      <div className="slider-with-value">
        <div className="custom-slider-container">
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
            id="concurrent-clients-slider"
            min="1"
            max="10"
            step="1"
            value={concurrentClients}
            onChange={handleSliderChange}
            className="custom-slider-input"
          />
        </div>
        <div className="slider-value-display">
          <input
            type="number"
            min="1"
            max="10"
            value={concurrentClients}
            onChange={handleNumberInputChange}
            className="number-input"
          />
        </div>
      </div>
    </div>
  );
};

export default GeminiConcurrentClientsSettings;
