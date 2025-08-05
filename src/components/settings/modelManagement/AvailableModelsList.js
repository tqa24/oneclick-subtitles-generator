import React from 'react';
import { useTranslation } from 'react-i18next';
import DownloadIcon from '@mui/icons-material/Download';
import CancelIcon from '@mui/icons-material/Cancel';
import AddIcon from '@mui/icons-material/Add';
import LoadingIndicator from '../../common/LoadingIndicator';
import { addModelFromHuggingFace, cancelModelDownload } from '../../../services/modelService';
import { invalidateModelsCache } from '../../../services/modelAvailabilityService';
import { AVAILABLE_MODELS, LANGUAGE_NAMES } from '../ModelList';
import { isDownloading, getDownloadProgress, isModelInstalled } from './modelManagementUtils';

/**
 * Component for displaying available models
 * @param {Object} props - Component props
 * @param {Array} props.installedModels - List of installed models
 * @param {Object} props.downloads - Download information
 * @param {Function} props.onModelAdded - Function to call when a model is added
 * @param {Function} props.onAddModelClick - Function to call when add model button is clicked
 * @param {Function} props.setDownloads - Function to update downloads state
 * @returns {JSX.Element} - Rendered component
 */
const AvailableModelsList = ({
  installedModels = [],
  downloads = {},
  onModelAdded,
  onAddModelClick,
  setDownloads,
  customModels = [],
  setCustomModels
}) => {
  const { t } = useTranslation();

  // Create a list of installed model IDs for filtering
  const installedModelIds = React.useMemo(() => {
    return installedModels.map(model => model.id);
  }, [installedModels]);

  // Combine built-in models with custom models
  const allAvailableModels = React.useMemo(() => {
    return [...AVAILABLE_MODELS, ...customModels];
  }, [customModels]);

  // Handle downloading a model
  const handleDownload = async (model) => {
    try {
      // Check if the model is already installed
      if (isModelInstalled(model.id, installedModelIds)) {

        return;
      }

      // Update downloads state to show progress
      setDownloads(prev => ({
        ...prev,
        [model.id]: {
          status: 'downloading',
          progress: 0
        }
      }));

      // Prepare model data for API
      const modelData = {
        modelUrl: model.modelUrl,
        vocabUrl: model.vocabUrl,
        modelId: model.id,
        languageCodes: model.languages, // Include language codes
        config: model.config
      };

      // Call API to add model
      const response = await addModelFromHuggingFace(modelData);

      if (response.success) {
        // Invalidate the models cache to notify other components
        invalidateModelsCache();

        // Notify parent component
        if (onModelAdded) {
          onModelAdded(response.model_id);
        }
      }
    } catch (error) {
      console.error('Error downloading model:', error);
      
      // Update downloads state to show error
      setDownloads(prev => ({
        ...prev,
        [model.id]: {
          status: 'failed',
          error: error.message || 'Failed to download model'
        }
      }));
    }
  };

  // Handle cancelling a model download
  const handleCancelDownload = async (modelId) => {
    try {
      // Call API to cancel download
      const response = await cancelModelDownload(modelId);

      if (response.success) {

        
        // Remove from downloads state
        setDownloads(prev => {
          const newDownloads = { ...prev };
          delete newDownloads[modelId];
          return newDownloads;
        });

        // Invalidate the models cache to notify other components
        invalidateModelsCache();

        // Notify parent component to refresh the model list
        if (onModelAdded) {
          onModelAdded();
        }
      }
    } catch (error) {
      console.error('Error cancelling model download:', error);
    }
  };

  return (
    <div className="model-management-section">
      <div className="section-header">
        <h4>{t('settings.modelManagement.availableModels')}</h4>
      </div>

      <div className="model-cards-container">
        {allAvailableModels.filter(model => {
          // Always filter out models that are already installed
          if (isModelInstalled(model.id, installedModelIds)) {
            return false;
          }

          // Special case: F5-TTS v1 Base should not be shown in available models
          // if there are no installed models, as it's the default model
          if (model.id === 'f5tts-v1-base' && installedModelIds.length === 0) {
            return false;
          }

          return true;
        }).map((model) => (
          <div className="model-card" key={model.id}>
            <div className="model-card-content">
              <h5 className="model-title">{model.name}</h5>
              <p className="model-author">{t('settings.modelManagement.by')} {model.author}</p>

              <div className="model-languages">
                {model.languages.map(lang => (
                  <span
                    key={lang}
                    className={`language-chip ${lang}`}
                  >
                    {LANGUAGE_NAMES[lang] || lang}
                  </span>
                ))}
              </div>
            </div>

            {/* Show delete button for custom models */}
            {customModels.some(cm => cm.id === model.id) && (
              <button
                className="delete-custom-model-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  const updatedCustomModels = customModels.filter(cm => cm.id !== model.id);
                  setCustomModels(updatedCustomModels);
                  localStorage.setItem('customModels', JSON.stringify(updatedCustomModels));
                }}
                title={t('settings.modelManagement.deleteCustomModel', 'Delete custom model template')}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: 'rgba(255, 59, 48, 0.1)',
                  border: '1px solid rgba(255, 59, 48, 0.3)',
                  borderRadius: '4px',
                  color: '#ff3b30',
                  padding: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="12px" viewBox="0 -960 960 960" width="12px" fill="currentColor">
                  <path d="M480-392 300-212q-18 18-44 18t-44-18q-18-18-18-44t18-44l180-180-180-180q-18-18-18-44t18-44q18-18 44-18t44 18l180 180 180-180q18-18 44-18t44 18q18 18 18 44t-18 44L568-480l180 180q18 18 18 44t-18 44q-18 18-44 18t-44-18L480-392Z"/>
                </svg>
              </button>
            )}

            {isDownloading(model.id, {}, downloads) ? (
              <div>
                <div className="download-progress">
                  <div
                    className="download-progress-bar"
                    style={{
                      width: downloads[model.id] && downloads[model.id].progress !== undefined
                        ? `${downloads[model.id].progress}%`
                        : '10%' // Default progress when no information is available
                    }}
                  ></div>
                </div>
                <div className="model-card-actions">
                  <div className="download-percentage">
                    <LoadingIndicator
                      theme="dark"
                      showContainer={false}
                      size={16}
                      className="download-progress-indicator"
                    />
                    <span>
                      {/* Always show percentage format only */}
                      {getDownloadProgress(model.id, downloads) ? `${getDownloadProgress(model.id, downloads)}%` : ''}
                    </span>
                  </div>
                  <button
                    className="cancel-download-btn"
                    onClick={() => handleCancelDownload(model.id)}
                    title={t('settings.modelManagement.cancelDownload', 'Cancel Download')}
                  >
                    <CancelIcon fontSize="small" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="model-card-actions">
                <button
                  className="download-model-btn"
                  onClick={() => handleDownload(model)}
                  title={t('settings.modelManagement.downloadModel')}
                >
                  <DownloadIcon fontSize="small" />
                  {t('settings.modelManagement.download')}
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Add model card */}
        <div className="add-model-card" onClick={onAddModelClick}>
          <div className="add-model-icon">
            <AddIcon fontSize="large" />
          </div>
          <p>{t('settings.modelManagement.addCustomModel')}</p>
        </div>

        {allAvailableModels.filter(model => !isModelInstalled(model.id, installedModelIds)).length === 0 && (
          <div className="model-card">
            <p className="model-source" style={{ textAlign: 'center', padding: '2rem 0' }}>
              {t('settings.modelManagement.allModelsInstalled')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AvailableModelsList;
