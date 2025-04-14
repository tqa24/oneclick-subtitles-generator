import { useState } from 'react';

/**
 * Custom hook to manage language input fields
 * @param {Array} initialLanguages - Initial language values
 * @returns {Object} - Language input state and handlers
 */
export const useLanguageInputs = (initialLanguages = [{ id: 1, value: '' }]) => {
  const [targetLanguages, setTargetLanguages] = useState(initialLanguages);

  /**
   * Add a new language input
   */
  const handleAddLanguage = () => {
    setTargetLanguages([...targetLanguages, { id: Date.now(), value: '' }]);
  };

  /**
   * Remove a language input
   * @param {number} id - ID of the language to remove
   */
  const handleRemoveLanguage = (id) => {
    if (targetLanguages.length > 1) {
      setTargetLanguages(targetLanguages.filter(lang => lang.id !== id));
    }
  };

  /**
   * Update a language value
   * @param {number} id - ID of the language to update
   * @param {string} value - New value
   */
  const handleLanguageChange = (id, value) => {
    setTargetLanguages(targetLanguages.map(lang =>
      lang.id === id ? { ...lang, value } : lang
    ));
  };

  /**
   * Check if at least one language has a value
   * @returns {boolean} - True if at least one language has a value
   */
  const hasValidLanguage = () => {
    return targetLanguages.some(lang => lang.value.trim() !== '');
  };

  /**
   * Get an array of language values
   * @returns {Array} - Array of language values
   */
  const getLanguageValues = () => {
    return targetLanguages.map(lang => lang.value.trim()).filter(lang => lang !== '');
  };

  return {
    targetLanguages,
    handleAddLanguage,
    handleRemoveLanguage,
    handleLanguageChange,
    hasValidLanguage,
    getLanguageValues
  };
};

export default useLanguageInputs;
