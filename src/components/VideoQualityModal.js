import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/VideoQualityModal.css';
import progressWebSocketClient from '../utils/progressWebSocketClient';

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
  const [downloadVideoId, setDownloadVideoId] = useState(null);

  // Reset state when modal opens and scan qualities for online videos
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
      setDownloadVideoId(null);

      // Scan qualities for online videos
      if (videoInfo && videoInfo.url && ['youtube', 'douyin', 'all-sites'].includes(videoInfo.source)) {
        console.log('[VideoQualityModal] Starting quality scan for:', videoInfo.source);
        scanVideoQualities();
      } else {
        console.log('[VideoQualityModal] Not scanning qualities. VideoInfo:', videoInfo);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, videoInfo]);

  // Set default version selection for uploaded videos
  useEffect(() => {
    if (availableVersions.length > 0 && !selectedVersion) {
      // Default to original version if available
      const originalVersion = availableVersions.find(v => v.type === 'original');
      setSelectedVersion(originalVersion || availableVersions[0]);
    }
  }, [availableVersions, selectedVersion]);

  // Scan available video qualities
  const scanVideoQualities = async () => {
    if (!videoInfo || !videoInfo.url) return;

    setIsScanning(true);
    try {
      const response = await fetch('http://localhost:3007/api/scan-video-qualities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: videoInfo.url
        }),
      });

      const data = await response.json();
      if (data.success) {
        setAvailableQualities(data.qualities);
        // Default to highest quality
        if (data.qualities.length > 0) {
          setSelectedQuality(data.qualities[0]);
        }
      } else {
        console.error('Failed to scan qualities:', data.error);
      }
    } catch (error) {
      console.error('Error scanning qualities:', error);
    } finally {
      setIsScanning(false);
    }
  };

  // Start quality download and return video ID
  const startQualityDownload = async (quality, url) => {
    const response = await fetch('http://localhost:3007/api/download-video-quality', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        quality: quality
      }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to start download');
    }

    return data;
  };

  // Start quality download with pre-generated video ID
  const startQualityDownloadWithId = async (quality, url, videoId) => {
    const response = await fetch('http://localhost:3007/api/download-video-quality', {
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

  // Start progress tracking for a video ID using WebSocket
  const startProgressTracking = async (videoId) => {
    try {
      console.log(`[VideoQualityModal] Starting WebSocket progress tracking for: ${videoId}`);

      await progressWebSocketClient.subscribe(videoId, (progressData) => {
        console.log(`[VideoQualityModal] Progress update: ${progressData.progress}% (${progressData.phase || 'unknown'}) - Status: ${progressData.status}`);

        const newProgress = progressData.progress || 0;

        // Filter out unreasonable progress values
        if (newProgress >= 0 && newProgress <= 100) {
          // Allow progress updates, but smooth out big jumps
          if (newProgress === 100 && downloadProgress < 90 && progressData.phase !== 'merge') {
            console.log(`[VideoQualityModal] Smoothing jump to 100% from ${downloadProgress}% (phase: ${progressData.phase})`);
            setDownloadProgress(90); // Set to 90% instead of jumping to 100%
          } else {
            setDownloadProgress(newProgress);
          }
        } else {
          console.log(`[VideoQualityModal] Ignoring invalid progress: ${newProgress}%`);
        }

        // Update status if needed
        if (progressData.status === 'error') {
          console.error('[VideoQualityModal] Download error:', progressData.error);
        }
      });

      console.log(`[VideoQualityModal] WebSocket subscription successful for: ${videoId}`);
    } catch (error) {
      console.warn('[VideoQualityModal] Failed to subscribe to WebSocket progress:', error);

      // Fallback to API polling
      const progressInterval = setInterval(async () => {
        try {
          const response = await fetch(`http://localhost:3007/api/quality-download-progress/${videoId}`);
          const data = await response.json();

          if (data.success) {
            setDownloadProgress(data.progress || 0);

            if (data.status === 'completed' || data.status === 'error') {
              clearInterval(progressInterval);
            }
          }
        } catch (error) {
          console.error('Error fetching download progress:', error);
        }
      }, 500);

      // Store interval for cleanup
      window.qualityDownloadInterval = progressInterval;
    }
  };

  // Wait for download completion
  const waitForDownloadCompletion = (videoId) => {
    return new Promise((resolve, reject) => {
      let completed = false;

      // Set up completion listener
      const completionInterval = setInterval(async () => {
        try {
          const response = await fetch(`http://localhost:3007/api/quality-download-progress/${videoId}`);
          const data = await response.json();

          if (data.success && !completed) {
            if (data.status === 'completed') {
              completed = true;
              clearInterval(completionInterval);

              // Unsubscribe from WebSocket
              try {
                progressWebSocketClient.unsubscribe(videoId);
              } catch (error) {
                console.warn('Error unsubscribing from WebSocket:', error);
              }

              resolve();
            } else if (data.status === 'error') {
              completed = true;
              clearInterval(completionInterval);

              // Unsubscribe from WebSocket
              try {
                progressWebSocketClient.unsubscribe(videoId);
              } catch (error) {
                console.warn('Error unsubscribing from WebSocket:', error);
              }

              reject(new Error(data.error || 'Download failed'));
            }
          }
        } catch (error) {
          console.error('Error checking download completion:', error);
        }
      }, 1000); // Check every second

      // Timeout after 5 minutes
      setTimeout(() => {
        if (!completed) {
          completed = true;
          clearInterval(completionInterval);
          try {
            progressWebSocketClient.unsubscribe(videoId);
          } catch (error) {
            console.warn('Error unsubscribing from WebSocket:', error);
          }
          reject(new Error('Download timeout'));
        }
      }, 300000); // 5 minutes
    });
  };

  // Cleanup progress tracking on unmount
  React.useEffect(() => {
    return () => {
      if (window.qualityDownloadInterval) {
        clearInterval(window.qualityDownloadInterval);
      }

      // Unsubscribe from WebSocket if we have a video ID
      if (downloadVideoId) {
        try {
          progressWebSocketClient.unsubscribe(downloadVideoId);
        } catch (error) {
          console.warn('Error unsubscribing from WebSocket on unmount:', error);
        }
      }
    };
  }, [downloadVideoId]);

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
        setDownloadVideoId(videoId);

        // Start progress tracking BEFORE starting download
        await startProgressTracking(videoId);

        // Start the download with the pre-generated video ID
        const result = await startQualityDownloadWithId(selectedQuality.quality, videoInfo.url, videoId);

        // Wait for download to complete
        await waitForDownloadCompletion(videoId);

        // Proceed with rendering
        await onConfirm('redownload', {
          quality: selectedQuality.quality,
          url: videoInfo.url,
          videoId: videoId
        });
      } catch (error) {
        console.error('Error redownloading video:', error);
        setIsRedownloading(false);
        setDownloadProgress(0);

        // Cleanup WebSocket subscription on error
        if (downloadVideoId) {
          try {
            progressWebSocketClient.unsubscribe(downloadVideoId);
          } catch (error) {
            console.warn('Error unsubscribing from WebSocket on error:', error);
          }
        }

        setDownloadVideoId(null);
        return;
      }
    } else if (selectedOption === 'version' && selectedVersion) {
      await onConfirm('version', { version: selectedVersion });
    } else {
      await onConfirm('current');
    }

    onClose();
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
    
    return videoInfo.quality || '360p';
  };

  const showRedownloadOption = videoInfo?.source &&
    ['youtube', 'douyin', 'all-sites'].includes(videoInfo.source) &&
    videoInfo.url; // Only show if we have a URL to redownload from

  const showVersionOption = availableVersions.length > 0;

  return (
    <div className="video-quality-modal-overlay" onClick={onClose}>
      <div className="video-quality-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('videoQuality.title', 'Video Quality for Rendering')}</h3>
          <button className="close-button" onClick={onClose}>×</button>
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
                            <label key={index} className="quality-option">
                              <input
                                type="radio"
                                name="quality"
                                checked={selectedQuality?.quality === quality.quality}
                                onChange={() => setSelectedQuality(quality)}
                              />
                              <div className="quality-info">
                                <div className="quality-title">
                                  {quality.description}
                                </div>
                                {quality.resolution && (
                                  <div className="quality-details">
                                    {quality.resolution}
                                  </div>
                                )}
                              </div>
                            </label>
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
                        <label key={index} className="version-option">
                          <input
                            type="radio"
                            name="version"
                            checked={selectedVersion?.path === version.path}
                            onChange={() => setSelectedVersion(version)}
                          />
                          <div className="version-info">
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
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </label>
            )}
          </div>

          <div className="modal-actions">
            <button 
              className="cancel-button" 
              onClick={onClose}
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
        </div>
      </div>
    </div>
  );
};

export default VideoQualityModal;
