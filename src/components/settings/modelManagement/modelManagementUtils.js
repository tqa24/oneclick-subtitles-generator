/**
 * Utility functions for model management
 */

/**
 * Check if a model is currently downloading
 * @param {string} modelId - Model ID to check
 * @param {Object} downloading - Local downloading state
 * @param {Object} downloadingModels - Server downloading state
 * @returns {boolean} - Whether the model is downloading
 */
export const isDownloading = (modelId, downloading = {}, downloadingModels = {}) => {
  return downloading[modelId] || (downloadingModels[modelId] && downloadingModels[modelId].status === 'downloading');
};

/**
 * Get download progress for a model
 * @param {string} modelId - Model ID to check
 * @param {Object} downloadingModels - Server downloading state
 * @returns {number} - Download progress (0-100)
 */
export const getDownloadProgress = (modelId, downloadingModels = {}) => {
  if (downloadingModels[modelId] && downloadingModels[modelId].status === 'downloading') {
    return downloadingModels[modelId].progress || 0;
  }
  return 0;
};

/**
 * Check if a model is already installed
 * @param {string} modelId - Model ID to check
 * @param {Array} installedModelIds - List of installed model IDs
 * @returns {boolean} - Whether the model is installed
 */
export const isModelInstalled = (modelId, installedModelIds = []) => {
  return installedModelIds.includes(modelId);
};

/**
 * Get initial form state for adding a model
 * @returns {Object} - Initial form state
 */
export const getInitialAddModelForm = () => ({
  sourceType: 'huggingface',
  modelUrl: '',
  vocabUrl: '',
  modelId: '',
  languageCodes: [''],
  showAdvanced: false,
  config: ''
});

/**
 * Get initial form state for editing a model
 * @param {Object} model - Model to edit
 * @returns {Object} - Initial form state
 */
export const getInitialEditModelForm = (model) => {
  // Ensure we have a valid languageCodes array
  let languageCodes = [];
  if (Array.isArray(model.languages) && model.languages.length > 0) {
    languageCodes = [...model.languages];
  } else if (model.language) {
    languageCodes = [model.language];
  } else {
    languageCodes = [''];
  }

  return {
    name: model.name || '',
    language: model.language || '',
    languageCodes: languageCodes,
    config: model.config ? JSON.stringify(model.config, null, 2) : ''
  };
};
