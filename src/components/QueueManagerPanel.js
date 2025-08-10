import React from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/QueueManagerPanel.css';

const QueueManagerPanel = ({
  queue,
  currentQueueItem,
  onRemoveItem,
  onClearQueue,
  onCancelItem,
  gridLayout = false
}) => {
  const { t } = useTranslation();

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        );
      case 'processing':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v4"></path>
            <path d="m16.2 7.8 2.9-2.9"></path>
            <path d="M18 12h4"></path>
            <path d="m16.2 16.2 2.9 2.9"></path>
            <path d="M12 18v4"></path>
            <path d="m4.9 19.1 2.9-2.9"></path>
            <path d="M2 12h4"></path>
            <path d="m4.9 4.9 2.9 2.9"></path>
          </svg>
        );
      case 'completed':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        );
      case 'failed':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        );
      default:
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        );
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'var(--accent-color)';
      case 'processing':
        return 'var(--warning-color)';
      case 'completed':
        return 'var(--success-color)';
      case 'failed':
        return 'var(--error-color)';
      default:
        return 'var(--text-secondary)';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    // Handle both number timestamps and string timestamps
    const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
    return isNaN(date.getTime()) ? '' : date.toLocaleTimeString();
  };

  // Generate persistent video number based on timestamp
  const getVideoNumber = (item) => {
    // Get or extract timestamp for this item
    let timestamp = item.timestamp;

    // If no timestamp property, try to extract from ID (format: render_TIMESTAMP_randomstring)
    if (!timestamp && item.id) {
      const idParts = item.id.split('_');
      if (idParts.length >= 2 && idParts[0] === 'render') {
        timestamp = parseInt(idParts[1]);
      }
    }

    // Fallback to current time if no timestamp found
    if (!timestamp) {
      timestamp = Date.now();
    }

    // Use localStorage to maintain a persistent counter across sessions
    const STORAGE_KEY = 'videoRenderCounter';
    const TIMESTAMP_MAP_KEY = 'videoTimestampMap';

    // Get existing timestamp-to-number mapping
    let timestampMap = {};
    try {
      const stored = localStorage.getItem(TIMESTAMP_MAP_KEY);
      if (stored) {
        timestampMap = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse timestamp map from localStorage');
    }

    // If this timestamp already has a number assigned, return it
    if (timestampMap[timestamp]) {
      return timestampMap[timestamp];
    }

    // Get current counter value
    let counter = 1;
    try {
      const storedCounter = localStorage.getItem(STORAGE_KEY);
      if (storedCounter) {
        counter = parseInt(storedCounter) + 1;
      }
    } catch (e) {
      console.warn('Failed to parse counter from localStorage');
    }

    // Assign this timestamp the next available number
    timestampMap[timestamp] = counter;

    // Save updated counter and mapping
    try {
      localStorage.setItem(STORAGE_KEY, counter.toString());
      localStorage.setItem(TIMESTAMP_MAP_KEY, JSON.stringify(timestampMap));
    } catch (e) {
      console.warn('Failed to save to localStorage');
    }

    return counter;
  };

  const handleDownloadVideo = async (outputPath, item) => {
    try {
      // Fetch the video as a blob
      const response = await fetch(outputPath);
      if (!response.ok) {
        throw new Error('Failed to fetch video');
      }

      const blob = await response.blob();

      // Create a download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `subtitled-video-${getVideoNumber(item)}.mp4`;
      document.body.appendChild(a);
      a.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error('Error downloading video:', error);
      // Fallback to direct link if fetch fails
      const a = document.createElement('a');
      a.href = outputPath;
      a.download = `subtitled-video-${getVideoNumber(item)}.mp4`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className={`queue-manager-panel ${gridLayout ? 'grid-layout' : ''}`}>
      <div className="panel-header">
        <div className="header-left">
          <svg className="panel-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span className="panel-title">{t('videoRendering.renderQueue', 'Render Queue')}</span>
          <span className="queue-count">{queue.length}</span>
        </div>

        {queue.length > 0 && (
          <button
            className="clear-queue-btn header-btn"
            onClick={onClearQueue}
            disabled={currentQueueItem !== null}
            title={t('videoRendering.clearQueue', 'Clear Queue')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        )}
      </div>

      <div className="panel-content">
        {queue.length === 0 ? (
          <div className="empty-queue">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
              <path d="M8 14h.01"></path>
              <path d="M12 14h.01"></path>
              <path d="M16 14h.01"></path>
              <path d="M8 18h.01"></path>
              <path d="M12 18h.01"></path>
              <path d="M16 18h.01"></path>
            </svg>
            <h3>{t('videoRendering.emptyQueue', 'Queue is Empty')}</h3>
            <p>{t('videoRendering.addVideosToQueue', 'Add videos to the queue to start batch rendering')}</p>
          </div>
        ) : (
          <div className={`queue-list ${gridLayout ? 'grid-layout' : ''}`}>
            {queue.map((item, index) => (
              <div 
                key={item.id} 
                className={`queue-item ${item.status} ${item.id === currentQueueItem ? 'current' : ''}`}
              >
                <div className="queue-item-header">
                  <div className="item-info">
                    <span className="status-icon">{getStatusIcon(item.status)}</span>
                    <div className="item-details">
                      <div className="item-title">
                        {t('videoRendering.subtitledVideo', 'Subtitled Video')} #{getVideoNumber(item)}
                      </div>
                      <div className="item-meta">
                        {item.settings.resolution} • {item.settings.frameRate}fps
                        {item.timestamp && (
                          <span className="item-time"> • {formatTime(item.timestamp)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="item-status">
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(item.status) }}
                    >
                      {t(`videoRendering.${item.status}`, item.status)}
                    </span>
                  </div>
                </div>

                {/* Progress Bar for processing items */}
                {(item.status === 'processing' || item.status === 'pending') && (
                  <div className="progress-section">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${item.progress || 0}%`,
                          backgroundColor: getStatusColor(item.status)
                        }}
                      ></div>
                    </div>
                    <div className="progress-text">
                      {item.status === 'processing' ? (
                        <>
                          {/* Fixed percentage container */}
                          <div className="progress-percentage-container">
                            <div className="progress-percentage">
                              {Math.round(item.progress || 0)}%
                            </div>
                          </div>

                          {/* Separate container for frame details */}
                          <div className="progress-frames-container">
                            {item.renderedFrames && item.durationInFrames ? (
                              <div className="progress-frames">
                                {`${item.renderedFrames}/${item.durationInFrames} ${t('videoRendering.frames', 'frames')}`}
                              </div>
                            ) : item.phaseDescription ? (
                              <div className="progress-frames">
                                {item.phaseDescription}
                              </div>
                            ) : (
                              <div className="progress-frames">
                                {t('videoRendering.renderingFrames', 'Processing video frames...')}
                              </div>
                            )}
                            {item.phase === 'encoding' && (
                              <div className="progress-phase encoding">
                                {t('videoRendering.encodingFrames', 'Encoding and stitching frames...')}
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        t('videoRendering.waiting', 'Waiting...')
                      )}
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {item.status === 'failed' && item.error && (
                  <div className="error-section">
                    <div className="error-message">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                      </svg>
                      {item.error}
                    </div>
                  </div>
                )}

                {/* Completed Video Info */}
                {item.status === 'completed' && item.outputPath && (
                  <div className="completed-section">
                    <div className="output-info">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      <span>{t('videoRendering.readyForDownload', 'Ready for download')}</span>
                    </div>
                    <button
                      onClick={() => handleDownloadVideo(item.outputPath, item)}
                      className="btn-base btn-success btn-compact download-btn-success"
                    >
                      {t('videoRendering.download', 'Download')}
                    </button>
                  </div>
                )}

                {/* Item Actions */}
                <div className="item-actions">
                  {item.status === 'processing' && onCancelItem && (
                    <button
                      className="cancel-btn"
                      onClick={() => onCancelItem(item.id)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="6" y="6" width="12" height="12"></rect>
                      </svg>
                      {t('videoRendering.cancel', 'Cancel')}
                    </button>
                  )}

                  {item.status !== 'processing' && (
                    <button
                      className="remove-btn"
                      onClick={() => onRemoveItem(item.id)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      {t('videoRendering.remove', 'Remove')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QueueManagerPanel;
