import { useState } from 'react';
import { translateSubtitles, getProcessingForceStopped } from '../services/geminiService';

/**
 * Custom hook that manages bulk (multi-file) translation state and handlers.
 * Composes into the main translation hook by receiving the parent state it needs.
 * @param {Object} params
 * @param {string} params.selectedModel - Currently selected translation model
 * @param {number} params.splitDuration - Split duration setting
 * @param {Function} params.setError - Setter for the error message
 * @param {Function} params.setTranslationStatus - Setter for the translation status message
 * @param {Function} params.t - i18n translation function
 * @returns {Object} - Bulk translation state and handlers
 */
export const useTranslationBulk = ({
  selectedModel,
  splitDuration,
  setError,
  setTranslationStatus,
  t
}) => {
  // Bulk translation state
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkTranslations, setBulkTranslations] = useState([]);
  const [isBulkTranslating, setIsBulkTranslating] = useState(false);
  const [currentBulkFileIndex, setCurrentBulkFileIndex] = useState(-1);

  /**
   * Handle bulk translation
   * @param {Array} languages - Languages to translate to
   * @param {string|null} delimiter - Delimiter for multi-language translation
   * @param {boolean} useParentheses - Whether to use parentheses for the second language
   * @param {Object} bracketStyle - Optional bracket style { open, close }
   * @param {Array} chainItems - Optional chain items for format mode
   * @param {boolean} hasMainSubtitles - Whether there are main subtitles to translate after bulk
   */
  const handleBulkTranslate = async (languages, delimiter = ' ', useParentheses = false, bracketStyle = null, chainItems = null, hasMainSubtitles = false) => {
    if (bulkFiles.length === 0) {
      setError(t('translation.bulk.noFiles', 'No files added for bulk translation'));
      return;
    }

    setIsBulkTranslating(true);
    setError('');
    setBulkTranslations([]);
    setCurrentBulkFileIndex(0);

    const results = [];

    try {
      // Process each file sequentially
      for (let i = 0; i < bulkFiles.length; i++) {
        // Check if processing has been force stopped before processing each file
        if (getProcessingForceStopped()) {
          console.log('Bulk translation cancelled by user');
          throw new Error('Bulk translation was cancelled by user');
        }

        setCurrentBulkFileIndex(i);
        const bulkFile = bulkFiles[i];

        // Update status - include main file in total count if it exists
        const totalFiles = bulkFiles.length + (hasMainSubtitles ? 1 : 0);
        setTranslationStatus(t('translation.bulk.processing', 'Processing file {{current}}/{{total}}: {{filename}}', {
          current: i + 1,
          total: totalFiles,
          filename: bulkFile.name
        }));

        try {
          // Use the same translation settings but skip context rules
          const result = await translateSubtitles(
            bulkFile.subtitles,
            languages.length === 1 ? languages[0] : languages,
            selectedModel,
            null, // Skip custom prompt/context rules for bulk translation
            splitDuration,
            false, // Skip include rules for bulk translation
            languages.length === 2 && useParentheses ? delimiter : (useParentheses ? null : delimiter),
            useParentheses,
            bracketStyle,
            chainItems,
            bulkFile.name // File context for bulk translation
          );

          if (result && result.length > 0) {
            results.push({
              originalFile: bulkFile,
              translatedSubtitles: result,
              success: true
            });
          } else {
            results.push({
              originalFile: bulkFile,
              error: t('translation.emptyResult', 'Translation returned no results'),
              success: false
            });
          }
        } catch (fileError) {
          console.error(`Error translating file ${bulkFile.name}:`, fileError);

          // Check if this was a cancellation error
          if (fileError.message && fileError.message.includes('aborted')) {
            console.log('File translation was cancelled, stopping bulk translation');
            throw new Error('Bulk translation was cancelled by user');
          }

          results.push({
            originalFile: bulkFile,
            error: fileError.message || t('translation.error', 'Error translating subtitles'),
            success: false
          });
        }

        // Check if processing has been force stopped after each file
        if (getProcessingForceStopped()) {
          console.log('Bulk translation cancelled by user after file completion');
          throw new Error('Bulk translation was cancelled by user');
        }
      }

      setBulkTranslations(results);

      // Calculate total files including main file if it exists
      const totalFiles = results.length + (hasMainSubtitles ? 1 : 0);
      const successfulBulkFiles = results.filter(r => r.success).length;

      if (hasMainSubtitles) {
        // If there's a main file to translate, show intermediate status
        setTranslationStatus(t('translation.bulk.completeWithMain', 'Bulk files complete: {{success}}/{{bulkTotal}} bulk files processed, main file next ({{current}}/{{total}} total)', {
          success: successfulBulkFiles,
          bulkTotal: results.length,
          current: successfulBulkFiles,
          total: totalFiles
        }));
      } else {
        // If no main file, show final status
        setTranslationStatus(t('translation.bulk.complete', 'Bulk translation complete: {{success}}/{{total}} files processed successfully', {
          success: successfulBulkFiles,
          total: totalFiles
        }));
      }

    } catch (error) {
      console.error('Bulk translation error:', error);

      // Check if this was a cancellation
      if (error.message && (error.message.includes('cancelled') || error.message.includes('aborted'))) {
        setTranslationStatus(t('translation.cancelled', 'Translation cancelled by user'));
      } else {
        setError(t('translation.bulk.error', 'Error during bulk translation: {{message}}', { message: error.message }));
      }
    } finally {
      setIsBulkTranslating(false);
      setCurrentBulkFileIndex(-1);
    }
  };

  /**
   * Handle bulk file removal with translation cleanup
   * @param {string} fileId - ID of the file to remove
   */
  const handleBulkFileRemoval = (fileId) => {
    // Remove the file from bulk files
    const updatedBulkFiles = bulkFiles.filter(bf => bf.id !== fileId);
    setBulkFiles(updatedBulkFiles);

    // Remove corresponding translation result if it exists
    const updatedBulkTranslations = bulkTranslations.filter(bt => bt.originalFile.id !== fileId);
    setBulkTranslations(updatedBulkTranslations);
  };

  /**
   * Handle bulk files removal (remove all) with translation cleanup
   */
  const handleBulkFilesRemovalAll = () => {
    setBulkFiles([]);
    setBulkTranslations([]);
  };

  return {
    bulkFiles,
    setBulkFiles,
    bulkTranslations,
    setBulkTranslations,
    isBulkTranslating,
    setIsBulkTranslating,
    currentBulkFileIndex,
    setCurrentBulkFileIndex,
    handleBulkTranslate,
    handleBulkFileRemoval,
    handleBulkFilesRemovalAll
  };
};
