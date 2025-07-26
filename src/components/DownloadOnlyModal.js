import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FiX, FiVideo, FiMusic, FiDownload, FiInfo } from 'react-icons/fi';
import '../styles/DownloadOnlyModal.css';
import { scanVideoQualities } from '../utils/qualityScanner';
import progressWebSocketClient from '../utils/progressWebSocketClient';

const DownloadOnlyModal = ({
  isOpen,
  onClose,
  videoInfo
}) => {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState(''); // 'video' or 'audio' - no preselection
  const [selectedQuality, setSelectedQuality] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [availableQualities, setAvailableQualities] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  // eslint-disable-next-line no-unused-vars
  const [downloadVideoId, setDownloadVideoId] = useState(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedType(''); // Don't preselect any type
      setSelectedQuality(null);
      setAvailableQualities([]);
      setIsScanning(false);
      setIsDownloading(false);
      setDownloadProgress(0);
      setDownloadVideoId(null);
    }
  }, [isOpen]);

  // Scan qualities when video type is selected (only when user actively selects video)
  useEffect(() => {
    if (selectedType === 'video' && videoInfo?.url && availableQualities.length === 0 && !isScanning) {
      handleScanQualities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, videoInfo?.url]);

  const handleScanQualities = async () => {
    if (!videoInfo?.url) return;

    setIsScanning(true);
    try {
      const qualities = await scanVideoQualities(videoInfo.url);
      setAvailableQualities(qualities);
      
      // Auto-select 360p if available, otherwise select the first quality
      const preferred360p = qualities.find(q => q.quality === '360p');
      if (preferred360p) {
        setSelectedQuality(preferred360p);
      } else if (qualities.length > 0) {
        setSelectedQuality(qualities[0]);
      }
    } catch (error) {
      console.error('Error scanning qualities:', error);
      setAvailableQualities([]);
    } finally {
      setIsScanning(false);
    }
  };

  const handleDownload = async () => {
    if (!videoInfo?.url) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const downloadData = {
        url: videoInfo.url,
        type: selectedType,
        quality: selectedType === 'video' ? selectedQuality?.quality : null,
        source: videoInfo.source
      };

      const response = await fetch('http://localhost:3031/api/download-only', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(downloadData),
      });

      const result = await response.json();

      if (result.success) {
        const videoId = result.videoId;
        setDownloadVideoId(videoId);

        // Subscribe to progress updates
        try {
          await progressWebSocketClient.subscribe(videoId, (progressData) => {
            console.log(`[DownloadOnlyModal] Progress update: ${progressData.progress}% - Status: ${progressData.status}`);
            
            const newProgress = progressData.progress || 0;
            if (newProgress >= 0 && newProgress <= 100) {
              setDownloadProgress(newProgress);
            }

            if (progressData.status === 'completed') {
              setIsDownloading(false);
              // Trigger download of the file using the download endpoint
              const downloadUrl = `http://localhost:3031/api/download-only-file/${videoId}`;
              const a = document.createElement('a');
              a.href = downloadUrl;
              a.download = result.filename || `download.${selectedType === 'video' ? 'mp4' : 'mp3'}`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              onClose();
            } else if (progressData.status === 'error') {
              setIsDownloading(false);
              console.error('Download error:', progressData.error);
            }
          });
        } catch (error) {
          console.warn('Failed to subscribe to WebSocket progress:', error);
          // Fallback to polling if WebSocket fails
          pollDownloadProgress(videoId);
        }
      } else {
        throw new Error(result.error || 'Download failed');
      }
    } catch (error) {
      console.error('Error starting download:', error);
      setIsDownloading(false);
    }
  };

  const pollDownloadProgress = (videoId) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:3031/api/download-only-progress/${videoId}`);
        const data = await response.json();

        if (data.success) {
          setDownloadProgress(data.progress || 0);

          if (data.status === 'completed' || data.status === 'error') {
            clearInterval(interval);
            setIsDownloading(false);
            
            if (data.status === 'completed') {
              // Trigger download using the download endpoint
              const downloadUrl = `http://localhost:3031/api/download-only-file/${downloadVideoId}`;
              const a = document.createElement('a');
              a.href = downloadUrl;
              a.download = `download.${selectedType === 'video' ? 'mp4' : 'mp3'}`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              onClose();
            }
          }
        }
      } catch (error) {
        console.error('Error polling download progress:', error);
      }
    }, 1000);
  };

  const handleClose = () => {
    if (!isDownloading) {
      onClose();
    }
  };

  const canDownload = () => {
    if (!selectedType) return false; // No type selected
    if (selectedType === 'audio') return true;
    if (selectedType === 'video') return selectedQuality !== null;
    return false;
  };

  if (!isOpen) return null;

  // Create portal content to render at root level
  const modalContent = (
    <div className="download-only-modal-overlay" onClick={handleClose}>
      <div className="download-only-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-content">
            <h3>{t('download.downloadOnly.title', 'Download Media')}</h3>
            <div className="header-badge" title={t('download.downloadOnly.cookieSupportTooltip', 'Uses browser cookies for authentication to access higher quality videos and bypass login restrictions')}>
              <FiInfo className="badge-icon" />
              <span className="badge-text">{t('download.downloadOnly.cookieSupport', 'Browser Cookie Added')}</span>
            </div>
          </div>
          <button
            className="close-button"
            onClick={handleClose}
            disabled={isDownloading}
          >
            <FiX />
          </button>
        </div>

        {/* Content */}
        <div className="modal-content">
          {/* Download Type Selection */}
          <div className="download-options">
            {/* Type Options Row */}
            <div className="type-options-row">
              {/* Video Option */}
              <label className="option-item">
                <input
                  type="radio"
                  name="download-type"
                  value="video"
                  checked={selectedType === 'video'}
                  onChange={(e) => setSelectedType(e.target.value)}
                  disabled={isDownloading}
                />
                <div className="option-content">
                  <div className="option-title">
                    <FiVideo size={16} />
                    {t('download.downloadOnly.video', 'Video')}
                  </div>
                  <div className="option-description">
                    {t('download.downloadOnly.videoDesc', 'Download video with selected quality')}
                  </div>
                </div>
              </label>

              {/* Audio Option */}
              <label className="option-item">
                <input
                  type="radio"
                  name="download-type"
                  value="audio"
                  checked={selectedType === 'audio'}
                  onChange={(e) => setSelectedType(e.target.value)}
                  disabled={isDownloading}
                />
                <div className="option-content">
                  <div className="option-title">
                    <FiMusic size={16} />
                    {t('download.downloadOnly.audio', 'Audio')}
                  </div>
                  <div className="option-description">
                    {t('download.downloadOnly.audioDesc', 'Download audio only (MP3 format)')}
                  </div>
                </div>
              </label>
            </div>

            {/* Quality Selector for Video - Outside the grid */}
            {selectedType === 'video' && (
              <div className="quality-selector">
                {isScanning ? (
                  <div className="scanning-indicator">
                    {t('download.downloadOnly.scanningQualities', 'Scanning available qualities...')}
                  </div>
                ) : availableQualities.length > 0 ? (
                  <div className="quality-options-list">
                    <div className="quality-selector-title">
                      {t('download.downloadOnly.selectQuality', 'Select quality:')}
                    </div>
                    {availableQualities.map((quality, index) => (
                      <div key={index} className="radio-pill">
                        <input
                          type="radio"
                          id={`quality-${index}`}
                          name="quality"
                          checked={selectedQuality?.quality === quality.quality}
                          onChange={() => setSelectedQuality(quality)}
                          disabled={isDownloading}
                        />
                        <label htmlFor={`quality-${index}`} className="quality-pill-label">
                          {quality.description}
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-qualities">
                    {t('download.downloadOnly.noQualities', 'No qualities available')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-actions">
          <button
            className="cancel-button"
            onClick={handleClose}
            disabled={isDownloading}
          >
            {t('download.downloadOnly.cancel', 'Cancel')}
          </button>
          <button
            className="confirm-button"
            onClick={handleDownload}
            disabled={!canDownload() || isDownloading}
          >
            <FiDownload size={16} />
            {isDownloading ?
              `${t('download.downloadOnly.downloading', 'Downloading...')} ${downloadProgress}%` :
              t('download.downloadOnly.download', 'Download')
            }
          </button>
        </div>
      </div>
    </div>
  );

  // Use ReactDOM.createPortal to render the modal directly to the document body
  return ReactDOM.createPortal(
    modalContent,
    document.body
  );
};

export default DownloadOnlyModal;
