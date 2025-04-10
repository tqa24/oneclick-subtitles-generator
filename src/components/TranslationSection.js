import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { translateSubtitles, completeDocument, summarizeDocument, getDefaultTranslationPrompt } from '../services/geminiService';
import { downloadSRT, downloadJSON, downloadTXT } from '../utils/fileUtils';
import ModelDropdown from './ModelDropdown';
import DownloadOptionsModal from './DownloadOptionsModal';
import PromptEditor from './PromptEditor';
import '../styles/TranslationSection.css';

const TranslationSection = ({ subtitles, videoTitle, onTranslationComplete }) => {
  const { t } = useTranslation();
  const [targetLanguage, setTargetLanguage] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedSubtitles, setTranslatedSubtitles] = useState(null);
  const [error, setError] = useState('');
  const [selectedModel, setSelectedModel] = useState(() => {
    // Get the model from localStorage or use default
    return localStorage.getItem('gemini_model') || 'gemini-2.0-flash';
  });
  const [txtContent, setTxtContent] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedDocument, setProcessedDocument] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false);
  const [customTranslationPrompt, setCustomTranslationPrompt] = useState(
    localStorage.getItem('custom_prompt_translation') || null
  );
  const [splitDuration, setSplitDuration] = useState(() => {
    // Get the split duration from localStorage or use default (0 = no split)
    return parseInt(localStorage.getItem('translation_split_duration') || '0');
  });
  const [translationStatus, setTranslationStatus] = useState('');

  // Reference to the status message element for scrolling
  const statusRef = useRef(null);

  // Update selectedModel when localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      const storedModel = localStorage.getItem('gemini_model');
      if (storedModel && storedModel !== selectedModel) {
        setSelectedModel(storedModel);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [selectedModel]);

  // Listen for translation status updates
  useEffect(() => {
    const handleTranslationStatus = (event) => {
      setTranslationStatus(event.detail.message);

      // Scroll to the status message if it exists
      if (statusRef.current) {
        statusRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    };

    window.addEventListener('translation-status', handleTranslationStatus);
    return () => window.removeEventListener('translation-status', handleTranslationStatus);
  }, []);

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
      // Pass the selected model, custom prompt, and split duration to the translation function
      const result = await translateSubtitles(subtitles, targetLanguage, selectedModel, customTranslationPrompt, splitDuration);
      setTranslatedSubtitles(result);
      if (onTranslationComplete) {
        onTranslationComplete(result);
      }

      // Save the split duration setting to localStorage
      localStorage.setItem('translation_split_duration', splitDuration.toString());
    } catch (err) {
      console.error('Translation error:', err);
      setError(t('translation.error', 'Error translating subtitles. Please try again.'));
    } finally {
      setIsTranslating(false);
    }
  };

  // Handle download request from modal
  const handleDownload = (source, format) => {
    const subtitlesToUse = source === 'translated' ? translatedSubtitles : subtitles;

    if (subtitlesToUse && subtitlesToUse.length > 0) {
      const langSuffix = source === 'translated' ? `_${targetLanguage.toLowerCase().replace(/\\s+/g, '_')}` : '';
      const baseFilename = `${videoTitle || 'subtitles'}${langSuffix}`;

      switch (format) {
        case 'srt':
          downloadSRT(subtitlesToUse, `${baseFilename}.srt`);
          break;
        case 'json':
          downloadJSON(subtitlesToUse, `${baseFilename}.json`);
          break;
        case 'txt':
          const content = downloadTXT(subtitlesToUse, `${baseFilename}.txt`);
          setTxtContent(content);
          break;
        default:
          break;
      }
    }
  };

  // Handle process request from modal
  const handleProcess = async (source, processType, model) => {
    const subtitlesToUse = source === 'translated' ? translatedSubtitles : subtitles;

    if (!subtitlesToUse || subtitlesToUse.length === 0) return;

    // First, get the text content if we don't have it yet
    let textContent = txtContent;
    if (!textContent) {
      textContent = subtitlesToUse.map(subtitle => subtitle.text).join('\n\n');
      setTxtContent(textContent);
    }

    setIsProcessing(true);
    try {
      let result;
      if (processType === 'consolidate') {
        result = await completeDocument(textContent, model);
      } else if (processType === 'summarize') {
        result = await summarizeDocument(textContent, model);
      }

      setProcessedDocument(result);

      // Show a temporary success message
      const successMessage = document.createElement('div');
      successMessage.className = 'save-success-message';
      successMessage.textContent = processType === 'consolidate'
        ? t('output.documentCompleted', 'Document completed successfully')
        : t('output.summaryCompleted', 'Summary completed successfully');
      document.body.appendChild(successMessage);

      // Remove the message after 3 seconds
      setTimeout(() => {
        if (document.body.contains(successMessage)) {
          document.body.removeChild(successMessage);
        }
      }, 3000);

      // Download the processed document
      const langSuffix = source === 'translated' ? `_${targetLanguage.toLowerCase().replace(/\\s+/g, '_')}` : '';
      const baseFilename = `${videoTitle || 'subtitles'}${langSuffix}`;
      const filename = processType === 'consolidate'
        ? `${baseFilename}_document.txt`
        : `${baseFilename}_summary.txt`;

      const blob = new Blob([result], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error(`Error ${processType === 'consolidate' ? 'completing' : 'summarizing'} document:`, error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setTranslatedSubtitles(null);
    setError('');
    if (onTranslationComplete) {
      onTranslationComplete(null);
    }
  };

  // Handle model selection
  const handleModelSelect = (modelId) => {
    setSelectedModel(modelId);
    // We don't save to localStorage here to avoid affecting the global setting
    // This way, the model selection is only for this translation
  };

  // Handle saving custom prompt
  const handleSavePrompt = (newPrompt) => {
    setCustomTranslationPrompt(newPrompt);
    localStorage.setItem('custom_prompt_translation', newPrompt);
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
        {/* First row: Language input */}
        <div className="translation-row language-row">
          <div className="row-label">
            <label htmlFor="target-language">{t('translation.targetLanguage', 'Target Language')}:</label>
          </div>
          <div className="row-content">
            <input
              id="target-language"
              type="text"
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              placeholder={t('translation.languagePlaceholder', 'Enter target language (e.g., Spanish, French, Japanese)')}
              disabled={isTranslating || translatedSubtitles !== null}
              className="language-input"
            />
          </div>
        </div>

        {/* Second row: Model selection */}
        {!translatedSubtitles ? (
          <>
            <div className="translation-row model-row">
              <div className="row-label">
                <label>{t('translation.modelSelection', 'Model')}:</label>
              </div>
              <div className="row-content">
                <ModelDropdown
                  onModelSelect={handleModelSelect}
                  selectedModel={selectedModel}
                  buttonClassName="translate-model-dropdown"
                  headerText={t('translation.selectModel', 'Select model for translation')}
                />
              </div>
            </div>

            {/* Third row: Split duration selection */}
            <div className="translation-row split-duration-row">
              <div className="row-label">
                <label>{t('translation.splitDuration', 'Split Duration')}:</label>
              </div>
              <div className="row-content">
                <select
                  value={splitDuration}
                  onChange={(e) => setSplitDuration(parseInt(e.target.value))}
                  className="split-duration-select"
                  title={t('translation.splitDurationTooltip', 'Split subtitles into chunks for translation to avoid token limits')}
                >
                  <option value="0">{t('translation.noSplit', 'No Split')}</option>
                  <option value="1">1 {t('translation.minutes', 'minutes')}</option>
                  <option value="3">3 {t('translation.minutes', 'minutes')}</option>
                  <option value="5">5 {t('translation.minutes', 'minutes')}</option>
                  <option value="7">7 {t('translation.minutes', 'minutes')}</option>
                  <option value="10">10 {t('translation.minutes', 'minutes')}</option>
                  <option value="15">15 {t('translation.minutes', 'minutes')}</option>
                  <option value="20">20 {t('translation.minutes', 'minutes')}</option>
                </select>
                <div
                  className="help-icon-container"
                  title={t('translation.splitDurationHelp', 'Splitting subtitles into smaller chunks helps prevent translations from being cut off due to token limits. For longer videos, use smaller chunks.')}
                >
                  <svg className="help-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                </div>
              </div>
            </div>

            {/* Fourth row: Prompt editing */}
            <div className="translation-row prompt-row">
              <div className="row-label">
                <label>{t('translation.promptSettings', 'Prompt')}:</label>
              </div>
              <div className="row-content">
                <button
                  className="edit-prompt-button-with-text"
                  onClick={() => setIsPromptEditorOpen(true)}
                  title={t('promptEditor.editPromptTooltip', 'Edit Gemini prompt')}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                  </svg>
                  <span>{t('promptEditor.editPrompt', 'Edit Prompt')}</span>
                </button>
              </div>
            </div>

            {/* Fifth row: Action buttons */}
            <div className="translation-row action-row">
              <div className="row-content action-content">
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
              </div>
            </div>

            {/* Translation status message */}
            {isTranslating && translationStatus && (
              <div className="translation-row status-row">
                <div className="row-content">
                  <div className="translation-status" ref={statusRef}>
                    {translationStatus}
                  </div>
                </div>
              </div>
            )}

            <PromptEditor
              isOpen={isPromptEditorOpen}
              onClose={() => setIsPromptEditorOpen(false)}
              initialPrompt={customTranslationPrompt || `Translate the following subtitles to {targetLanguage}.

IMPORTANT: You MUST preserve the exact SRT format with numbers and timestamps.
DO NOT modify the timestamps or subtitle numbers.
ONLY translate the text content between timestamps and blank lines.
DO NOT include any explanations, comments, or additional text in your response.

Format must be exactly:
1
00:01:23,456 --> 00:01:26,789
Translated text here

2
00:01:27,123 --> 00:01:30,456
Next translated text here

Here are the subtitles to translate:\n\n{subtitlesText}`}
              onSave={handleSavePrompt}
              title={t('promptEditor.editTranslationPrompt', 'Edit Translation Prompt')}
              description={t('promptEditor.customizeTranslationDesc', 'Customize how Gemini translates your subtitles.')}
            />
          </>
        ) : (
          <div className="translation-row action-row">
            <div className="row-content action-content">
              {/* New Translation button */}
              <button
                className="reset-translation-button"
                onClick={handleReset}
              >
                {t('translation.newTranslation', 'New Translation')}
              </button>


              <DownloadOptionsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onDownload={handleDownload}
                onProcess={handleProcess}
                hasTranslation={translatedSubtitles && translatedSubtitles.length > 0}
                hasOriginal={subtitles && subtitles.length > 0}
              />
            </div>
          </div>
        )}

        {/* Error message section */}
        {error && (
          <div className="translation-row error-row">
            <div className="row-content">
              <div className="translation-error">{error}</div>
            </div>
          </div>
        )}

        {/* Translation Preview Section */}
        {translatedSubtitles && (
          <div className="translation-row preview-row">
            <div className="row-label">
              <label>{t('translation.previewLabel', 'Preview')}:</label>
            </div>
            <div className="row-content">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TranslationSection;
