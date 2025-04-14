import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Split duration slider component
 * @param {Object} props - Component props
 * @param {number} props.splitDuration - Current split duration value
 * @param {Function} props.onSplitDurationChange - Function to handle split duration change
 * @param {Array} props.subtitles - Subtitles array for segment distribution calculation
 * @param {boolean} props.disabled - Whether the slider is disabled
 * @returns {JSX.Element} - Rendered component
 */
const SplitDurationSlider = ({ splitDuration, onSplitDurationChange, subtitles, disabled = false }) => {
  const { t } = useTranslation();

  // Calculate segment distribution based on split duration
  const segmentDistribution = useMemo(() => {
    if (!subtitles || subtitles.length === 0 || splitDuration === 0) {
      return [subtitles?.length || 0]; // No split, all subtitles in one segment
    }

    // Convert splitDuration from minutes to seconds
    const splitDurationSeconds = splitDuration * 60;

    // Group subtitles into chunks based on their timestamps
    const chunks = [];
    let currentChunk = [];
    let chunkStartTime = subtitles[0]?.start || 0;

    subtitles.forEach(subtitle => {
      // If this subtitle would exceed the chunk duration, start a new chunk
      if (subtitle.start - chunkStartTime > splitDurationSeconds) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.length);
          currentChunk = [];
          chunkStartTime = subtitle.start;
        }
      }

      currentChunk.push(subtitle);
    });

    // Add the last chunk if it's not empty
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.length);
    }

    return chunks.length > 0 ? chunks : [subtitles.length];
  }, [subtitles, splitDuration]);

  return (
    <div className="translation-row split-duration-row">
      <div className="row-label">
        <label>{t('translation.splitDuration', 'Split Duration')}:</label>
      </div>
      <div className="row-content">
        <div className="split-duration-slider-container">
          <div className="slider-control-row">
            <div className="slider-with-value">
              <div className="custom-slider-container">
                <div className="custom-slider-track">
                  <div
                    className="custom-slider-fill"
                    style={{ width: `${(splitDuration / 20) * 100}%` }}
                  ></div>
                  <div
                    className="custom-slider-thumb"
                    style={{ left: `${(splitDuration / 20) * 100}%` }}
                  ></div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={splitDuration}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    onSplitDurationChange(value);
                  }}
                  className="custom-slider-input"
                  title={t('translation.splitDurationTooltip', 'Split subtitles into chunks for translation to avoid token limits')}
                  disabled={disabled}
                />
              </div>
              <div className="slider-value-display">
                {splitDuration === 0
                  ? t('translation.noSplit', 'No Split')
                  : `${splitDuration} ${t('translation.minutes', 'min')}`}
              </div>
            </div>
          </div>

          {/* Compact segment distribution preview */}
          {subtitles && subtitles.length > 0 && (
            <div className="segment-preview-compact">
              {splitDuration === 0 ? (
                <span className="single-segment">
                  {t('translation.allSubtitles', 'All {{count}} subtitles', {count: subtitles.length})}
                </span>
              ) : (
                <div className="segment-pills">
                  {segmentDistribution.map((count, index) => (
                    <span key={index} className="segment-pill">
                      {count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div
          className="help-icon-container"
          title={t('translation.splitDurationHelp', 'Splitting subtitles into smaller chunks helps prevent translations from being cut off due to token limits. For longer videos, use smaller chunks.')}
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

export default SplitDurationSlider;
