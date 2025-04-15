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

  return (
    <div className="translation-row action-row">
      <div className="row-content action-content">
        {isTranslating ? (
          <>
            <button
              className="translate-button"
              disabled={true}
            >
              <span className="loading-spinner"></span>
              {t('translation.translating', 'Translating...')}
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
            {isFormatMode
              ? t('translation.format', 'Format')
              : t('translation.translate', 'Translate')}
          </button>
        )}
      </div>
    </div>
  );
};

export default TranslationActions;
