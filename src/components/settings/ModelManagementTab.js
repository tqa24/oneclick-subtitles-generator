import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import ErrorIcon from '@mui/icons-material/Error';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import LanguageIcon from '@mui/icons-material/Language';
import CodeIcon from '@mui/icons-material/Code';
import LinkIcon from '@mui/icons-material/Link';
import TuneIcon from '@mui/icons-material/Tune';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CancelIcon from '@mui/icons-material/Cancel';
import { FiRefreshCw } from 'react-icons/fi';
import { getModels, addModelFromHuggingFace, addModelFromUrl, deleteModel, getModelDownloadStatus, updateModelInfo, getModelStorageInfo, cancelModelDownload } from '../../services/modelService';
import { invalidateModelsCache } from '../../services/modelAvailabilityService';
import { formatBytes } from '../../utils/formatUtils';
import '../../styles/settings/customModelDialog.css';
import ModelList, { LANGUAGE_NAMES } from './ModelList';
import '../../styles/settings/modelManagement.css';
import CustomModelDialog from './CustomModelDialog';

// We're using inline status display instead of a component to avoid DOM nesting issues

const ModelManagementTab = () => {
  const { t } = useTranslation();
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [modelToDelete, setModelToDelete] = useState(null);
  const [modelToEdit, setModelToEdit] = useState(null);
  const [modelStorageInfo, setModelStorageInfo] = useState({});
  const [addModelForm, setAddModelForm] = useState({
    sourceType: 'huggingface',
    modelUrl: '',
    vocabUrl: '',
    modelId: '',
    languageCodes: [''],
    showAdvanced: false,
    config: ''
  });
  const [editModelForm, setEditModelForm] = useState({
    name: '',
    language: '',
    languageCodes: [''],
    config: ''
  });
  const [addingModel, setAddingModel] = useState(false);
  const [editingModel, setEditingModel] = useState(false);
  const [downloads, setDownloads] = useState({});
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });
  const [modelSizes, setModelSizes] = useState({});
  const [isScanning, setIsScanning] = useState(false);

  // Fetch models on component mount
  useEffect(() => {
    fetchModels();
  }, []);

  // Set up periodic scanning for models in the f5_tts directory
  useEffect(() => {
    // Initial scan
    scanForModels();

    // Set up interval for periodic scanning (every 30 seconds)
    const intervalId = setInterval(() => {
      scanForModels();
    }, 30000);

    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  // Function to scan for models in the f5_tts directory
  const scanForModels = async () => {
    if (isScanning) return;

    try {
      setIsScanning(true);
      const data = await getModels(false);

      // Check if there are any new models that aren't in the current state
      const currentModelIds = models.map(model => model.id);
      const newModels = data.models.filter(model => !currentModelIds.includes(model.id));

      if (newModels.length > 0) {
        console.log(`Found ${newModels.length} new models during scan`);
        setModels(data.models || []);
        invalidateModelsCache();
      }

      // Update model sizes
      const sizes = {};
      for (const model of data.models) {
        if (model.model_path && model.id !== 'f5tts-v1-base') {
          try {
            const storageInfo = await getModelStorageInfo(model.id);
            if (storageInfo && storageInfo.size) {
              sizes[model.id] = storageInfo.size;
            }
          } catch (error) {
            console.error(`Error getting size for model ${model.id}:`, error);
          }
        }
      }

      setModelSizes(prev => ({...prev, ...sizes}));
    } catch (error) {
      console.error('Error scanning for models:', error);
    } finally {
      setIsScanning(false);
    }
  };

  // Set up polling for download status
  useEffect(() => {
    const checkDownloadStatus = async () => {
      // Check status of all downloads
      const downloadIds = Object.keys(downloads);

      if (downloadIds.length === 0) return;

      for (const modelId of downloadIds) {
        const downloadInfo = downloads[modelId];

        // Only check status for downloads in progress
        // Skip cancelled downloads
        if (downloadInfo.status === 'downloading' && downloadInfo.status !== 'cancelled') {
          try {
            const statusData = await getModelDownloadStatus(modelId);

            if (statusData.status === null) {
              // If status is null, it means the download is no longer tracked by the server
              // This could happen if the download completed and the server removed the status
              // Refresh models and remove from downloads state
              fetchModels();
              setDownloads(prev => {
                const newDownloads = { ...prev };
                delete newDownloads[modelId];
                return newDownloads;
              });
            } else if (statusData.status) {
              // Update download status
              setDownloads(prev => ({
                ...prev,
                [modelId]: {
                  status: statusData.status,
                  progress: statusData.progress,
                  error: statusData.error
                }
              }));

              // If download is complete, refresh models and remove from downloads state after a delay
              if (statusData.status === 'completed') {
                // Refresh models immediately to show the new model in the installed section
                fetchModels();

                // Remove the completed download from state after a short delay
                setTimeout(() => {
                  setDownloads(prev => {
                    const newDownloads = { ...prev };
                    delete newDownloads[modelId];
                    return newDownloads;
                  });
                }, 1000); // 1 second delay to show completion
              }
            }
          } catch (err) {
            console.error(`Error checking download status for ${modelId}:`, err);
          }
        }
      }
    };

    // Poll every 2 seconds
    const interval = setInterval(checkDownloadStatus, 2000);

    return () => clearInterval(interval);
  }, [downloads]);

  // Fetch models from API
  const fetchModels = async () => {
    try {
      setLoading(true);
      const data = await getModels(false); // Never include cache models
      setModels(data.models || []);

      // Update downloads state with server data
      if (data.downloads) {
        setDownloads(data.downloads);
      }

      // Invalidate the models cache to notify other components
      invalidateModelsCache();

      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to fetch models');
      console.error('Error fetching models:', err);
    } finally {
      setLoading(false);
    }
  };

  // We no longer set an active model - models are loaded on-demand when generating narration

  // Handle opening add model dialog
  const handleOpenAddDialog = () => {
    setAddModelForm({
      sourceType: 'huggingface',
      modelUrl: '',
      vocabUrl: '',
      modelId: '',
      languageCodes: [''],
      showAdvanced: false,
      config: ''
    });
    setOpenAddDialog(true);
  };

  // Handle closing add model dialog
  const handleCloseAddDialog = () => {
    setOpenAddDialog(false);
  };

  // Handle form input change
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setAddModelForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle source type change
  const handleSourceTypeChange = (e) => {
    setAddModelForm(prev => ({
      ...prev,
      sourceType: e.target.value
    }));
  };

  // Toggle advanced options
  const toggleAdvancedOptions = () => {
    setAddModelForm(prev => ({
      ...prev,
      showAdvanced: !prev.showAdvanced
    }));
  };

  // Handle adding a new model
  const handleAddModel = async () => {
    try {
      setAddingModel(true);

      // Parse config if provided
      let configObj = {};
      if (addModelForm.config) {
        try {
          configObj = JSON.parse(addModelForm.config);
        } catch (err) {
          throw new Error(t('settings.modelManagement.invalidConfigFormat'));
        }
      }

      // Prepare model data
      const modelData = {
        modelUrl: addModelForm.modelUrl,
        vocabUrl: addModelForm.vocabUrl,
        modelId: addModelForm.modelId,
        languageCodes: addModelForm.languageCodes.filter(code => code.trim() !== ''),
        config: configObj
      };

      // Add model based on source type
      let response;
      if (addModelForm.sourceType === 'huggingface') {
        response = await addModelFromHuggingFace(modelData);
      } else {
        response = await addModelFromUrl(modelData);
      }

      // Get the model ID from the response
      const { model_id } = response;

      // Close dialog
      handleCloseAddDialog();

      // Show downloading message
      setSnackbar({
        open: true,
        message: t('settings.modelManagement.modelDownloading'),
        severity: 'info'
      });

      // Update downloads state
      setDownloads(prev => ({
        ...prev,
        [model_id]: {
          status: 'downloading',
          progress: 0
        }
      }));

      // Fetch models to get initial download status
      await fetchModels();

    } catch (err) {
      setError(err.message || 'Failed to add model');
      setSnackbar({
        open: true,
        message: err.message || t('settings.modelManagement.errorAddingModel'),
        severity: 'error'
      });
    } finally {
      setAddingModel(false);
    }
  };

  // Handle opening delete confirmation dialog
  const handleOpenDeleteDialog = (model) => {
    setModelToDelete(model);
    setOpenDeleteDialog(true);
  };

  // Handle closing delete confirmation dialog
  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
    setModelToDelete(null);
  };

  // Handle deleting a model
  const handleDeleteModel = async () => {
    if (!modelToDelete) return;

    try {
      setLoading(true);
      await deleteModel(modelToDelete.id, true); // Always delete from cache without asking

      // Close dialog and refresh models
      handleCloseDeleteDialog();
      await fetchModels();

      // Show success message
      setSnackbar({
        open: true,
        message: t('settings.modelManagement.modelDeletedSuccess'),
        severity: 'success'
      });
    } catch (err) {
      setError(err.message || 'Failed to delete model');
      setSnackbar({
        open: true,
        message: err.message || t('settings.modelManagement.errorDeletingModel'),
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle opening edit dialog
  const handleOpenEditDialog = async (model) => {
    setModelToEdit(model);
    // Ensure we have a valid languageCodes array
    let languageCodes = [];
    if (Array.isArray(model.languages) && model.languages.length > 0) {
      languageCodes = [...model.languages];
    } else if (model.language) {
      languageCodes = [model.language];
    } else {
      languageCodes = [''];
    }

    setEditModelForm({
      name: model.name || '',
      language: model.language || '',
      languageCodes: languageCodes,
      config: model.config ? JSON.stringify(model.config, null, 2) : ''
    });

    // Fetch storage information for this model
    try {
      const storageInfo = await getModelStorageInfo(model.id);
      setModelStorageInfo(prevState => ({
        ...prevState,
        [model.id]: storageInfo
      }));
    } catch (error) {
      console.error('Error fetching model storage info:', error);
    }

    setOpenEditDialog(true);
  };

  // Handle closing edit dialog
  const handleCloseEditDialog = () => {
    setOpenEditDialog(false);
    setModelToEdit(null);
  };

  // Handle editing a model
  const handleEditModel = async () => {
    if (!modelToEdit) return;

    try {
      setEditingModel(true);

      // Parse config if provided
      let configObj = {};
      if (editModelForm.config) {
        try {
          configObj = JSON.parse(editModelForm.config);
        } catch (err) {
          throw new Error(t('settings.modelManagement.invalidConfigFormat'));
        }
      }

      // Ensure languageCodes is an array
      const languageCodes = Array.isArray(editModelForm.languageCodes) ? editModelForm.languageCodes : [''];

      // Prepare model data
      const modelInfo = {
        name: editModelForm.name,
        language: languageCodes[0] || '', // Set primary language to first language code
        languages: languageCodes.filter(code => code.trim() !== ''), // Include all language codes
        config: configObj
      };

      // Update model
      await updateModelInfo(modelToEdit.id, modelInfo);

      // Close dialog and refresh models
      handleCloseEditDialog();
      await fetchModels();

      // Show success message
      setSnackbar({
        open: true,
        message: t('settings.modelManagement.modelUpdatedSuccess'),
        severity: 'success'
      });
    } catch (err) {
      setError(err.message || 'Failed to update model');
      setSnackbar({
        open: true,
        message: err.message || t('settings.modelManagement.errorUpdatingModel'),
        severity: 'error'
      });
    } finally {
      setEditingModel(false);
    }
  };



  // Handle cancelling a model download
  const handleCancelDownload = async (modelId) => {
    try {
      // Call API to cancel download
      const response = await cancelModelDownload(modelId);

      if (response.success) {
        console.log(`Download cancelled for model ${modelId}`);

        // Update downloads state to remove the cancelled download
        setDownloads(prev => {
          const newDownloads = { ...prev };
          delete newDownloads[modelId];
          return newDownloads;
        });

        // Show success message
        setSnackbar({
          open: true,
          message: t('settings.modelManagement.downloadCancelled', 'Download cancelled successfully'),
          severity: 'info'
        });

        // Refresh models to update the UI
        await fetchModels();
      }
    } catch (err) {
      console.error('Error cancelling model download:', err);
      setSnackbar({
        open: true,
        message: err.message || t('settings.modelManagement.errorCancellingDownload', 'Error cancelling download'),
        severity: 'error'
      });
    }
  };

  // Handle closing snackbar
  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({
      ...prev,
      open: false
    }));
  };

  return (
    <div className="model-management-section" id="model-management">
      <p className="model-management-description">
        {t('settings.modelManagement.description')}
      </p>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Model List Component */}
      <ModelList
        onModelAdded={fetchModels}
        downloadingModels={downloads}
        installedModels={models}
        onAddModelClick={handleOpenAddDialog}
      />

      <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />

      <div className="section-header">
        <h4>{t('settings.modelManagement.installedModels')}</h4>
        <button
          className="refresh-models-btn"
          onClick={scanForModels}
          disabled={isScanning}
          title={t('settings.modelManagement.refreshModels', 'Scan for new models')}
        >
          <FiRefreshCw className={isScanning ? 'spinning' : ''} />
          {t('settings.modelManagement.refresh', 'Refresh')}
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <CircularProgress size={24} />
        </div>
      ) : models.length === 0 && Object.keys(downloads).length === 0 ? (
        <p className="model-source" style={{ textAlign: 'center', padding: '1rem' }}>
          {t('settings.modelManagement.noModelsInstalled')}
        </p>
      ) : (
        <div className="model-cards-container">
          {models.map((model) => (
            <div className="model-card installed-model" key={model.id}>
              <div className="model-card-content">
                <h5 className="model-title">{model.name}</h5>
                <p className="model-source">{t('settings.modelManagement.source')}: {model.source}</p>

                {/* Show model size for all models except F5-TTS v1 Base */}
                {model.id !== 'f5tts-v1-base' && modelSizes[model.id] ? (
                  <p className="model-size">{formatBytes(modelSizes[model.id])}</p>
                ) : (
                  /* Add an empty placeholder with the same height for the default model to maintain consistent spacing */
                  <p className="model-size empty-size">&nbsp;</p>
                )}

                <div className="model-languages">
                  {model.languages && model.languages.length > 0 ? (
                    model.languages.map(lang => (
                      <span
                        key={lang}
                        className={`language-chip ${lang}`}
                      >
                        {LANGUAGE_NAMES[lang] || lang}
                      </span>
                    ))
                  ) : model.language && model.language !== 'unknown' && (
                    <span className={`language-chip ${model.language}`}>
                      {model.language}
                    </span>
                  )}
                </div>

                {/* Show download status if this model is being downloaded */}
                {downloads[model.id] && downloads[model.id].status === 'downloading' && (
                  <div>
                    <div className="download-status">
                      <CloudDownloadIcon fontSize="small" />
                      <span>{t('settings.modelManagement.downloading')}</span>
                      <span>
                        {/* Always show percentage format only */}
                        ({downloads[model.id].progress ? `${downloads[model.id].progress}%` : ''})
                      </span>
                      <button
                        className="cancel-download-btn"
                        onClick={() => handleCancelDownload(model.id)}
                        title={t('settings.modelManagement.cancelDownload', 'Cancel Download')}
                      >
                        <CancelIcon fontSize="small" />
                      </button>
                    </div>
                    <div className="download-progress">
                      <div
                        className="download-progress-bar"
                        style={{
                          width: downloads[model.id].progress !== undefined
                            ? `${downloads[model.id].progress}%`
                            : '10%' // Default progress when no information is available
                        }}
                      ></div>
                    </div>
                  </div>
                )}
                {downloads[model.id] && downloads[model.id].status === 'failed' && (
                  <div className="download-status error">
                    <ErrorIcon fontSize="small" />
                    <span>{t('settings.modelManagement.downloadFailed')}: {downloads[model.id].error}</span>
                  </div>
                )}
              </div>

              <div className="model-card-actions">
                <button
                  className="edit-model-btn"
                  onClick={() => handleOpenEditDialog(model)}
                  title={t('settings.modelManagement.editModel', 'Edit model information')}
                >
                  <EditIcon fontSize="small" />
                </button>

                {/* Hide delete button for F5-TTS v1 Base model */}
                {model.id !== 'f5tts-v1-base' && (
                  <button
                    className="delete-model-btn"
                    onClick={() => handleOpenDeleteDialog(model)}
                    title={t('settings.modelManagement.deleteModel', 'Delete model')}
                  >
                    <DeleteIcon fontSize="small" />
                    {t('settings.modelManagement.delete', 'Delete')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}



      {/* Add Model Dialog */}
      <CustomModelDialog
        isOpen={openAddDialog}
        onClose={handleCloseAddDialog}
        title={t('settings.modelManagement.addNewCustomModel')}
        footer={
          <>
            <button
              className="cancel-btn"
              onClick={handleCloseAddDialog}
              disabled={addingModel}
            >
              {t('common.cancel')}
            </button>
            <button
              className="confirm-btn"
              onClick={handleAddModel}
              disabled={!addModelForm.modelUrl || addingModel}
            >
              {addingModel && <span className="spinner"></span>}
              {addingModel
                ? t('settings.modelManagement.addingCustomModel')
                : t('settings.modelManagement.addCustomModel')
              }
            </button>
          </>
        }
      >
        <p className="explanation">
          {t('settings.modelManagement.addModelExplanation', 'Add a custom TTS model from Hugging Face or a direct URL. The model will be downloaded and made available for narration.')}
        </p>

        <div className="form-field">
          <label>{t('settings.modelManagement.modelSource')}</label>
          <div className="radio-group">
            <div className="radio-option">
              <input
                type="radio"
                id="source-huggingface"
                name="sourceType"
                value="huggingface"
                checked={addModelForm.sourceType === 'huggingface'}
                onChange={handleSourceTypeChange}
              />
              <label htmlFor="source-huggingface">
                {t('settings.modelManagement.huggingFace')}
              </label>
            </div>
            <div className="radio-option">
              <input
                type="radio"
                id="source-url"
                name="sourceType"
                value="url"
                checked={addModelForm.sourceType === 'url'}
                onChange={handleSourceTypeChange}
              />
              <label htmlFor="source-url">
                {t('settings.modelManagement.directUrl')}
              </label>
            </div>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="modelUrl">
            {addModelForm.sourceType === 'huggingface'
              ? t('settings.modelManagement.huggingFaceModelUrl')
              : t('settings.modelManagement.directModelUrl')}
          </label>
          <input
            id="modelUrl"
            name="modelUrl"
            type="text"
            value={addModelForm.modelUrl}
            onChange={handleFormChange}
            style={{
              borderRadius: '100px',
              height: '36px',
              padding: '0 16px',
              boxSizing: 'border-box'
            }}
            placeholder={addModelForm.sourceType === 'huggingface'
              ? "facebook/fastspeech2-en-ljspeech"
              : "https://example.com/model.bin"}
          />
          <div className="helper-text">
            {addModelForm.sourceType === 'huggingface'
              ? t('settings.modelManagement.huggingFaceModelUrlHelp')
              : t('settings.modelManagement.directModelUrlHelp')}
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="vocabUrl">
            {addModelForm.sourceType === 'huggingface'
              ? t('settings.modelManagement.huggingFaceVocabUrl')
              : t('settings.modelManagement.directVocabUrl')}
          </label>
          <input
            id="vocabUrl"
            name="vocabUrl"
            type="text"
            value={addModelForm.vocabUrl}
            onChange={handleFormChange}
            style={{
              borderRadius: '100px',
              height: '36px',
              padding: '0 16px',
              boxSizing: 'border-box'
            }}
            placeholder={addModelForm.sourceType === 'huggingface'
              ? "facebook/fastspeech2-en-ljspeech/vocab.json"
              : "https://example.com/vocab.json"}
          />
          <div className="helper-text">
            {addModelForm.sourceType === 'huggingface'
              ? t('settings.modelManagement.huggingFaceVocabUrlHelp')
              : t('settings.modelManagement.directVocabUrlHelp')}
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="modelId">{t('settings.modelManagement.modelId')}</label>
          <input
            id="modelId"
            name="modelId"
            type="text"
            value={addModelForm.modelId}
            onChange={handleFormChange}
            style={{
              borderRadius: '100px',
              height: '36px',
              padding: '0 16px',
              boxSizing: 'border-box'
            }}
            placeholder="my-custom-tts-model"
          />
          <div className="helper-text">
            {t('settings.modelManagement.modelIdHelp')}
          </div>
        </div>

        <div className="language-codes-section">
          <div className="section-header">
            <LanguageIcon />
            <h5>{t('settings.modelManagement.languageCodes', 'Supported Languages')}</h5>
          </div>
          <div className="helper-text">
            {t('settings.modelManagement.languageCodesHelp', 'Enter the language codes this model supports (e.g., en, fr, zh). Add multiple codes for multilingual models.')}
          </div>

          <div className="language-codes-container">
            {addModelForm.languageCodes.map((code, index) => (
              <div key={index} className="language-code-field">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    const newCodes = [...addModelForm.languageCodes];
                    newCodes[index] = e.target.value;
                    setAddModelForm(prev => ({ ...prev, languageCodes: newCodes }));
                  }}
                  style={{
                    borderRadius: '100px',
                    width: '80px',
                    height: '36px',
                    padding: '0 12px',
                    boxSizing: 'border-box'
                  }}
                  placeholder={t('settings.modelManagement.languageCode')}
                />

                {/* Remove button for all except the first language code */}
                {index > 0 && (
                  <button
                    className="delete-model-btn"
                    onClick={() => {
                      const newCodes = [...addModelForm.languageCodes];
                      newCodes.splice(index, 1);
                      setAddModelForm(prev => ({ ...prev, languageCodes: newCodes }));
                    }}
                    title={t('settings.modelManagement.removeLanguageCode', 'Remove language code')}
                  >
                    <DeleteIcon fontSize="small" />
                  </button>
                )}
              </div>
            ))}

            {/* Add language code button */}
            <button
              className="add-language-btn"
              onClick={() => {
                setAddModelForm(prev => ({
                  ...prev,
                  languageCodes: [...prev.languageCodes, '']
                }));
              }}
            >
              <AddIcon fontSize="small" />
              {t('settings.modelManagement.addLanguageCode', 'Add language code')}
            </button>
          </div>
        </div>

        <button
          className="advanced-options-toggle"
          onClick={toggleAdvancedOptions}
        >
          <TuneIcon fontSize="small" style={{ marginRight: '8px' }} />
          {addModelForm.showAdvanced
            ? t('settings.modelManagement.hideAdvancedOptions')
            : t('settings.modelManagement.showAdvancedOptions')
          }
          {addModelForm.showAdvanced
            ? <KeyboardArrowUpIcon fontSize="small" style={{ marginLeft: '4px' }} />
            : <KeyboardArrowDownIcon fontSize="small" style={{ marginLeft: '4px' }} />
          }
        </button>

        {addModelForm.showAdvanced && (
          <div className="form-field">
            <label htmlFor="config">{t('settings.modelManagement.modelConfig')}</label>
            <textarea
              id="config"
              name="config"
              value={addModelForm.config}
              onChange={handleFormChange}
              rows={4}
              placeholder='{"sample_rate": 22050, "vocoder": "hifigan"}'
            />
            <div className="helper-text">
              {t('settings.modelManagement.modelConfigHelp')}
            </div>
          </div>
        )}
      </CustomModelDialog>

      {/* Delete Confirmation Dialog */}
      <CustomModelDialog
        isOpen={openDeleteDialog}
        onClose={handleCloseDeleteDialog}
        title={t('settings.modelManagement.confirmDelete')}
        footer={
          <>
            <button
              className="cancel-btn"
              onClick={handleCloseDeleteDialog}
              disabled={loading}
            >
              {t('common.cancel')}
            </button>
            <button
              className="delete-btn"
              onClick={handleDeleteModel}
              disabled={loading}
            >
              {loading && <span className="spinner"></span>}
              {loading
                ? t('settings.modelManagement.deleting')
                : t('settings.modelManagement.delete')
              }
            </button>
          </>
        }
      >
        <p className="delete-confirmation-text">
          {t('settings.modelManagement.deleteConfirmationText', {
            modelName: modelToDelete?.name || ''
          })}
        </p>

        {/* We no longer have active models, so no warning needed */}
        {/* Removed Hugging Face cache message as it's no longer necessary */}
      </CustomModelDialog>

      {/* Edit Model Dialog */}
      <CustomModelDialog
        isOpen={openEditDialog}
        onClose={handleCloseEditDialog}
        title={t('settings.modelManagement.editModel')}
        footer={
          <>
            <button
              className="cancel-btn"
              onClick={handleCloseEditDialog}
              disabled={editingModel}
            >
              {t('common.cancel')}
            </button>
            <button
              className="confirm-btn"
              onClick={handleEditModel}
              disabled={editingModel}
            >
              {editingModel && <span className="spinner"></span>}
              {editingModel
                ? t('settings.modelManagement.updating')
                : t('settings.modelManagement.update')
              }
            </button>
          </>
        }
      >
        <p className="explanation">
          {t('settings.modelManagement.editModelExplanation', 'Edit the information for this model. Changes will be applied immediately.')}
        </p>

        <div className="form-field">
          <label htmlFor="modelName">{t('settings.modelManagement.modelName')}</label>
          <input
            id="modelName"
            type="text"
            value={editModelForm.name}
            onChange={(e) => setEditModelForm(prev => ({ ...prev, name: e.target.value }))}
            style={{
              borderRadius: '100px',
              height: '36px',
              padding: '0 16px',
              boxSizing: 'border-box'
            }}
            placeholder="Model Name"
          />
        </div>

        <div className="language-codes-section">
          <div className="section-header">
            <LanguageIcon />
            <h5>{t('settings.modelManagement.languageCodes', 'Supported Languages')}</h5>
          </div>
          <div className="helper-text">
            {t('settings.modelManagement.languageCodesHelp', 'Enter the language codes this model supports (e.g., en, fr, zh). Add multiple codes for multilingual models.')}
          </div>

          <div className="language-codes-container">
            {(editModelForm.languageCodes || []).map((code, index) => (
              <div key={index} className="language-code-field">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    const newCodes = [...(editModelForm.languageCodes || [''])];
                    newCodes[index] = e.target.value;
                    setEditModelForm(prev => ({ ...prev, languageCodes: newCodes }));
                  }}
                  style={{
                    borderRadius: '100px',
                    width: '80px',
                    height: '36px',
                    padding: '0 12px',
                    boxSizing: 'border-box'
                  }}
                  placeholder={t('settings.modelManagement.languageCode')}
                />

                {/* Remove button for all except the first language code */}
                {index > 0 && (
                  <button
                    className="delete-model-btn"
                    onClick={() => {
                      const newCodes = [...(editModelForm.languageCodes || [])];
                      newCodes.splice(index, 1);
                      setEditModelForm(prev => ({ ...prev, languageCodes: newCodes }));
                    }}
                    title={t('settings.modelManagement.removeLanguageCode', 'Remove language code')}
                  >
                    <DeleteIcon fontSize="small" />
                  </button>
                )}
              </div>
            ))}

            {/* Add language code button */}
            <button
              className="add-language-btn"
              onClick={() => {
                setEditModelForm(prev => ({
                  ...prev,
                  languageCodes: [...(prev.languageCodes || []), '']
                }));
              }}
            >
              <AddIcon fontSize="small" />
              {t('settings.modelManagement.addLanguageCode', 'Add language code')}
            </button>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="editConfig">{t('settings.modelManagement.modelConfig')}</label>
          <textarea
            id="editConfig"
            value={editModelForm.config}
            onChange={(e) => setEditModelForm(prev => ({ ...prev, config: e.target.value }))}
            rows={4}
            placeholder='{"sample_rate": 22050, "vocoder": "hifigan"}'
          />
          <div className="helper-text">
            {t('settings.modelManagement.modelConfigHelp')}
          </div>
        </div>

        {/* Display storage information only for symlinked models */}
        {modelToEdit && modelStorageInfo[modelToEdit.id] && modelStorageInfo[modelToEdit.id].is_symlink && (
          <div className="form-field storage-info">
            <div className="section-header">
              <LinkIcon />
              <h5>{t('settings.modelManagement.storageInformation')}</h5>
            </div>

            <Alert severity="info" sx={{ mb: 1 }}>
              {t('settings.modelManagement.usingSymlinks')}
            </Alert>

            <p className="model-source">
              {t('settings.modelManagement.originalFiles')}:
            </p>
            <ul className="file-list">
              <li>
                {modelStorageInfo[modelToEdit.id].original_model_file}
              </li>
              {modelStorageInfo[modelToEdit.id].original_vocab_file && (
                <li>
                  {modelStorageInfo[modelToEdit.id].original_vocab_file}
                </li>
              )}
            </ul>
          </div>
        )}
      </CustomModelDialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default ModelManagementTab;
