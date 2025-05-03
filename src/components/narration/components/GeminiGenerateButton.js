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
    <div className="gemini-generate-controls">
      {isGenerating ? (
        <button
          className="gemini-cancel-btn"
          onClick={cancelGeneration}
        >
          {t('narration.cancel', 'Cancel')}
        </button>
      ) : (
        <button
          className="gemini-generate-btn"
          onClick={handleGenerateNarration}
          disabled={!subtitleSource}
        >
          {t('narration.generateWithGemini', 'Generate Narration with Gemini')}
        </button>
      )}
    </div>
  );
};

export default GeminiGenerateButton;
