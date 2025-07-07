import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Translation action buttons component
 * @param {Object} props - Component props
 * @param {boolean} props.isTranslating - Whether translation is in progress
 * @param {Function} props.onTranslate - Function to handle translation
 * @param {Function} props.onCancel - Function to handle cancellation
 * @param {boolean} props.disabled - Whether the buttons are disabled
 * @param {boolean} props.isFormatMode - Whether we're in format mode (only original language)
 * @returns {JSX.Element} - Rendered component
 */
const TranslationActions = ({
  isTranslating,
  onTranslate,
  onCancel,
  disabled = false,
  isFormatMode = false
}) => {
  const { t } = useTranslation();

  // Gemini effects for translate buttons have been removed to reduce lag

  return (
    <div className="translation-row action-row">
      <div className="row-content action-content">
        {isTranslating ? (
          <>
            <button
              className="translate-button processing"
              disabled={true}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                  <span
                    className="loading-spinner translate-spinner"
                    aria-hidden="true"
                  ></span>
                </div>
                <span>{t('translation.translating', 'Translating...')}</span>
              </div>
            </button>
            <button
              className="cancel-translation-button"
              onClick={onCancel}
              title={t('translation.cancelTooltip', 'Cancel translation process')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              {t('translation.cancel', 'Cancel')}
            </button>
          </>
        ) : (
          <button
            className={`translate-button ${isFormatMode ? 'format-button' : ''}`}
            onClick={onTranslate}
            disabled={disabled}
          >
            {isFormatMode ? (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6"></polyline>
                  <polyline points="8 6 2 12 8 18"></polyline>
                </svg>
                {t('translation.format', 'Format')}
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                {t('translation.translate', 'Translate')}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default TranslationActions;
