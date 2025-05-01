import { useState, useEffect } from 'react';
import { getModels, getModelDownloadStatus, getModelStorageInfo } from '../../../services/modelService';
import { invalidateModelsCache } from '../../../services/modelAvailabilityService';

/**
 * Custom hook for managing models
 * @returns {Object} - Models state and functions
 */
export const useModels = () => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [modelSizes, setModelSizes] = useState({});

  // Fetch models from API
  const fetchModels = async () => {
    try {
      setLoading(true);
      const data = await getModels(false); // Never include cache models
      setModels(data.models || []);

      // Invalidate the models cache to notify other components
      invalidateModelsCache();

      setError(null);
      return data;
    } catch (err) {
      setError(err.message || 'Failed to fetch models');
      console.error('Error fetching models:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

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

  return {
    models,
    loading,
    error,
    isScanning,
    modelSizes,
    fetchModels,
    scanForModels
  };
};

/**
 * Custom hook for managing downloads
 * @param {Function} fetchModels - Function to fetch models
 * @returns {Object} - Downloads state and functions
 */
export const useDownloads = (fetchModels) => {
  const [downloads, setDownloads] = useState({});

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
  }, [downloads, fetchModels]);

  // Update downloads with server data
  const updateDownloads = (serverDownloads) => {
    if (serverDownloads) {
      setDownloads(serverDownloads);
    }
  };

  return {
    downloads,
    setDownloads,
    updateDownloads
  };
};
