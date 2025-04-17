import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Generate Button component
 * @param {Object} props - Component props
 * @param {Function} props.handleGenerateNarration - Function to handle narration generation
 * @param {boolean} props.isGenerating - Whether generation is in progress
 * @param {Object} props.referenceAudio - Reference audio object
 * @param {Array} props.generationResults - Generation results
 * @param {Function} props.downloadAllAudio - Function to download all audio
 * @returns {JSX.Element} - Rendered component
 */
const GenerateButton = ({
  handleGenerateNarration,
  isGenerating,
  referenceAudio,
  generationResults,
  downloadAllAudio
}) => {
  const { t } = useTranslation();

  return (
    <div className="narration-row generate-button-row">
      <div className="row-label">
        <label>{t('narration.generate', 'Generate')}:</label>
      </div>
      <div className="row-content">
        <div className="pill-button-group">
          <button
            className="pill-button primary generate-btn"
            onClick={handleGenerateNarration}
            disabled={isGenerating || !referenceAudio}
          >
            {isGenerating && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke="currentColor">
                  <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
                </path>
              </svg>
            )}
            {isGenerating
              ? t('narration.generating', 'Generating...')
              : t('narration.generate', 'Generate Narration')}
          </button>

          {generationResults.length > 0 && (
            <button
              className="pill-button secondary download-all-btn"
              onClick={downloadAllAudio}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t('narration.downloadAll', 'Download All')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GenerateButton;
