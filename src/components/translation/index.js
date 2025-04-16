import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadSRT, downloadJSON, downloadTXT } from '../../utils/fileUtils';
import { completeDocument, summarizeDocument } from '../../services/geminiService';
import useTranslationState from '../../hooks/useTranslationState';
import useLanguageInputs from '../../hooks/useLanguageInputs';
import TranslationHeader from './TranslationHeader';
import LanguageInputs from './LanguageInputs';
import DelimiterOptions from './DelimiterOptions';
import ModelSelection from './ModelSelection';
import SplitDurationSlider from './SplitDurationSlider';
import RulesToggle from './RulesToggle';
import PromptEditorButton from './PromptEditorButton';
import TranslationActions from './TranslationActions';
import TranslationStatus from './TranslationStatus';
import TranslationError from './TranslationError';
import TranslationPreview from './TranslationPreview';
import TranslationComplete from './TranslationComplete';
// Narration section moved to OutputContainer
import '../../styles/translation/index.css';
<<<<<<< Updated upstream
=======
import '../../styles/translation/languageChain.css';
// Narration styles moved to OutputContainer
>>>>>>> Stashed changes

/**
 * Translation section component
 * @param {Object} props - Component props
 * @param {Array} props.subtitles - Subtitles to translate
 * @param {string} props.videoTitle - Video title for download filenames
 * @param {Function} props.onTranslationComplete - Callback when translation is complete
 * @returns {JSX.Element} - Rendered component
 */
const TranslationSection = ({ subtitles, videoTitle, onTranslationComplete }) => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [txtContent, setTxtContent] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedDocument, setProcessedDocument] = useState(null);
  
  // Multi-language translation settings
  const [selectedDelimiter, setSelectedDelimiter] = useState(' '); // Default to space
  const [useParentheses, setUseParentheses] = useState(false);

  // Use custom hooks for state management
  const {
    targetLanguages,
    handleAddLanguage,
    handleRemoveLanguage,
    handleLanguageChange,
    hasValidLanguage,
    getLanguageValues
  } = useLanguageInputs();

  const {
    isTranslating,
    translatedSubtitles,
    error,
    translationStatus,
    selectedModel,
    customTranslationPrompt,
    splitDuration,
    includeRules,
    rulesAvailable,
    hasUserProvidedSubtitles,
    statusRef,
    handleModelSelect,
    handleSavePrompt,
    handleTranslate: translate,
    handleCancelTranslation,
    handleReset,
    handleSplitDurationChange,
    handleIncludeRulesChange
  } = useTranslationState(subtitles, onTranslationComplete);

  // Wrapper for handleTranslate to pass the current languages and delimiter settings
  const handleTranslate = () => {
    if (!hasValidLanguage()) {
      return;
    }
    translate(getLanguageValues(), selectedDelimiter, useParentheses);
  };

  // Handle download request from modal
  const handleDownload = (source, format) => {
    const subtitlesToUse = source === 'translated' ? translatedSubtitles : subtitles;

    if (subtitlesToUse && subtitlesToUse.length > 0) {
      let langSuffix = '';
      if (source === 'translated') {
        if (targetLanguages.length > 1) {
          langSuffix = '_multi_lang';
        } else {
          langSuffix = `_${targetLanguages[0]?.value?.toLowerCase().replace(/\\s+/g, '_') || 'translated'}`;
        }
      }
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
  const handleProcess = async (source, processType) => {
    const subtitlesToUse = source === 'translated' ? translatedSubtitles : subtitles;

    if (!subtitlesToUse || subtitlesToUse.length === 0) return;

    // First, get the text content if we don't have it yet
    let textContent = txtContent;
    if (!textContent) {
      textContent = subtitlesToUse.map(subtitle => subtitle.text).join('\\n\\n');
      setTxtContent(textContent);
    }

    setIsProcessing(true);
    try {
      let result;
      // For multi-language translations, use the first non-empty language or null
      let targetLang = null;
      if (source === 'translated') {
        if (targetLanguages.length > 1) {
          // For multi-language, we'll use the first valid language
          const validLanguage = targetLanguages.find(lang => lang.value?.trim() !== '');
          targetLang = validLanguage?.value || null;
        } else {
          targetLang = targetLanguages[0]?.value || null;
        }
      }

      if (processType === 'consolidate') {
        result = await completeDocument(textContent, selectedModel, targetLang);
      } else if (processType === 'summarize') {
        result = await summarizeDocument(textContent, selectedModel, targetLang);
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
              plainText += '\\n\\nKey Points:\\n';
              jsonResult.keyPoints.forEach((point, index) => {
                plainText += `\\n${index + 1}. ${point}`;
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
      let langSuffix = '';
      if (source === 'translated') {
        if (targetLanguages.length > 1) {
          langSuffix = '_multi_lang';
        } else {
          langSuffix = `_${targetLanguages[0]?.value?.toLowerCase().replace(/\\s+/g, '_') || 'translated'}`;
        }
      }
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

  return (
    <div className="translation-section">
      <TranslationHeader />

      <div className="translation-controls">
        {/* Language inputs */}
        <LanguageInputs
          targetLanguages={targetLanguages}
          onAddLanguage={handleAddLanguage}
          onRemoveLanguage={handleRemoveLanguage}
          onLanguageChange={handleLanguageChange}
          disabled={isTranslating || translatedSubtitles !== null}
        />

        {/* Delimiter settings - only show when multiple languages are added */}
        {targetLanguages.length > 1 && (
          <DelimiterOptions
            selectedDelimiter={selectedDelimiter}
            onDelimiterChange={setSelectedDelimiter}
            useParentheses={useParentheses}
            onParenthesesChange={setUseParentheses}
            disabled={isTranslating || translatedSubtitles !== null}
            showParenthesesOption={targetLanguages.length === 2}
          />
        )}

        {/* If we have translated subtitles, show the complete view */}
        {translatedSubtitles ? (
          <TranslationComplete
            onReset={handleReset}
            isModalOpen={isModalOpen}
            setIsModalOpen={setIsModalOpen}
            onDownload={handleDownload}
            onProcess={handleProcess}
            hasTranslation={translatedSubtitles && translatedSubtitles.length > 0}
            hasOriginal={subtitles && subtitles.length > 0}
          />
        ) : (
          <>
            {/* Model selection */}
            <ModelSelection
              selectedModel={selectedModel}
              onModelSelect={handleModelSelect}
            />

            {/* Split duration slider */}
            <SplitDurationSlider
              splitDuration={splitDuration}
              onSplitDurationChange={handleSplitDurationChange}
              subtitles={subtitles}
              disabled={isTranslating || translatedSubtitles !== null}
            />

            {/* Include rules toggle */}
            <RulesToggle
              includeRules={includeRules}
              onIncludeRulesChange={handleIncludeRulesChange}
              rulesAvailable={rulesAvailable}
              hasUserProvidedSubtitles={hasUserProvidedSubtitles}
              disabled={isTranslating || translatedSubtitles !== null}
            />

            {/* Prompt editor button */}
            <PromptEditorButton
              customPrompt={customTranslationPrompt}
              onSavePrompt={handleSavePrompt}
            />

            {/* Translation actions */}
            <TranslationActions
              isTranslating={isTranslating}
              onTranslate={handleTranslate}
              onCancel={handleCancelTranslation}
              disabled={!hasValidLanguage()}
            />

            {/* Translation status */}
            {isTranslating && (
              <TranslationStatus
                status={translationStatus}
                statusRef={statusRef}
              />
            )}
          </>
        )}

        {/* Error message */}
        <TranslationError error={error} />

        {/* Translation preview */}
        <TranslationPreview
          translatedSubtitles={translatedSubtitles}
          targetLanguages={targetLanguages}
        />

        {/* Narration Section moved to OutputContainer */}
      </div>
    </div>
  );
};

export default TranslationSection;
