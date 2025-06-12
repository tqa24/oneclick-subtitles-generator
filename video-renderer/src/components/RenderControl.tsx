import React, { useEffect } from 'react';
import styled from 'styled-components';

import { LyricEntry, Resolution } from '../types';


import remotionService from '../services/remotionService';
import { useQueue } from '../contexts/QueueContext';
import { useLanguage } from '../contexts/LanguageContext';



const Container = styled.div`
  margin: 0;
`;

const Button = styled.button`
  background: linear-gradient(135deg, var(--accent-color) 0%, #a777e3 100%);
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s ease;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    transform: translateY(-2px);
  }
`;



const CompactHeader = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 15px;

  h3 {
    margin: 0 0 5px 0;
    color: var(--heading-color);
  }
`;

const InfoText = styled.div`
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
`;

interface RenderControlProps {
  audioFile: File | null;
  lyrics: LyricEntry[] | null; // Keep as lyrics for backward compatibility
  metadata: {
    videoType: 'Subtitled Video';
    resolution: Resolution;
    frameRate: 30 | 60;
    originalAudioVolume: number;
    narrationVolume: number;
  };
  onRenderComplete: (videoPath: string) => void;
  narrationFile?: File | null;
  isVideoFile?: boolean; // Flag to indicate if the main file is a video
}

export const RenderControl: React.FC<RenderControlProps> = ({
  audioFile,
  lyrics: subtitles, // Rename parameter internally
  metadata,
  onRenderComplete,
  narrationFile,
  isVideoFile = false
}) => {
  const { t } = useLanguage();

  // Queue context
  const {
    queue,
    addToQueue,
    updateQueueItem,
    currentProcessingItem,
    setCurrentProcessingItem,
    isProcessing
  } = useQueue();

  const videoTypes = [
    'Subtitled Video'
  ] as const;

  // Check if we can add files to queue
  const canAddToQueue = audioFile &&
                     subtitles &&
                     Array.isArray(subtitles) &&
                     subtitles.length > 0;

  // Function to add current version to queue
  const handleAddCurrentVersionToQueue = () => {
    if (!canAddToQueue || !audioFile) return;

    addToQueue({
      audioFile,
      lyrics: subtitles || [],
      metadata: {
        ...metadata,
        videoType: metadata.videoType,
        resolution: metadata.resolution,
        frameRate: metadata.frameRate,
        originalAudioVolume: metadata.originalAudioVolume || 100,
        narrationVolume: metadata.narrationVolume || 100
      },
      narrationFile,
      isVideoFile,
      singleVersion: true
    });
  };

  // Function to add all versions to queue (now just adds the single subtitled video)
  const handleAddAllVersionsToQueue = async () => {
    if (!canAddToQueue || !audioFile) return;

    // For subtitled videos, there's only one type
    addToQueue({
      audioFile,
      lyrics: subtitles || [],
      metadata: {
        ...metadata,
        videoType: 'Subtitled Video',
        resolution: metadata.resolution,
        frameRate: metadata.frameRate,
        originalAudioVolume: metadata.originalAudioVolume || 100,
        narrationVolume: metadata.narrationVolume || 100
      },
      narrationFile,
      isVideoFile,
      singleVersion: true
    });
  };

  // Process queue
  useEffect(() => {
    const processNextQueueItem = async () => {
      // If already processing or queue is empty, do nothing
      let currentItemId: string | null = null;
      if (isProcessing || queue.length === 0) return;

      // Find the first pending item
      const nextItem = queue.find(item => item.status === 'pending');
      if (!nextItem) return;

      // Set as currently processing
      currentItemId = nextItem.id;
      setCurrentProcessingItem(nextItem.id);
      updateQueueItem(nextItem.id, { status: 'processing', progress: 0 });

      try {
        const results: { [videoType: string]: string } = {};

        // Process either all video types or just the selected one based on queue item flags
        const typesToProcess = nextItem.singleVersion ? [nextItem.metadata.videoType] : videoTypes;

        for (const videoType of typesToProcess) {
          // Update for current video type
          updateQueueItem(nextItem.id, {
            progress: 0,
            currentVideoType: videoType
          });

          // Create configuration for narration audio if available
          const typeSpecificAudioConfig: { [key: string]: string } = {};
          if (nextItem.narrationFile) {
            typeSpecificAudioConfig.narrationUrl = URL.createObjectURL(nextItem.narrationFile);
          }

          // Render this video version
          const videoPath = await remotionService.renderVideo(
            nextItem.audioFile,
            nextItem.lyrics,
            {
              metadata: { ...nextItem.metadata, videoType },
              isVideoFile: nextItem.isVideoFile,
              ...typeSpecificAudioConfig
            },
            (progress) => {
              // Only update if this is still the current processing item
              const currentItemId = nextItem.id; // Store the ID at render start
              // Compare against stored ID rather than currentProcessingItem
              if (nextItem.id === currentItemId) {
                if (progress.status === 'error') {
                  updateQueueItem(nextItem.id, {
                    error: `Error rendering ${videoType}: ${progress.error}`
                  });
                } else {
                  updateQueueItem(nextItem.id, {
                    progress: progress.progress
                  });
                }
              }
            }
          );

          // Add result for this video type
          results[videoType] = videoPath;

          // Clean up URLs
          Object.values(typeSpecificAudioConfig).forEach(url => URL.revokeObjectURL(url));
        }

        // Mark as complete with results
        updateQueueItem(nextItem.id, {
          status: 'complete',
          progress: 1,
          result: results
        });
      } catch (err) {
        // Mark as error
        updateQueueItem(nextItem.id, {
          status: 'error',
          error: err instanceof Error ? err.message : 'An unknown error occurred'
        });
      } finally {
        // Clear current processing item
        setCurrentProcessingItem(null);
        currentItemId = null;
      }
    };

    // Process next item if available
    processNextQueueItem();
  }, [queue, isProcessing, currentProcessingItem, videoTypes]);



  return (
    <Container>
      <CompactHeader>
        <h3>{t('renderVideo')}</h3>
        <InfoText>
          {t('videosRenderedNote')}
        </InfoText>
      </CompactHeader>

      <ButtonContainer>
        <Button
          onClick={handleAddCurrentVersionToQueue}
          disabled={!canAddToQueue}
          style={{ background: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)', flex: 1 }}
        >
          {t('addToQueue')}
        </Button>

        <Button
          onClick={handleAddAllVersionsToQueue}
          disabled={!canAddToQueue}
          style={{ background: 'linear-gradient(135deg, #E91E63 0%, #C2185B 100%)', flex: 1 }}
        >
          {t('addAllVersions')}
        </Button>
      </ButtonContainer>


    </Container>
  );
};

// Updating styled components for theme
const ButtonContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
`;


