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
  LinearProgress
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import ErrorIcon from '@mui/icons-material/Error';
import { getModels, setActiveModel, addModelFromHuggingFace, addModelFromUrl, deleteModel, getModelDownloadStatus } from '../../services/modelService';

// Component to display download status
const DownloadStatus = ({ status }) => {
  const { t } = useTranslation();

  if (!status) return null;

  if (status.status === 'downloading') {
    return (
      <Box sx={{ width: '100%', mt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
          <CloudDownloadIcon color="primary" fontSize="small" sx={{ mr: 1 }} />
          <Typography variant="body2" color="primary">
            {t('settings.modelManagement.downloading')} ({status.progress}%)
          </Typography>
        </Box>
        <LinearProgress variant="determinate" value={status.progress} />
      </Box>
    );
  } else if (status.status === 'failed') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
        <ErrorIcon color="error" fontSize="small" sx={{ mr: 1 }} />
        <Typography variant="body2" color="error">
          {t('settings.modelManagement.downloadFailed')}: {status.error}
        </Typography>
      </Box>
    );
  }

  return null;
};

const ModelManagementTab = () => {
  const { t } = useTranslation();
  const [models, setModels] = useState([]);
  const [activeModel, setActiveModelState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [modelToDelete, setModelToDelete] = useState(null);
  const [addModelForm, setAddModelForm] = useState({
    sourceType: 'huggingface',
    modelUrl: '',
    vocabUrl: '',
    modelId: '',
    showAdvanced: false,
    config: ''
  });
  const [addingModel, setAddingModel] = useState(false);
  const [downloads, setDownloads] = useState({});
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });

  // Fetch models on component mount
  useEffect(() => {
    fetchModels();
  }, []);

  // Set up polling for download status
  useEffect(() => {
    const checkDownloadStatus = async () => {
      // Check status of all downloads
      const downloadIds = Object.keys(downloads);

      if (downloadIds.length === 0) return;

      for (const modelId of downloadIds) {
        const downloadInfo = downloads[modelId];

        // Only check status for downloads in progress
        if (downloadInfo.status === 'downloading') {
          try {
            const statusData = await getModelDownloadStatus(modelId);

            if (statusData.status) {
              // Update download status
              setDownloads(prev => ({
                ...prev,
                [modelId]: statusData.status
              }));

              // If download is complete, refresh models
              if (statusData.status.status === 'completed') {
                fetchModels();
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
      const data = await getModels();
      setModels(data.models || []);
      setActiveModelState(data.active_model);

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
      await deleteModel(modelToDelete.id);

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

      <Typography variant="body2" color="textSecondary" paragraph>
        {t('settings.modelManagement.description')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Display ongoing downloads */}
      {Object.keys(downloads).length > 0 && (
        <Paper elevation={1} sx={{ mb: 3, p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            {t('settings.modelManagement.ongoingDownloads')}
          </Typography>

          <List>
            {Object.entries(downloads).map(([modelId, status]) => {
              // Skip completed downloads that are already in the models list
              if (status.status === 'completed' && models.some(m => m.id === modelId)) {
                return null;
              }

              return (
                <ListItem key={modelId}>
                  <ListItemText
                    primary={
                      <Typography variant="body1">
                        {modelId.replace('_', ' ')}
                      </Typography>
                    }
                    secondary={
                      <DownloadStatus status={status} />
                    }
                  />
                </ListItem>
              );
            })}
          </List>
        </Paper>
      )}

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
                  <Box>
                    {model.id !== activeModel && (
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
                      <Typography
                        variant="body1"
                        sx={{ fontWeight: model.id === activeModel ? 'bold' : 'normal' }}
                      >
                        {model.name}
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
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Box sx={{ mt: 0.5 }}>
                      <Typography variant="body2" color="textSecondary">
                        {t('settings.modelManagement.source')}: {model.source}
                      </Typography>
                      {model.language && model.language !== 'unknown' && (
                        <Typography variant="body2" color="textSecondary">
                          {t('settings.modelManagement.language')}: {model.language}
                        </Typography>
                      )}

                      {/* Show download status if this model is being downloaded */}
                      {downloads[model.id] && <DownloadStatus status={downloads[model.id]} />}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleOpenAddDialog}
            disabled={loading}
          >
            {t('settings.modelManagement.addModel')}
          </Button>
        </Box>
      </Paper>

      {/* Add Model Dialog */}
      <Dialog open={openAddDialog} onClose={handleCloseAddDialog} maxWidth="md" fullWidth>
        <DialogTitle>{t('settings.modelManagement.addNewModel')}</DialogTitle>
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
              ? t('settings.modelManagement.addingModel')
              : t('settings.modelManagement.addModel')
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
