import React from 'react';
import { useTranslation } from 'react-i18next';
import LiquidGlass from '../../common/LiquidGlass';
import MaterialSwitch from '../../common/MaterialSwitch';

/**
 * Component that renders action buttons for video preview (refresh narration, download audio, quality toggle)
 * @param {object} props - Component props
 * @returns {JSX.Element} Action buttons component
 */
const VideoActionButtons = ({
  // State
  isLoaded,
  isVideoHovered,
  controlsVisible,
  isFullscreen,
  isAudioDownloading,
  hasOptimizedVersion,
  useOptimizedPreview,
  optimizedVideoInfo,
  
  // Actions
  handleRefreshNarration,
  handleDownloadAudio,
  setUseOptimizedPreview,
  setIsRefreshingNarration,
  
  // Video ref for narration refresh
  videoRef
}) => {
  const { t } = useTranslation();

  const buttonOpacity = isFullscreen ? (controlsVisible ? 1 : 0) : (isVideoHovered || controlsVisible) ? 1 : 0;
  const buttonPointerEvents = isFullscreen ? (controlsVisible ? 'auto' : 'none') : (isVideoHovered || controlsVisible) ? 'auto' : 'none';

  return (
    <>
      {/* Video Quality Toggle - only show when optimized video is available */}
      {hasOptimizedVersion && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 10,
          opacity: buttonOpacity,
          transition: 'opacity 0.3s ease-in-out',
          pointerEvents: buttonPointerEvents
        }}>
          <LiquidGlass
            width={200}
            height={60}
            borderRadius="30px"
            className="content-center interactive theme-secondary"
            cursor="pointer"
            effectIntensity={0.6}
            effectRadius={0.5}
            effectWidth={0.3}
            effectHeight={0.2}
            animateOnHover={true}
            hoverScale={1.02}
            updateOnMouseMove={false}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '0 16px'
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start'
              }}>
                <span style={{
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: '600',
                  marginBottom: '2px'
                }}>
                  {useOptimizedPreview ? 'Optimized' : 'Original'} Quality
                </span>
                {optimizedVideoInfo && (
                  <span style={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '10px'
                  }}>
                    {useOptimizedPreview 
                      ? `${optimizedVideoInfo.resolution} • ${optimizedVideoInfo.fps}fps`
                      : 'Full Quality'
                    }
                  </span>
                )}
              </div>
              <MaterialSwitch
                checked={useOptimizedPreview}
                onChange={(checked) => {
                  setUseOptimizedPreview(checked);
                  localStorage.setItem('use_optimized_preview', checked.toString());
                }}
                size="small"
              />
            </div>
          </LiquidGlass>
        </div>
      )}

      {/* Refresh Narration Button - only show when video is loaded */}
      {isLoaded && (
        <LiquidGlass
          width={180}
          height={50}
          position="absolute"
          top="10px"
          left="10px"
          borderRadius="25px"
          className="content-center interactive theme-primary"
          cursor="pointer"
          zIndex={10}
          effectIntensity={0.6}
          effectRadius={0.5}
          effectWidth={0.3}
          effectHeight={0.2}
          animateOnHover={true}
          hoverScale={1.05}
          updateOnMouseMove={false}
          style={{
            opacity: buttonOpacity,
            transition: 'opacity 0.3s ease-in-out',
            pointerEvents: buttonPointerEvents
          }}
          aria-label={t('preview.refreshNarration', 'Refresh Narration')}
          onClick={async () => {
            try {
              // Pause the video if it's playing
              if (videoRef.current && !videoRef.current.paused) {
                videoRef.current.pause();
              }

              // Call the refresh narration handler
              await handleRefreshNarration(setIsRefreshingNarration);
            } catch (error) {
              console.error('Error refreshing narration:', error);
              setIsRefreshingNarration(false);
            }
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            height: '100%'
          }}>
            {/* Refresh icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            <span style={{
              color: 'white',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              {t('preview.refreshNarration', 'Refresh Narration')}
            </span>
          </div>
        </LiquidGlass>
      )}

      {/* Download Audio Button - only show when video is loaded */}
      {isLoaded && (
        <LiquidGlass
          width={160}
          height={50}
          position="absolute"
          top="70px"
          left="10px"
          borderRadius="25px"
          className="content-center interactive theme-secondary"
          cursor="pointer"
          zIndex={10}
          effectIntensity={0.6}
          effectRadius={0.5}
          effectWidth={0.3}
          effectHeight={0.2}
          animateOnHover={true}
          hoverScale={1.05}
          updateOnMouseMove={false}
          style={{
            opacity: buttonOpacity,
            transition: 'opacity 0.3s ease-in-out',
            pointerEvents: buttonPointerEvents
          }}
          aria-label={t('preview.downloadAudio', 'Download Audio')}
          onClick={handleDownloadAudio}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            height: '100%'
          }}>
            {isAudioDownloading ? (
              // Loading spinner
              <>
                <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" style={{ color: 'white' }}>
                  <circle className="path" cx="12" cy="12" r="10" fill="none" strokeWidth="3"></circle>
                </svg>
                <span style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>
                  {t('preview.downloadingAudio', 'Downloading...')}
                </span>
              </>
            ) : (
              // Download icon
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                </svg>
                <span style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>
                  {t('preview.downloadAudio', 'Download Audio')}
                </span>
              </>
            )}
          </div>
        </LiquidGlass>
      )}

      {/* Spinner animation styles */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          .spinner {
            animation: spin 1s linear infinite;
          }

          .spinner .path {
            stroke: currentColor;
            stroke-linecap: round;
            stroke-dasharray: 90, 150;
            stroke-dashoffset: 0;
            stroke-width: 2;
          }
        `}
      </style>
    </>
  );
};

export default VideoActionButtons;
