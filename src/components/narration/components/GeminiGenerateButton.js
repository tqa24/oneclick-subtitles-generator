import React from 'react';
import { useTranslation } from 'react-i18next';
import '../../../styles/narration/geminiGenerateButton.css';

/**
 * Generate button component for Gemini narration
 * @param {Object} props - Component props
 * @param {Function} props.handleGenerateNarration - Function to handle narration generation
 * @param {boolean} props.isGenerating - Whether generation is in progress
 * @param {string} props.subtitleSource - Selected subtitle source
 * @param {Function} props.cancelGeneration - Function to cancel generation
 * @returns {JSX.Element} - Rendered component
 */
const GeminiGenerateButton = ({
  handleGenerateNarration,
  isGenerating,
  subtitleSource,
  cancelGeneration
}) => {
  const { t } = useTranslation();

  return (
    <div className="narration-row generate-button-row">
      <div className="row-content">
        <div className="pill-button-group">
          {isGenerating ? (
            <button
              className="pill-button danger cancel-btn"
              onClick={cancelGeneration}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              {t('narration.cancel', 'Cancel Generation')}
            </button>
          ) : (
            <button
              className="pill-button primary generate-btn"
              onClick={handleGenerateNarration}
              disabled={!subtitleSource}
              title={!subtitleSource ? t('narration.noSourceSelectedError', 'Please select a subtitle source (Original or Translated)') : ''}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 5.14v14l11-7-11-7z" />
              </svg>
              {t('narration.generateWithGemini', 'Generate Narration with Gemini')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeminiGenerateButton;
