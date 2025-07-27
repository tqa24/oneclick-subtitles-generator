import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FiInfo } from 'react-icons/fi';
import '../styles/VideoQualityModal.css';
// import progressWebSocketClient from '../utils/progressWebSocketClient'; // DISABLED - using polling instead

const VideoQualityModal = ({
  isOpen,
  onClose,
  onConfirm,
  videoInfo,
  availableVersions = []
}) => {
  const { t } = useTranslation();
  const [selectedOption, setSelectedOption] = useState('current');
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [selectedQuality, setSelectedQuality] = useState(null);
  const [isRedownloading, setIsRedownloading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [availableQualities, setAvailableQualities] = useState([]);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const progressIntervalRef = useRef(null);

  // Wrapper function for onClose to ensure cleanup
  const handleClose = () => {
    console.log(`[VideoQualityModal] Modal closing, cleaning up progress interval`);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    onClose();
  };

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('[VideoQualityModal] Modal opened with videoInfo:', videoInfo);
      console.log('[VideoQualityModal] Available versions:', availableVersions);

      setSelectedOption('current');
      setSelectedVersion(null);
      setSelectedQuality(null);
      setIsRedownloading(false);
      setIsScanning(false);
      setAvailableQualities([]);
      setDownloadProgress(0);

      // Clear any existing progress interval
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      // Don't scan qualities automatically - only when redownload is selected
      console.log('[VideoQualityModal] Modal opened, waiting for user to select redownload option');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, videoInfo]);

  // Scan qualities when redownload option is selected
  useEffect(() => {
    if (selectedOption === 'redownload' && videoInfo && videoInfo.url &&
        ['youtube', 'douyin', 'all-sites'].includes(videoInfo.source) &&
        availableQualities.length === 0 && !isScanning) {
      console.log('[VideoQualityModal] Redownload selected, starting quality scan for:', videoInfo.source);
      scanVideoQualities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOption, videoInfo]);

  // Set default version selection for uploaded videos
  useEffect(() => {
    if (availableVersions.length > 0 && !selectedVersion) {
      // Default to original version if available
      const originalVersion = availableVersions.find(v => v.type === 'original');
      setSelectedVersion(originalVersion || availableVersions[0]);
    }
  }, [availableVersions, selectedVersion]);

  // Scan available video qualities using the new polling system
  const scanVideoQualities = async () => {
    if (!videoInfo || !videoInfo.url) return;

    setIsScanning(true);
    try {
      // Import the polling-based quality scanner
      const { scanVideoQualities: scanQualities } = await import('../utils/qualityScanner');
      const qualities = await scanQualities(videoInfo.url);

      setAvailableQualities(qualities);
      // Default to highest quality
      if (qualities.length > 0) {
        setSelectedQuality(qualities[0]);
      }
    } catch (error) {
      console.error('Error scanning qualities:', error);
      setAvailableQualities([]);
    } finally {
      setIsScanning(false);
    }
  };



  // Start quality download with pre-generated video ID
  const startQualityDownloadWithId = async (quality, url, videoId) => {
    const response = await fetch('http://localhost:3031/api/download-video-quality', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        quality: quality,
        videoId: videoId
      }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to start download');
    }

    return data;
  };

  // Start progress tracking using polling (WebSocket disabled to prevent duplicates)
  const startProgressTracking = (videoId, quality, url) => {
    console.log(`[VideoQualityModal] Using polling instead of WebSocket to prevent duplicates`);
    console.log(`[VideoQualityModal] Setting up polling for videoId: ${videoId}`);

    // Clear any existing interval first
    if (progressIntervalRef.current) {
      console.log(`[VideoQualityModal] Clearing existing progress interval`);
      clearInterval(progressIntervalRef.current);
    }

    // Use polling instead of WebSocket
    console.log(`[VideoQualityModal] About to set up interval for videoId: ${videoId}`);
    const newProgressInterval = setInterval(async () => {
      console.log(`[VideoQualityModal] INTERVAL FIRED! Polling for videoId: ${videoId}`);
      try {
        console.log(`[VideoQualityModal] Making fetch request...`);
        const response = await fetch(`http://localhost:3031/api/quality-download-progress/${videoId}`);
        console.log(`[VideoQualityModal] Response status:`, response.status, response.statusText);
        const data = await response.json();

        console.log(`[VideoQualityModal] Polling response:`, data);

        if (data.success) {
          const newProgress = data.progress || 0;

          // Filter out unreasonable progress values
          if (newProgress >= 0 && newProgress <= 100) {
            setDownloadProgress(newProgress);
          }

          if (data.status === 'completed') {
            console.log(`[VideoQualityModal] Download completed! Proceeding to render...`);
            clearInterval(newProgressInterval);
            progressIntervalRef.current = null;
            setIsRedownloading(false);
            setDownloadProgress(100);

            // Call onConfirm to proceed to rendering, then close modal
            setTimeout(async () => {
              try {
                await onConfirm('redownload', {
                  quality: quality,
                  url: url,
                  videoId: videoId
                });
                handleClose();
              } catch (error) {
                console.error('[VideoQualityModal] Error confirming redownload:', error);
                handleClose();
              }
            }, 1000);
          } else if (data.status === 'error') {
            console.log(`[VideoQualityModal] Download error detected:`, data.error);
            clearInterval(newProgressInterval);
            progressIntervalRef.current = null;
            setIsRedownloading(false);
            console.error('[VideoQualityModal] Download error:', data.error);
          }
        } else {
          console.log(`[VideoQualityModal] Polling failed:`, data);
        }
      } catch (error) {
        console.error('Error fetching download progress:', error);
      }
    }, 1000);

    // Store interval in ref for cleanup
    progressIntervalRef.current = newProgressInterval;
    console.log(`[VideoQualityModal] Progress interval set up successfully for videoId: ${videoId}`);
  };



  // Cleanup progress tracking on unmount or when modal closes
  React.useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        console.log(`[VideoQualityModal] Cleaning up progress interval on unmount`);
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (selectedOption === 'redownload') {
      if (!selectedQuality) {
        alert('Please select a quality to download');
        return;
      }

      setIsRedownloading(true);
      setDownloadProgress(0);

      try {
        // Generate video ID first
        const videoId = `quality_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // Start progress tracking BEFORE starting download
        startProgressTracking(videoId, selectedQuality.quality, videoInfo.url);

        // Start the download with the pre-generated video ID
        await startQualityDownloadWithId(selectedQuality.quality, videoInfo.url, videoId);

        // Progress tracking will handle completion and proceed to rendering automatically
      } catch (error) {
        console.error('Error redownloading video:', error);
        setIsRedownloading(false);
        setDownloadProgress(0);

        // WebSocket cleanup removed - using polling instead

        // Clear progress interval on error
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        return;
      }
    } else if (selectedOption === 'version' && selectedVersion) {
      await onConfirm('version', { version: selectedVersion });
    } else {
      await onConfirm('current');
    }

    handleClose();
  };

  const getVideoSourceDisplay = () => {
    if (!videoInfo) return t('videoQuality.unknownSource', 'Unknown source');
    
    switch (videoInfo.source) {
      case 'youtube':
        return t('videoQuality.youtubeVideo', 'YouTube Video');
      case 'douyin':
        return t('videoQuality.douyinVideo', 'Douyin Video');
      case 'all-sites':
        return t('videoQuality.webVideo', 'Web Video');
      case 'upload':
        return t('videoQuality.uploadedVideo', 'Uploaded Video');
      default:
        return t('videoQuality.unknownSource', 'Unknown source');
    }
  };

  const getCurrentQuality = () => {
    if (!videoInfo) return t('videoQuality.unknownQuality', 'Unknown quality');

    if (videoInfo.source === 'upload') {
      return videoInfo.isOptimized
        ? t('videoQuality.optimizedQuality', 'Optimized ({{quality}})', { quality: videoInfo.quality || '360p' })
        : t('videoQuality.originalQuality', 'Original Quality');
    }

    // Show actual dimensions if available, otherwise just the quality
    if (videoInfo.quality && videoInfo.quality.includes('×')) {
      return videoInfo.quality; // Already includes dimensions like "720p (1080×1920)"
    }

    return videoInfo.quality || '360p';
  };

  const showRedownloadOption = videoInfo?.source &&
    ['youtube', 'douyin', 'all-sites'].includes(videoInfo.source) &&
    videoInfo.url; // Only show if we have a URL to redownload from

  const showVersionOption = availableVersions.length > 0;

  return (
    <div className="video-quality-modal-overlay" onClick={handleClose}>
      <div className="video-quality-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-content">
            <h3>{t('videoQuality.title', 'Video Quality for Rendering')}</h3>
            <div className="header-badge" title={t('videoQuality.cookieSupportTooltip', 'Uses browser cookies for authentication to access higher quality videos and bypass login restrictions')}>
              <FiInfo className="badge-icon" />
              <span className="badge-text">{t('videoQuality.cookieSupport', 'Browser Cookie Added')}</span>
            </div>
          </div>
          <button className="close-button" onClick={handleClose}>×</button>
        </div>

        <div className="modal-content">
          <div className="video-info">
            <div className="info-row">
              <span className="label">{t('videoQuality.source', 'Source')}:</span>
              <span className="value">{getVideoSourceDisplay()}</span>
            </div>
            <div className="info-row">
              <span className="label">{t('videoQuality.currentQuality', 'Current Quality')}:</span>
              <span className="value">{getCurrentQuality()}</span>
            </div>
            {videoInfo?.title && (
              <div className="info-row">
                <span className="label">{t('videoQuality.title', 'Title')}:</span>
                <span className="value" title={videoInfo.title}>
                  {videoInfo.title.length > 50 
                    ? `${videoInfo.title.substring(0, 50)}...` 
                    : videoInfo.title}
                </span>
              </div>
            )}
          </div>

          <div className="quality-options">
            <h4>{t('videoQuality.chooseOption', 'Choose an option for rendering:')}</h4>

            {/* Current quality option */}
            <label className="option-item">
              <input
                type="radio"
                name="quality-option"
                value="current"
                checked={selectedOption === 'current'}
                onChange={(e) => setSelectedOption(e.target.value)}
              />
              <div className="option-content">
                <div className="option-title">
                  {t('videoQuality.useCurrent', 'Use current video quality')}
                </div>
                <div className="option-description">
                  {t('videoQuality.useCurrentDesc', 'Render with the video currently playing in the preview ({{quality}})', 
                    { quality: getCurrentQuality() })}
                </div>
              </div>
            </label>

            {/* Redownload option for online videos */}
            {showRedownloadOption && (
              <label className="option-item">
                <input
                  type="radio"
                  name="quality-option"
                  value="redownload"
                  checked={selectedOption === 'redownload'}
                  onChange={(e) => setSelectedOption(e.target.value)}
                />
                <div className="option-content">
                  <div className="option-title">
                    {t('videoQuality.redownloadQuality', 'Redownload in different quality')}
                  </div>
                  <div className="option-description">
                    {t('videoQuality.redownloadQualityDesc', 'Download the video again in a different quality for rendering')}
                  </div>

                  {selectedOption === 'redownload' && (
                    <div className="quality-selector">
                      {isScanning ? (
                        <div className="scanning-indicator">
                          {t('videoQuality.scanningQualities', 'Scanning available qualities...')}
                        </div>
                      ) : availableQualities.length > 0 ? (
                        <div className="quality-options-list">
                          <div className="quality-selector-title">
                            {t('videoQuality.selectQuality', 'Select quality:')}
                          </div>
                          {availableQualities.map((quality, index) => (
                            <div key={index} className="radio-pill">
                              <input
                                type="radio"
                                id={`quality-${index}`}
                                name="quality"
                                checked={selectedQuality?.quality === quality.quality}
                                onChange={() => setSelectedQuality(quality)}
                              />
                              <label htmlFor={`quality-${index}`} className="quality-pill-label">
                                {quality.description}
                              </label>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="no-qualities">
                          {t('videoQuality.noQualitiesFound', 'No additional qualities found')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </label>
            )}

            {/* Version selection for uploaded videos */}
            {showVersionOption && (
              <label className="option-item">
                <input
                  type="radio"
                  name="quality-option"
                  value="version"
                  checked={selectedOption === 'version'}
                  onChange={(e) => setSelectedOption(e.target.value)}
                />
                <div className="option-content">
                  <div className="option-title">
                    {t('videoQuality.selectVersion', 'Select video version')}
                  </div>
                  <div className="option-description">
                    {t('videoQuality.selectVersionDesc', 'Choose from available video versions')}
                  </div>
                  
                  {selectedOption === 'version' && (
                    <div className="version-selector">
                      {availableVersions.map((version, index) => (
                        <div key={index} className="radio-pill">
                          <input
                            type="radio"
                            id={`version-${index}`}
                            name="version"
                            checked={selectedVersion?.path === version.path}
                            onChange={() => setSelectedVersion(version)}
                          />
                          <label htmlFor={`version-${index}`} className="version-pill-label">
                            <div className="version-title">
                              {version.type === 'original'
                                ? t('videoQuality.originalVersion', 'Original Quality')
                                : t('videoQuality.optimizedVersion', 'Optimized ({{quality}})', { quality: version.quality || '360p' })}
                            </div>
                            {version.resolution && (
                              <div className="version-details">
                                {version.resolution} • {version.fps || 30}fps
                              </div>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </label>
            )}
          </div>

          {/* Progress bar for redownloading */}
          {isRedownloading && (
            <div className="download-progress-container">
              <div className="download-progress-bar">
                <div
                  className="download-progress-fill"
                  style={{ width: `${downloadProgress}%` }}
                ></div>
              </div>
              <div className="download-progress-text">
                {downloadProgress}% - {t('videoQuality.downloadingQuality', 'Downloading {{quality}}', { quality: selectedQuality?.quality })}
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button
            className="cancel-button"
            onClick={handleClose}
            disabled={isRedownloading}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            className="confirm-button"
            onClick={handleConfirm}
            disabled={
              isRedownloading ||
              isScanning ||
              (selectedOption === 'version' && !selectedVersion) ||
              (selectedOption === 'redownload' && !selectedQuality)
            }
          >
            {isRedownloading
              ? `${t('videoQuality.redownloading', 'Redownloading...')} ${downloadProgress}%`
              : isScanning
              ? t('videoQuality.scanning', 'Scanning...')
              : t('common.confirm', 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoQualityModal;
