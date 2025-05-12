import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../../../styles/narration/geminiConcurrentClientsSlider.css';

/**
 * Component for controlling the number of concurrent WebSocket clients for Gemini narration
 * @param {Object} props - Component props
 * @param {number} props.concurrentClients - Current number of concurrent clients
 * @param {Function} props.setConcurrentClients - Function to set concurrent clients
 * @param {boolean} props.isGenerating - Whether generation is in progress
 * @returns {JSX.Element} - Rendered component
 */
const GeminiConcurrentClientsSlider = ({
  concurrentClients,
  setConcurrentClients,
  isGenerating
}) => {
  const { t } = useTranslation();
  const [localConcurrentClients, setLocalConcurrentClients] = useState(concurrentClients || 1);

  // Initialize from localStorage on mount
  useEffect(() => {
    const storedValue = localStorage.getItem('gemini_concurrent_clients');
    if (storedValue) {
      const parsedValue = parseInt(storedValue, 10);
      if (!isNaN(parsedValue) && parsedValue >= 1 && parsedValue <= 10) {
        setLocalConcurrentClients(parsedValue);
        if (setConcurrentClients) {
          setConcurrentClients(parsedValue);
        }
      }
    }
  }, [setConcurrentClients]);

  const handleConcurrentClientsChange = (e) => {
    const newValue = parseInt(e.target.value, 10);
    setLocalConcurrentClients(newValue);

    if (setConcurrentClients) {
      setConcurrentClients(newValue);
    }

    // Store in localStorage for persistence
    try {
      localStorage.setItem('gemini_concurrent_clients', newValue.toString());
    } catch (e) {
      console.error('Error storing concurrent clients in localStorage:', e);
    }
  };

  // Calculate percentage for slider fill and thumb position (1-10 range)
  const sliderPercentage = ((localConcurrentClients - 1) / 9) * 100;

  return (
    <div className="narration-row gemini-concurrent-clients-row animated-row">
      <div className="row-label">
        <label>{t('narration.concurrentClients', 'Chế độ cực nhanh')}:</label>
      </div>
      <div className="row-content">
        <div className="split-duration-slider-container">
          <div className="slider-control-row">
            <div className="slider-with-value">
              {!isGenerating ? (
                <div className="custom-slider-container gemini-concurrent-clients-slider">
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
                    min="1"
                    max="10"
                    step="1"
                    value={localConcurrentClients}
                    onChange={handleConcurrentClientsChange}
                    className="custom-slider-input"
                    title={t('narration.concurrentClientsTooltip', 'Number of concurrent WebSocket connections')}
                  />
                </div>
              ) : (
                <div className="custom-slider-container gemini-concurrent-clients-slider disabled">
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
                {`${localConcurrentClients}x`}
              </div>
            </div>
          </div>
        </div>

        <div
          className="help-icon-container"
          title={t('narration.concurrentClientsHelp', 'Mở nhiều hội thoại song song với Gemini cùng lúc, CHÚ Ý: có thể gây cạn kiệt quota nhanh chóng')}
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

export default GeminiConcurrentClientsSlider;
