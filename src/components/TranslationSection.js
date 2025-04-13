import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { translateSubtitles, completeDocument, summarizeDocument, abortAllRequests } from '../services/geminiService';
import { downloadSRT, downloadJSON, downloadTXT } from '../utils/fileUtils';
import ModelDropdown from './ModelDropdown';
import DownloadOptionsModal from './DownloadOptionsModal';
import PromptEditor from './PromptEditor';
import '../styles/TranslationSection.css';

// Helper function to format time in HH:MM:SS.mmm format
const formatTimeString = (timeInSeconds) => {
  if (timeInSeconds === undefined || timeInSeconds === null) return '00:00:00.000';

  const hours = Math.floor(timeInSeconds / 3600);
  const minutes = Math.floor((timeInSeconds % 3600) / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  const milliseconds = Math.floor((timeInSeconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
};

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
      console.log('Translation result received:', result ? result.length : 0, 'subtitles');

      // Check if result is valid
      if (!result || result.length === 0) {
        console.error('Translation returned empty result');
        setError(t('translation.emptyResult', 'Translation returned no results. Please try again or check the console for errors.'));
        return;
      }

      if (result.length > 0) {
        console.log('First translated subtitle:', JSON.stringify(result[0]));
        console.log('Last translated subtitle:', JSON.stringify(result[result.length - 1]));
      }

      // Make sure the result has the necessary properties for display
      const processedResult = result.map((sub, index) => {
        // Ensure each subtitle has start and end times
        if ((!sub.start || sub.start === 0) && (!sub.startTime || sub.startTime === '00:00:00,000')) {
          // First try to find by originalId if available
          if (sub.originalId) {
            const originalSub = subtitles.find(s => s.id === sub.originalId);
            if (originalSub) {
              console.log(`Found original subtitle for ID ${sub.originalId} at index ${index}`);
              return {
                ...sub,
                start: originalSub.start,
                end: originalSub.end,
                startTime: sub.startTime || formatTimeString(originalSub.start),
                endTime: sub.endTime || formatTimeString(originalSub.end)
              };
            }
          }

          // If originalId doesn't work, try to match by index
          if (index < subtitles.length) {
            const originalSub = subtitles[index];
            console.log(`Using original subtitle at index ${index} as fallback`);
            return {
              ...sub,
              start: originalSub.start,
              end: originalSub.end,
              startTime: sub.startTime || formatTimeString(originalSub.start),
              endTime: sub.endTime || formatTimeString(originalSub.end),
              originalId: originalSub.id || index + 1
            };
          }
        } else if (sub.startTime && sub.endTime) {
          // If we have startTime and endTime strings but no numeric start/end, convert them
          if (!sub.start || !sub.end) {
            try {
              // Convert from SRT format (00:00:00,000) to seconds
              const startMatch = sub.startTime.match(/^(\d+):(\d+):(\d+),(\d+)$/);
              const endMatch = sub.endTime.match(/^(\d+):(\d+):(\d+),(\d+)$/);

              if (startMatch) {
                const startHours = parseInt(startMatch[1]);
                const startMinutes = parseInt(startMatch[2]);
                const startSeconds = parseInt(startMatch[3]);
                const startMs = parseInt(startMatch[4]) / 1000;
                sub.start = startHours * 3600 + startMinutes * 60 + startSeconds + startMs;
              }

              if (endMatch) {
                const endHours = parseInt(endMatch[1]);
                const endMinutes = parseInt(endMatch[2]);
                const endSeconds = parseInt(endMatch[3]);
                const endMs = parseInt(endMatch[4]) / 1000;
                sub.end = endHours * 3600 + endMinutes * 60 + endSeconds + endMs;
              }

              console.log(`Converted time strings to seconds for subtitle ${index+1}: ${sub.start}s - ${sub.end}s`);
            } catch (error) {
              console.error(`Error converting time strings for subtitle ${index+1}:`, error);
            }
          }
        }
        return sub;
      });

      // Sort the subtitles by start time to ensure they're in the correct order
      const sortedResult = [...processedResult].sort((a, b) => {
        // Use start time for sorting
        return (a.start || 0) - (b.start || 0);
      });

      console.log('Processed translation result:', sortedResult.length, 'subtitles');
      if (sortedResult.length > 0) {
        console.log('First processed subtitle:', JSON.stringify(sortedResult[0]));
        console.log('Last processed subtitle:', JSON.stringify(sortedResult[sortedResult.length - 1]));
      }

      setTranslatedSubtitles(sortedResult);
      if (onTranslationComplete) {
        onTranslationComplete(sortedResult);
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

      // Check if the result is JSON and extract plain text
      if (result && typeof result === 'string' && (result.trim().startsWith('{') || result.trim().startsWith('['))) {
        try {
          const jsonResult = JSON.parse(result);
          console.log('Detected JSON response:', jsonResult);

          // For summarize feature
          if (jsonResult.summary) {
            let plainText = jsonResult.summary;

            // Add key points if available
            if (jsonResult.keyPoints && Array.isArray(jsonResult.keyPoints) && jsonResult.keyPoints.length > 0) {
              plainText += '\n\nKey Points:\n';
              jsonResult.keyPoints.forEach((point, index) => {
                plainText += `\n${index + 1}. ${point}`;
              });
            }

            result = plainText;
            console.log('Extracted plain text from summary JSON');
          }
          // For consolidate feature
          else if (jsonResult.content) {
            result = jsonResult.content;
            console.log('Extracted plain text from content JSON');
          }
          // For any other JSON structure
          else if (jsonResult.text) {
            result = jsonResult.text;
            console.log('Extracted plain text from text JSON');
          }
        } catch (e) {
          console.log('Result looks like JSON but failed to parse:', e);
          // Keep the original result if parsing fails
        }
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

  // Handle cancellation of translation
  const handleCancelTranslation = () => {
    console.log('Cancelling translation process...');
    abortAllRequests();
    setIsTranslating(false);
    setError(t('translation.cancelled', 'Translation cancelled by user'));
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
                      onClick={handleCancelTranslation}
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
                    className="translate-button"
                    onClick={handleTranslate}
                    disabled={!targetLanguage.trim()}
                  >
                    {t('translation.translate', 'Translate')}
                  </button>
                )}
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

{subtitlesText}`}
              onSave={handleSavePrompt}
              title={t('promptEditor.editTranslationPrompt', 'Edit Translation Prompt')}
              promptType="translation" // Explicitly set the prompt type
              description={t('promptEditor.customizeTranslationDesc', 'Add custom instructions for translation. The system will automatically handle formatting.')}
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
        {translatedSubtitles && translatedSubtitles.length > 0 && (
          <div className="translation-row preview-row">
            <div className="row-label">
              <label>{t('translation.previewLabel', 'Preview')}:</label>
            </div>
            <div className="row-content">
              <div className="translation-preview">
                <h4>{t('translation.preview', 'Translation Preview')} ({targetLanguage})</h4>
                <div className="translation-preview-content">
                  {translatedSubtitles.slice(0, 5).map((subtitle, index) => {
                    // Determine the time display format
                    let startTimeDisplay = subtitle.startTime;
                    let endTimeDisplay = subtitle.endTime;

                    // If we have start/end in seconds but no formatted time strings
                    if (!startTimeDisplay && subtitle.start !== undefined) {
                      startTimeDisplay = formatTimeString(subtitle.start);
                    }

                    if (!endTimeDisplay && subtitle.end !== undefined) {
                      endTimeDisplay = formatTimeString(subtitle.end);
                    }

                    return (
                      <div key={index} className="preview-subtitle">
                        <span className="preview-time">
                          {startTimeDisplay || '00:00:00.000'} → {endTimeDisplay || '00:00:05.000'}
                        </span>
                        <span className="preview-text">{subtitle.text}</span>
                      </div>
                    );
                  })}
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
