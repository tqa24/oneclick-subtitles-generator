import React from 'react';
import LiquidGlass from '../../common/LiquidGlass';

/**
 * Custom video controls component with LiquidGlass styling
 * @param {object} props - Component props
 * @returns {JSX.Element} Video controls component
 */
const VideoControls = ({
  // Control state
  isPlaying,
  videoDuration,
  currentTime,
  volume,
  isMuted,
  playbackSpeed,
  bufferedProgress,
  
  // UI state
  showCustomControls,
  controlsVisible,
  isVideoHovered,
  isFullscreen,
  isDragging,
  dragTime,
  isVolumeSliderVisible,
  isVolumeDragging,
  isSpeedMenuVisible,
  
  // Setters
  setIsVolumeSliderVisible,
  setIsSpeedMenuVisible,
  
  // Actions
  togglePlayPause,
  handleVolumeChange,
  toggleMute,
  handleSpeedChange,
  handleTimelineMouseDown,
  handleTimelineTouchStart,
  handleVolumeMouseDown,
  
  // Fullscreen
  enterFullscreen,
  handleFullscreenExit
}) => {
  if (!showCustomControls) {
    return null;
  }

  const controlsOpacity = isFullscreen ? (controlsVisible ? 1 : 0) : (isVideoHovered || controlsVisible) ? 1 : 0;
  const controlsPointerEvents = isFullscreen ? (controlsVisible ? 'auto' : 'none') : (isVideoHovered || controlsVisible) ? 'auto' : 'none';

  return (
    <div
      className="custom-video-controls"
      style={{
        position: 'absolute',
        bottom: '0',
        left: '0',
        right: '0',
        height: '70px',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        zIndex: 10
      }}
    >
      {/* Play/Pause Button */}
      <LiquidGlass
        width={50}
        height={50}
        borderRadius="25px"
        className="content-center interactive theme-primary shape-circle"
        cursor="pointer"
        effectIntensity={0.6}
        effectRadius={0.5}
        effectWidth={0.3}
        effectHeight={0.3}
        animateOnHover={true}
        hoverScale={1.1}
        updateOnMouseMove={true}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        onClick={togglePlayPause}
        style={{
          marginRight: '15px',
          opacity: controlsOpacity,
          transition: 'opacity 0.3s ease-in-out',
          pointerEvents: controlsPointerEvents
        }}
      >
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {isPlaying ? (
            // Pause icon
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8))' }}>
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          ) : (
            // Play icon
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8))' }}>
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </div>
      </LiquidGlass>

      {/* Timeline/Progress Bar */}
      <div
        className="timeline-container"
        style={{
          flex: 1,
          height: '8px',
          minHeight: '8px',
          maxHeight: '8px',
          background: 'rgba(255, 255, 255, 0.16)',
          borderRadius: '4px',
          border: '1px solid rgba(0, 0, 0, 0.35)',
          position: 'relative',
          cursor: 'pointer',
          marginRight: '15px',
          touchAction: 'none',
          alignSelf: 'center',
          overflow: 'visible',
          margin: '0',
          opacity: controlsOpacity,
          transition: 'opacity 0.3s ease-in-out',
          pointerEvents: controlsPointerEvents
        }}
        onMouseDown={handleTimelineMouseDown}
        onTouchStart={handleTimelineTouchStart}
      >
        {/* Buffered progress (background) */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: `${bufferedProgress}%`,
          background: 'rgba(255, 255, 255, 0.19)',
          borderRadius: '4px',
          transition: 'width 0.3s ease'
        }} />

        {/* Progress fill */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: videoDuration > 0 ? `${((isDragging ? dragTime : currentTime) / videoDuration) * 100}%` : '0%',
          background: '#ffffffff',
          borderRadius: '4px',
          transition: isDragging ? 'none' : 'width 0.1s ease'
        }} />

        {/* Progress handle */}
        <div style={{
          position: 'absolute',
          left: videoDuration > 0 ? `${((isDragging ? dragTime : currentTime) / videoDuration) * 100}%` : '0%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: isDragging ? '38px' : '18px',
          height: isDragging ? '24px' : '18px',
          background: isDragging ? '#6d84c7ff' : 'white',
          borderRadius: '12px',
          boxShadow: isDragging ? '0 4px 8px rgba(0,0,0,0.5)' : '0 2px 4px rgba(0,0,0,0.3)',
          transition: isDragging ? 'none' : 'left 0.1s ease, width 0.2s ease, height 0.2s ease',
          cursor: 'pointer'
        }} />
      </div>

      {/* Time Display */}
      <div style={{
        color: 'white',
        fontSize: '12px',
        fontWeight: '500',
        marginRight: '15px',
        minWidth: '80px',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        opacity: controlsOpacity,
        transition: 'opacity 0.3s ease-in-out',
        pointerEvents: controlsPointerEvents,
        userSelect: 'none'
      }}>
        {Math.floor((isDragging ? dragTime : currentTime) / 60)}:{String(Math.floor((isDragging ? dragTime : currentTime) % 60)).padStart(2, '0')} / {Math.floor(videoDuration / 60)}:{String(Math.floor(videoDuration % 60)).padStart(2, '0')}
      </div>

      {/* Volume Control with Expanding Pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginRight: '15px',
          position: 'relative'
        }}
        onMouseEnter={() => setIsVolumeSliderVisible(true)}
        onMouseLeave={() => setIsVolumeSliderVisible(false)}
      >
        {/* Expanding Volume Pill */}
        <LiquidGlass
          width={50}
          height={isVolumeSliderVisible ? 180 : 50}
          borderRadius="25px"
          className="content-center interactive theme-secondary"
          cursor="pointer"
          effectIntensity={0.7}
          effectRadius={0.6}
          effectWidth={0.4}
          effectHeight={0.4}
          animateOnHover={true}
          hoverScale={1.02}
          updateOnMouseMove={true}
          style={{
            transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-in-out',
            transform: isVolumeSliderVisible ? 'translateY(-65px)' : 'translateY(0px)',
            transformOrigin: 'bottom center',
            opacity: controlsOpacity,
            pointerEvents: controlsPointerEvents
          }}
        >
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative'
          }}>
            {/* Volume Slider */}
            <div
              className="expanding-volume-slider"
              style={{
                width: '6px',
                height: '60px',
                background: 'rgba(255,255,255,0.3)',
                borderRadius: '3px',
                position: 'absolute',
                top: '50px',
                cursor: 'pointer',
                opacity: isVolumeSliderVisible ? 1 : 0,
                transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                pointerEvents: isVolumeSliderVisible ? 'auto' : 'none'
              }}
              onMouseDown={handleVolumeMouseDown}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const newVolume = Math.max(0, Math.min(1, (rect.bottom - e.clientY) / rect.height));
                handleVolumeChange(newVolume);
              }}
            >
              {/* Volume fill */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: '100%',
                height: `${volume * 100}%`,
                background: 'linear-gradient(to top, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.6) 100%)',
                borderRadius: '3px',
                backdropFilter: 'blur(4px)',
                boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3), 0 1px 3px rgba(0,0,0,0.2)',
                transition: isVolumeDragging ? 'none' : 'height 0.2s ease'
              }} />

              {/* Volume handle */}
              <div
                style={{
                  position: 'absolute',
                  bottom: `${volume * 100}%`,
                  left: '50%',
                  transform: 'translate(-50%, 50%)',
                  width: isVolumeDragging ? '18px' : '16px',
                  height: isVolumeDragging ? '18px' : '16px',
                  background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,1), rgba(255,255,255,0.95), rgba(255,255,255,0.85))',
                  borderRadius: '50%',
                  backdropFilter: 'blur(2px)',
                  boxShadow: isVolumeDragging
                    ? '0 4px 12px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.6), 0 0 8px rgba(255,255,255,0.4)'
                    : '0 2px 6px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.6), 0 0 4px rgba(255,255,255,0.3)',
                  border: '1px solid rgba(255,255,255,0.8)',
                  transition: isVolumeDragging ? 'none' : 'all 0.2s ease',
                  cursor: 'pointer',
                  zIndex: 10
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              />

              {/* Volume percentage indicator */}
              <div
                style={{
                  position: 'absolute',
                  top: '-35px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'white',
                  textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                  opacity: isVolumeDragging || isVolumeSliderVisible ? 1 : 0,
                  transition: 'opacity 0.2s ease',
                  pointerEvents: 'none',
                  zIndex: 15,
                  textAlign: 'center'
                }}
              >
                {Math.round(volume * 100)}%
              </div>
            </div>

            {/* Volume Icon */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '30px',
                height: '30px',
                cursor: 'pointer',
                position: 'absolute',
                bottom: '10px',
                left: '50%',
                transform: 'translateX(-50%)'
              }}
              onClick={toggleMute}
            >
              {isMuted || volume === 0 ? (
                // Muted icon
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8))' }}>
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                </svg>
              ) : volume < 0.5 ? (
                // Low volume icon
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8))' }}>
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                </svg>
              ) : (
                // High volume icon
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8))' }}>
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
              )}
            </div>
          </div>
        </LiquidGlass>
      </div>

      {/* Combined Actions Pill (Speed, Fullscreen) */}
      <div
        style={{
          position: 'relative',
          marginRight: '15px'
        }}
        onMouseEnter={() => setIsSpeedMenuVisible(true)}
        onMouseLeave={() => setIsSpeedMenuVisible(false)}
      >
        {/* Invisible hover area extension */}
        <div style={{
          position: 'absolute',
          top: '-200px',
          left: '-10px',
          right: '-10px',
          height: '200px',
          zIndex: 5
        }} />

        {/* Speed Menu */}
        {isSpeedMenuVisible && (
          <div style={{
            position: 'absolute',
            bottom: '60px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.8)',
            borderRadius: '8px',
            padding: '8px',
            minWidth: '80px',
            zIndex: 10,
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(speed => (
              <div
                key={speed}
                onClick={() => handleSpeedChange(speed)}
                style={{
                  padding: '6px 12px',
                  color: playbackSpeed === speed ? '#6d84c7' : 'white',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: playbackSpeed === speed ? '600' : '400',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                  backgroundColor: playbackSpeed === speed ? 'rgba(109, 132, 199, 0.2)' : 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (playbackSpeed !== speed) {
                    e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (playbackSpeed !== speed) {
                    e.target.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {speed}x
              </div>
            ))}
          </div>
        )}

        {/* Speed Control Button */}
        <LiquidGlass
          width={50}
          height={50}
          borderRadius="25px"
          className="content-center interactive theme-secondary shape-circle"
          cursor="pointer"
          effectIntensity={0.6}
          effectRadius={0.5}
          effectWidth={0.3}
          effectHeight={0.3}
          animateOnHover={true}
          hoverScale={1.1}
          updateOnMouseMove={true}
          style={{
            opacity: controlsOpacity,
            transition: 'opacity 0.3s ease-in-out',
            pointerEvents: controlsPointerEvents
          }}
        >
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: '600',
            color: 'white',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)'
          }}>
            {playbackSpeed}x
          </div>
        </LiquidGlass>
      </div>

      {/* Fullscreen Button */}
      <LiquidGlass
        width={50}
        height={50}
        borderRadius="25px"
        className="content-center interactive theme-primary shape-circle"
        cursor="pointer"
        effectIntensity={0.6}
        effectRadius={0.5}
        effectWidth={0.3}
        effectHeight={0.3}
        animateOnHover={true}
        hoverScale={1.1}
        updateOnMouseMove={true}
        aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        onClick={isFullscreen ? handleFullscreenExit : enterFullscreen}
        style={{
          opacity: controlsOpacity,
          transition: 'opacity 0.3s ease-in-out',
          pointerEvents: controlsPointerEvents
        }}
      >
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {isFullscreen ? (
            // Exit fullscreen icon
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8))' }}>
              <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
            </svg>
          ) : (
            // Fullscreen icon
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8))' }}>
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
            </svg>
          )}
        </div>
      </LiquidGlass>
    </div>
  );
};

export default VideoControls;
