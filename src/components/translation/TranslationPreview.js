import React from 'react';
import { useTranslation } from 'react-i18next';
import formatTimeString from './utils/formatTimeString';

/**
 * Translation preview component
 * @param {Object} props - Component props
 * @param {Array} props.translatedSubtitles - Translated subtitles
 * @param {Array} props.targetLanguages - Target languages
 * @returns {JSX.Element|null} - Rendered component or null if no translated subtitles
 */
const TranslationPreview = ({ translatedSubtitles, targetLanguages }) => {
  const { t } = useTranslation();

  if (!translatedSubtitles || translatedSubtitles.length === 0) return null;

  return (
    <div className="translation-row preview-row">
      <div className="row-label">
        <label>{t('translation.previewLabel', 'Preview')}:</label>
      </div>
      <div className="row-content">
        <div className="translation-preview">
          <h4>
            {t('translation.preview', 'Translation Preview')}
            {targetLanguages.length > 1
              ? ` (${targetLanguages.map(lang => lang.value).filter(val => val.trim() !== '').join(', ')})`
              : targetLanguages[0]?.value?.trim() ? ` (${targetLanguages[0].value})` : ''}
          </h4>
          <div className="translation-preview-content">
            {translatedSubtitles.slice(0, 5).map((subtitle, index) => {
              // Determine the time display format
              let startTimeDisplay = subtitle.startTime;
              let endTimeDisplay = subtitle.endTime;

              // If we have start/end in seconds but no formatted time strings
              if (!startTimeDisplay && subtitle.start !== undefined) {
                startTimeDisplay = formatTimeString(subtitle.start);
              }

              if (!endTimeDisplay && subtitle.end !== undefined) {
                endTimeDisplay = formatTimeString(subtitle.end);
              }

              return (
                <div key={index} className="preview-subtitle">
                  <span className="preview-time">
                    {startTimeDisplay || '00:00:00.000'} → {endTimeDisplay || '00:00:05.000'}
                  </span>
                  <span className="preview-text">{subtitle.text}</span>
                </div>
              );
            })}
            {translatedSubtitles.length > 5 && (
              <div className="preview-more">
                {t('translation.moreSubtitles', '... and {{count}} more subtitles', { count: translatedSubtitles.length - 5 })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranslationPreview;
