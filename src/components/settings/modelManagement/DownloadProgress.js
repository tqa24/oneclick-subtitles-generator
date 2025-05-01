import React from 'react';
import { useTranslation } from 'react-i18next';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CancelIcon from '@mui/icons-material/Cancel';
import ErrorIcon from '@mui/icons-material/Error';

/**
 * Component for showing download progress
 * @param {Object} props - Component props
 * @param {Object} props.downloadInfo - Download information
 * @param {string} props.modelId - Model ID
 * @param {Function} props.onCancel - Function to call when download is cancelled
 * @returns {JSX.Element|null} - Rendered component or null if not downloading
 */
const DownloadProgress = ({ downloadInfo, modelId, onCancel }) => {
  const { t } = useTranslation();

  if (!downloadInfo) return null;

  // If download is in progress
  if (downloadInfo.status === 'downloading') {
    return (
      <div>
        <div className="download-status">
          <CloudDownloadIcon fontSize="small" />
          <span>{t('settings.modelManagement.downloading')}</span>
          <span>
            {/* Always show percentage format only */}
            ({downloadInfo.progress ? `${downloadInfo.progress}%` : ''})
          </span>
          <button
            className="cancel-download-btn"
            onClick={() => onCancel(modelId)}
            title={t('settings.modelManagement.cancelDownload', 'Cancel Download')}
          >
            <CancelIcon fontSize="small" />
          </button>
        </div>
        <div className="download-progress">
          <div
            className="download-progress-bar"
            style={{
              width: downloadInfo.progress !== undefined
                ? `${downloadInfo.progress}%`
                : '10%' // Default progress when no information is available
            }}
          ></div>
        </div>
      </div>
    );
  }

  // If download failed
  if (downloadInfo.status === 'failed') {
    return (
      <div className="download-status error">
        <ErrorIcon fontSize="small" />
        <span>{t('settings.modelManagement.downloadFailed')}: {downloadInfo.error}</span>
      </div>
    );
  }

  return null;
};

export default DownloadProgress;
