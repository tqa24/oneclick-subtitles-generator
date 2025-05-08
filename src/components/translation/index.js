import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadSRT, downloadJSON, downloadTXT } from '../../utils/fileUtils';
import { completeDocument, summarizeDocument } from '../../services/geminiService';
import useTranslationState from '../../hooks/useTranslationState';
import useLanguageChain from '../../hooks/useLanguageChain';
import TranslationHeader from './TranslationHeader';
import LanguageChain from './LanguageChain';
import ModelSelection from './ModelSelection';
import SplitDurationSlider from './SplitDurationSlider';
import RestTimeSlider from './RestTimeSlider';
import RulesToggle from './RulesToggle';
import TranslationPromptEditorButton from './TranslationPromptEditorButton';
import TranslationActions from './TranslationActions';
import TranslationStatus from './TranslationStatus';
import TranslationError from './TranslationError';
import TranslationPreview from './TranslationPreview';
import TranslationComplete from './TranslationComplete';
// Narration section moved to OutputContainer
import '../../styles/translation/index.css';
import '../../styles/translation/languageChain.css';
// Narration styles moved to OutputContainer

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

  // Refs for height animation
  const containerRef = useRef(null);
  const contentRef = useRef(null);

  // Use language chain hook for managing languages and delimiters
  const {
    chainItems,
    addLanguage,
    addOriginalLanguage,
    addDelimiter,
    removeItem,
    updateLanguage,
    updateDelimiter,
    moveItem,
    getLanguageValues,
    getDelimiterValues,
    hasValidLanguage,
    hasOnlyOriginalLanguage
  } = useLanguageChain(false); // false = don't include original language by default

  // Get target languages from chain items
  const targetLanguages = chainItems.filter(item => item.type === 'language' && !item.isOriginal);

  const {
    isTranslating,
    translatedSubtitles,
    error,
    translationStatus,
    selectedModel,
    customTranslationPrompt,
    splitDuration,
    restTime,
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
    handleRestTimeChange,
    handleIncludeRulesChange
  } = useTranslationState(subtitles, onTranslationComplete);

  // Initialize container height on component mount
  useEffect(() => {
    if (containerRef.current && contentRef.current) {
      // Small delay to ensure the DOM is fully rendered
      setTimeout(() => {
        // Set initial height with extra 100px to ensure enough space
        const contentHeight = contentRef.current.offsetHeight;
        containerRef.current.style.height = `${contentHeight + 150}px`;
      }, 50);
    }
  }, []);

  // Handle height animation when content changes
  useEffect(() => {
    // Use a small delay to ensure the new content is rendered
    const animationTimeout = setTimeout(() => {
      if (containerRef.current && contentRef.current) {
        // Get the height of the content and add 100px for extra space
        const contentHeight = contentRef.current.offsetHeight;

        // Set the container height to match the content height plus extra space
        containerRef.current.style.height = `${contentHeight + 150}px`;
      }
    }, 50); // Small delay to ensure content is rendered

    return () => clearTimeout(animationTimeout);
  }, [translatedSubtitles, isTranslating, error]); // Re-run when these state values change

  // Wrapper for handleTranslate to pass the current languages and delimiter settings
  const handleTranslate = () => {
    // Format mode - only original language in the chain
    const isFormatMode = hasOnlyOriginalLanguage();

    // In format mode, we don't need to check for valid languages
    if (!isFormatMode && !hasValidLanguage()) {
      return;
    }

    // Always pass the chain items to ensure the exact arrangement is preserved
    console.log('Chain items for translation/formatting:', chainItems);

    if (isFormatMode) {
      // In format mode, pass empty languages array
      translate([], '', false, null, chainItems);
    } else {
      // In translation mode, pass languages and chain items
      // Get the first delimiter's value and style (if any) as fallback
      const delimiters = getDelimiterValues();
      const firstDelimiter = delimiters.length > 0 ? delimiters[0] : { value: ' ', style: { open: '', close: '' } };

      // Check if we're using brackets (parentheses)
      const useParentheses = firstDelimiter.style && (firstDelimiter.style.open || firstDelimiter.style.close);

      // Get languages for translation
      const languages = getLanguageValues();

      // Pass both the languages and the chain items
      translate(languages, firstDelimiter.value, useParentheses, firstDelimiter.style, chainItems);
    }
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
    <div className="translation-section" ref={containerRef}>
      <TranslationHeader
        promptEditorButton={
          <TranslationPromptEditorButton
            customPrompt={customTranslationPrompt}
            onSavePrompt={handleSavePrompt}
          />
        }
      />

      <div className={`translation-controls ${translatedSubtitles ? 'state-results' : 'state-form'}`} ref={contentRef}>
        {/* Language Chain UI */}
        <div className="translation-row language-chain-row">
          <div className="row-label">
            <label>{t('translation.languageChain', 'Language Chain')}:</label>
          </div>
          <div className="row-content">
            <LanguageChain
              chainItems={chainItems}
              onAddLanguage={addLanguage}
              onAddOriginalLanguage={addOriginalLanguage}
              onAddDelimiter={addDelimiter}
              onRemoveItem={removeItem}
              onUpdateLanguage={updateLanguage}
              onUpdateDelimiter={updateDelimiter}
              onMoveItem={moveItem}
              disabled={isTranslating || translatedSubtitles !== null}
              showOriginalOption={true}
            />
          </div>
        </div>

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
            {/* Check if we're in format mode (only original language) */}
            {!hasOnlyOriginalLanguage() && (
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

                {/* Rest time slider */}
                <RestTimeSlider
                  restTime={restTime}
                  onRestTimeChange={handleRestTimeChange}
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
              </>
            )}

            {/* Translation actions */}
            <TranslationActions
              isTranslating={isTranslating}
              onTranslate={handleTranslate}
              onCancel={handleCancelTranslation}
              disabled={!hasOnlyOriginalLanguage() && !hasValidLanguage()}
              isFormatMode={hasOnlyOriginalLanguage()}
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
