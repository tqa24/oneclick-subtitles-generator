import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import '../../styles/narration/narrationPlaybackMenu.css';

/**
 * Narration Playback Menu component
 * Provides controls for playing narration voices with the video
 *
 * @param {Object} props - Component props
 * @param {Array} props.originalNarrations - Original narration audio files
 * @param {Array} props.translatedNarrations - Translated narration audio files
 * @param {Object} props.videoRef - Reference to the video element
 * @param {Function} props.getAudioUrl - Function to get audio URL from filename
 * @returns {JSX.Element} - Rendered component
 */
const NarrationPlaybackMenu = ({
  originalNarrations = [],
  translatedNarrations = [],
  videoRef,
  getAudioUrl
}) => {
  // Log props for debugging
  console.log('NarrationPlaybackMenu props:', {
    originalNarrations: originalNarrations?.length || 0,
    translatedNarrations: translatedNarrations?.length || 0,
    videoRef: !!videoRef,
    getAudioUrl: !!getAudioUrl
  });
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [narrationSource, setNarrationSource] = useState('original'); // 'original' or 'translated'
  const [narrationVolume, setNarrationVolume] = useState(0.8); // 0 to 1
  const [videoVolume, setVideoVolume] = useState(0.3); // 0 to 1
  const [activeNarrations, setActiveNarrations] = useState([]);
  const [currentNarration, setCurrentNarration] = useState(null);

  // Refs for audio elements
  const audioRefs = useRef({});
  const menuRef = useRef(null);

  // Initialize active narrations based on selected source
  useEffect(() => {
    setActiveNarrations(narrationSource === 'original' ? originalNarrations : translatedNarrations);
  }, [narrationSource, originalNarrations, translatedNarrations]);

  // Update video volume when it changes
  useEffect(() => {
    if (videoRef && videoRef.current) {
      videoRef.current.volume = videoVolume;
    }
  }, [videoVolume, videoRef]);

  // Handle video timeupdate to trigger narration playback
  useEffect(() => {
    const handleTimeUpdate = () => {
      if (!isPlaying || !videoRef?.current) return;

      const currentTime = videoRef.current.currentTime;

      // Find narrations that should be playing at the current time
      activeNarrations.forEach(narration => {
        const subtitle = narration.subtitle || {};
        const start = parseFloat(subtitle.start) || 0;
        const end = parseFloat(subtitle.end) || 0;

        // Calculate the middle point of the subtitle
        const midPoint = (start + end) / 2;

        // Define a window around the midpoint when narration should play
        // This can be adjusted based on the narration length
        const narrationDuration = 3; // Estimated duration in seconds
        const startPlay = midPoint - (narrationDuration / 2);
        const endPlay = midPoint + (narrationDuration / 2);

        // Check if current time is within the play window
        if (currentTime >= startPlay && currentTime <= endPlay) {
          // If we're not already playing this narration, play it
          if (currentNarration?.id !== narration.subtitle_id) {
            playNarration(narration);
          }
        }
      });
    };

    // Add event listener to video
    if (videoRef && videoRef.current && isPlaying) {
      videoRef.current.addEventListener('timeupdate', handleTimeUpdate);
    }

    return () => {
      // Clean up event listener
      if (videoRef && videoRef.current) {
        videoRef.current.removeEventListener('timeupdate', handleTimeUpdate);
      }
    };
  }, [isPlaying, activeNarrations, currentNarration, videoRef]);

  // Play a specific narration
  const playNarration = (narration) => {
    // Stop any currently playing narration
    if (currentNarration && audioRefs.current[currentNarration.id]) {
      audioRefs.current[currentNarration.id].pause();
    }

    // Set the current narration
    setCurrentNarration(narration);

    // Get or create audio element for this narration
    if (!audioRefs.current[narration.subtitle_id]) {
      const audio = new Audio(getAudioUrl(narration.filename));
      audio.volume = narrationVolume;
      audioRefs.current[narration.subtitle_id] = audio;
    }

    // Play the narration
    const audioElement = audioRefs.current[narration.subtitle_id];
    audioElement.volume = narrationVolume;
    audioElement.currentTime = 0;
    audioElement.play();
  };

  // Toggle narration playback
  const togglePlayback = () => {
    if (isPlaying) {
      // Stop playback
      setIsPlaying(false);

      // Pause any playing narration
      if (currentNarration && audioRefs.current[currentNarration.id]) {
        audioRefs.current[currentNarration.id].pause();
      }

      setCurrentNarration(null);
    } else {
      // Start playback
      setIsPlaying(true);
    }
  };

  // Toggle menu open/closed
  const toggleMenu = () => {
    console.log('Toggle menu called, current state:', isOpen);
    setIsOpen(prevState => {
      const newState = !prevState;
      console.log('Setting isOpen to:', newState);
      return newState;
    });
  };

  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    // Only add the event listener when the menu is open
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Add escape key listener
      const handleEscKey = (event) => {
        if (event.key === 'Escape') {
          setIsOpen(false);
        }
      };
      document.addEventListener('keydown', handleEscKey);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscKey);
      };
    }
  }, [isOpen]);

  // Update all audio volumes when narration volume changes
  useEffect(() => {
    Object.values(audioRefs.current).forEach(audio => {
      audio.volume = narrationVolume;
    });
  }, [narrationVolume]);

  // Log state for debugging
  console.log('NarrationPlaybackMenu state:', { isOpen });

  return (
    <div className={`narration-playback-container ${isOpen ? 'open' : ''}`} ref={menuRef}>
      <button
        className="narration-playback-toggle"
        onClick={toggleMenu}
        title={t('narration.playbackMenu', 'Narration Playback')}
        style={{ backgroundColor: '#2196F3', color: 'white', fontSize: '20px', fontWeight: 'bold' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" y1="19" x2="12" y2="22"></line>
        </svg>
        N
      </button>

      <div className="narration-playback-menu" style={{ zIndex: 9999 }}>
        <div className="menu-header">
          <h3>{t('narration.playbackTitle', 'Narration')}</h3>
          <button
            className="close-menu"
            onClick={() => {
              console.log('Close button clicked, setting isOpen to false');
              setIsOpen(false);
            }}
            style={{
              padding: '8px',
              backgroundColor: 'rgba(0,0,0,0.1)',
              borderRadius: '50%',
              cursor: 'pointer',
              border: 'none'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="menu-content" style={{ padding: '16px', backgroundColor: '#fff', color: '#000' }}>
          {/* Playback Controls */}
          <div className="playback-controls">
            <button
              className={`pill-button ${isPlaying ? 'error' : 'primary'}`}
              onClick={togglePlayback}
              disabled={!activeNarrations.length}
            >
              {isPlaying ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="4" width="4" height="16" fill="currentColor"></rect>
                    <rect x="14" y="4" width="4" height="16" fill="currentColor"></rect>
                  </svg>
                  {t('narration.stopPlayback', 'Stop')}
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"></polygon>
                  </svg>
                  {t('narration.startPlayback', 'Play')}
                </>
              )}
            </button>
          </div>

          {/* Narration Source Selection */}
          <div className="narration-source">
            <label>{t('narration.narrationSource', 'Source')}:</label>
            <div className="radio-pill-group">
              <div className="radio-pill">
                <input
                  type="radio"
                  id="source-original-narration"
                  name="narration-source"
                  checked={narrationSource === 'original'}
                  onChange={() => setNarrationSource('original')}
                  disabled={!originalNarrations.length}
                />
                <label htmlFor="source-original-narration">
                  {t('narration.original', 'Original')}
                </label>
              </div>
              <div className="radio-pill">
                <input
                  type="radio"
                  id="source-translated-narration"
                  name="narration-source"
                  checked={narrationSource === 'translated'}
                  onChange={() => setNarrationSource('translated')}
                  disabled={!translatedNarrations.length}
                />
                <label htmlFor="source-translated-narration">
                  {t('narration.translated', 'Translated')}
                </label>
              </div>
            </div>
          </div>

          {/* Volume Controls */}
          <div className="volume-controls">
            <div className="volume-control">
              <label htmlFor="narration-volume">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                </svg>
                {t('narration.narrationVolume', 'Narration')}:
              </label>
              <div className="slider-container">
                <input
                  type="range"
                  id="narration-volume"
                  min="0"
                  max="1"
                  step="0.01"
                  value={narrationVolume}
                  onChange={(e) => setNarrationVolume(parseFloat(e.target.value))}
                  className="range-slider"
                />
                <div className="slider-value">{Math.round(narrationVolume * 100)}%</div>
              </div>
            </div>

            <div className="volume-control">
              <label htmlFor="video-volume">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                </svg>
                {t('narration.videoVolume', 'Video Audio')}:
              </label>
              <div className="slider-container">
                <input
                  type="range"
                  id="video-volume"
                  min="0"
                  max="1"
                  step="0.01"
                  value={videoVolume}
                  onChange={(e) => setVideoVolume(parseFloat(e.target.value))}
                  className="range-slider"
                />
                <div className="slider-value">{Math.round(videoVolume * 100)}%</div>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="narration-status">
            {activeNarrations.length === 0 ? (
              <div className="status-message warning">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {narrationSource === 'original'
                  ? t('narration.noOriginalNarrations', 'No original narrations available')
                  : t('narration.noTranslatedNarrations', 'No translated narrations available')}
              </div>
            ) : (
              <div className="status-message info">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                {t('narration.narrationReady', 'Narration ready for playback')}
                <div className="narration-count">
                  {t('narration.narrationCount', '{{count}} narrations available', { count: activeNarrations.length })}
                </div>
              </div>
            )}
          </div>

          {/* Extra close button at the bottom */}
          <button
            className="pill-button error close-menu-button"
            onClick={() => {
              console.log('Bottom close button clicked, setting isOpen to false');
              setIsOpen(false);
            }}
            style={{
              marginTop: '16px',
              width: '100%',
              backgroundColor: '#f44336',
              color: 'white',
              padding: '10px',
              fontSize: '16px',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: '20px',
              cursor: 'pointer'
            }}
          >
            {t('narration.closeMenu', 'Close Menu')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NarrationPlaybackMenu;
