import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Subtitle Source Selection component
 * @param {Object} props - Component props
 * @param {string} props.subtitleSource - Current subtitle source
 * @param {Function} props.setSubtitleSource - Function to set subtitle source
 * @param {boolean} props.isGenerating - Whether generation is in progress
 * @param {Array} props.translatedSubtitles - Translated subtitles
 * @returns {JSX.Element} - Rendered component
 */
const SubtitleSourceSelection = ({
  subtitleSource,
  setSubtitleSource,
  isGenerating,
  translatedSubtitles
}) => {
  const { t } = useTranslation();
  const hasTranslatedSubtitles = translatedSubtitles && translatedSubtitles.length > 0;

  return (
    <div className="narration-row subtitle-source-row">
      <div className="row-label">
        <label>{t('narration.subtitleSource', 'Subtitle Source')}:</label>
      </div>
      <div className="row-content">
        <div className="radio-pill-group">
          <div className="radio-pill">
            <input
              type="radio"
              id="source-original"
              name="subtitle-source"
              value="original"
              checked={subtitleSource === 'original'}
              onChange={() => setSubtitleSource('original')}
              disabled={isGenerating}
            />
            <label htmlFor="source-original">
              {t('narration.originalSubtitles', 'Original Subtitles')}
            </label>
          </div>
          <div className="radio-pill">
            <input
              type="radio"
              id="source-translated"
              name="subtitle-source"
              value="translated"
              checked={subtitleSource === 'translated'}
              onChange={() => setSubtitleSource('translated')}
              disabled={isGenerating || !hasTranslatedSubtitles}
            />
            <label htmlFor="source-translated">
              {t('narration.translatedSubtitles', 'Translated Subtitles')}
              {!hasTranslatedSubtitles && (
                <span className="unavailable-indicator">
                  {t('narration.unavailable', '(unavailable)')}
                </span>
              )}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubtitleSourceSelection;
