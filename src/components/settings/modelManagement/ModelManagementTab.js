import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@mui/material';
import {
  addModelFromHuggingFace,
  addModelFromUrl,
  deleteModel,
  updateModelInfo,
  getModelStorageInfo,
  cancelModelDownload
} from '../../../services/modelService';
import { invalidateModelsCache } from '../../../services/modelAvailabilityService';
import Toast from '../../common/Toast';
import InstalledModelsList from './InstalledModelsList';
import AvailableModelsList from './AvailableModelsList';
import AddModelDialog from './AddModelDialog';
import EditModelDialog from './EditModelDialog';
import DeleteModelDialog from './DeleteModelDialog';
import { useModels, useDownloads } from './modelManagementHooks';
import { getInitialAddModelForm, getInitialEditModelForm } from './modelManagementUtils';

/**
 * Component for managing narration models
 * @returns {JSX.Element} - Rendered component
 */
const ModelManagementTab = () => {
  const { t } = useTranslation();

  // Custom hooks for models and downloads
  const { models, loading, error, isScanning, modelSizes, fetchModels, scanForModels } = useModels();
  const { downloads, setDownloads, updateDownloads } = useDownloads(fetchModels);

  // Dialog states
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);

  // Model states
  const [modelToDelete, setModelToDelete] = useState(null);
  const [modelToEdit, setModelToEdit] = useState(null);
  const [modelStorageInfo, setModelStorageInfo] = useState({});

  // Form states
  const [addModelForm, setAddModelForm] = useState(getInitialAddModelForm());
  const [editModelForm, setEditModelForm] = useState({
    name: '',
    language: '',
    languageCodes: [''],
    config: ''
  });

  // Loading states
  const [addingModel, setAddingModel] = useState(false);
  const [editingModel, setEditingModel] = useState(false);

  // Notification state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'info'
  });

  // Handle opening add model dialog
  const handleOpenAddDialog = () => {
    setAddModelForm(getInitialAddModelForm());
    setOpenAddDialog(true);
  };

  // Handle closing add model dialog
  const handleCloseAddDialog = () => {
    setOpenAddDialog(false);
  };

  // Handle form input change for add model
  const handleAddFormChange = (name, value) => {
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

  // Handle language codes change for add model
  const handleAddLanguageCodesChange = (languageCodes) => {
    setAddModelForm(prev => ({
      ...prev,
      languageCodes
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

  // State for tracking model deletion
  const [isDeletingModel, setIsDeletingModel] = useState(false);

  // Handle deleting a model
  const handleDeleteModel = async () => {
    if (!modelToDelete) return;

    try {
      setIsDeletingModel(true);
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
      setSnackbar({
        open: true,
        message: err.message || t('settings.modelManagement.errorDeletingModel'),
        severity: 'error'
      });
    } finally {
      setIsDeletingModel(false);
    }
  };

  // Handle opening edit dialog
  const handleOpenEditDialog = async (model) => {
    setModelToEdit(model);
    setEditModelForm(getInitialEditModelForm(model));

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

  // Handle form input change for edit model
  const handleEditFormChange = (name, value) => {
    setEditModelForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle language codes change for edit model
  const handleEditLanguageCodesChange = (languageCodes) => {
    setEditModelForm(prev => ({
      ...prev,
      languageCodes
    }));
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

      {/* Available Models List */}
      <AvailableModelsList
        onModelAdded={fetchModels}
        downloads={downloads}
        setDownloads={setDownloads}
        installedModels={models}
        onAddModelClick={handleOpenAddDialog}
      />

      <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />

      {/* Installed Models List */}
      <InstalledModelsList
        models={models}
        modelSizes={modelSizes}
        downloads={downloads}
        loading={loading}
        isScanning={isScanning}
        onScan={scanForModels}
        onEdit={handleOpenEditDialog}
        onDelete={handleOpenDeleteDialog}
        onCancelDownload={handleCancelDownload}
      />

      {/* Add Model Dialog */}
      <AddModelDialog
        isOpen={openAddDialog}
        onClose={handleCloseAddDialog}
        form={addModelForm}
        onFormChange={handleAddFormChange}
        onSourceTypeChange={handleSourceTypeChange}
        onToggleAdvanced={toggleAdvancedOptions}
        onLanguageCodesChange={handleAddLanguageCodesChange}
        onAddModel={handleAddModel}
        isAdding={addingModel}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteModelDialog
        isOpen={openDeleteDialog}
        onClose={handleCloseDeleteDialog}
        model={modelToDelete}
        onDelete={handleDeleteModel}
        isDeleting={isDeletingModel}
      />

      {/* Edit Model Dialog */}
      <EditModelDialog
        isOpen={openEditDialog}
        onClose={handleCloseEditDialog}
        model={modelToEdit}
        form={editModelForm}
        onFormChange={handleEditFormChange}
        onLanguageCodesChange={handleEditLanguageCodesChange}
        onEditModel={handleEditModel}
        isEditing={editingModel}
        storageInfo={modelToEdit ? modelStorageInfo[modelToEdit.id] : null}
      />

      {/* Custom Toast notification */}
      <Toast
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={handleCloseSnackbar}
        autoHideDuration={2000}
      />
    </div>
  );
};

export default ModelManagementTab;
