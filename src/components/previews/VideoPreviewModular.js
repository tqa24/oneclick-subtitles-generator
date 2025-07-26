import React from 'react';
import { useTranslation } from 'react-i18next';
import SubtitleSettings from '../SubtitleSettings';
import VideoPreviewContainer from './components/VideoPreviewContainer';
import { useSubtitleDisplay } from './hooks/useSubtitleDisplay';
import { useVideoDownloader } from './hooks/useVideoDownloader';
import { useVideoState } from './hooks/useVideoState';
import { SERVER_URL } from '../../config';

// Import styles
import '../../styles/common/material-switch.css';
import '../../styles/VideoPreview.css';
import '../../styles/narration/index.css';

/**
 * Modularized VideoPreview component
 * Maintains the same external API as the original while using extracted hooks and components
 */
const VideoPreview = ({ 
  currentTime, 
  setCurrentTime, 
  setDuration, 
  videoSource, 
  onSeek, 
  translatedSubtitles, 
  subtitlesArray, 
  onVideoUrlReady, 
  onReferenceAudioChange, 
  onRenderVideo 
}) => {
  const { t } = useTranslation();

  // Initialize hooks for subtitle settings and video downloading
  const subtitleDisplay = useSubtitleDisplay(
    currentTime,
    subtitlesArray,
    translatedSubtitles,
    false // Not in fullscreen for this context
  );

  const videoState = useVideoState(videoSource, onVideoUrlReady);

  const videoDownloader = useVideoDownloader(
    videoState.effectiveVideoUrl,
    videoSource,
    subtitlesArray,
    translatedSubtitles,
    subtitleDisplay.subtitleSettings
  );

  // CSS for hiding native video controls and fullscreen styling
  const videoControlsCSS = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Force hide native video controls in all states including fullscreen */
    .video-player::-webkit-media-controls {
      display: none !important;
    }
    .video-player::-webkit-media-controls-panel {
      display: none !important;
    }
    .video-player::-webkit-media-controls-play-button {
      display: none !important;
    }
    .video-player::-webkit-media-controls-timeline {
      display: none !important;
    }
    .video-player::-webkit-media-controls-current-time-display {
      display: none !important;
    }
    .video-player::-webkit-media-controls-time-remaining-display {
      display: none !important;
    }
    .video-player::-webkit-media-controls-mute-button {
      display: none !important;
    }
    .video-player::-webkit-media-controls-volume-slider {
      display: none !important;
    }
    .video-player::-webkit-media-controls-fullscreen-button {
      display: none !important;
    }
    .video-player::-webkit-media-controls-overlay-play-button {
      display: none !important;
    }

    /* Firefox */
    .video-player::-moz-media-controls {
      display: none !important;
    }

    /* Edge/IE */
    .video-player::-ms-media-controls {
      display: none !important;
    }

    /* Additional fallback */
    .video-player {
      outline: none !important;
    }
    .video-player:focus {
      outline: none !important;
    }

    /* Fullscreen container styling */
    .native-video-container:fullscreen {
      width: 100vw !important;
      height: 100vh !important;
      background: black !important;
      position: relative !important;
      display: block !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    .native-video-container:-webkit-full-screen {
      width: 100vw !important;
      height: 100vh !important;
      background: black !important;
      position: relative !important;
      display: block !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    .native-video-container:-moz-full-screen {
      width: 100vw !important;
      height: 100vh !important;
      background: black !important;
      position: relative !important;
      display: block !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    .native-video-container:-ms-fullscreen {
      width: 100vw !important;
      height: 100vh !important;
      background: black !important;
      position: relative !important;
      display: block !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    /* Video in fullscreen */
    .native-video-container:fullscreen .video-player,
    .native-video-container:-webkit-full-screen .video-player,
    .native-video-container:-moz-full-screen .video-player,
    .native-video-container:-ms-fullscreen .video-player {
      width: 100vw !important;
      height: 100vh !important;
      max-width: none !important;
      max-height: none !important;
      min-width: 100vw !important;
      min-height: 100vh !important;
      object-fit: fill !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      z-index: 1000 !important;
      transform: none !important;
    }

    /* Video wrapper in fullscreen */
    .native-video-container:fullscreen .video-wrapper,
    .native-video-container:-webkit-full-screen .video-wrapper,
    .native-video-container:-moz-full-screen .video-wrapper,
    .native-video-container:-ms-fullscreen .video-wrapper {
      width: 100vw !important;
      height: 100vh !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      z-index: 1 !important;
    }

    /* Force video element to fill in fullscreen */
    .native-video-container:fullscreen video,
    .native-video-container:-webkit-full-screen video,
    .native-video-container:-moz-full-screen video,
    .native-video-container:-ms-fullscreen video,
    .native-video-container:fullscreen .video-player,
    .native-video-container:-webkit-full-screen .video-player,
    .native-video-container:-moz-full-screen .video-player,
    .native-video-container:-ms-fullscreen .video-player {
      width: 100vw !important;
      height: 100vh !important;
      object-fit: fill !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      z-index: 1000 !important;
      transform: none !important;
      max-width: none !important;
      max-height: none !important;
      min-width: 100vw !important;
      min-height: 100vh !important;
      cursor: pointer !important;
      touch-action: manipulation !important;
    }
  `;

  return (
    <div className="video-preview">
      {/* CSS Animation for spinner and hide native controls */}
      <style>{videoControlsCSS}</style>

      <div className="video-preview-header">
        <h3>{t('output.videoPreview', 'Video Preview with Subtitles')}</h3>
        <SubtitleSettings
          settings={subtitleDisplay.subtitleSettings}
          onSettingsChange={subtitleDisplay.setSubtitleSettings}
          onDownloadWithSubtitles={videoDownloader.handleDownloadWithSubtitles}
          onDownloadWithTranslatedSubtitles={videoDownloader.handleDownloadWithTranslatedSubtitles}
          hasTranslation={translatedSubtitles && translatedSubtitles.length > 0}
          translatedSubtitles={translatedSubtitles}
          targetLanguage={translatedSubtitles && translatedSubtitles.length > 0 && translatedSubtitles[0].language}
          videoRef={null} // Will be handled by VideoPreviewContainer
          originalNarrations={window.originalNarrations || (() => {
            try {
              const stored = localStorage.getItem('originalNarrations');
              return stored ? JSON.parse(stored) : [];
            } catch (e) {
              console.error('Error parsing originalNarrations from localStorage:', e);
              return [];
            }
          })()}
          translatedNarrations={window.translatedNarrations || (() => {
            try {
              const stored = localStorage.getItem('translatedNarrations');
              return stored ? JSON.parse(stored) : [];
            } catch (e) {
              console.error('Error parsing translatedNarrations from localStorage:', e);
              return [];
            }
          })()}
          {...(() => {
            // Store subtitles data in window for access by other components
            if (subtitlesArray && subtitlesArray.length > 0) {
              window.subtitlesData = subtitlesArray;
              window.originalSubtitles = subtitlesArray;
              if (process.env.NODE_ENV === 'development' && !window._loggedSubtitlesData) {
                console.log('[VideoPreview] Stored subtitles data in window object');
                window._loggedSubtitlesData = true;
              }
            }
            
            // Store translated subtitles if available
            if (translatedSubtitles && translatedSubtitles.length > 0) {
              window.translatedSubtitles = translatedSubtitles;
              if (process.env.NODE_ENV === 'development' && !window._loggedTranslatedSubtitles) {
                console.log('[VideoPreview] Stored translated subtitles in window object');
                window._loggedTranslatedSubtitles = true;
              }
            }
            return {};
          })()}
          getAudioUrl={(filename) => `${SERVER_URL}/narration/audio/${filename || 'test.wav'}`}
          onRenderVideo={onRenderVideo}
        />
      </div>

      {/* Video Preview Container */}
      <VideoPreviewContainer
        currentTime={currentTime}
        setCurrentTime={setCurrentTime}
        setDuration={setDuration}
        videoSource={videoSource}
        onSeek={onSeek}
        translatedSubtitles={translatedSubtitles}
        subtitlesArray={subtitlesArray}
        onVideoUrlReady={onVideoUrlReady}
        onReferenceAudioChange={onReferenceAudioChange}
        onRenderVideo={onRenderVideo}
      />
    </div>
  );
};

export default VideoPreview;
