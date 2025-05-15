import React from 'react';
import { useTranslation } from 'react-i18next';
import formatTimeString from './utils/formatTimeString';

/**
 * Translation preview component
 * @param {Object} props - Component props
 * @param {Array} props.translatedSubtitles - Translated subtitles
 * @param {Array} props.targetLanguages - Target languages
 * @param {boolean} props.loadedFromCache - Whether translations were loaded from cache
 * @returns {JSX.Element|null} - Rendered component or null if no translated subtitles
 */
const TranslationPreview = ({ translatedSubtitles, targetLanguages, loadedFromCache }) => {
  const { t } = useTranslation();

  if (!translatedSubtitles || translatedSubtitles.length === 0) return null;

  return (
    <div className="translation-row preview-row">
      <div className="row-label">
        <label>{t('translation.previewLabel', 'Preview')}:</label>
      </div>
      <div className="row-content">
        <div className="translation-preview translation-preview-animated">
          <h4>
            {t('translation.preview', 'Translation Preview')}
            {targetLanguages.length > 1
              ? ` (${targetLanguages.map(lang => lang.value).filter(val => val.trim() !== '').join(', ')})`
              : targetLanguages[0]?.value?.trim() ? ` (${targetLanguages[0].value})` : ''}
            {loadedFromCache && (
              <span className="cache-indicator" title={t('translation.fromCache', 'Loaded from cache')}>
                {" "}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12.5A5.5 5.5 0 0 1 7.5 7H18a4 4 0 0 1 0 8h-2.5"></path>
                  <path d="M12 20v-8"></path>
                  <path d="M16 16l-4 4-4-4"></path>
                </svg>
              </span>
            )}
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
                  <span className="preview-text">
                    {subtitle.text.split('\n').map((line, lineIndex) => (
                      <React.Fragment key={lineIndex}>
                        {lineIndex > 0 && <br />}
                        {line}
                      </React.Fragment>
                    ))}
                  </span>
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
