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
 * @param {Function} props.downloadAllAudio - Function to download all audio files
 * @param {Function} props.downloadAlignedAudio - Function to download aligned audio
 * @param {Array} props.generationResults - Generation results
 * @param {boolean} props.isServiceAvailable - Whether the narration service is available
 * @param {string} props.serviceUnavailableMessage - Message to show when service is unavailable
 * @returns {JSX.Element} - Rendered component
 */
const GeminiGenerateButton = ({
  handleGenerateNarration,
  isGenerating,
  subtitleSource,
  cancelGeneration,
  downloadAllAudio,
  downloadAlignedAudio,
  generationResults,
  isServiceAvailable = true,
  serviceUnavailableMessage = ''
}) => {
  const { t } = useTranslation();

  // Check if there are any successful narrations with audio data
  const hasAudioToDownload = generationResults &&
                            generationResults.length > 0 &&
                            generationResults.some(r => r.success && r.audioData);

  return (
    <div className="narration-row generate-button-row animated-row">
      <div className="row-content generate-button-container">
        {/* Left side - Generate/Cancel button */}
        <div className="generate-button-left">
          {isGenerating ? (
            <button
              className="pill-button danger cancel-btn"
              onClick={cancelGeneration}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              {t('narration.cancel', 'Cancel Generation')}
            </button>
          ) : (
            <button
              className="pill-button primary"
              onClick={handleGenerateNarration}
              disabled={!subtitleSource || !isServiceAvailable}
              title={
                !isServiceAvailable ? serviceUnavailableMessage :
                !subtitleSource ? t('narration.noSourceSelectedError', 'Please select a subtitle source (Original or Translated)') : ''
              }
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 5.14v14l11-7-11-7z" />
              </svg>
              {t('narration.generateWithGemini', 'Generate Narration with Gemini')}
            </button>
          )}
        </div>

        {/* Right side - Download buttons */}
        <div className="generate-button-right">
          <div className="pill-button-group">
            <button
              className="pill-button secondary download-all-btn"
              onClick={downloadAllAudio}
              title={t('narration.downloadAllTooltip', 'Download all generated audio files')}
              disabled={!hasAudioToDownload}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t('narration.downloadAll', 'Download All')}
            </button>

            <button
              className="pill-button secondary"
              onClick={downloadAlignedAudio}
              title={t('narration.downloadAlignedTooltip', 'Download a single aligned narration file')}
              disabled={!hasAudioToDownload}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t('narration.downloadAligned', 'Download Aligned')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeminiGenerateButton;
