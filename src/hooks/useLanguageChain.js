import { useState, useCallback, useEffect } from 'react';

/**
 * Custom hook to manage the language chain state
 * @param {boolean} includeOriginal - Whether to include the original language in the chain
 * @returns {Object} - Language chain state and handlers
 */
const useLanguageChain = (includeOriginal = false) => {
  // Chain items can be languages or delimiters
  // Languages: { id: number, type: 'language', value: string, isOriginal: boolean }
  // Delimiters: { id: number, type: 'delimiter', value: string, style: { open: string, close: string } }
  const [chainItems, setChainItems] = useState(() => {
    // Try to load saved chain items from localStorage
    try {
      const savedChain = localStorage.getItem('language_chain_items');
      if (savedChain) {
        const parsedChain = JSON.parse(savedChain);


        // Ensure the chain has at least one item
        if (parsedChain && Array.isArray(parsedChain) && parsedChain.length > 0) {
          // Check if we need to add the original language
          if (includeOriginal && !parsedChain.some(item => item.type === 'language' && item.isOriginal)) {
            parsedChain.unshift({
              id: Date.now(),
              type: 'language',
              value: 'Original',
              isOriginal: true
            });
          }
          return parsedChain;
        }
      }
    } catch (error) {
      console.error('Error loading saved chain from localStorage:', error);
    }

    // If no saved chain or error, create default chain
    const initialItems = [];

    // Add original language if needed
    if (includeOriginal) {
      initialItems.push({
        id: Date.now(),
        type: 'language',
        value: 'Original',
        isOriginal: true
      });
    }

    // Add an empty target language
    initialItems.push({
      id: Date.now() + 1,
      type: 'language',
      value: '',
      isOriginal: false
    });

    return initialItems;
  });

  /**
   * Add a new language to the chain
   */
  const addLanguage = useCallback(() => {
    setChainItems(items => {
      // Create a new language item
      const newLanguage = {
        id: Date.now(),
        type: 'language',
        value: '',
        isOriginal: false
      };

      // If there's more than one item, add a delimiter before the new language
      if (items.length > 0) {
        const newDelimiter = {
          id: Date.now() - 1,
          type: 'delimiter',
          value: ' ', // Default to space
          style: { open: '', close: '' }
        };

        return [...items, newDelimiter, newLanguage];
      }

      return [...items, newLanguage];
    });
  }, []);

  /**
   * Add a new delimiter to the chain
   * @param {Object} delimiter - The delimiter to add
   */
  const addDelimiter = useCallback((delimiter) => {
    setChainItems(items => {
      return [...items, delimiter];
    });
  }, []);

  /**
   * Add the original language to the chain
   */
  const addOriginalLanguage = useCallback(() => {
    setChainItems(items => {
      // Check if original language already exists
      if (items.some(item => item.type === 'language' && item.isOriginal)) {
        return items;
      }

      // Create a new original language item
      const originalLanguage = {
        id: Date.now(),
        type: 'language',
        value: 'Original',
        isOriginal: true
      };

      // If there's more than one item, add a delimiter before the original language
      if (items.length > 0) {
        const newDelimiter = {
          id: Date.now() - 1,
          type: 'delimiter',
          value: ' ', // Default to space
          style: { open: '', close: '' }
        };

        return [...items, newDelimiter, originalLanguage];
      }

      return [...items, originalLanguage];
    });
  }, []);

  /**
   * Remove an item from the chain
   * @param {number} id - ID of the item to remove
   */
  const removeItem = useCallback((id) => {
    setChainItems(items => {
      const index = items.findIndex(item => item.id === id);
      if (index === -1) return items;

      const newItems = [...items];

      // If removing a language, also remove the delimiter before or after it
      if (newItems[index].type === 'language') {
        // If there's a delimiter before this language, remove it
        if (index > 0 && newItems[index - 1].type === 'delimiter') {
          newItems.splice(index - 1, 2); // Remove delimiter and language
        }
        // If there's a delimiter after this language, remove it
        else if (index < newItems.length - 1 && newItems[index + 1].type === 'delimiter') {
          newItems.splice(index, 2); // Remove language and delimiter
        }
        // Otherwise just remove the language
        else {
          newItems.splice(index, 1);
        }
      }
      // If removing a delimiter, just remove it
      else {
        newItems.splice(index, 1);
      }

      return newItems;
    });
  }, []);

  /**
   * Update a language value
   * @param {number} id - ID of the language to update
   * @param {string} value - New value
   */
  const updateLanguage = useCallback((id, value) => {
    setChainItems(items =>
      items.map(item =>
        item.id === id && item.type === 'language'
          ? { ...item, value }
          : item
      )
    );
  }, []);

  /**
   * Update a delimiter value
   * @param {number} id - ID of the delimiter to update
   * @param {string} value - New value
   * @param {Object} style - Optional bracket style { open, close }
   */
  const updateDelimiter = useCallback((id, value, style = null) => {
    setChainItems(items =>
      items.map(item => {
        if (item.id === id && item.type === 'delimiter') {
          const updatedItem = { ...item, value };
          if (style) {
            updatedItem.style = style;
          }
          return updatedItem;
        }
        return item;
      })
    );
  }, []);

  /**
   * Move an item in the chain
   * @param {number} fromIndex - Index to move from
   * @param {number} toIndex - Index to move to
   */
  const moveItem = useCallback((fromIndex, toIndex) => {
    setChainItems(items => {
      const newItems = [...items];
      const [movedItem] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, movedItem);
      return newItems;
    });
  }, []);

  /**
   * Get all language values from the chain
   * @returns {Array} - Array of language values
   */
  const getLanguageValues = useCallback(() => {
    return chainItems
      .filter(item => item.type === 'language' && !item.isOriginal)
      .map(item => item.value.trim())
      .filter(value => value !== '');
  }, [chainItems]);

  /**
   * Get all delimiter values from the chain
   * @returns {Array} - Array of delimiter values
   */
  const getDelimiterValues = useCallback(() => {
    return chainItems
      .filter(item => item.type === 'delimiter')
      .map(item => ({ value: item.value, style: item.style }));
  }, [chainItems]);

  /**
   * Check if the chain has at least one valid language
   * @returns {boolean} - True if at least one language has a value
   */
  const hasValidLanguage = useCallback(() => {
    return chainItems.some(item =>
      item.type === 'language' && !item.isOriginal && item.value.trim() !== ''
    );
  }, [chainItems]);

  /**
   * Check if the chain has only the original language
   * @returns {boolean} - True if only the original language is in the chain
   */
  const hasOnlyOriginalLanguage = useCallback(() => {
    // Check if there's at least one original language
    const hasOriginal = chainItems.some(item =>
      item.type === 'language' && item.isOriginal
    );

    // Check if there are no non-original languages with values
    const hasNoTargetLanguages = !chainItems.some(item =>
      item.type === 'language' && !item.isOriginal && item.value.trim() !== ''
    );

    return hasOriginal && hasNoTargetLanguages;
  }, [chainItems]);

  /**
   * Reset the chain to its initial state and clear localStorage
   */
  const resetChain = useCallback(() => {
    // Clear saved chain from localStorage
    try {
      localStorage.removeItem('language_chain_items');

    } catch (error) {
      console.error('Error clearing saved chain from localStorage:', error);
    }

    // Reset to initial state
    setChainItems(() => {
      const initialItems = [];

      // Add original language if needed
      if (includeOriginal) {
        initialItems.push({
          id: Date.now(),
          type: 'language',
          value: 'Original',
          isOriginal: true
        });
      }

      // Add an empty target language
      initialItems.push({
        id: Date.now() + 1,
        type: 'language',
        value: '',
        isOriginal: false
      });

      return initialItems;
    });
  }, [includeOriginal]);

  // Save chain items to localStorage whenever they change
  useEffect(() => {
    try {
      // Don't save if the chain is empty or only has default items
      if (chainItems.length > 0) {
        localStorage.setItem('language_chain_items', JSON.stringify(chainItems));

      }
    } catch (error) {
      console.error('Error saving chain to localStorage:', error);
    }
  }, [chainItems]);

  return {
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
    hasOnlyOriginalLanguage,
    resetChain
  };
};

export default useLanguageChain;
