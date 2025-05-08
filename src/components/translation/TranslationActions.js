import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import initTranslateButtonEffects from '../../utils/translateButtonEffects';

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

  // Initialize Gemini effects for translate buttons
  useEffect(() => {
    // Small delay to ensure DOM is fully rendered
    const timer = setTimeout(() => {
      initTranslateButtonEffects();

      // Add a MutationObserver to detect when the button is clicked
      // This ensures the effects are reinitialized after the button state changes
      const translateButtons = document.querySelectorAll('.translate-button.generate-btn');
      if (translateButtons.length > 0) {
        const observer = new MutationObserver((mutations) => {
          // When button attributes change (like disabled state), reinitialize effects
          initTranslateButtonEffects();
        });

        // Observe each translate button for attribute changes
        translateButtons.forEach(button => {
          observer.observe(button, {
            attributes: true,
            attributeFilter: ['class', 'disabled']
          });
        });

        // Return cleanup function
        return () => observer.disconnect();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isTranslating]); // Re-initialize when isTranslating changes

  return (
    <div className="translation-row action-row">
      <div className="row-content action-content">
        {isTranslating ? (
          <>
            <button
              className="translate-button generate-btn processing"
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
            className={`translate-button generate-btn ${isFormatMode ? 'format-button' : ''}`}
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
