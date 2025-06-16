import React from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/QueueManagerPanel.css';

const QueueManagerPanel = ({
  queue,
  currentQueueItem,
  onRemoveItem,
  onClearQueue,
  onRetryItem
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
    return new Date(timestamp).toLocaleTimeString();
  };



  return (
    <div className="queue-manager-panel">
      <div className="panel-header">
        <svg className="panel-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span className="panel-title">{t('videoRendering.renderQueue', 'Render Queue')}</span>
        <span className="queue-count">{queue.length}</span>
      </div>

      <div className="panel-content">
        {queue.length > 0 && (
          <div className="queue-actions">
            <button 
              className="clear-queue-btn"
              onClick={onClearQueue}
              disabled={currentQueueItem !== null}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              {t('videoRendering.clearQueue', 'Clear Queue')}
            </button>
          </div>
        )}

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
          <div className="queue-list">
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
                        {t('videoRendering.subtitledVideo', 'Subtitled Video')} #{index + 1}
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
                      {item.status === 'processing' ? 
                        `${Math.round(item.progress || 0)}%` : 
                        t('videoRendering.waiting', 'Waiting...')
                      }
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
                    <a 
                      href={item.outputPath} 
                      download 
                      className="download-btn"
                    >
                      {t('videoRendering.download', 'Download')}
                    </a>
                  </div>
                )}

                {/* Item Actions */}
                <div className="item-actions">
                  {item.status === 'failed' && (
                    <button 
                      className="retry-btn"
                      onClick={() => onRetryItem(item.id)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                      </svg>
                      {t('videoRendering.retry', 'Retry')}
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
