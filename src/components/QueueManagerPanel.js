import React from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/QueueManagerPanel.css';

const QueueManagerPanel = ({ 
  queue, 
  currentQueueItem, 
  onRemoveItem, 
  onClearQueue, 
  onRetryItem,
  isExpanded,
  onToggle 
}) => {
  const { t } = useTranslation();

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'processing':
        return '⚙️';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '📄';
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

  if (!isExpanded) {
    return (
      <div className="queue-manager-collapsed" onClick={onToggle}>
        <div className="collapsed-header">
          <span className="collapsed-icon">📋</span>
          <span className="collapsed-title">{t('videoRendering.renderQueue', 'Render Queue')}</span>
          <span className="collapsed-count">({queue.length})</span>
          <span className="expand-arrow">▶</span>
        </div>
      </div>
    );
  }

  return (
    <div className="queue-manager-panel">
      <div className="panel-header" onClick={onToggle}>
        <span className="panel-icon">📋</span>
        <span className="panel-title">{t('videoRendering.renderQueue', 'Render Queue')}</span>
        <span className="queue-count">({queue.length})</span>
        <span className="expand-arrow expanded">▼</span>
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
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="2" y="4" width="20" height="16" rx="2"></rect>
              <path d="M6 8h.01"></path>
              <path d="M10 8h.01"></path>
              <path d="M14 8h.01"></path>
              <path d="M18 8h.01"></path>
              <path d="M6 12h.01"></path>
              <path d="M10 12h.01"></path>
              <path d="M14 12h.01"></path>
              <path d="M18 12h.01"></path>
              <path d="M6 16h.01"></path>
              <path d="M10 16h.01"></path>
              <path d="M14 16h.01"></path>
              <path d="M18 16h.01"></path>
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
