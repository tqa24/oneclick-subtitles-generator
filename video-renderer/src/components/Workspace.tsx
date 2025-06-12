import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Player } from '@remotion/player';
import UploadForm from './UploadForm/UploadForm.component';
import SubtitledVideoContent from './SubtitledVideo';
import { RenderControl } from './RenderControl';
import VideoPreview from './VideoPreview';
import { LyricEntry, VideoMetadata, AudioFiles, SubtitleCustomization } from '../types';
import { analyzeAudio } from '../utils/audioAnalyzer';
import { useTabs } from '../contexts/TabsContext';
import { useLanguage } from '../contexts/LanguageContext';
import SubtitleCustomizationPanel, { defaultCustomization } from './SubtitleCustomization';

// Types and props
interface WorkspaceProps {
  tabId: string;
}

// Define a local AudioFiles type that matches what we're using in the component
interface LocalAudioFiles {
  main: File | null;
  narration: File | null;
}

const Workspace: React.FC<WorkspaceProps> = ({ tabId }) => {
  const { updateTabContent, activeWorkspace } = useTabs();
  const { t } = useLanguage();

  // Always declare hooks at the top level, regardless of conditions
  const [audioUrls, setAudioUrls] = useState({
    main: '',
    narration: ''
  });

  // Check if this workspace is active
  const isActiveWorkspace = activeWorkspace?.id === tabId;
  const workspaceData = activeWorkspace;

  // Update audio URLs when the workspace data changes
  useEffect(() => {
    if (!isActiveWorkspace || !workspaceData?.audioFiles) return;

    const processAudio = async () => {
      // Clean up previous object URLs
      Object.values(audioUrls).forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });

      const { main, narration } = workspaceData.audioFiles;

      const newAudioUrls = {
        main: main ? URL.createObjectURL(main) : '',
        narration: narration ? URL.createObjectURL(narration) : ''
      };

      setAudioUrls(newAudioUrls);

      // Perform audio analysis on all audio URLs
      for (const [key, url] of Object.entries(newAudioUrls)) {
        if (url) {
          try {
            await analyzeAudio(url);
          } catch (err) {
            console.error(`Error analyzing ${key} audio:`, err);
          }
        }
      }
    };

    processAudio();

    // Cleanup function for audio URLs
    return () => {
      Object.values(audioUrls).forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [isActiveWorkspace, workspaceData?.audioFiles]);  // Remove audioUrls from dependencies



  // If this workspace is not active, don't render it
  if (!isActiveWorkspace || !workspaceData || !workspaceData.$active) {
    return null;
  }

  const {
    audioFiles,
    subtitles,
    metadata,
    durationInSeconds,
    videoPath
  } = workspaceData;

  const handleFilesChange = async (
    newAudioFiles: AudioFiles,
    newLyrics: LyricEntry[] | null,
    newMetadata: VideoMetadata,
    newLyricsFile: File | null
  ) => {
    let newDuration = durationInSeconds;

    // Calculate duration if we have a new main audio file
    if (newAudioFiles.main && (!audioFiles?.main || newAudioFiles.main !== audioFiles.main)) {
      const audio = new Audio(URL.createObjectURL(newAudioFiles.main));
      await new Promise<void>(resolve => {
        audio.addEventListener('loadedmetadata', () => {
          newDuration = audio.duration;
          resolve();
        });
      });
    }

    // Ensure we have a consistent format for audioFiles matching our local definition
    const normalizedAudioFiles: LocalAudioFiles = {
      main: newAudioFiles.main,
      narration: newAudioFiles.narration || null
    };

    // Update the tab content all at once to ensure state consistency
    updateTabContent(tabId, {
      audioFiles: normalizedAudioFiles,
      subtitles: newLyrics,
      subtitlesFile: newLyricsFile,
      metadata: newMetadata,
      durationInSeconds: newDuration
    });

    // Tab name will remain as default since we removed title metadata
  };



  // Handle original audio volume change
  const handleOriginalAudioVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value, 10);
    updateTabContent(tabId, {
      metadata: {
        ...metadata,
        originalAudioVolume: newVolume
      }
    });
  };

  // Handle narration volume change
  const handleNarrationVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value, 10);
    updateTabContent(tabId, {
      metadata: {
        ...metadata,
        narrationVolume: newVolume
      }
    });
  };

  // Handle resolution change
  const handleResolutionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newResolution = e.target.value as '480p' | '720p' | '1080p' | '2K';

    // Save preference to localStorage
    try {
      localStorage.setItem('preferredResolution', newResolution);
    } catch (error) {
      console.error('Error saving resolution preference:', error);
    }

    // Update tab content
    updateTabContent(tabId, {
      metadata: {
        ...metadata,
        resolution: newResolution
      }
    });
  };

  // Handle frame rate change
  const handleFrameRateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFrameRate = parseInt(e.target.value, 10) as 30 | 60;

    // Save preference to localStorage
    try {
      localStorage.setItem('preferredFrameRate', e.target.value);
    } catch (error) {
      console.error('Error saving frame rate preference:', error);
    }

    // Update tab content
    updateTabContent(tabId, {
      metadata: {
        ...metadata,
        frameRate: newFrameRate
      }
    });
  };

  // Handle subtitle customization change
  const handleSubtitleCustomizationChange = (customization: SubtitleCustomization) => {
    updateTabContent(tabId, {
      metadata: {
        ...metadata,
        subtitleCustomization: customization
      }
    });
  };

  // Set video path when rendering is complete
  const handleRenderComplete = (path: string) => {
    updateTabContent(tabId, { videoPath: path });
  };

  // Calculate whether to show preview and render controls
  const canShowPreview = audioFiles?.main && subtitles && durationInSeconds > 0;
  // Add a 2-second buffer to ensure audio doesn't get cut off at the end
  const audioDurationWithBuffer = durationInSeconds + 2;
  const durationInFrames = Math.ceil(Math.max(60, audioDurationWithBuffer * metadata.frameRate));

  // Helper function to check if a file is a video
  const isVideoFile = (file: File | null): boolean => {
    if (!file) return false;
    const videoTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/mkv', 'video/webm', 'video/m4v', 'video/quicktime'];
    return videoTypes.includes(file.type);
  };

  // Check if the main audio file is actually a video
  const mainFileIsVideo = isVideoFile(audioFiles?.main || null);

  return (
    <WorkspaceContainer>
      <WorkspaceTopSection>
        <UploadFormCard data-tab-id={tabId}>
          <h2>{t('uploadFiles')}</h2>
          <UploadForm
            key={tabId} // Add this key to ensure each tab has its own instance
            onFilesChange={handleFilesChange}
            onVideoPathChange={(path: string) => updateTabContent(tabId, { videoPath: path })}
            initialValues={{
              audioFiles: {
                main: audioFiles.main,
                narration: audioFiles.narration || null
              },
              lyrics: subtitles,
              lyricsFile: workspaceData.subtitlesFile,
              metadata
            }}
          />
        </UploadFormCard>
      </WorkspaceTopSection>

      {/* Preview and controls - show only when we have enough data */}
      {canShowPreview && (
        <PreviewSection>
          <PreviewCard>
            <PreviewTitle>{t('videoPreview')}</PreviewTitle>
            <PreviewGrid>
              <PreviewContainer>
                <Player
                  key={`${tabId}-${metadata.videoType}-${audioUrls.main}-${audioUrls.narration}-${metadata.resolution}-${metadata.frameRate}`}
                  component={SubtitledVideoContent}
                  durationInFrames={durationInFrames}
                  compositionWidth={
                    metadata.resolution === '480p' ? 854 :
                    metadata.resolution === '720p' ? 1280 :
                    metadata.resolution === '2K' ? 2560 : 1920
                  }
                  compositionHeight={
                    metadata.resolution === '480p' ? 480 :
                    metadata.resolution === '720p' ? 720 :
                    metadata.resolution === '2K' ? 1440 : 1080
                  }
                  fps={metadata.frameRate}
                  controls
                  style={{
                    width: '100%',
                    aspectRatio: '16/9',
                  }}
                  inputProps={{
                    audioUrl: audioUrls.main,
                    narrationUrl: audioUrls.narration,
                    lyrics: subtitles || [],
                    metadata,
                    isVideoFile: mainFileIsVideo
                  }}
                />

                {/* Render Control moved inside the preview container */}
                <RenderControlContainer>
                  <RenderControl
                    audioFile={audioFiles.main}
                    lyrics={subtitles}
                    metadata={metadata}
                    onRenderComplete={handleRenderComplete}
                    narrationFile={audioFiles.narration || null}
                    isVideoFile={mainFileIsVideo}
                  />
                </RenderControlContainer>
              </PreviewContainer>

              <ControlPanelContainer>
                <h3>Audio Settings</h3>
                <SliderControl>
                  <SliderLabel>
                    Original Audio Volume
                    <SliderValue>{metadata.originalAudioVolume ?? 100}%</SliderValue>
                  </SliderLabel>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={metadata.originalAudioVolume ?? 100}
                    onChange={handleOriginalAudioVolumeChange}
                    step="1"
                  />
                  <SliderDescription>Adjust the volume of the original video/audio track.</SliderDescription>
                </SliderControl>

                {audioFiles?.narration && (
                  <SliderControl>
                    <SliderLabel>
                      Narration Volume
                      <SliderValue>{metadata.narrationVolume ?? 100}%</SliderValue>
                    </SliderLabel>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={metadata.narrationVolume ?? 100}
                      onChange={handleNarrationVolumeChange}
                      step="1"
                    />
                    <SliderDescription>Adjust the volume of the narration audio track.</SliderDescription>
                  </SliderControl>
                )}

                <h3>{t('videoSettings')}</h3>

                <SelectControl>
                  <SelectLabel>
                    {t('resolution')}
                  </SelectLabel>
                  <select
                    value={metadata.resolution}
                    onChange={handleResolutionChange}
                  >
                    <option value="480p">480p (854x480)</option>
                    <option value="720p">720p (1280x720)</option>
                    <option value="1080p">1080p (1920x1080)</option>
                    <option value="2K">2K (2560x1440)</option>
                  </select>
                  <SelectDescription>{t('resolutionDesc')}</SelectDescription>
                </SelectControl>

                <SelectControl>
                  <SelectLabel>
                    {t('frameRate')}
                  </SelectLabel>
                  <select
                    value={metadata.frameRate}
                    onChange={handleFrameRateChange}
                  >
                    <option value="30">30 FPS</option>
                    <option value="60">60 FPS</option>
                  </select>
                  <SelectDescription>{t('frameRateDesc')}</SelectDescription>
                </SelectControl>
              </ControlPanelContainer>
            </PreviewGrid>
          </PreviewCard>

          {/* Customization and Preview Grid */}
          <CustomizationGrid>
            {/* Sticky Preview Section */}
            <StickyPreviewContainer>
              <PreviewCard>
                <PreviewTitle>🎥 Video Preview</PreviewTitle>
                <PreviewContainer>
                  {audioUrls.main && subtitles && subtitles.length > 0 ? (
                    <Player
                      component={SubtitledVideoContent}
                      inputProps={{
                        audioUrl: audioUrls.main,
                        lyrics: subtitles,
                        metadata: metadata,
                        narrationUrl: audioUrls.narration,
                        isVideoFile: mainFileIsVideo
                      }}
                      durationInFrames={Math.ceil((subtitles[subtitles.length - 1]?.end || 30) * metadata.frameRate)}
                      compositionWidth={metadata.resolution === '2K' ? 2560 : metadata.resolution === '1080p' ? 1920 : metadata.resolution === '720p' ? 1280 : 854}
                      compositionHeight={metadata.resolution === '2K' ? 1440 : metadata.resolution === '1080p' ? 1080 : metadata.resolution === '720p' ? 720 : 480}
                      fps={metadata.frameRate}
                      style={{
                        width: '100%',
                        height: 'auto',
                        aspectRatio: '16/9'
                      }}
                      controls
                      loop
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      aspectRatio: '16/9',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '1.2rem',
                      textAlign: 'center',
                      padding: '20px',
                      borderRadius: '8px'
                    }}>
                      Upload audio and add subtitles to see preview
                    </div>
                  )}
                </PreviewContainer>
              </PreviewCard>
            </StickyPreviewContainer>

            {/* Customization Controls Section */}
            <CustomizationSection>
              {/* Subtitle Customization Panel */}
              <SubtitleCustomizationPanel
                customization={metadata.subtitleCustomization || defaultCustomization}
                onChange={handleSubtitleCustomizationChange}
              />

              {/* Render Control Panel */}
              <PreviewCard>
                <PreviewTitle>🎬 Render Video</PreviewTitle>
                <RenderControlContainer>
                  <RenderControl
                    audioFile={audioFiles.main}
                    lyrics={subtitles}
                    metadata={metadata}
                    onRenderComplete={handleRenderComplete}
                    narrationFile={audioFiles.narration || null}
                    isVideoFile={mainFileIsVideo}
                  />
                </RenderControlContainer>
              </PreviewCard>
            </CustomizationSection>
          </CustomizationGrid>
        </PreviewSection>
      )}

      {/* Final rendered video section */}
      {videoPath && (
        <FinalVideoSection>
          <VideoCard>
            <h2>{t('finalVideo')}</h2>
            <VideoPreview videoUrl={videoPath} />
          </VideoCard>
        </FinalVideoSection>
      )}
    </WorkspaceContainer>
  );
};

const WorkspaceContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
`;

const WorkspaceTopSection = styled.section`
  width: 100%;
`;

const PreviewSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
`;

const FinalVideoSection = styled.section`
  width: 100%;
`;

const UploadFormCard = styled.div`
  background: var(--card-background);
  border-radius: 8px;
  box-shadow: 0 4px 6px var(--shadow-color);
  padding: 1.5rem;
  transition: background-color 0.3s, box-shadow 0.3s;

  h2 {
    color: var(--heading-color);
    margin-bottom: 1.5rem;
    font-size: 1.6rem;
  }
`;

const PreviewCard = styled.div`
  background: var(--card-background);
  border-radius: 8px;
  box-shadow: 0 4px 6px var(--shadow-color);
  overflow: hidden;
  transition: background-color 0.3s, box-shadow 0.3s;
`;

const PreviewTitle = styled.h2`
  color: var(--heading-color);
  padding: 1.5rem;
  margin: 0;
  border-bottom: 1px solid var(--border-color);
  font-size: 1.6rem;
`;

const PreviewGrid = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const CustomizationGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
`;

const StickyPreviewContainer = styled.div`
  position: sticky;
  top: 20px;
  height: fit-content;
  max-height: calc(100vh - 40px);
  overflow-y: auto;

  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: var(--hover-color);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--accent-color);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: var(--accent-color-dark);
  }

  @media (max-width: 1200px) {
    position: static;
    max-height: none;
    overflow-y: visible;
  }
`;

const CustomizationSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const PreviewContainer = styled.div`
  padding: 1.5rem;
  border-right: 1px solid var(--border-color);

  @media (max-width: 980px) {
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }
`;

const ControlPanelContainer = styled.div`
  padding: 1.5rem;
  background-color: var(--hover-color);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;

  h3 {
    margin-top: 0;
    color: var(--heading-color);
    margin-bottom: 1rem;
  }
`;

const RenderControlContainer = styled.div`
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
`;

const VideoCard = styled.div`
  background: var(--card-background);
  border-radius: 8px;
  box-shadow: 0 4px 6px var(--shadow-color);
  padding: 1.5rem;
  transition: background-color 0.3s, box-shadow 0.3s;

  h2 {
    color: var(--heading-color);
    margin-bottom: 1.5rem;
    font-size: 1.6rem;
  }
`;

const SliderControl = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const SliderLabel = styled.label`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text-color);
`;

const SliderValue = styled.span`
  font-weight: bold;
  background-color: var(--input-background);
  color: var(--text-color);
  padding: 2px 6px;
  border-radius: 4px;
  min-width: 50px;
  text-align: center;
`;

const SliderDescription = styled.small`
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin-top: 0.25rem;
`;

const SelectControl = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  select {
    padding: 8px 12px;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    background-color: var(--input-background);
    color: var(--text-color);
    font-size: 0.95rem;
    cursor: pointer;

    &:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.2);
    }
  }
`;

const SelectLabel = styled.label`
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text-color);
`;

const SelectDescription = styled.small`
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin-top: 0.25rem;
`;

export default Workspace;