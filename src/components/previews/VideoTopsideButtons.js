import React from 'react';
import { useTranslation } from 'react-i18next';
import LiquidGlass from '../common/LiquidGlass';
import { extractAndDownloadAudio } from '../../utils/fileUtils';

const VideoTopsideButtons = ({
  showCustomControls,
  isFullscreen,
  controlsVisible,
  isVideoHovered,
  isRefreshingNarration,
  setIsRefreshingNarration,
  isAudioDownloading,
  setIsAudioDownloading,
  setError,
  videoRef,
  videoSource,
  useOptimizedPreview,
  optimizedVideoUrl,
  videoUrl
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* Refresh Narration button - only show when custom controls are available */}
      {showCustomControls && (
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
            opacity: isFullscreen ? (controlsVisible ? 1 : 0) : (isVideoHovered || controlsVisible) ? 1 : 0,
            transition: 'opacity 0.6s ease-in-out',
            pointerEvents: isFullscreen ? (controlsVisible ? 'auto' : 'none') : (isVideoHovered || controlsVisible) ? 'auto' : 'none'
          }}
          aria-label={t('preview.refreshNarration', 'Refresh Narration')}
          onClick={async () => {
            try {
              // Pause the video if it's playing
              if (videoRef.current && !videoRef.current.paused) {
                videoRef.current.pause();
              }

              // Set refreshing state
              setIsRefreshingNarration(true);

              // Clear any existing aligned narration
              if (typeof window.resetAlignedNarration === 'function') {
                console.log('Clearing existing aligned narration before regeneration');
                window.resetAlignedNarration();
              }

              // Clean up any existing audio element
              if (window.alignedAudioElement) {
                try {
                  console.log('Cleaning up existing alignedAudioElement before regeneration');
                  window.alignedAudioElement.pause();
                  window.alignedAudioElement.src = '';
                  window.alignedAudioElement.load();
                  window.alignedAudioElement = null;
                } catch (e) {
                  console.warn('Error cleaning up existing alignedAudioElement:', e);
                }
              }

              // Remove existing event handlers
              if (window.alignedNarrationEventHandlers && videoRef.current) {
                const { handleVideoPlay, handleVideoPause, handleVideoSeeked, handleVideoTimeUpdate } = window.alignedNarrationEventHandlers;
                videoRef.current.removeEventListener('play', handleVideoPlay);
                videoRef.current.removeEventListener('pause', handleVideoPause);
                videoRef.current.removeEventListener('seeked', handleVideoSeeked);
                videoRef.current.removeEventListener('timeupdate', handleVideoTimeUpdate);
                window.alignedNarrationEventHandlers = null;
              }

              // Trigger regeneration by dispatching the event
              const regenerateEvent = new CustomEvent('regenerate-aligned-narration');
              window.dispatchEvent(regenerateEvent);

              // Set up direct playback after regeneration
              const setupDirectPlayback = () => {
                console.log('Setting up direct playback for aligned narration');

                // Create new audio element for aligned narration
                const audio = new Audio();
                audio.preload = 'auto';
                audio.volume = 1.0;

                // Store globally for cleanup
                window.alignedAudioElement = audio;

                // Load the aligned narration audio
                const alignedNarrationUrl = `http://localhost:3030/api/aligned-narration-audio`;
                console.log('Loading aligned narration audio from:', alignedNarrationUrl);
                audio.src = alignedNarrationUrl;

                // Set up event handlers for video-audio synchronization
                function handleVideoPlay() {
                  console.log('Video play detected, syncing aligned narration');
                  if (audio && videoRef.current) {
                    audio.currentTime = videoRef.current.currentTime;
                    const playPromise = audio.play();
                    if (playPromise !== undefined) {
                      playPromise.catch(error => {
                        console.error('Error playing aligned narration:', error);
                      });
                    }
                  }
                }

                function handleVideoPause() {
                  console.log('Video pause detected, pausing aligned narration');
                  if (audio) {
                    audio.pause();
                  }
                }

                function handleVideoSeeked() {
                  console.log('Video seeked, syncing aligned narration time');
                  if (audio) {
                    audio.currentTime = videoRef.current.currentTime;
                    if (!videoRef.current.paused) {
                      const playPromise = audio.play();
                      if (playPromise !== undefined) {
                        playPromise.catch(error => {
                          console.error('Error playing aligned narration after seek:', error);
                        });
                      }
                    }
                  }
                }

                function handleVideoTimeUpdate() {
                  // Only update if the difference is significant
                  if (audio && Math.abs(audio.currentTime - videoRef.current.currentTime) > 0.3) {
                    audio.currentTime = videoRef.current.currentTime;
                  }
                }

                // Add event listeners
                videoRef.current.addEventListener('play', handleVideoPlay);
                videoRef.current.addEventListener('pause', handleVideoPause);
                videoRef.current.addEventListener('seeked', handleVideoSeeked);
                videoRef.current.addEventListener('timeupdate', handleVideoTimeUpdate);

                // Store the event handlers on the window for cleanup
                window.alignedNarrationEventHandlers = {
                  handleVideoPlay,
                  handleVideoPause,
                  handleVideoSeeked,
                  handleVideoTimeUpdate
                };

                // If the video is playing, start playing the aligned narration
                if (videoRef.current && !videoRef.current.paused) {
                  console.log('Video is currently playing, starting aligned narration');
                  handleVideoPlay();
                }
              };

              // Set up direct playback
              setupDirectPlayback();

            } catch (error) {
              console.error('Error during aligned narration regeneration:', error);
            } finally {
              // Clear refreshing state
              setIsRefreshingNarration(false);
            }
          }}
          disabled={isRefreshingNarration}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            height: '100%',
            opacity: isRefreshingNarration ? 0.7 : 1,
            cursor: isRefreshingNarration ? 'not-allowed' : 'pointer'
          }}>
            {isRefreshingNarration ? (
              // Show loading spinner when refreshing
              <>
                <svg className="spinner" width="22" height="22" viewBox="0 0 24 24" style={{ color: 'white' }}>
                  <circle className="path" cx="12" cy="12" r="10" fill="none" strokeWidth="3"></circle>
                </svg>
                <span style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>
                  {t('preview.refreshingNarration', 'Refreshing...')}
                </span>
              </>
            ) : (
              // Show refresh icon when not refreshing
              <>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                  <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                </svg>
                <span style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>
                  {t('preview.refreshNarration', 'Refresh Narration')}
                </span>
              </>
            )}
          </div>
        </LiquidGlass>
      )}

      {/* Gemini FPS Info button - only show when custom controls are available */}
      {showCustomControls && (
        <LiquidGlass
          width={50}
          height={50}
          position="absolute"
          top="10px"
          left="200px"
          borderRadius="25px"
          className="content-center interactive theme-warning shape-circle"
          cursor="pointer"
          zIndex={10}
          effectIntensity={0.7}
          effectRadius={0.6}
          effectWidth={0.4}
          effectHeight={0.4}
          animateOnHover={true}
          hoverScale={1.1}
          updateOnMouseMove={true}
          aria-label="Gemini FPS Info"
          style={{
            opacity: isFullscreen ? (controlsVisible ? 1 : 0) : (isVideoHovered || controlsVisible) ? 1 : 0,
            transition: 'opacity 0.6s ease-in-out',
            pointerEvents: isFullscreen ? (controlsVisible ? 'auto' : 'none') : (isVideoHovered || controlsVisible) ? 'auto' : 'none'
          }}
          onClick={() => {
            window.open('https://ai.google.dev/gemini-api/docs/video-understanding', '_blank');
          }}
        >
          <div
            title="Gemini chỉ xử lý 1FPS dù gửi video có FPS cao, bấm nút để xem thêm, vui lòng chọn Render Video để có chất lượng + FPS tốt nhất"
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
          </div>
        </LiquidGlass>
      )}

      {/* Download audio button - only show when custom controls are available */}
      {showCustomControls && (
        <LiquidGlass
          width={160}
          height={50}
          position="absolute"
          top="10px"
          right="10px"
          borderRadius="25px"
          className={`content-center interactive ${isAudioDownloading ? 'theme-secondary' : 'theme-success'}`}
          cursor={isAudioDownloading ? 'not-allowed' : 'pointer'}
          zIndex={10}
          effectIntensity={isAudioDownloading ? 0.3 : 0.6}
          effectRadius={0.5}
          effectWidth={0.3}
          effectHeight={0.2}
          animateOnHover={!isAudioDownloading}
          hoverScale={1.05}
          updateOnMouseMove={false}
          aria-label={t('preview.downloadAudio', 'Download Audio')}
          style={{
            opacity: isFullscreen ? (controlsVisible ? 1 : 0) : (isVideoHovered || controlsVisible) ? 1 : 0,
            transition: 'opacity 0.6s ease-in-out',
            pointerEvents: isFullscreen ? (controlsVisible ? 'auto' : 'none') : (isVideoHovered || controlsVisible) ? 'auto' : 'none'
          }}
          onClick={async () => {
            if (isAudioDownloading) return; // Prevent multiple clicks

            // Get video title or use default
            const videoTitle = videoSource?.title || 'audio';
            // Use the current video URL (optimized or original)
            const currentVideoUrl = useOptimizedPreview && optimizedVideoUrl ? optimizedVideoUrl : videoUrl;

            // Show loading state
            setError('');
            setIsAudioDownloading(true);

            // Extract and download audio - our utility function now handles blob URLs properly
            const success = await extractAndDownloadAudio(currentVideoUrl, videoTitle);

            // Reset loading state
            setIsAudioDownloading(false);

            // Show error if failed
            if (!success) {
              setError(t('preview.audioExtractionError', 'Failed to extract audio from video. Please try again.'));

              // Clear error after 5 seconds
              setTimeout(() => {
                setError('');
              }, 5000);
            }
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            width: '100%',
            height: '100%',
            opacity: isAudioDownloading ? 0.7 : 1,
            cursor: isAudioDownloading ? 'not-allowed' : 'pointer'
          }}>
            {isAudioDownloading ? (
              // Material Design loading spinner
              <>
                <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" style={{ color: 'white' }}>
                  <circle className="path" cx="12" cy="12" r="10" fill="none" strokeWidth="3"></circle>
                </svg>
                <span style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>
                  {t('preview.downloadingAudio', 'Downloading...')}
                </span>
              </>
            ) : (
              // Material Design download icon
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
    </>
  );
};

export default VideoTopsideButtons;
