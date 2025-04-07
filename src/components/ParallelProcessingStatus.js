import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/ParallelProcessingStatus.css';
import { FiRefreshCw, FiStar, FiAward, FiZap, FiCpu, FiChevronDown } from 'react-icons/fi';

/**
 * Component to display the status of parallel segment processing
 * @param {Object} props - Component props
 * @param {Array} props.segments - Array of segment status objects
 * @param {string} props.overallStatus - Overall processing status message
 * @param {string} props.statusType - Status type (loading, success, error, warning)
 * @param {Function} props.onRetrySegment - Function to retry processing a specific segment
 * @param {Function} props.onRetryWithModel - Function to retry processing a segment with a specific model
 * @param {Function} props.onGenerateSegment - Function to generate a specific segment (for strong model)
 * @param {Array} props.retryingSegments - Array of segment indices that are currently being retried
 * @returns {JSX.Element} - Rendered component
 */
const ParallelProcessingStatus = ({ segments, overallStatus, statusType, onRetrySegment, onRetryWithModel, onGenerateSegment, retryingSegments = [] }) => {
  const { t } = useTranslation();
  const [openDropdownIndex, setOpenDropdownIndex] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRefs = useRef({});

  // Calculate dropdown position when a button is clicked
  const calculateDropdownPosition = (index) => {
    if (buttonRefs.current[index]) {
      const buttonRect = buttonRefs.current[index].getBoundingClientRect();
      const top = buttonRect.bottom + 8;
      const left = Math.max(buttonRect.left - 240, 10); // Align to left of button, but keep on screen
      setDropdownPosition({ top, left });
    }
  };

  // Toggle dropdown and calculate position
  const toggleDropdown = (e, index) => {
    e.stopPropagation();

    if (openDropdownIndex === index) {
      setOpenDropdownIndex(null);
    } else {
      calculateDropdownPosition(index);
      setOpenDropdownIndex(index);
    }
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if the click is outside any dropdown
      const dropdowns = document.querySelectorAll('.model-dropdown');
      const buttons = document.querySelectorAll('.segment-retry-btn');
      let clickedInsideDropdown = false;

      dropdowns.forEach(dropdown => {
        if (dropdown.contains(event.target)) {
          clickedInsideDropdown = true;
        }
      });

      buttons.forEach(button => {
        if (button.contains(event.target)) {
          clickedInsideDropdown = true;
        }
      });

      if (!clickedInsideDropdown) {
        setOpenDropdownIndex(null);
      }
    };

    // Handle window resize
    const handleResize = () => {
      if (openDropdownIndex !== null) {
        calculateDropdownPosition(openDropdownIndex);
      }
    };

    document.addEventListener('click', handleClickOutside);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      window.removeEventListener('resize', handleResize);
    };
  }, [openDropdownIndex]);

  if (!segments || segments.length === 0) {
    return (
      <div className={`status ${statusType}`}>
        {overallStatus}
      </div>
    );
  }

  return (
    <div className="parallel-processing-container">
      <div className={`status ${statusType}`}>
        {overallStatus}
      </div>

      <div className="segments-status">
        <h4>{t('output.segmentsStatus', 'Segments Status')}</h4>
        <div className="segments-grid">
          {segments.map((segment, index) => (
            <div
              key={index}
              className={`segment-status ${segment.status}`}
              title={segment.message}
            >
              <span className="segment-number">{index + 1}</span>
              <span className="segment-indicator"></span>
              <span className="segment-message">{segment.shortMessage || segment.status}</span>
              {/* Show generate button for pending segments */}
              {segment.status === 'pending' && !retryingSegments.includes(index) && onGenerateSegment && (
                <button
                  className="segment-generate-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('Generate button clicked for segment', index);
                    onGenerateSegment(index);
                  }}
                  title={t('output.generateSegmentTooltip', 'Process this segment')}
                >
                  {t('output.generateSegment', 'Generate')}
                </button>
              )}

              {/* Show retry button with dropdown for completed segments that aren't currently being retried */}
              {(segment.status === 'success' || segment.status === 'error') && !retryingSegments.includes(index) && onRetryWithModel && (
                <div className="model-retry-dropdown-container">
                  {/* Retry button */}
                  <button
                    className="segment-retry-btn"
                    onClick={(e) => toggleDropdown(e, index)}
                    title={t('output.retryWithModel', 'Retry with different model')}
                    ref={el => buttonRefs.current[index] = el}
                  >
                    <FiRefreshCw size={14} />
                    <FiChevronDown size={10} className="dropdown-icon" />
                  </button>

                  {/* Model dropdown */}
                  {openDropdownIndex === index && (
                    <div
                      className="model-dropdown"
                      style={{
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`
                      }}
                    >
                      <div className="model-dropdown-header">
                        {t('output.selectModel', 'Select model for retry')}
                      </div>

                      {/* Gemini 2.5 Pro */}
                      <button
                        className="model-option"
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('Retry with Gemini 2.5 Pro for segment', index);
                          onRetryWithModel(index, 'gemini-2.5-pro-exp-03-25');
                          setOpenDropdownIndex(null);
                        }}
                      >
                        <div className="model-option-icon model-pro">
                          <FiStar size={14} />
                        </div>
                        <div className="model-option-text">
                          <div className="model-option-name">{t('models.gemini25Pro', 'Gemini 2.5 Pro')}</div>
                          <div className="model-option-desc">{t('models.bestAccuracy', 'Best accuracy')}</div>
                        </div>
                      </button>

                      {/* Gemini 2.0 Flash Thinking */}
                      <button
                        className="model-option"
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('Retry with Gemini 2.0 Flash Thinking for segment', index);
                          onRetryWithModel(index, 'gemini-2.0-flash-thinking-exp-01-21');
                          setOpenDropdownIndex(null);
                        }}
                      >
                        <div className="model-option-icon model-thinking">
                          <FiAward size={14} />
                        </div>
                        <div className="model-option-text">
                          <div className="model-option-name">{t('models.gemini20FlashThinking', 'Gemini 2.0 Flash Thinking')}</div>
                          <div className="model-option-desc">{t('models.highAccuracy', 'High accuracy')}</div>
                        </div>
                      </button>

                      {/* Gemini 2.0 Flash */}
                      <button
                        className="model-option"
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('Retry with Gemini 2.0 Flash for segment', index);
                          onRetryWithModel(index, 'gemini-2.0-flash');
                          setOpenDropdownIndex(null);
                        }}
                      >
                        <div className="model-option-icon model-flash">
                          <FiZap size={14} />
                        </div>
                        <div className="model-option-text">
                          <div className="model-option-name">{t('models.gemini20Flash', 'Gemini 2.0 Flash')}</div>
                          <div className="model-option-desc">{t('models.balancedModel', 'Balanced')}</div>
                        </div>
                      </button>

                      {/* Gemini 2.0 Flash Lite */}
                      <button
                        className="model-option"
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('Retry with Gemini 2.0 Flash Lite for segment', index);
                          onRetryWithModel(index, 'gemini-2.0-flash-lite');
                          setOpenDropdownIndex(null);
                        }}
                      >
                        <div className="model-option-icon model-lite">
                          <FiCpu size={14} />
                        </div>
                        <div className="model-option-text">
                          <div className="model-option-name">{t('models.gemini20FlashLite', 'Gemini 2.0 Flash Lite')}</div>
                          <div className="model-option-desc">{t('models.fastestModel', 'Fastest')}</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Show spinning refresh icon for segments that are currently being retried */}
              {(segment.status === 'retrying' || retryingSegments.includes(index)) && (
                <span className="segment-retrying-indicator" title={t('output.retryingSegment', 'Retrying this segment...')}>
                  <FiRefreshCw size={14} className="spinning" />
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ParallelProcessingStatus;
