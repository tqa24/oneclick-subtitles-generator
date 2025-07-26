import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing fullscreen state and complex fullscreen transitions
 * @param {React.RefObject} videoRef - Reference to the video element
 * @param {object} subtitleSettings - Subtitle configuration for fullscreen overlay
 * @param {function} setControlsVisible - Function to control video controls visibility
 * @param {function} setIsVideoHovered - Function to control hover state
 * @returns {object} Fullscreen state and handlers
 */
export const useFullscreenManager = (videoRef, subtitleSettings, setControlsVisible, setIsVideoHovered) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Function to create fullscreen subtitle container
  const createFullscreenSubtitleContainer = useCallback(() => {
    console.log('🎬 SUBTITLE - Creating fullscreen subtitle container');

    let container = document.getElementById('fullscreen-subtitle-overlay');
    if (!container) {
      console.log('🎬 SUBTITLE - Container does not exist, creating new one');
      container = document.createElement('div');
      container.id = 'fullscreen-subtitle-overlay';
      container.style.position = 'fixed';
      container.style.left = '0';
      container.style.right = '0';
      container.style.bottom = '10%';
      container.style.width = `${subtitleSettings.boxWidth || '80'}%`;
      container.style.margin = '0 auto';
      container.style.textAlign = 'center';
      container.style.zIndex = '999999';
      container.style.pointerEvents = 'none';
      document.body.appendChild(container);
      console.log('🎬 SUBTITLE - Container created and added to body');
    } else {
      console.log('🎬 SUBTITLE - Container already exists, reusing');
      container.style.zIndex = '999999';
      container.style.position = 'fixed';
    }

    return container;
  }, [subtitleSettings.boxWidth]);

  // Function to handle fullscreen exit
  const handleFullscreenExit = useCallback(() => {
    console.log('🎬 MANUAL EXIT: Starting fullscreen exit process');

    // Try all exit fullscreen methods
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(console.error);
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }

    // Force state update if needed
    setTimeout(() => {
      const stillFullscreen = !!(document.fullscreenElement ||
                               document.webkitFullscreenElement ||
                               document.mozFullScreenElement ||
                               document.msFullscreenElement);
      if (!stillFullscreen) {
        console.log('🎬 MANUAL EXIT: Exiting fullscreen, resetting styles');
        resetFullscreenStyles();
        setIsFullscreen(false);
        setControlsVisible(false);
        setIsVideoHovered(false);
        console.log('🎬 MANUAL EXIT: Exit fullscreen styles reset');
      }
    }, 100);
  }, [setControlsVisible, setIsVideoHovered]);

  // Function to reset fullscreen styles
  const resetFullscreenStyles = useCallback(() => {
    const videoElement = document.querySelector('.native-video-container video');
    const videoWrapper = document.querySelector('.native-video-container .video-wrapper');
    const container = document.querySelector('.native-video-container');

    if (videoElement) {
      videoElement.style.removeProperty('width');
      videoElement.style.removeProperty('height');
      videoElement.style.removeProperty('object-fit');
      videoElement.style.removeProperty('position');
      videoElement.style.removeProperty('top');
      videoElement.style.removeProperty('left');
      videoElement.style.removeProperty('z-index');
      videoElement.style.removeProperty('max-width');
      videoElement.style.removeProperty('max-height');
      videoElement.style.removeProperty('min-width');
      videoElement.style.removeProperty('min-height');
      videoElement.style.removeProperty('transform');
      videoElement.style.removeProperty('border-radius');
      videoElement.classList.remove('fullscreen-video');
    }

    if (videoWrapper) {
      videoWrapper.style.removeProperty('width');
      videoWrapper.style.removeProperty('height');
      videoWrapper.style.removeProperty('position');
      videoWrapper.style.removeProperty('top');
      videoWrapper.style.removeProperty('left');
      videoWrapper.style.removeProperty('z-index');
      videoWrapper.style.removeProperty('overflow');
    }

    if (container) {
      container.style.removeProperty('width');
      container.style.removeProperty('height');
      container.style.removeProperty('position');
      container.style.removeProperty('top');
      container.style.removeProperty('left');
      container.style.removeProperty('z-index');
      container.style.removeProperty('background');
      container.style.removeProperty('display');
      container.style.removeProperty('padding');
      container.style.removeProperty('margin');
      container.style.cursor = 'default';
    }
  }, []);

  // Function to apply fullscreen styles
  const applyFullscreenStyles = useCallback(() => {
    const videoElement = videoRef.current;
    const container = document.querySelector('.native-video-container');

    if (videoElement) {
      console.log('🎬 APPLYING FULLSCREEN STYLES TO VIDEO');
      
      // Use setProperty with important flag to override any existing styles
      videoElement.style.setProperty('width', '100vw', 'important');
      videoElement.style.setProperty('height', '100vh', 'important');
      videoElement.style.setProperty('object-fit', 'fill', 'important');
      videoElement.style.setProperty('position', 'fixed', 'important');
      videoElement.style.setProperty('top', '0', 'important');
      videoElement.style.setProperty('left', '0', 'important');
      videoElement.style.setProperty('z-index', '1', 'important');
      videoElement.style.setProperty('max-width', 'none', 'important');
      videoElement.style.setProperty('max-height', 'none', 'important');
      videoElement.style.setProperty('min-width', '100vw', 'important');
      videoElement.style.setProperty('min-height', '100vh', 'important');
      videoElement.style.setProperty('transform', 'none', 'important');
      videoElement.style.setProperty('border-radius', '0', 'important');

      // Remove any conflicting attributes
      videoElement.removeAttribute('width');
      videoElement.removeAttribute('height');

      // Force video wrapper styles
      const videoWrapper = videoElement.closest('.video-wrapper');
      if (videoWrapper) {
        videoWrapper.style.setProperty('width', '100vw', 'important');
        videoWrapper.style.setProperty('height', '100vh', 'important');
        videoWrapper.style.setProperty('position', 'fixed', 'important');
        videoWrapper.style.setProperty('top', '0', 'important');
        videoWrapper.style.setProperty('left', '0', 'important');
        videoWrapper.style.setProperty('z-index', '1', 'important');
        videoWrapper.style.setProperty('overflow', 'hidden', 'important');
      }

      // Force container styles
      if (container) {
        container.style.setProperty('width', '100vw', 'important');
        container.style.setProperty('height', '100vh', 'important');
        container.style.setProperty('position', 'fixed', 'important');
        container.style.setProperty('top', '0', 'important');
        container.style.setProperty('left', '0', 'important');
        container.style.setProperty('z-index', '998', 'important');
        container.style.setProperty('display', 'block', 'important');
        container.style.setProperty('padding', '0', 'important');
        container.style.setProperty('margin', '0', 'important');
      }
    }
  }, [videoRef]);

  // Function to enter fullscreen
  const enterFullscreen = useCallback(() => {
    const container = document.querySelector('.native-video-container');
    if (!container) return;

    // Request fullscreen
    if (container.requestFullscreen) {
      container.requestFullscreen().catch(console.error);
    } else if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
    } else if (container.mozRequestFullScreen) {
      container.mozRequestFullScreen();
    } else if (container.msRequestFullscreen) {
      container.msRequestFullscreen();
    }
  }, []);

  // Handle fullscreen changes
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleFullscreenChange = () => {
      console.log('🎬 FULLSCREEN CHANGE EVENT TRIGGERED');
      const isDocFullscreen = !!(document.fullscreenElement ||
                               document.webkitFullscreenElement ||
                               document.mozFullScreenElement ||
                               document.msFullscreenElement);

      const container = document.querySelector('.native-video-container');
      const isVideoFullscreen = isDocFullscreen &&
                              (document.fullscreenElement === container ||
                               document.webkitFullscreenElement === container ||
                               document.mozFullScreenElement === container ||
                               document.msFullscreenElement === container);

      setIsFullscreen(isVideoFullscreen);

      if (!isVideoFullscreen) {
        setControlsVisible(false);
        setIsVideoHovered(false);
      }

      if (isVideoFullscreen) {
        console.log('🎬 ENTERING FULLSCREEN');
        createFullscreenSubtitleContainer();
        videoElement.classList.add('fullscreen-video');
        setControlsVisible(true);

        // Apply fullscreen styles after a short delay
        setTimeout(() => {
          applyFullscreenStyles();
        }, 100);
      } else {
        console.log('🎬 EXITING FULLSCREEN');
        
        // Remove the subtitle container
        const subtitleContainer = document.getElementById('fullscreen-subtitle-overlay');
        if (subtitleContainer) {
          document.body.removeChild(subtitleContainer);
        }
        videoElement.classList.remove('fullscreen-video');

        // Reset styles
        setTimeout(() => {
          resetFullscreenStyles();
          setIsFullscreen(false);
          setControlsVisible(false);
          setIsVideoHovered(false);
        }, 50);
      }
    };

    // Add event listeners for all browser variants
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // Add window-level listener to catch any missed fullscreen changes
    const handleWindowResize = () => {
      const isActuallyFullscreen = !!(document.fullscreenElement ||
                                     document.webkitFullscreenElement ||
                                     document.mozFullScreenElement ||
                                     document.msFullscreenElement);

      if (isFullscreen && !isActuallyFullscreen) {
        console.log('🎬 WINDOW RESIZE: Detected fullscreen state mismatch, forcing cleanup');
        handleFullscreenChange();
      }
    };

    window.addEventListener('resize', handleWindowResize);

    // Add ESC key listener
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isFullscreen) {
        console.log('🎬 ESC KEY: Detected ESC press while in fullscreen');
      }
    };

    document.addEventListener('keydown', handleEscKey);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      window.removeEventListener('resize', handleWindowResize);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [videoRef, isFullscreen, createFullscreenSubtitleContainer, applyFullscreenStyles, resetFullscreenStyles, setControlsVisible, setIsVideoHovered]);

  return {
    isFullscreen,
    enterFullscreen,
    handleFullscreenExit,
    createFullscreenSubtitleContainer
  };
};
