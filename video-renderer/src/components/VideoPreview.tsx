import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useLanguage } from '../contexts/LanguageContext';
import { LyricEntry } from '../types';
import { Button, Flex } from './StyledComponents';

// Define the VideoType type for subtitled videos
type VideoType = 'Subtitled Video';

// Enhanced Props interface to support rich preview functionality
interface Props {
  videoUrl?: string;
  audioFiles?: {
    main: File | null;
    narration?: File | null;
  };
  lyrics?: LyricEntry[] | null;
  background?: File | null;
  videoType?: VideoType;

  addToQueue?: (videoType: VideoType) => void;
  addAllVersions?: () => void;
}

const PreviewContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const VideoContainer = styled.div`
  background-color: var(--card-background);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
`;

const Video = styled.video`
  width: 100%;
  height: 100%;
  border-radius: 8px;
`;

const PreviewPlaceholder = styled.div`
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--text-color);
  gap: 1rem;
  padding: 2rem;
  text-align: center;
`;

const MetadataPreview = styled.div`
  padding: 1.25rem;
  background-color: var(--hover-color);
  border-radius: 8px;
  margin-top: 1rem;
`;

const MetadataTitle = styled.h3`
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1.2rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.75rem;
`;

const MetadataRow = styled.div`
  display: flex;
  margin-bottom: 0.75rem;

  strong {
    width: 100px;
    color: var(--heading-color);
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 1rem;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const VideoPreview: React.FC<Props> = ({
  videoUrl = '',
  audioFiles,
  lyrics,
  background,
  videoType = 'Subtitled Video',
  addToQueue,
  addAllVersions
}) => {
  const { t } = useLanguage();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // For the actual implementation, this would involve more complex logic
  // to generate a preview image/video based on the assets
  useEffect(() => {
    // If there's an actual video URL, use that
    if (videoUrl) {
      setPreviewUrl(videoUrl);
      return;
    }

    // Otherwise, we could simulate or generate a preview
    // This is just a placeholder for your actual preview generation logic
    setPreviewUrl(null);
  }, [videoUrl, videoType, lyrics]);

  const hasAudioFile = audioFiles?.main !== null;
  const hasRequiredData = hasAudioFile;

  return (
    <PreviewContainer>
      <VideoContainer>
        {previewUrl ? (
          <Video controls>
            <source src={previewUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </Video>
        ) : (
          <PreviewPlaceholder>
            {hasRequiredData ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                  <path d="M9.5 16V8l7 4-7 4z"/>
                </svg>
                <div>
                  <h3>Subtitled Video</h3>
                  <p>{t('videoType')}: {t(videoType.toLowerCase().replace(' ', ''))}</p>
                </div>
              </>
            ) : (
              <>
                <p>{t('noVideo')}</p>
                {!hasAudioFile && (
                  <p>{t('uploadAudioFirst')}</p>
                )}
              </>
            )}
          </PreviewPlaceholder>
        )}
      </VideoContainer>

      {hasRequiredData && (
        <>
          <MetadataPreview>
            <MetadataTitle>{t('videoDetails')}</MetadataTitle>
            <MetadataRow>
              <strong>{t('videoType')}:</strong>
              <span>{videoType}</span>
            </MetadataRow>
            <MetadataRow>
              <strong>{t('files')}:</strong>
              <span>
                {audioFiles?.main ? '✓ ' + t('mainAudio') : '✗ ' + t('mainAudio')}
                {lyrics ? ', ✓ ' + t('lyrics') : ''}
                {background ? ', ✓ ' + t('background') : ''}
              </span>
            </MetadataRow>
          </MetadataPreview>

          {addToQueue && addAllVersions && (
            <ButtonContainer>
              <Button onClick={() => addToQueue(videoType)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                {t('addToQueue')}
              </Button>
              <Button onClick={addAllVersions}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <line x1="17" y1="8" x2="7" y2="8"/>
                  <polyline points="12 3 7 8 12 13"/>
                  <line x1="17" y1="16" x2="7" y2="16"/>
                  <polyline points="12 21 7 16 12 11"/>
                </svg>
                {t('addAllVersions')}
              </Button>
            </ButtonContainer>
          )}
        </>
      )}
    </PreviewContainer>
  );
};

export default VideoPreview;