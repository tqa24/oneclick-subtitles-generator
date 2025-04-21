import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/SubtitleSettings.css';
import '../styles/narration/narrationPlaybackMenuRedesign.css';
import NarrationPlaybackMenu from './narration/NarrationPlaybackMenu';
import SimpleNarrationMenu from './narration/SimpleNarrationMenu';
import { SERVER_URL } from '../config';

const SubtitleSettings = ({
  settings,
  onSettingsChange,
  onDownloadWithSubtitles,
  onDownloadWithTranslatedSubtitles,
  hasTranslation,
  translatedSubtitles,
  targetLanguage,
  videoRef,
  originalNarrations = [],
  translatedNarrations = [],
  getAudioUrl
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(() => {
    // Load isOpen state from localStorage
    const savedIsOpen = localStorage.getItem('subtitle_settings_panel_open');
    return savedIsOpen === 'true';
  });

  const [subtitleLanguage, setSubtitleLanguage] = useState(() => {
    // Load subtitle language from localStorage
    const savedLanguage = localStorage.getItem('subtitle_language');
    return savedLanguage || 'original';
  });

  // Update subtitle language when translation becomes available
  useEffect(() => {
    if (hasTranslation && settings.showTranslatedSubtitles) {
      setSubtitleLanguage('translated');
    }
  }, [hasTranslation, settings.showTranslatedSubtitles]);

  // Save isOpen state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('subtitle_settings_panel_open', isOpen.toString());
  }, [isOpen]);

  // Remove transparency mode from localStorage if it exists
  useEffect(() => {
    if (localStorage.getItem('subtitle_settings_panel_transparent')) {
      localStorage.removeItem('subtitle_settings_panel_transparent');
    }
  }, []);

  const handleSettingChange = (setting, value) => {
    const updatedSettings = {
      ...settings,
      [setting]: value
    };

    // Save to localStorage
    localStorage.setItem('subtitle_settings', JSON.stringify(updatedSettings));

    // Update state via parent component
    onSettingsChange(updatedSettings);
  };

  const handleSubtitleLanguageChange = (e) => {
    const value = e.target.value;
    setSubtitleLanguage(value);

    // Update the showTranslatedSubtitles setting
    const showTranslated = value === 'translated';
    handleSettingChange('showTranslatedSubtitles', showTranslated);

    // Save the selected language to localStorage
    localStorage.setItem('subtitle_language', value);

    // Log the change for debugging
    console.log(`Subtitle language changed to: ${value}, showTranslatedSubtitles set to: ${showTranslated}`);
    console.log('Translated subtitles available:', hasTranslation);
  };

  const fontOptions = [
    // Korean optimized fonts
    { value: "'Noto Sans KR', sans-serif", label: 'Noto Sans Korean', group: 'Korean Optimized', koreanSupport: true, vietnameseSupport: false },
    { value: "'Nanum Gothic', sans-serif", label: 'Nanum Gothic', group: 'Korean Optimized', koreanSupport: true, vietnameseSupport: false },
    { value: "'Malgun Gothic', sans-serif", label: 'Malgun Gothic', group: 'Korean Optimized', koreanSupport: true, vietnameseSupport: false },
    { value: "'Nanum Myeongjo', serif", label: 'Nanum Myeongjo', group: 'Korean Optimized', koreanSupport: true, vietnameseSupport: false },
    { value: "'Nanum Barun Gothic', sans-serif", label: 'Nanum Barun Gothic', group: 'Korean Optimized', koreanSupport: true, vietnameseSupport: false },
    { value: "'Spoqa Han Sans', sans-serif", label: 'Spoqa Han Sans', group: 'Korean Optimized', koreanSupport: true, vietnameseSupport: false },
    { value: "'KoPub Batang', serif", label: 'KoPub Batang', group: 'Korean Optimized', koreanSupport: true, vietnameseSupport: false },
    { value: "'Gowun Dodum', sans-serif", label: 'Gowun Dodum', group: 'Korean Optimized', koreanSupport: true, vietnameseSupport: false },

    // Vietnamese optimized fonts
    { value: "'Noto Sans Vietnamese', sans-serif", label: 'Noto Sans Vietnamese', group: 'Vietnamese Optimized', koreanSupport: false, vietnameseSupport: true },
    { value: "'Be Vietnam Pro', sans-serif", label: 'Be Vietnam Pro', group: 'Vietnamese Optimized', koreanSupport: false, vietnameseSupport: true },
    { value: "'Sarabun', sans-serif", label: 'Sarabun', group: 'Vietnamese Optimized', koreanSupport: false, vietnameseSupport: true },
    { value: "'Montserrat Alternates', sans-serif", label: 'Montserrat Alternates', group: 'Vietnamese Optimized', koreanSupport: false, vietnameseSupport: true },
    { value: "'Josefin Sans', sans-serif", label: 'Josefin Sans', group: 'Vietnamese Optimized', koreanSupport: false, vietnameseSupport: true },
    { value: "'Lexend', sans-serif", label: 'Lexend', group: 'Vietnamese Optimized', koreanSupport: false, vietnameseSupport: true },

    // Multilingual fonts with good support for both Korean and Vietnamese
    { value: "'Noto Sans', sans-serif", label: 'Noto Sans', group: 'Multilingual', koreanSupport: true, vietnameseSupport: true },
    { value: "'Noto Serif', serif", label: 'Noto Serif', group: 'Multilingual', koreanSupport: true, vietnameseSupport: true },
    { value: "'Arial Unicode MS', sans-serif", label: 'Arial Unicode', group: 'Multilingual', koreanSupport: true, vietnameseSupport: true },
    { value: "'Source Sans Pro', sans-serif", label: 'Source Sans Pro', group: 'Multilingual', koreanSupport: true, vietnameseSupport: true },
    { value: "'Roboto', sans-serif", label: 'Roboto', group: 'Multilingual', koreanSupport: true, vietnameseSupport: true },
    { value: "'Open Sans', sans-serif", label: 'Open Sans', group: 'Multilingual', koreanSupport: true, vietnameseSupport: true },

    // Standard sans-serif fonts
    { value: "'Poppins', sans-serif", label: 'Poppins', group: 'Sans-serif', koreanSupport: false, vietnameseSupport: true },
    { value: "'Arial', sans-serif", label: 'Arial', group: 'Sans-serif', koreanSupport: false, vietnameseSupport: true },
    { value: "'Helvetica', sans-serif", label: 'Helvetica', group: 'Sans-serif', koreanSupport: false, vietnameseSupport: true },
    { value: "'Tahoma', sans-serif", label: 'Tahoma', group: 'Sans-serif', koreanSupport: false, vietnameseSupport: true },
    { value: "'Verdana', sans-serif", label: 'Verdana', group: 'Sans-serif', koreanSupport: false, vietnameseSupport: true },

    // Serif fonts
    { value: "'Georgia', serif", label: 'Georgia', group: 'Serif', koreanSupport: false, vietnameseSupport: false },
    { value: "'Times New Roman', serif", label: 'Times New Roman', group: 'Serif', koreanSupport: false, vietnameseSupport: true },

    // Monospace fonts
    { value: "'Nanum Gothic Coding', monospace", label: 'Nanum Gothic Coding', group: 'Monospace', koreanSupport: true, vietnameseSupport: false },
    { value: "'Roboto Mono', monospace", label: 'Roboto Mono', group: 'Monospace', koreanSupport: false, vietnameseSupport: true },
    { value: "'Courier New', monospace", label: 'Courier New', group: 'Monospace', koreanSupport: false, vietnameseSupport: false }
  ];

  // Group fonts for the select element
  const fontGroups = fontOptions.reduce((groups, font) => {
    if (!groups[font.group]) {
      groups[font.group] = [];
    }
    groups[font.group].push(font);
    return groups;
  }, {});

  const fontWeightOptions = [
    { value: '300', label: t('subtitleSettings.light', 'Light') },
    { value: '400', label: t('subtitleSettings.normal', 'Normal') },
    { value: '500', label: t('subtitleSettings.medium', 'Medium') },
    { value: '600', label: t('subtitleSettings.semiBold', 'Semi Bold') },
    { value: '700', label: t('subtitleSettings.bold', 'Bold') },
    { value: '800', label: t('subtitleSettings.extraBold', 'Extra Bold') }
  ];

  const textAlignOptions = [
    { value: 'left', label: t('subtitleSettings.left', 'Left') },
    { value: 'center', label: t('subtitleSettings.center', 'Center') },
    { value: 'right', label: t('subtitleSettings.right', 'Right') }
  ];

  const textTransformOptions = [
    { value: 'none', label: t('subtitleSettings.none', 'None') },
    { value: 'uppercase', label: t('subtitleSettings.uppercase', 'UPPERCASE') },
    { value: 'lowercase', label: t('subtitleSettings.lowercase', 'lowercase') },
    { value: 'capitalize', label: t('subtitleSettings.capitalize', 'Capitalize') }
  ];

  // Position is now a percentage value from 0 (top) to 100 (bottom)

  // Create states for the narration menu
  const [showNarrationMenu, setShowNarrationMenu] = useState(false);
  const [narrationSource, setNarrationSource] = useState('');
  const [narrationVolume, setNarrationVolume] = useState(0.8);
  const [videoVolume, setVideoVolume] = useState(0.3);

  // Audio refs for narration playback
  const audioRefs = useRef({});
  const audioDurationsRef = useRef({});
  const [currentNarration, setCurrentNarration] = useState(null);

  // State to track narrations internally
  const [internalOriginalNarrations, setInternalOriginalNarrations] = useState(originalNarrations || []);
  const [internalTranslatedNarrations, setInternalTranslatedNarrations] = useState(translatedNarrations || []);

  // Update internal state when props change
  useEffect(() => {
    if (originalNarrations && originalNarrations.length > 0) {
      setInternalOriginalNarrations(originalNarrations);
    }
    if (translatedNarrations && translatedNarrations.length > 0) {
      setInternalTranslatedNarrations(translatedNarrations);
    }
  }, [originalNarrations, translatedNarrations]);

  // Listen for narrations-updated event
  useEffect(() => {
    const handleNarrationsUpdated = (event) => {
      console.log('SubtitleSettings - Received narrations-updated event:', event.detail);
      if (event.detail.source === 'original') {
        setInternalOriginalNarrations(event.detail.narrations);

        // If narrations were cleared (empty array), also clear any playing audio
        if (event.detail.narrations.length === 0) {
          console.log('SubtitleSettings - Original narrations cleared, stopping any playing audio');
          // Stop any currently playing narration
          if (currentNarration && audioRefs.current[currentNarration.subtitle_id]) {
            audioRefs.current[currentNarration.subtitle_id].pause();
            setCurrentNarration(null);
          }
          // Clear audio refs to prevent playing old audio
          audioRefs.current = {};
          audioDurationsRef.current = {};
        }
      } else {
        setInternalTranslatedNarrations(event.detail.narrations);

        // If narrations were cleared (empty array), also clear any playing audio
        if (event.detail.narrations.length === 0 && narrationSource === 'translated') {
          console.log('SubtitleSettings - Translated narrations cleared, stopping any playing audio');
          // Stop any currently playing narration
          if (currentNarration && audioRefs.current[currentNarration.subtitle_id]) {
            audioRefs.current[currentNarration.subtitle_id].pause();
            setCurrentNarration(null);
          }
        }
      }
    };

    window.addEventListener('narrations-updated', handleNarrationsUpdated);

    // Also check localStorage on mount
    try {
      const storedOriginal = localStorage.getItem('originalNarrations');
      if (storedOriginal) {
        const parsed = JSON.parse(storedOriginal);
        if (parsed && parsed.length > 0) {
          setInternalOriginalNarrations(parsed);
        }
      }

      const storedTranslated = localStorage.getItem('translatedNarrations');
      if (storedTranslated) {
        const parsed = JSON.parse(storedTranslated);
        if (parsed && parsed.length > 0) {
          setInternalTranslatedNarrations(parsed);
        }
      }
    } catch (e) {
      console.error('Error loading narrations from localStorage:', e);
    }

    return () => {
      window.removeEventListener('narrations-updated', handleNarrationsUpdated);
    };
  }, [currentNarration, narrationSource]);

  // Check if any narrations are available
  const hasOriginalNarrations = internalOriginalNarrations.length > 0;
  const hasTranslatedNarrations = internalTranslatedNarrations.length > 0;
  const hasAnyNarrations = hasOriginalNarrations || hasTranslatedNarrations;

  // Debug narration data
  useEffect(() => {
    console.log('SubtitleSettings - internalOriginalNarrations:', internalOriginalNarrations);
    console.log('SubtitleSettings - internalTranslatedNarrations:', internalTranslatedNarrations);
    console.log('SubtitleSettings - hasOriginalNarrations:', hasOriginalNarrations);
    console.log('SubtitleSettings - hasTranslatedNarrations:', hasTranslatedNarrations);
    console.log('SubtitleSettings - hasAnyNarrations:', hasAnyNarrations);
    console.log('SubtitleSettings - window.originalNarrations:', window.originalNarrations);
    console.log('SubtitleSettings - window.translatedNarrations:', window.translatedNarrations);
  }, [internalOriginalNarrations, internalTranslatedNarrations, hasOriginalNarrations, hasTranslatedNarrations, hasAnyNarrations]);

  // Set narration source based on available narrations
  useEffect(() => {
    // If original narrations are available, set source to original
    if (hasOriginalNarrations) {
      setNarrationSource('original');
      console.log('SubtitleSettings: Setting narration source to original');
    }
    // If original narrations are not available but translated narrations are, set source to translated
    else if (!hasOriginalNarrations && hasTranslatedNarrations) {
      setNarrationSource('translated');
      console.log('SubtitleSettings: Setting narration source to translated');
    }
    // If no narrations are available, don't set any source
    else {
      setNarrationSource('');
      console.log('SubtitleSettings: No narrations available, clearing narration source');

      // Also stop any currently playing narration
      if (currentNarration && audioRefs.current[currentNarration.subtitle_id]) {
        audioRefs.current[currentNarration.subtitle_id].pause();
        setCurrentNarration(null);
      }
    }
  }, [hasOriginalNarrations, hasTranslatedNarrations, currentNarration]);

  // Reference for the menu container
  const menuRef = useRef(null);

  // Add escape key and click outside handlers to close the menu
  useEffect(() => {
    // Handle escape key
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && showNarrationMenu) {
        setShowNarrationMenu(false);
      }
    };

    // Handle click outside
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) && showNarrationMenu) {
        setShowNarrationMenu(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNarrationMenu]);

  // Update video volume when it changes
  useEffect(() => {
    if (videoRef && videoRef.current) {
      videoRef.current.volume = videoVolume;
    }
  }, [videoVolume, videoRef]);

  // Update all audio volumes when narration volume changes
  useEffect(() => {
    Object.values(audioRefs.current).forEach(audio => {
      audio.volume = narrationVolume;
    });
  }, [narrationVolume]);

  // Handle video timeupdate to trigger narration playback
  useEffect(() => {
    const handleTimeUpdate = () => {
      if (!hasAnyNarrations || !videoRef?.current || narrationSource === '' || narrationVolume === 0) return;

      const currentTime = videoRef.current.currentTime;
      const activeNarrations = narrationSource === 'original' ? internalOriginalNarrations : internalTranslatedNarrations;

      // Find narrations that should be playing at the current time
      activeNarrations.forEach(narration => {
        if (!narration.success) return;

        // Debug narration success status
        console.log('Narration success status:', narration.success);

        // Debug narration structure
        console.log('Narration object:', narration);

        // Get the subtitle ID
        const subtitleId = narration.subtitle_id;
        console.log('Subtitle ID:', subtitleId);

        // Try to find the matching subtitle from window.subtitlesData
        let subtitleData;
        if (window.subtitlesData && Array.isArray(window.subtitlesData)) {
          subtitleData = window.subtitlesData.find(sub => sub.id === subtitleId);
          console.log('Found subtitle data from window.subtitlesData:', subtitleData);
        }

        // If not found, try to find it in the original subtitles prop
        if (!subtitleData && window.originalSubtitles && Array.isArray(window.originalSubtitles)) {
          subtitleData = window.originalSubtitles.find(sub => sub.id === subtitleId);
          console.log('Found subtitle data from window.originalSubtitles:', subtitleData);
        }

        // If still not found, try to find it in the translated subtitles prop
        if (!subtitleData && window.translatedSubtitles && Array.isArray(window.translatedSubtitles)) {
          subtitleData = window.translatedSubtitles.find(sub => sub.id === subtitleId);
          console.log('Found subtitle data from window.translatedSubtitles:', subtitleData);
        }

        // If we couldn't find the subtitle data, skip this narration
        if (!subtitleData) {
          console.log('Could not find subtitle data for narration:', narration);
          return;
        }

        // Get subtitle timing
        const subtitleStart = typeof subtitleData.start === 'number' ?
          subtitleData.start : parseFloat(subtitleData.start);
        const subtitleEnd = typeof subtitleData.end === 'number' ?
          subtitleData.end : parseFloat(subtitleData.end);

        console.log('Subtitle timing:', subtitleStart, 'to', subtitleEnd);

        // We no longer need the subtitle midpoint since we're aligning with the start

        // Get narration duration (or use a default if not available)
        const narrationDuration = audioDurationsRef.current[narration.subtitle_id] || 2.0;

        // Simply align the narration start with the subtitle start
        // This is more straightforward and predictable
        const startPlay = subtitleStart;
        const endPlay = subtitleStart + narrationDuration;

        // Check if current time is within the play window
        if (currentTime >= startPlay && currentTime <= endPlay) {
          console.log(`Current time ${currentTime} is within play window ${startPlay}-${endPlay} for subtitle ${narration.subtitle_id}`);
          // If we're not already playing this narration, play it
          if (!currentNarration || currentNarration.subtitle_id !== narration.subtitle_id) {
            console.log(`Starting narration for subtitle ${narration.subtitle_id} at subtitle start ${subtitleStart}`);
            playNarration(narration);
          }
        }
      });
    };

    // Add event listener to video
    if (videoRef && videoRef.current && hasAnyNarrations && narrationSource !== '' && narrationVolume > 0) {
      videoRef.current.addEventListener('timeupdate', handleTimeUpdate);
    }

    return () => {
      // Clean up event listener
      if (videoRef && videoRef.current) {
        videoRef.current.removeEventListener('timeupdate', handleTimeUpdate);
      }
    };
  }, [hasAnyNarrations, narrationSource, internalOriginalNarrations, internalTranslatedNarrations, currentNarration, videoRef, narrationVolume]);

  // Play a specific narration
  const playNarration = (narration) => {
    console.log('Playing narration:', narration);

    // Store the subtitle data with the narration for reference
    if (!narration.subtitleData) {
      // Try to find the matching subtitle
      let subtitleData;
      if (window.subtitlesData && Array.isArray(window.subtitlesData)) {
        subtitleData = window.subtitlesData.find(sub => sub.id === narration.subtitle_id);
      }
      if (!subtitleData && window.originalSubtitles && Array.isArray(window.originalSubtitles)) {
        subtitleData = window.originalSubtitles.find(sub => sub.id === narration.subtitle_id);
      }
      if (!subtitleData && window.translatedSubtitles && Array.isArray(window.translatedSubtitles)) {
        subtitleData = window.translatedSubtitles.find(sub => sub.id === narration.subtitle_id);
      }

      if (subtitleData) {
        narration.subtitleData = subtitleData;
        console.log('Added subtitle data to narration:', subtitleData);
      }
    }

    // Stop any currently playing narration
    if (currentNarration && audioRefs.current[currentNarration.subtitle_id]) {
      console.log('Stopping current narration:', currentNarration.subtitle_id);
      audioRefs.current[currentNarration.subtitle_id].pause();
    }

    // Set the current narration
    setCurrentNarration(narration);

    // Get or create audio element for this narration
    if (!audioRefs.current[narration.subtitle_id]) {
      const audioUrl = `${SERVER_URL}/narration/audio/${narration.filename || 'test.wav'}`;
      console.log('Creating new audio element for URL:', audioUrl);

      const audio = new Audio(audioUrl);
      audio.volume = narrationVolume;

      // Add error handling
      audio.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        console.error('Audio error code:', audio.error?.code);
        console.error('Audio error message:', audio.error?.message);
      });

      // Store the audio duration once it's loaded
      audio.addEventListener('loadedmetadata', () => {
        console.log('Audio loaded metadata, duration:', audio.duration);
        audioDurationsRef.current[narration.subtitle_id] = audio.duration;
      });

      // Add play event listener
      audio.addEventListener('play', () => {
        console.log('Audio started playing');
      });

      // Add ended event listener
      audio.addEventListener('ended', () => {
        console.log('Audio finished playing');
        if (currentNarration && currentNarration.subtitle_id === narration.subtitle_id) {
          setCurrentNarration(null);
        }
      });

      audioRefs.current[narration.subtitle_id] = audio;
    } else {
      console.log('Using existing audio element for narration:', narration.subtitle_id);
    }

    // Play the narration
    const audioElement = audioRefs.current[narration.subtitle_id];
    audioElement.volume = narrationVolume;
    console.log('Setting audio volume to:', narrationVolume);

    // If we have the subtitle midpoint and audio duration, calculate the start time
    const audioDuration = audioDurationsRef.current[narration.subtitle_id];
    console.log('Audio duration:', audioDuration);

    // Find the subtitle start time
    let subtitleStart = 0;
    if (narration.subtitleData) {
      subtitleStart = typeof narration.subtitleData.start === 'number' ?
        narration.subtitleData.start : parseFloat(narration.subtitleData.start);
    } else {
      // Try to find the subtitle data
      let subtitleData;
      if (window.subtitlesData && Array.isArray(window.subtitlesData)) {
        subtitleData = window.subtitlesData.find(sub => sub.id === narration.subtitle_id);
      }
      if (!subtitleData && window.originalSubtitles && Array.isArray(window.originalSubtitles)) {
        subtitleData = window.originalSubtitles.find(sub => sub.id === narration.subtitle_id);
      }
      if (!subtitleData && window.translatedSubtitles && Array.isArray(window.translatedSubtitles)) {
        subtitleData = window.translatedSubtitles.find(sub => sub.id === narration.subtitle_id);
      }

      if (subtitleData) {
        subtitleStart = typeof subtitleData.start === 'number' ?
          subtitleData.start : parseFloat(subtitleData.start);
      }
    }

    if (audioDuration) {
      // Simply calculate how far we are from the subtitle start
      const videoCurrentTime = videoRef.current.currentTime;
      const timeFromSubtitleStart = videoCurrentTime - subtitleStart;

      // If we're already past the subtitle start, set audio position accordingly
      // Otherwise, start from the beginning of the audio
      const audioStartTime = Math.max(0, timeFromSubtitleStart);

      console.log('Calculated audio start time:', audioStartTime, 'from video time:', videoCurrentTime, 'and subtitle start:', subtitleStart);

      // Ensure the start time is within valid bounds
      if (audioStartTime >= 0 && audioStartTime < audioDuration) {
        audioElement.currentTime = audioStartTime;
        console.log('Setting audio currentTime to:', audioStartTime);
      } else {
        audioElement.currentTime = 0;
        console.log('Audio start time out of bounds, setting to 0');
      }
    } else {
      audioElement.currentTime = 0;
      console.log('No subtitle midpoint or audio duration, starting from beginning');
    }

    // Try to play the audio and handle any errors
    try {
      const playPromise = audioElement.play();
      console.log('Audio play called');

      // Modern browsers return a promise from play()
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('Audio playback started successfully');
          })
          .catch(error => {
            console.error('Error playing audio:', error);
            // Try again with user interaction
            console.log('Adding one-time click handler to play audio');
            const handleClick = () => {
              audioElement.play()
                .then(() => console.log('Audio played after user interaction'))
                .catch(e => console.error('Still failed to play audio:', e));
              document.removeEventListener('click', handleClick);
            };
            document.addEventListener('click', handleClick, { once: true });
          });
      }
    } catch (error) {
      console.error('Exception trying to play audio:', error);
    }
  };

  return (
    <div className="subtitle-settings-container">


      <div className="action-buttons">
        {/* Render with Subtitles and Render with Translated buttons hidden for now */}

        <button
          className={`action-button subtitle-settings-toggle md-filled-tonal-button ${isOpen ? 'active' : ''}`}
          onClick={() => {
            const newIsOpen = !isOpen;
            setIsOpen(newIsOpen);
            // Close narration menu if it's open
            if (showNarrationMenu) {
              console.log('Closing narration menu when opening subtitle settings');
              setShowNarrationMenu(false);
            }
            console.log(`Subtitle settings menu ${newIsOpen ? 'opened' : 'closed'}`);
          }}
          title={t('subtitleSettings.settingsTooltip', 'Customize subtitle appearance')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span>{t('subtitleSettings.toggleSettings', 'Subtitle Settings')}</span>
        </button>

        <div ref={menuRef} className="narration-menu-container">
          <button
            className={`action-button narration-settings-toggle md-filled-tonal-button ${showNarrationMenu ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              const newShowNarrationMenu = !showNarrationMenu;
              setShowNarrationMenu(newShowNarrationMenu);
              // Close subtitle settings menu if it's open and we're opening narration menu
              if (isOpen && newShowNarrationMenu) {
                console.log('Closing subtitle settings menu when opening narration menu');
                setIsOpen(false);
              }
              console.log(`Narration menu ${newShowNarrationMenu ? 'opened' : 'closed'}`);
            }}
            title={t('narration.settingsTooltip', 'Narration Settings')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="22"></line>
            </svg>
            <span>{t('narration.toggleSettings', 'Narration Settings')}</span>
          </button>

          {/* Narration menu panel with subtitle-settings styling */}
          {showNarrationMenu && (
            <div
              className="subtitle-settings-panel narration-panel"
              style={{ position: 'absolute', right: '0', top: 'calc(100%)', right: '-10px', height: '505px', width: '320px', zIndex: 9999 }}
              onClick={(e) => e.stopPropagation()}
            >
            <div className="settings-header">
              <h4>{t('narration.playbackTitle', 'Narration')}</h4>
              <div className="settings-header-actions">
                <button
                  className="close-settings-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNarrationMenu(false);
                  }}
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="settings-content">
              {/* Narration Source Selection */}
              <div className="setting-group subtitle-language-group">
                <label>{t('narration.narrationSource', 'Source')}</label>
                <div className="radio-pill-group">
                  <div className="radio-pill">
                    <input
                      type="radio"
                      id="source-original"
                      name="narration-source"
                      checked={narrationSource === 'original'}
                      onChange={(e) => {
                        e.stopPropagation();
                        if (hasOriginalNarrations) {
                          setNarrationSource('original');
                        }
                      }}
                      disabled={!hasOriginalNarrations}
                    />
                    <label
                      htmlFor="source-original"
                      className={!hasOriginalNarrations ? 'disabled' : ''}
                    >
                      {t('narration.original', 'Original')}
                      {!hasOriginalNarrations ? ` (${t('narration.notAvailable', 'Not Available')})` : ''}
                    </label>
                  </div>
                  <div className="radio-pill">
                    <input
                      type="radio"
                      id="source-translated"
                      name="narration-source"
                      checked={narrationSource === 'translated'}
                      onChange={(e) => {
                        e.stopPropagation();
                        if (hasTranslatedNarrations) {
                          setNarrationSource('translated');
                        }
                      }}
                      disabled={!hasTranslatedNarrations}
                    />
                    <label
                      htmlFor="source-translated"
                      className={!hasTranslatedNarrations ? 'disabled' : ''}
                    >
                      {t('narration.translated', 'Translated')}
                      {!hasTranslatedNarrations ? ` (${t('narration.notAvailable', 'Not Available')})` : ''}
                    </label>
                  </div>
                </div>
              </div>

              {/* Status message when no narrations are available */}
              {!hasAnyNarrations && (
                <div className="setting-group">
                  <div className="notification-message warning">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                      <line x1="12" y1="9" x2="12" y2="13"></line>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <span>
                      {t('narration.noNarrationsAvailable', 'No narrations available. Generate narration first.')}
                    </span>
                  </div>
                </div>
              )}



              {/* Volume Controls */}
              <div className="setting-group">
                <label className={hasAnyNarrations ? '' : 'disabled'}>
                  <span className="icon-label-container">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    </svg>
                    <span>
                      {t('narration.narrationVolume', 'Narration Volume')}
                      {currentNarration && (
                        <span className="narration-status-indicator">
                          <span className="status-dot"></span>
                          {t('narration.playing', 'Playing')}
                        </span>
                      )}
                    </span>
                  </span>
                </label>
                <div className="slider-with-value">
                  {hasAnyNarrations ? (
                    <div className="custom-slider-container">
                      <div className="custom-slider-track">
                        <div
                          className="custom-slider-fill"
                          style={{ width: `${narrationVolume * 100}%` }}
                        ></div>
                        <div
                          className="custom-slider-thumb"
                          style={{ left: `${narrationVolume * 100}%` }}
                        ></div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={narrationVolume}
                        onChange={(e) => {
                          e.stopPropagation();
                          setNarrationVolume(parseFloat(e.target.value));

                          // If setting volume to 0, stop any playing narration
                          if (parseFloat(e.target.value) === 0 && currentNarration && audioRefs.current[currentNarration.subtitle_id]) {
                            audioRefs.current[currentNarration.subtitle_id].pause();
                            setCurrentNarration(null);
                          }
                        }}
                        className="custom-slider-input"
                      />
                    </div>
                  ) : (
                    <div className="custom-slider-container disabled">
                      <div className="custom-slider-track">
                        <div
                          className="custom-slider-fill"
                          style={{ width: `${narrationVolume * 100}%` }}
                        ></div>
                        <div
                          className="custom-slider-thumb"
                          style={{ left: `${narrationVolume * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  <div className="slider-value-display">{Math.round(narrationVolume * 100)}%</div>
                </div>
              </div>

              <div className="setting-group">
                <label>
                  <span className="icon-label-container">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                    </svg>
                    <span>{t('narration.videoVolume', 'Video Audio Volume')}</span>
                  </span>
                </label>
                <div className="slider-with-value">
                  <div className="custom-slider-container video-volume-slider">
                    <div className="custom-slider-track">
                      <div
                        className="custom-slider-fill"
                        style={{ width: `${videoVolume * 100}%` }}
                      ></div>
                      <div
                        className="custom-slider-thumb"
                        style={{ left: `${videoVolume * 100}%` }}
                      ></div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={videoVolume}
                      onChange={(e) => {
                        e.stopPropagation();
                        setVideoVolume(parseFloat(e.target.value));
                      }}
                      className="custom-slider-input"
                    />
                  </div>
                  <div className="slider-value-display">{Math.round(videoVolume * 100)}%</div>
                </div>
              </div>


            </div>
          </div>
        )}
        </div>
      </div>

      {isOpen && (
        <div className="subtitle-settings-panel">
          <div className="settings-header">
            <h4>{t('subtitleSettings.title', 'Subtitle Settings')}</h4>
            <div className="settings-header-actions">
              <button
                className="close-settings-btn"
                onClick={() => setIsOpen(false)}
              >
                &times;
              </button>
            </div>
          </div>

          <div className="settings-content">
            {/* Subtitle Language Selector - Always shown at the top */}
            <div className="setting-group subtitle-language-group">
              <label htmlFor="subtitle-language">{t('subtitleSettings.subtitleLanguage', 'Subtitle Language')}</label>
              <select
                id="subtitle-language"
                value={subtitleLanguage}
                onChange={handleSubtitleLanguageChange}
                className="subtitle-language-select"
                disabled={!hasTranslation}
              >
                <option value="original">{t('subtitleSettings.original', 'Original')}</option>
                {hasTranslation && (
                  <option value="translated">
                    {t('subtitleSettings.translated', 'Translated')}
                    {targetLanguage ? ` (${targetLanguage})` : ''}
                  </option>
                )}
              </select>
            </div>

            <hr className="settings-divider" />

            <div className="setting-group">
              <label htmlFor="font-family">{t('subtitleSettings.font', 'Font')}</label>
              <select
                id="font-family"
                value={settings.fontFamily}
                onChange={(e) => handleSettingChange('fontFamily', e.target.value)}
                className="font-select"
              >
                {Object.entries(fontGroups).map(([group, fonts]) => (
                  <optgroup key={group} label={group}>
                    {fonts.map(font => (
                      <option key={font.value} value={font.value}>
                        {font.label} {font.koreanSupport && '🇰🇷'}{font.vietnameseSupport && '🇻🇳'}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="setting-description">
                {t('subtitleSettings.fontSupportNote', 'Fonts marked with 🇰🇷 support Korean, 🇻🇳 support Vietnamese')}
              </p>
              <div className="font-preview" style={{ fontFamily: settings.fontFamily }}>
                <span className="font-preview-label">{t('subtitleSettings.fontPreview', 'Preview')}:</span>
                <div className="font-preview-samples">
                  <span className="font-preview-text">안녕하세요 (Korean)</span>
                  <span className="font-preview-text">Xin chào (Vietnamese)</span>
                  <span className="font-preview-text">Hello 123</span>
                </div>
              </div>
            </div>

            <div className="setting-group">
              <label htmlFor="font-size">{t('subtitleSettings.fontSize', 'Font Size')}</label>
              <div className="slider-with-value">
                <div className="custom-slider-container">
                  <div className="custom-slider-track">
                    <div
                      className="custom-slider-fill"
                      style={{ width: `${((settings.fontSize - 12) / 24) * 100}%` }}
                    ></div>
                    <div
                      className="custom-slider-thumb"
                      style={{ left: `${((settings.fontSize - 12) / 24) * 100}%` }}
                    ></div>
                  </div>
                  <input
                    type="range"
                    id="font-size"
                    min="12"
                    max="36"
                    step="1"
                    value={settings.fontSize}
                    onChange={(e) => handleSettingChange('fontSize', e.target.value)}
                    className="custom-slider-input"
                  />
                </div>
                <div className="slider-value-display">{settings.fontSize}px</div>
              </div>
            </div>

            <div className="setting-group">
              <label htmlFor="font-weight">{t('subtitleSettings.fontWeight', 'Font Weight')}</label>
              <select
                id="font-weight"
                value={settings.fontWeight}
                onChange={(e) => handleSettingChange('fontWeight', e.target.value)}
              >
                {fontWeightOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="setting-group">
              <label htmlFor="position">{t('subtitleSettings.position', 'Y Position')}</label>
              <div className="slider-with-value">
                <div className="custom-slider-container">
                  <div className="custom-slider-track">
                    <div
                      className="custom-slider-fill"
                      style={{ width: `${settings.position}%` }}
                    ></div>
                    <div
                      className="custom-slider-thumb"
                      style={{ left: `${settings.position}%` }}
                    ></div>
                  </div>
                  <input
                    type="range"
                    id="position"
                    min="0"
                    max="100"
                    step="1"
                    value={settings.position}
                    onChange={(e) => handleSettingChange('position', e.target.value)}
                    className="custom-slider-input"
                  />
                </div>
                <div className="slider-value-display">{settings.position}%</div>
              </div>
              <div className="position-labels">
                <span>{t('subtitleSettings.top', 'Top')}</span>
                <span>{t('subtitleSettings.bottom', 'Bottom')}</span>
              </div>
            </div>

            <div className="setting-group">
              <label htmlFor="box-width">{t('subtitleSettings.boxWidth', 'Box Width')}</label>
              <div className="slider-with-value">
                <div className="custom-slider-container">
                  <div className="custom-slider-track">
                    <div
                      className="custom-slider-fill"
                      style={{ width: `${((settings.boxWidth - 50) / 50) * 100}%` }}
                    ></div>
                    <div
                      className="custom-slider-thumb"
                      style={{ left: `${((settings.boxWidth - 50) / 50) * 100}%` }}
                    ></div>
                  </div>
                  <input
                    type="range"
                    id="box-width"
                    min="50"
                    max="100"
                    step="5"
                    value={settings.boxWidth}
                    onChange={(e) => handleSettingChange('boxWidth', e.target.value)}
                    className="custom-slider-input"
                  />
                </div>
                <div className="slider-value-display">{settings.boxWidth}%</div>
              </div>
            </div>

            <div className="setting-group">
              <label htmlFor="background-color">{t('subtitleSettings.backgroundColor', 'Background Color')}</label>
              <input
                type="color"
                id="background-color"
                value={settings.backgroundColor}
                onChange={(e) => handleSettingChange('backgroundColor', e.target.value)}
              />
            </div>

            <div className="setting-group">
              <label htmlFor="opacity">{t('subtitleSettings.opacity', 'Opacity')}</label>
              <div className="slider-with-value">
                <div className="custom-slider-container">
                  <div className="custom-slider-track">
                    <div
                      className="custom-slider-fill"
                      style={{ width: `${settings.opacity * 100}%` }}
                    ></div>
                    <div
                      className="custom-slider-thumb"
                      style={{ left: `${settings.opacity * 100}%` }}
                    ></div>
                  </div>
                  <input
                    type="range"
                    id="opacity"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.opacity}
                    onChange={(e) => handleSettingChange('opacity', e.target.value)}
                    className="custom-slider-input"
                  />
                </div>
                <div className="slider-value-display">{Math.round(settings.opacity * 100)}%</div>
              </div>
            </div>

            <div className="setting-group">
              <label htmlFor="text-color">{t('subtitleSettings.textColor', 'Text Color')}</label>
              <input
                type="color"
                id="text-color"
                value={settings.textColor}
                onChange={(e) => handleSettingChange('textColor', e.target.value)}
              />
            </div>

            <div className="setting-group">
              <label htmlFor="text-align">{t('subtitleSettings.textAlign', 'Text Alignment')}</label>
              <div className="button-toggle-group">
                {textAlignOptions.map(option => (
                  <button
                    key={option.value}
                    className={`button-toggle ${settings.textAlign === option.value ? 'active' : ''}`}
                    onClick={() => handleSettingChange('textAlign', option.value)}
                    title={option.label}
                  >
                    {option.value === 'left' && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="12" x2="15" y2="12"></line>
                        <line x1="3" y1="18" x2="18" y2="18"></line>
                      </svg>
                    )}
                    {option.value === 'center' && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="6" y1="12" x2="18" y2="12"></line>
                        <line x1="4" y1="18" x2="20" y2="18"></line>
                      </svg>
                    )}
                    {option.value === 'right' && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="9" y1="12" x2="21" y2="12"></line>
                        <line x1="6" y1="18" x2="21" y2="18"></line>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-group">
              <label htmlFor="text-transform">{t('subtitleSettings.textTransform', 'Text Transform')}</label>
              <select
                id="text-transform"
                value={settings.textTransform || 'none'}
                onChange={(e) => handleSettingChange('textTransform', e.target.value)}
              >
                {textTransformOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="setting-group">
              <label htmlFor="line-spacing">{t('subtitleSettings.lineSpacing', 'Line Spacing')}</label>
              <div className="slider-with-value">
                <div className="custom-slider-container">
                  <div className="custom-slider-track">
                    <div
                      className="custom-slider-fill"
                      style={{ width: `${((settings.lineSpacing || 1.4) - 1) * 100}%` }}
                    ></div>
                    <div
                      className="custom-slider-thumb"
                      style={{ left: `${((settings.lineSpacing || 1.4) - 1) * 100}%` }}
                    ></div>
                  </div>
                  <input
                    type="range"
                    id="line-spacing"
                    min="1"
                    max="2"
                    step="0.1"
                    value={settings.lineSpacing || '1.4'}
                    onChange={(e) => handleSettingChange('lineSpacing', e.target.value)}
                    className="custom-slider-input"
                  />
                </div>
                <div className="slider-value-display">{settings.lineSpacing || '1.4'}</div>
              </div>
            </div>

            <div className="setting-group">
              <label htmlFor="letter-spacing">{t('subtitleSettings.letterSpacing', 'Letter Spacing')}</label>
              <div className="slider-with-value">
                <div className="custom-slider-container">
                  <div className="custom-slider-track">
                    <div
                      className="custom-slider-fill"
                      style={{ width: `${(parseFloat(settings.letterSpacing || 0) + 1) / 6 * 100}%` }}
                    ></div>
                    <div
                      className="custom-slider-thumb"
                      style={{ left: `${(parseFloat(settings.letterSpacing || 0) + 1) / 6 * 100}%` }}
                    ></div>
                  </div>
                  <input
                    type="range"
                    id="letter-spacing"
                    min="-1"
                    max="5"
                    step="0.5"
                    value={settings.letterSpacing || '0'}
                    onChange={(e) => handleSettingChange('letterSpacing', e.target.value)}
                    className="custom-slider-input"
                  />
                </div>
                <div className="slider-value-display">{settings.letterSpacing || '0'}px</div>
              </div>
            </div>

            <div className="setting-group">
              <label htmlFor="background-radius">{t('subtitleSettings.backgroundRadius', 'Background Radius')}</label>
              <div className="slider-with-value">
                <div className="custom-slider-container">
                  <div className="custom-slider-track">
                    <div
                      className="custom-slider-fill"
                      style={{ width: `${(parseFloat(settings.backgroundRadius || 0) / 20) * 100}%` }}
                    ></div>
                    <div
                      className="custom-slider-thumb"
                      style={{ left: `${(parseFloat(settings.backgroundRadius || 0) / 20) * 100}%` }}
                    ></div>
                  </div>
                  <input
                    type="range"
                    id="background-radius"
                    min="0"
                    max="20"
                    step="1"
                    value={settings.backgroundRadius || '0'}
                    onChange={(e) => handleSettingChange('backgroundRadius', e.target.value)}
                    className="custom-slider-input"
                  />
                </div>
                <div className="slider-value-display">{settings.backgroundRadius || '0'}px</div>
              </div>
            </div>

            <div className="setting-group">
              <label htmlFor="background-padding">{t('subtitleSettings.backgroundPadding', 'Background Padding')}</label>
              <div className="slider-with-value">
                <div className="custom-slider-container">
                  <div className="custom-slider-track">
                    <div
                      className="custom-slider-fill"
                      style={{ width: `${(parseFloat(settings.backgroundPadding || 10) / 30) * 100}%` }}
                    ></div>
                    <div
                      className="custom-slider-thumb"
                      style={{ left: `${(parseFloat(settings.backgroundPadding || 10) / 30) * 100}%` }}
                    ></div>
                  </div>
                  <input
                    type="range"
                    id="background-padding"
                    min="0"
                    max="30"
                    step="2"
                    value={settings.backgroundPadding || '10'}
                    onChange={(e) => handleSettingChange('backgroundPadding', e.target.value)}
                    className="custom-slider-input"
                  />
                </div>
                <div className="slider-value-display">{settings.backgroundPadding || '10'}px</div>
              </div>
            </div>

            <div className="setting-group">
              <label>{t('subtitleSettings.textShadow', 'Text Shadow')}</label>
              <div className="toggle-switch-container">
                <label className="toggle-switch" htmlFor="text-shadow">
                  <input
                    type="checkbox"
                    id="text-shadow"
                    checked={settings.textShadow === 'true' || settings.textShadow === true}
                    onChange={(e) => handleSettingChange('textShadow', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <span className="toggle-label">{settings.textShadow === 'true' || settings.textShadow === true ? t('common.on', 'On') : t('common.off', 'Off')}</span>
              </div>
            </div>

            <button
              className="reset-settings-btn"
              onClick={() => {
                const defaultSettings = {
                  fontFamily: "'Noto Sans KR', sans-serif",
                  fontSize: '24',
                  fontWeight: '500',
                  position: '90',
                  boxWidth: '80',
                  backgroundColor: '#000000',
                  opacity: '0.7',
                  textColor: '#ffffff',
                  textAlign: 'center',
                  textTransform: 'none',
                  lineSpacing: '1.4',
                  letterSpacing: '0',
                  backgroundRadius: '4',
                  backgroundPadding: '10',
                  textShadow: false,
                  showTranslatedSubtitles: false
                };

                // Save default settings to localStorage
                localStorage.setItem('subtitle_settings', JSON.stringify(defaultSettings));

                // Update state via parent component
                onSettingsChange(defaultSettings);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                <path d="M3 3v5h5"></path>
              </svg>
              {t('subtitleSettings.resetToDefault', 'Reset to Default')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubtitleSettings;
