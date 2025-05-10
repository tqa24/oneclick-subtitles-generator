/**
 * Service for checking model availability
 */
import { getModels } from './modelService';

// Cache for models to avoid repeated API calls
let modelsCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 1 minute cache

// Custom event for model list changes
export const MODEL_LIST_CHANGED_EVENT = 'model-list-changed';

/**
 * Get all available models with cache
 * @returns {Promise<Object>} - List of models and active model
 */
export const getAvailableModels = async () => {
  const now = Date.now();

  // Use cache if available and not expired
  if (modelsCache && (now - lastFetchTime < CACHE_DURATION)) {
    return modelsCache;
  }

  try {
    const models = await getModels();
    modelsCache = models;
    lastFetchTime = now;
    return models;
  } catch (error) {
    console.error('Error fetching models:', error);
    // If we have a cache, return it even if expired
    if (modelsCache) {
      return modelsCache;
    }
    throw error;
  }
};

/**
 * Check if a model is available for a specific language or languages
 * @param {string|Array} languageCode - ISO 639-1 language code or array of codes
 * @returns {Promise<Object>} - { available: boolean, modelId: string, error: string }
 */
export const checkModelAvailabilityForLanguage = async (languageCode) => {
  try {
    const { models } = await getAvailableModels();

    if (!models || models.length === 0) {
      return {
        available: false,
        modelId: null,
        error: 'No narration models are available'
      };
    }

    // Handle array of language codes
    if (Array.isArray(languageCode) && languageCode.length > 0) {
      // Priority languages that have specific models
      const priorityLanguages = ['vi', 'zh', 'en', 'ko', 'ja'];

      // Try to find a model for each priority language in the array
      for (const lang of priorityLanguages) {
        if (languageCode.includes(lang)) {
          const result = await checkModelAvailabilityForLanguage(lang);
          if (result.available) {
            return result;
          }
        }
      }

      // If no priority language found, try each language in the array
      for (const lang of languageCode) {
        const result = await checkModelAvailabilityForLanguage(lang);
        if (result.available) {
          return result;
        }
      }

      // If no model found for any language, return error
      return {
        available: false,
        modelId: null,
        error: `No narration model available for any of the detected languages: ${languageCode.join(', ')}`,
        languageCodes: languageCode
      };
    }

    // Find models that support this language
    const supportingModels = models.filter(model =>
      model.language === languageCode ||
      (Array.isArray(model.languages) && model.languages.includes(languageCode))
    );

    if (supportingModels.length === 0) {
      return {
        available: false,
        modelId: null,
        error: `No narration model available for ${languageCode} language`,
        languageCode: languageCode
      };
    }

    // Return the first available model
    return {
      available: true,
      modelId: supportingModels[0].id,
      error: null
    };
  } catch (error) {
    console.error('Error checking model availability:', error);
    return {
      available: false,
      modelId: null,
      error: 'Error checking model availability'
    };
  }
};

/**
 * Get the best available model for a language
 * @param {string} languageCode - ISO 639-1 language code
 * @returns {Promise<string>} - Model ID or null if no model is available
 */
export const getBestModelForLanguage = async (languageCode) => {
  const result = await checkModelAvailabilityForLanguage(languageCode);
  return result.available ? result.modelId : null;
};

/**
 * Check if a specific model is available
 * @param {string} modelId - Model ID to check
 * @returns {Promise<boolean>} - Whether the model is available
 */
export const isModelAvailable = async (modelId) => {
  try {
    const { models } = await getAvailableModels();

    if (!models || models.length === 0) {
      return false;
    }

    return models.some(model => model.id === modelId);
  } catch (error) {
    console.error('Error checking if model is available:', error);
    return false;
  }
};

/**
 * Invalidate the models cache and notify listeners
 * Call this function whenever models are added or removed
 */
export const invalidateModelsCache = () => {

  modelsCache = null;
  lastFetchTime = 0;

  // Dispatch a custom event to notify components that the model list has changed
  const event = new CustomEvent(MODEL_LIST_CHANGED_EVENT);
  window.dispatchEvent(event);
};
