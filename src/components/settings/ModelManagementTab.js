import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Radio,
  CircularProgress,
  Tooltip,
  Paper,
  Alert,
  Snackbar,
  Divider,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Grid
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import ErrorIcon from '@mui/icons-material/Error';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import StorageIcon from '@mui/icons-material/Storage';
import CancelIcon from '@mui/icons-material/Cancel';
import { getModels, setActiveModel, addModelFromHuggingFace, addModelFromUrl, deleteModel, getModelDownloadStatus, updateModelInfo, getModelStorageInfo, cancelModelDownload } from '../../services/modelService';
import ModelList, { LANGUAGE_NAMES, LANGUAGE_COLORS } from './ModelList';

// We're using inline status display instead of a component to avoid DOM nesting issues

const ModelManagementTab = () => {
  const { t } = useTranslation();
  const [models, setModels] = useState([]);
  const [cacheModels, setCacheModels] = useState([]);
  const [activeModel, setActiveModelState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [modelToDelete, setModelToDelete] = useState(null);
  const [modelToEdit, setModelToEdit] = useState(null);
  const [deleteFromCache, setDeleteFromCache] = useState(false);
  const [showCacheModels, setShowCacheModels] = useState(false);
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

  // Fetch models on component mount
  useEffect(() => {
    fetchModels(showCacheModels);
  }, [showCacheModels]);

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

            if (statusData.status) {
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
                fetchModels();

                // Remove the completed download from state after a short delay
                setTimeout(() => {
                  setDownloads(prev => {
                    const newDownloads = { ...prev };
                    delete newDownloads[modelId];
                    return newDownloads;
                  });
                }, 3000); // 3 second delay to show completion
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
  const fetchModels = async (includeCacheModels = false) => {
    try {
      setLoading(true);
      const data = await getModels(includeCacheModels);
      setModels(data.models || []);
      setActiveModelState(data.active_model);

      // Update cache models if included
      if (includeCacheModels && data.cache_models) {
        setCacheModels(data.cache_models);
      }

      // Update downloads state with server data
      if (data.downloads) {
        setDownloads(data.downloads);
      }

      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to fetch models');
      console.error('Error fetching models:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle setting active model
  const handleSetActiveModel = async (modelId) => {
    try {
      setLoading(true);
      await setActiveModel(modelId);
      setActiveModelState(modelId);
      setSnackbar({
        open: true,
        message: t('settings.modelManagement.activeModelSet'),
        severity: 'success'
      });
    } catch (err) {
      setError(err.message || 'Failed to set active model');
      setSnackbar({
        open: true,
        message: err.message || t('settings.modelManagement.errorSettingActiveModel'),
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

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
    setDeleteFromCache(true); // Always delete from cache
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
      await deleteModel(modelToDelete.id, deleteFromCache);

      // Close dialog and refresh models
      handleCloseDeleteDialog();
      await fetchModels(showCacheModels);

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
      await fetchModels(showCacheModels);

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

  // Toggle showing cache models
  const toggleCacheModels = () => {
    setShowCacheModels(prev => !prev);
  };

  // Handle cancelling a model download
  const handleCancelDownload = async (modelId) => {
    try {
      const response = await cancelModelDownload(modelId);

      if (response.success) {
        // Show success message
        setSnackbar({
          open: true,
          message: t('settings.modelManagement.downloadCancelled', 'Download cancelled successfully'),
          severity: 'success'
        });

        // Remove from downloads state immediately
        setDownloads(prev => {
          const newDownloads = { ...prev };
          delete newDownloads[modelId];
          return newDownloads;
        });

        // Refresh models
        await fetchModels(showCacheModels);
      }
    } catch (error) {
      console.error('Error cancelling model download:', error);
      setSnackbar({
        open: true,
        message: error.message || t('settings.modelManagement.errorCancellingDownload', 'Error cancelling download'),
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
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        {t('settings.modelManagement.title')}
      </Typography>

      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
        {t('settings.modelManagement.description')}
      </Typography>

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
      />

      <Divider sx={{ my: 4 }} />

      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          {t('settings.modelManagement.modelManagement')}
        </Typography>
        <Box>
          <Button
            variant="outlined"
            color="primary"
            onClick={toggleCacheModels}
            startIcon={<StorageIcon />}
            sx={{ mr: 2 }}
          >
            {showCacheModels
              ? t('settings.modelManagement.hideCacheModels')
              : t('settings.modelManagement.showCacheModels')}
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleOpenAddDialog}
            disabled={loading}
          >
            {t('settings.modelManagement.addCustomModel')}
          </Button>
        </Box>
      </Box>

      <Paper elevation={1} sx={{ mb: 3, p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          {t('settings.modelManagement.installedModels')}
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : models.length === 0 && Object.keys(downloads).length === 0 ? (
          <Typography variant="body2" color="textSecondary" sx={{ p: 2 }}>
            {t('settings.modelManagement.noModelsInstalled')}
          </Typography>
        ) : (
          <List>
            {models.map((model) => (
              <ListItem
                key={model.id}
                secondaryAction={
                  <Box sx={{ display: 'flex' }}>
                    <Tooltip title={t('settings.modelManagement.editModel')}>
                      <IconButton
                        edge="end"
                        aria-label="edit"
                        onClick={() => handleOpenEditDialog(model)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    {/* Hide delete button for F5-TTS v1 Base model */}
                    {model.id !== 'f5tts-v1-base' && (
                      <Tooltip title={t('settings.modelManagement.deleteModel')}>
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={() => handleOpenDeleteDialog(model)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                }
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <IconButton
                        edge="start"
                        aria-label="select model"
                        onClick={() => handleSetActiveModel(model.id)}
                        disabled={model.id === activeModel}
                        sx={{ mr: 1, p: 0.5 }}
                      >
                        {model.id === activeModel ? (
                          <CheckCircleIcon color="primary" />
                        ) : (
                          <RadioButtonUncheckedIcon />
                        )}
                      </IconButton>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography
                          variant="body1"
                          sx={{ fontWeight: model.id === activeModel ? 'bold' : 'normal' }}
                        >
                          {model.name}
                        </Typography>
                        {model.id === activeModel && (
                          <Typography
                            component="span"
                            variant="body2"
                            color="primary"
                            sx={{ ml: 1 }}
                          >
                            ({t('settings.modelManagement.active')})
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  }
                  secondary={
                    <Box sx={{ mt: 0.5 }}>
                      <Typography variant="body2" color="textSecondary">
                        {t('settings.modelManagement.source')}: {model.source}
                      </Typography>
                      {/* Display all supported languages if available */}
                      {model.languages && model.languages.length > 0 ? (
                        <Box>
                          <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                            {t('settings.modelManagement.language')}:
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {model.languages.map(lang => (
                              <Chip
                                key={lang}
                                label={LANGUAGE_NAMES[lang] || lang}
                                size="small"
                                color={LANGUAGE_COLORS[lang] || 'default'}
                                sx={{ mr: 0.5, mb: 0.5 }}
                              />
                            ))}
                          </Box>
                        </Box>
                      ) : model.language && model.language !== 'unknown' && (
                        <Typography variant="body2" color="textSecondary">
                          {t('settings.modelManagement.language')}: {model.language}
                        </Typography>
                      )}

                      {/* Show download status if this model is being downloaded */}
                      {downloads[model.id] && downloads[model.id].status === 'downloading' && (
                        <span style={{ color: '#1976d2', display: 'flex', alignItems: 'center', marginTop: '4px' }}>
                          <CloudDownloadIcon fontSize="small" style={{ marginRight: '4px' }} />
                          {t('settings.modelManagement.downloading')} ({downloads[model.id].progress.toFixed(1)}%)
                        </span>
                      )}
                      {downloads[model.id] && downloads[model.id].status === 'failed' && (
                        <span style={{ color: '#d32f2f', display: 'flex', alignItems: 'center', marginTop: '4px' }}>
                          <ErrorIcon fontSize="small" style={{ marginRight: '4px' }} />
                          {t('settings.modelManagement.downloadFailed')}: {downloads[model.id].error}
                        </span>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}


      </Paper>

      {/* Hugging Face Cache Models */}
      {showCacheModels && (
        <Paper elevation={1} sx={{ mb: 3, p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            {t('settings.modelManagement.cacheModels')}
          </Typography>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : cacheModels.length === 0 ? (
            <Typography variant="body2" color="textSecondary" sx={{ p: 2 }}>
              {t('settings.modelManagement.noCacheModels')}
            </Typography>
          ) : (
            <List>
              {cacheModels.map((model) => (
                <Accordion key={model.id} sx={{ mb: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Grid container alignItems="center">
                      <Grid item xs={8}>
                        <Typography variant="subtitle2">
                          {model.id}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {t('settings.modelManagement.size')}: {(model.size / (1024 * 1024)).toFixed(2)} MB
                        </Typography>
                      </Grid>
                      <Grid item xs={4} sx={{ textAlign: 'right' }}>
                        <Chip
                          label={model.org}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ mr: 1 }}
                        />
                      </Grid>
                    </Grid>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="subtitle2" gutterBottom>
                      {t('settings.modelManagement.snapshots')}:
                    </Typography>
                    {model.snapshots && model.snapshots.length > 0 ? (
                      <List dense>
                        {model.snapshots.map((snapshot) => (
                          <ListItem key={snapshot.hash}>
                            <ListItemText
                              primary={snapshot.hash}
                              secondary={`${t('settings.modelManagement.size')}: ${(snapshot.size / (1024 * 1024)).toFixed(2)} MB`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    ) : (
                      <Typography variant="body2" color="textSecondary">
                        {t('settings.modelManagement.noSnapshots')}
                      </Typography>
                    )}
                  </AccordionDetails>
                </Accordion>
              ))}
            </List>
          )}
        </Paper>
      )}

      {/* Add Model Dialog */}
      <Dialog open={openAddDialog} onClose={handleCloseAddDialog} maxWidth="md" fullWidth>
        <DialogTitle>{t('settings.modelManagement.addNewCustomModel')}</DialogTitle>
        <DialogContent>
          <FormControl component="fieldset" sx={{ mb: 2, mt: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('settings.modelManagement.modelSource')}
            </Typography>
            <RadioGroup
              name="sourceType"
              value={addModelForm.sourceType}
              onChange={handleSourceTypeChange}
              row
            >
              <FormControlLabel
                value="huggingface"
                control={<Radio />}
                label={t('settings.modelManagement.huggingFace')}
              />
              <FormControlLabel
                value="url"
                control={<Radio />}
                label={t('settings.modelManagement.directUrl')}
              />
            </RadioGroup>
          </FormControl>

          <TextField
            margin="dense"
            name="modelUrl"
            label={
              addModelForm.sourceType === 'huggingface'
                ? t('settings.modelManagement.huggingFaceModelUrl')
                : t('settings.modelManagement.directModelUrl')
            }
            type="text"
            fullWidth
            value={addModelForm.modelUrl}
            onChange={handleFormChange}
            helperText={
              addModelForm.sourceType === 'huggingface'
                ? t('settings.modelManagement.huggingFaceModelUrlHelp')
                : t('settings.modelManagement.directModelUrlHelp')
            }
            sx={{ mb: 2 }}
          />

          <TextField
            margin="dense"
            name="vocabUrl"
            label={
              addModelForm.sourceType === 'huggingface'
                ? t('settings.modelManagement.huggingFaceVocabUrl')
                : t('settings.modelManagement.directVocabUrl')
            }
            type="text"
            fullWidth
            value={addModelForm.vocabUrl}
            onChange={handleFormChange}
            helperText={
              addModelForm.sourceType === 'huggingface'
                ? t('settings.modelManagement.huggingFaceVocabUrlHelp')
                : t('settings.modelManagement.directVocabUrlHelp')
            }
            sx={{ mb: 2 }}
          />

          <TextField
            margin="dense"
            name="modelId"
            label={t('settings.modelManagement.modelId')}
            type="text"
            fullWidth
            value={addModelForm.modelId}
            onChange={handleFormChange}
            helperText={t('settings.modelManagement.modelIdHelp')}
            sx={{ mb: 2 }}
          />

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('settings.modelManagement.languageCodes')}
            </Typography>
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
              {t('settings.modelManagement.languageCodesHelp')}
            </Typography>

            {addModelForm.languageCodes.map((code, index) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TextField
                  margin="dense"
                  name={`languageCode-${index}`}
                  label={t('settings.modelManagement.languageCode')}
                  type="text"
                  fullWidth
                  value={code}
                  onChange={(e) => {
                    const newCodes = [...addModelForm.languageCodes];
                    newCodes[index] = e.target.value;
                    setAddModelForm(prev => ({ ...prev, languageCodes: newCodes }));
                  }}
                  sx={{ mr: 1 }}
                />

                {/* Remove button for all except the first language code */}
                {index > 0 && (
                  <IconButton
                    onClick={() => {
                      const newCodes = [...addModelForm.languageCodes];
                      newCodes.splice(index, 1);
                      setAddModelForm(prev => ({ ...prev, languageCodes: newCodes }));
                    }}
                    color="error"
                    size="small"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            ))}

            {/* Add language code button */}
            <Button
              startIcon={<AddIcon />}
              onClick={() => {
                setAddModelForm(prev => ({
                  ...prev,
                  languageCodes: [...prev.languageCodes, '']
                }));
              }}
              size="small"
              sx={{ mt: 1 }}
            >
              {t('settings.modelManagement.addLanguageCode')}
            </Button>
          </Box>

          <Button
            onClick={toggleAdvancedOptions}
            variant="text"
            color="primary"
            sx={{ mb: 1 }}
          >
            {addModelForm.showAdvanced
              ? t('settings.modelManagement.hideAdvancedOptions')
              : t('settings.modelManagement.showAdvancedOptions')
            }
          </Button>

          {addModelForm.showAdvanced && (
            <TextField
              margin="dense"
              name="config"
              label={t('settings.modelManagement.modelConfig')}
              multiline
              rows={4}
              fullWidth
              value={addModelForm.config}
              onChange={handleFormChange}
              helperText={t('settings.modelManagement.modelConfigHelp')}
              sx={{ mb: 2 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddDialog} disabled={addingModel}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleAddModel}
            color="primary"
            variant="contained"
            disabled={!addModelForm.modelUrl || addingModel}
            startIcon={addingModel ? <CircularProgress size={20} /> : null}
          >
            {addingModel
              ? t('settings.modelManagement.addingCustomModel')
              : t('settings.modelManagement.addCustomModel')
            }
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog}>
        <DialogTitle>{t('settings.modelManagement.confirmDelete')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('settings.modelManagement.deleteConfirmationText', {
              modelName: modelToDelete?.name || ''
            })}
          </Typography>

          {modelToDelete?.id === activeModel && (
            <Alert severity="warning" sx={{ mt: 2, mb: 1 }}>
              {t('settings.modelManagement.deleteActiveModelWarning')}
            </Alert>
          )}

          {modelToDelete?.repo_id && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {t('settings.modelManagement.deleteFromCacheInfo', {
                repoId: modelToDelete.repo_id
              })}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleDeleteModel}
            color="error"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading
              ? t('settings.modelManagement.deleting')
              : t('settings.modelManagement.delete')
            }
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Model Dialog */}
      <Dialog open={openEditDialog} onClose={handleCloseEditDialog} maxWidth="md" fullWidth>
        <DialogTitle>{t('settings.modelManagement.editModel')}</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            name="name"
            label={t('settings.modelManagement.modelName')}
            type="text"
            fullWidth
            value={editModelForm.name}
            onChange={(e) => setEditModelForm(prev => ({ ...prev, name: e.target.value }))}
            sx={{ mb: 2 }}
          />

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('settings.modelManagement.languageCodes')}
            </Typography>
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
              {t('settings.modelManagement.languageCodesHelp')}
            </Typography>

            {(editModelForm.languageCodes || []).map((code, index) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TextField
                  margin="dense"
                  name={`languageCode-${index}`}
                  label={t('settings.modelManagement.languageCode')}
                  type="text"
                  fullWidth
                  value={code}
                  onChange={(e) => {
                    const newCodes = [...(editModelForm.languageCodes || [''])];
                    newCodes[index] = e.target.value;
                    setEditModelForm(prev => ({ ...prev, languageCodes: newCodes }));
                  }}
                  sx={{ mr: 1 }}
                />

                {/* Remove button for all except the first language code */}
                {index > 0 && (
                  <IconButton
                    onClick={() => {
                      const newCodes = [...(editModelForm.languageCodes || [])];
                      newCodes.splice(index, 1);
                      setEditModelForm(prev => ({ ...prev, languageCodes: newCodes }));
                    }}
                    color="error"
                    size="small"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            ))}

            {/* Add language code button */}
            <Button
              startIcon={<AddIcon />}
              onClick={() => {
                setEditModelForm(prev => ({
                  ...prev,
                  languageCodes: [...(prev.languageCodes || []), '']
                }));
              }}
              size="small"
              sx={{ mt: 1 }}
            >
              {t('settings.modelManagement.addLanguageCode')}
            </Button>
          </Box>

          <TextField
            margin="dense"
            name="config"
            label={t('settings.modelManagement.modelConfig')}
            multiline
            rows={4}
            fullWidth
            value={editModelForm.config}
            onChange={(e) => setEditModelForm(prev => ({ ...prev, config: e.target.value }))}
            helperText={t('settings.modelManagement.modelConfigHelp')}
            sx={{ mb: 2 }}
          />

          {/* Display storage information only for symlinked models */}
          {modelToEdit && modelStorageInfo[modelToEdit.id] && modelStorageInfo[modelToEdit.id].is_symlink && (
            <Box sx={{ mt: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('settings.modelManagement.storageInformation')}
              </Typography>

              <Alert severity="info" sx={{ mb: 1 }}>
                {t('settings.modelManagement.usingSymlinks')}
              </Alert>

              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                {t('settings.modelManagement.originalFiles')}:
                <Box component="ul" sx={{ mt: 0.5, pl: 2 }}>
                  <Box component="li">
                    {modelStorageInfo[modelToEdit.id].original_model_file}
                  </Box>
                  {modelStorageInfo[modelToEdit.id].original_vocab_file && (
                    <Box component="li">
                      {modelStorageInfo[modelToEdit.id].original_vocab_file}
                    </Box>
                  )}
                </Box>
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog} disabled={editingModel}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleEditModel}
            color="primary"
            variant="contained"
            disabled={editingModel}
            startIcon={editingModel ? <CircularProgress size={20} /> : null}
          >
            {editingModel
              ? t('settings.modelManagement.updating')
              : t('settings.modelManagement.update')
            }
          </Button>
        </DialogActions>
      </Dialog>

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
    </Box>
  );
};

export default ModelManagementTab;
