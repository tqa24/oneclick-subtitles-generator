import React from 'react';
import styled from 'styled-components';
import { Card, Badge, Button, Flex, ProgressBar, Tooltip } from './StyledComponents';
import { useLanguage } from '../contexts/LanguageContext';
import { useQueue } from '../contexts/QueueContext';
import type { QueueItem as QueueItemType } from '../contexts/QueueContext';

const QueueContainer = styled.div`
  width: 100%;
`;

const QueueItem = styled(Card)`
  margin-bottom: 1rem;
  padding: 1.25rem;
  background: var(--card-background);
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  }
`;

const QueueItemHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
`;

const QueueItemTitle = styled.div`
  font-weight: 600;
  color: var(--heading-color);
  display: flex;
  align-items: center;
  gap: 0.5rem;

  small {
    opacity: 0.7;
    font-weight: normal;
  }
`;

const QueueItemProgressWrapper = styled.div`
  margin: 0.75rem 0;
`;

const QueueItemActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.75rem;
`;

const RemoveButton = styled.button`
  background: none;
  border: none;
  color: var(--error-color);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  font-size: 0.9rem;
  transition: all 0.2s ease;

  &:hover {
    background-color: var(--error-background);
  }

  svg {
    margin-right: 0.25rem;
  }
`;

const StopButton = styled(RemoveButton)`
  color: var(--warning-color);

  &:hover {
    background-color: var(--warning-background, rgba(255, 152, 0, 0.1));
  }
`;

const EmptyQueue = styled.div`
  padding: 2rem;
  text-align: center;
  color: var(--text-color);
  opacity: 0.7;
  border: 2px dashed var(--border-color);
  border-radius: 8px;

  svg {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    color: var(--border-color);
  }

  p {
    margin: 0.5rem 0;
  }
`;

const ClearQueueButton = styled(Button)`
  margin-bottom: 1rem;
  background: linear-gradient(135deg, #f44336, #d32f2f);

  &:hover {
    background: linear-gradient(135deg, #d32f2f, #b71c1c);
  }
`;

// Icon components
const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

const FolderIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
);

const QueueEmptyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
);

export type QueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface QueueItemData {
  id: string;
  status: QueueItemStatus;
  progress: number;
  videoType: string;
  outputPath?: string;
  errorMessage?: string;
}

// We no longer need the props since we'll use the context
const QueueManager: React.FC = () => {
  const { t } = useLanguage();
  const { queue: queueItems, removeFromQueue, clearQueue: clearQueueContext, currentProcessingItem } = useQueue();

  // Sort queue items to ensure processing items are shown first,
  // and pending items maintain their original order
  const sortedQueueItems = [...queueItems].sort((a, b) => {
    // Processing items first
    if (a.id === currentProcessingItem) return -1;
    if (b.id === currentProcessingItem) return 1;
    // Then by status (complete items next)
    if (a.status === 'complete' && b.status !== 'complete') return -1;
    if (b.status === 'complete' && a.status !== 'complete') return 1;
    // Then by error status
    if (a.status === 'error' && b.status !== 'error') return -1;
    if (b.status === 'error' && a.status !== 'error') return 1;
    // Maintain original order for pending items
    return queueItems.indexOf(a) - queueItems.indexOf(b);
  });

  // Convert queue items to display data
  const queue = sortedQueueItems.map((item: QueueItemType) => {
    // Determine the actual display status
    let displayStatus: QueueItemStatus;
    let displayProgress: number;

    if (item.id === currentProcessingItem) {
      // This is the currently processing item
      displayStatus = 'processing';
      displayProgress = item.progress;
    } else if (item.status === 'complete') {
      // Item is complete
      displayStatus = 'completed';
      displayProgress = 1;
    } else if (item.status === 'error') {
      // Item has failed
      displayStatus = 'failed';
      displayProgress = 0;
    } else {
      // All other items should show as pending
      displayStatus = 'pending';
      displayProgress = 0;
    }

    return {
      id: item.id,
      status: displayStatus,
      progress: displayProgress,
      videoType: item.metadata.videoType,
      outputPath: item.result?.[item.metadata.videoType],
      errorMessage: item.error
    };
  });

  const removeQueueItem = (id: string) => {
    removeFromQueue(id);
  };

  const clearQueue = () => {
    // Only remove non-processing items
    queueItems.forEach((item: QueueItemType) => {
      if (item.id !== currentProcessingItem) {
        removeFromQueue(item.id);
      }
    });
  };

  const getBadgeVariant = (status: QueueItemStatus) => {
    switch(status) {
      case 'pending': return 'info';
      case 'processing': return 'warning';
      case 'completed': return 'success';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const getStatusColor = (status: QueueItemStatus) => {
    switch(status) {
      case 'pending': return 'var(--accent-color)';
      case 'processing': return 'var(--warning-color)';
      case 'completed': return 'var(--success-color)';
      case 'failed': return 'var(--error-color)';
      default: return 'var(--accent-color)';
    }
  };

  return (
    <QueueContainer>
      {queue.length > 0 && (
        <Flex justify="space-between" align="center" style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>{t('renderQueue')} ({queue.length})</h3>
          <ClearQueueButton onClick={clearQueue}>
            <TrashIcon /> {t('clearQueue')}
          </ClearQueueButton>
        </Flex>
      )}

      {queue.length === 0 ? (
        <EmptyQueue>
          <QueueEmptyIcon />
          <p>{t('noVideo')}</p>
          <p>Add videos to the queue to start rendering</p>
        </EmptyQueue>
      ) : (
        queue.map(item => (
          <QueueItem key={item.id}>
            <QueueItemHeader>
              <QueueItemTitle>
                Subtitled Video
                <small>({item.videoType})</small>
              </QueueItemTitle>
              <Badge variant={getBadgeVariant(item.status)}>
                {t(item.status)}
              </Badge>
            </QueueItemHeader>

            {(item.status === 'processing' || item.status === 'pending') && (
              <QueueItemProgressWrapper>
                <ProgressBar progress={item.progress * 100} color={getStatusColor(item.status)} />
                <div style={{ textAlign: 'right', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  {(item.progress * 100).toFixed(2)}%
                </div>
              </QueueItemProgressWrapper>
            )}

            {item.errorMessage && (
              <div style={{
                backgroundColor: 'var(--error-background)',
                color: 'var(--error-color)',
                padding: '0.75rem',
                borderRadius: '4px',
                marginTop: '0.75rem',
                fontSize: '0.9rem'
              }}>
                Error: {item.errorMessage}
              </div>
            )}

            <QueueItemActions>
              {item.status !== 'processing' && (
                <Tooltip data-tooltip="Remove from queue">
                  <RemoveButton onClick={() => removeQueueItem(item.id)}>
                    <TrashIcon /> {t('remove')}
                  </RemoveButton>
                </Tooltip>
              )}
            </QueueItemActions>
          </QueueItem>
        ))
      )}
    </QueueContainer>
  );
};

export default QueueManager;