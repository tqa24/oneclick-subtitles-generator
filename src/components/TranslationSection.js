import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { translateSubtitles } from '../services/geminiService';
import { downloadSRT, downloadJSON } from '../utils/fileUtils';
import '../styles/TranslationSection.css';

const TranslationSection = ({ subtitles, videoTitle, onTranslationComplete }) => {
  const { t } = useTranslation();
  const [targetLanguage, setTargetLanguage] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedSubtitles, setTranslatedSubtitles] = useState(null);
  const [error, setError] = useState('');

  const handleTranslate = async () => {
    if (!targetLanguage.trim()) {
      setError(t('translation.languageRequired', 'Please enter a target language'));
      return;
    }

    if (!subtitles || subtitles.length === 0) {
      setError(t('translation.noSubtitles', 'No subtitles to translate'));
      return;
    }

    setError('');
    setIsTranslating(true);

    try {
      const result = await translateSubtitles(subtitles, targetLanguage);
      setTranslatedSubtitles(result);
      if (onTranslationComplete) {
        onTranslationComplete(result);
      }
    } catch (err) {
      console.error('Translation error:', err);
      setError(t('translation.error', 'Error translating subtitles. Please try again.'));
    } finally {
      setIsTranslating(false);
    }
  };

  const handleDownloadSRT = () => {
    if (translatedSubtitles && translatedSubtitles.length > 0) {
      const filename = `${videoTitle || 'subtitles'}_${targetLanguage.toLowerCase().replace(/\\s+/g, '_')}.srt`;
      downloadSRT(translatedSubtitles, filename);
    }
  };

  const handleDownloadJSON = () => {
    if (translatedSubtitles && translatedSubtitles.length > 0) {
      const filename = `${videoTitle || 'subtitles'}_${targetLanguage.toLowerCase().replace(/\\s+/g, '_')}.json`;
      downloadJSON(translatedSubtitles, filename);
    }
  };

  const handleReset = () => {
    setTranslatedSubtitles(null);
    setError('');
    if (onTranslationComplete) {
      onTranslationComplete(null);
    }
  };

  return (
    <div className="translation-section">
      <div className="translation-header">
        <h3>{t('translation.title', 'Translate Subtitles')}</h3>
        <p className="translation-description">
          {t('translation.description', 'Translate your edited subtitles to another language while preserving timing information.')}
        </p>
      </div>

      <div className="translation-controls">
        <div className="language-input-container">
          <input
            type="text"
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            placeholder={t('translation.languagePlaceholder', 'Target language')}
            disabled={isTranslating || translatedSubtitles !== null}
            className="language-input"
          />
          {!translatedSubtitles ? (
            <button
              className="translate-button"
              onClick={handleTranslate}
              disabled={isTranslating || !targetLanguage.trim()}
            >
              {isTranslating ? (
                <>
                  <span className="loading-spinner"></span>
                  {t('translation.translating', 'Translating...')}
                </>
              ) : (
                t('translation.translate', 'Translate')
              )}
            </button>
          ) : (
            <div className="translation-actions">
              <div className="download-buttons">
                <button
                  className="download-translation-button"
                  onClick={handleDownloadSRT}
                >
                  {t('translation.downloadSRT', 'Download SRT')}
                </button>
                <button
                  className="download-translation-button json"
                  onClick={handleDownloadJSON}
                >
                  {t('translation.downloadJSON', 'Download JSON')}
                </button>
              </div>
              <button
                className="reset-translation-button"
                onClick={handleReset}
              >
                {t('translation.newTranslation', 'New Translation')}
              </button>
            </div>
          )}
        </div>

        {error && <div className="translation-error">{error}</div>}

        {translatedSubtitles && (
          <div className="translation-preview">
            <h4>{t('translation.preview', 'Translation Preview')} ({targetLanguage})</h4>
            <div className="translation-preview-content">
              {translatedSubtitles.slice(0, 5).map((subtitle, index) => (
                <div key={index} className="preview-subtitle">
                  <span className="preview-time">{subtitle.startTime} → {subtitle.endTime}</span>
                  <span className="preview-text">{subtitle.text}</span>
                </div>
              ))}
              {translatedSubtitles.length > 5 && (
                <div className="preview-more">
                  {t('translation.moreSubtitles', '... and {{count}} more subtitles', { count: translatedSubtitles.length - 5 })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TranslationSection;
