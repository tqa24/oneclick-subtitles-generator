import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { translateSubtitles, abortAllRequests } from '../services/geminiService';

/**
 * Custom hook to manage translation state
 * @param {Array} subtitles - Subtitles to translate
 * @param {Function} onTranslationComplete - Callback when translation is complete
 * @returns {Object} - Translation state and handlers
 */
export const useTranslationState = (subtitles, onTranslationComplete) => {
  const { t } = useTranslation();
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedSubtitles, setTranslatedSubtitles] = useState(null);
  const [error, setError] = useState('');
  const [translationStatus, setTranslationStatus] = useState('');
  const [selectedModel, setSelectedModel] = useState(() => {
    // Get the model from localStorage or use default
    return localStorage.getItem('gemini_model') || 'gemini-2.0-flash';
  });
  const [customTranslationPrompt, setCustomTranslationPrompt] = useState(
    localStorage.getItem('custom_prompt_translation') || null
  );
  const [splitDuration, setSplitDuration] = useState(() => {
    // Get the split duration from localStorage or use default (0 = no split)
    return parseInt(localStorage.getItem('translation_split_duration') || '0');
  });
  const [includeRules, setIncludeRules] = useState(() => {
    // Get the preference from localStorage or default to true
    return localStorage.getItem('translation_include_rules') !== 'false';
  });
  const [rulesAvailable, setRulesAvailable] = useState(false);
  const [userProvidedSubtitles, setUserProvidedSubtitles] = useState('');
  const hasUserProvidedSubtitles = userProvidedSubtitles.trim() !== '';

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

  // Check if transcription rules are available
  useEffect(() => {
    const checkRulesAvailability = async () => {
      try {
        // Dynamically import to avoid circular dependencies
        const { getTranscriptionRulesSync } = await import('../utils/transcriptionRulesStore');
        const rules = getTranscriptionRulesSync();
        setRulesAvailable(!!rules);
        console.log('Transcription rules available:', !!rules);
      } catch (error) {
        console.error('Error checking transcription rules availability:', error);
        setRulesAvailable(false);
      }
    };

    checkRulesAvailability();
  }, []);

  // Load user-provided subtitles
  useEffect(() => {
    const loadUserProvidedSubtitles = async () => {
      try {
        // Dynamically import to avoid circular dependencies
        const { getUserProvidedSubtitlesSync } = await import('../utils/userSubtitlesStore');
        const subtitles = getUserProvidedSubtitlesSync();
        setUserProvidedSubtitles(subtitles || '');
        console.log('User-provided subtitles loaded:', subtitles ? 'yes' : 'no');
      } catch (error) {
        console.error('Error loading user-provided subtitles:', error);
        setUserProvidedSubtitles('');
      }
    };

    loadUserProvidedSubtitles();
  }, []);

  /**
   * Handle model selection
   * @param {string} modelId - Selected model ID
   */
  const handleModelSelect = (modelId) => {
    setSelectedModel(modelId);
    // We don't save to localStorage here to avoid affecting the global setting
    // This way, the model selection is only for this translation
  };

  /**
   * Handle saving custom prompt
   * @param {string} newPrompt - New custom prompt
   */
  const handleSavePrompt = (newPrompt) => {
    setCustomTranslationPrompt(newPrompt);
    localStorage.setItem('custom_prompt_translation', newPrompt);
  };

  /**
   * Handle translation
   * @param {Array} languages - Languages to translate to
   * @param {string|null} delimiter - Delimiter for multi-language translation
   * @param {boolean} useParentheses - Whether to use parentheses for the second language
   * @param {Object} bracketStyle - Optional bracket style { open, close }
   * @param {Array} chainItems - Optional chain items for format mode
   */
  const handleTranslate = async (languages, delimiter = ' ', useParentheses = false, bracketStyle = null, chainItems = null) => {
    // Check if at least one language is entered (unless in format mode with chainItems)
    if (languages.length === 0 && !chainItems) {
      setError(t('translation.languageRequired', 'Please enter at least one target language'));
      return;
    }

    if (!subtitles || subtitles.length === 0) {
      setError(t('translation.noSubtitles', 'No subtitles to translate'));
      return;
    }

    setError('');
    setIsTranslating(true);

    try {
      // For 2 target languages, we can use both delimiter and brackets
      // For 3+ languages, we only use delimiter
      const useBothOptions = languages.length === 2 && useParentheses;

      // Pass the selected model, custom prompt, split duration, includeRules, delimiter and parentheses options
      const result = await translateSubtitles(
        subtitles,
        languages.length === 1 ? languages[0] : languages,
        selectedModel,
        customTranslationPrompt,
        splitDuration,
        includeRules,
        useBothOptions ? delimiter : (useParentheses ? null : delimiter), // Pass delimiter even when using parentheses for 2 languages
        useParentheses,
        bracketStyle, // Pass the bracket style
        chainItems // Pass the chain items for format mode
      );
      console.log('Translation result received:', result ? result.length : 0, 'subtitles');

      // Check if result is valid
      if (!result || result.length === 0) {
        console.error('Translation returned empty result');
        setError(t('translation.emptyResult', 'Translation returned no results. Please try again or check the console for errors.'));
        return;
      }

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

  /**
   * Handle cancellation of translation
   */
  const handleCancelTranslation = () => {
    console.log('Cancelling translation process...');
    abortAllRequests();
    setIsTranslating(false);
    setError(t('translation.cancelled', 'Translation cancelled by user'));
  };

  /**
   * Handle reset of translation
   */
  const handleReset = () => {
    setTranslatedSubtitles(null);
    setError('');
    if (onTranslationComplete) {
      onTranslationComplete(null);
    }
  };

  /**
   * Handle split duration change
   * @param {number} value - New split duration value
   */
  const handleSplitDurationChange = (value) => {
    setSplitDuration(value);
    localStorage.setItem('translation_split_duration', value.toString());
  };

  /**
   * Handle include rules toggle
   * @param {boolean} value - New include rules value
   */
  const handleIncludeRulesChange = (value) => {
    setIncludeRules(value);
    localStorage.setItem('translation_include_rules', value.toString());
  };

  return {
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
    handleTranslate,
    handleCancelTranslation,
    handleReset,
    handleSplitDurationChange,
    handleIncludeRulesChange
  };
};

export default useTranslationState;
