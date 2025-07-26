import React from 'react';
import { useTranslation } from 'react-i18next';
import LiquidGlass from '../../common/LiquidGlass';

/**
 * Component that handles all video loading, downloading, and error states
 * @param {object} props - Component props
 * @returns {JSX.Element} Loading states component
 */
const VideoLoadingStates = ({
  error,
  isDownloading,
  downloadProgress,
  isVideoLoading,
  isBuffering,
  isRenderingVideo,
  renderProgress,
  isRefreshingNarration
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* CSS Animation for spinner */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          .spinner {
            animation: spin 1s linear infinite;
          }

          .spinner-large {
            animation: spin 1s linear infinite;
          }

          .spinner .path {
            stroke: currentColor;
            stroke-linecap: round;
            stroke-dasharray: 90, 150;
            stroke-dashoffset: 0;
            stroke-width: 2;
          }

          .spinner-large .path {
            stroke: #6d84c7;
            stroke-linecap: round;
            stroke-dasharray: 90, 150;
            stroke-dashoffset: 0;
            stroke-width: 2;
          }
        `}
      </style>

      {/* Error Display */}
      {error && (
        <div className="error" style={{
          color: '#ff6b6b',
          background: 'rgba(255, 107, 107, 0.1)',
          border: '1px solid rgba(255, 107, 107, 0.3)',
          borderRadius: '8px',
          padding: '12px',
          margin: '10px 0',
          fontSize: '14px',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      {/* Video Download Progress */}
      {isDownloading && downloadProgress > 0 && (
        <div className="video-downloading" style={{
          background: 'rgba(0, 0, 0, 0.8)',
          borderRadius: '8px',
          padding: '16px',
          margin: '10px 0',
          textAlign: 'center'
        }}>
          <div className="download-progress" style={{
            width: '100%',
            height: '8px',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '8px'
          }}>
            <div 
              className="progress-bar" 
              style={{ 
                width: `${downloadProgress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #6d84c7, #8fa4d3)',
                borderRadius: '4px',
                transition: 'width 0.3s ease'
              }}
            />
          </div>
          <div className="download-text" style={{
            color: 'white',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            {t('preview.downloading', 'Downloading video...')} ({downloadProgress}%)
          </div>
        </div>
      )}

      {/* Video Rendering Progress */}
      {isRenderingVideo && (
        <div className="rendering-overlay" style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          borderRadius: '8px'
        }}>
          <div className="rendering-progress" style={{
            width: '80%',
            maxWidth: '300px',
            height: '8px',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '16px'
          }}>
            <div 
              className="progress-bar" 
              style={{ 
                width: `${renderProgress * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #6d84c7, #8fa4d3)',
                borderRadius: '4px',
                transition: 'width 0.3s ease'
              }}
            />
          </div>
          <div className="rendering-text" style={{
            color: 'white',
            fontSize: '16px',
            fontWeight: '500',
            textAlign: 'center'
          }}>
            {t('videoPreview.rendering', 'Rendering video with subtitles...')} ({Math.round(renderProgress * 100)}%)
          </div>
        </div>
      )}

      {/* Loading/Buffering Spinner */}
      {(isVideoLoading || isBuffering) && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 15
        }}>
          <LiquidGlass
            width={60}
            height={60}
            borderRadius="30px"
            className="content-center theme-primary shape-circle"
            effectIntensity={0.8}
            effectRadius={0.6}
            effectWidth={0.4}
            effectHeight={0.4}
            style={{
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                border: '3px solid rgba(255,255,255,0.3)',
                borderTop: '3px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            </div>
          </LiquidGlass>
        </div>
      )}

      {/* Narration Refresh Loading Overlay */}
      {isRefreshingNarration && (
        <div className="narration-refresh-overlay" style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          borderRadius: '8px'
        }}>
          <div className="narration-refresh-content" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px'
          }}>
            <svg className="spinner-large" width="48" height="48" viewBox="0 0 24 24">
              <circle className="path" cx="12" cy="12" r="10" fill="none" strokeWidth="3"></circle>
            </svg>
            <div className="narration-refresh-text" style={{
              color: 'white',
              fontSize: '16px',
              fontWeight: '500',
              textAlign: 'center'
            }}>
              {t('preview.refreshingNarration', 'Refreshing narration...')}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VideoLoadingStates;
