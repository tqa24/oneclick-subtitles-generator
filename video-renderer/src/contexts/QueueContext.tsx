import React, { createContext, useState, useContext, ReactNode } from 'react';
import { LyricEntry, VideoMetadata } from '../types';

// Define our queue item type
export interface QueueItem {
  id: string;
  audioFile: File;
  lyrics: LyricEntry[];
  metadata: VideoMetadata;
  narrationFile?: File | null;
  isVideoFile?: boolean; // Flag to indicate if the main file is a video
  status: 'pending' | 'processing' | 'complete' | 'error';
  progress: number;
  error?: string;
  result?: { [videoType: string]: string }; // videoType -> output URL
  singleVersion?: boolean; // Flag to indicate only render the current version
  allVersions?: boolean; // Flag to indicate render all versions
  currentVideoType?: string; // Currently processing video type
}

interface QueueContextType {
  queue: QueueItem[];
  addToQueue: (item: Omit<QueueItem, 'id' | 'status' | 'progress' | 'result'>) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  updateQueueItem: (id: string, updates: Partial<QueueItem>) => void;
  currentProcessingItem: string | null;
  setCurrentProcessingItem: (id: string | null) => void;
  isProcessing: boolean;
}

const QueueContext = createContext<QueueContextType | undefined>(undefined);

export const QueueProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentProcessingItem, setCurrentProcessingItem] = useState<string | null>(null);

  const addToQueue = (item: Omit<QueueItem, 'id' | 'status' | 'progress' | 'result'>) => {
    const newItem: QueueItem = {
      ...item,
      id: Date.now().toString(),
      status: 'pending',
      progress: 0,
      result: {}
    };

    setQueue(prevQueue => [...prevQueue, newItem]);
  };

  const removeFromQueue = (id: string) => {
    // Don't allow removing currently processing items
    if (id === currentProcessingItem) return;
    setQueue(prevQueue => prevQueue.filter(item => item.id !== id));
  };

  const clearQueue = () => {
    // Only clear non-processing items
    setQueue(prevQueue => prevQueue.filter(item => item.id === currentProcessingItem));
  };

  const updateQueueItem = (id: string, updates: Partial<QueueItem>) => {
    setQueue(prevQueue =>
      prevQueue.map(item =>
        item.id === id ? { ...item, ...updates } : item
      )
    );
  };

  const isProcessing = currentProcessingItem !== null;

  return (
    <QueueContext.Provider value={{
      queue,
      addToQueue,
      removeFromQueue,
      clearQueue,
      updateQueueItem,
      currentProcessingItem,
      setCurrentProcessingItem,
      isProcessing
    }}>
      {children}
    </QueueContext.Provider>
  );
};

export const useQueue = (): QueueContextType => {
  const context = useContext(QueueContext);
  if (!context) {
    throw new Error('useQueue must be used within a QueueProvider');
  }
  return context;
};