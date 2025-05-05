import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../../styles/SubtitleSettings.css';
import '../../styles/narration/narrationPlaybackMenuRedesign.css';
import { SERVER_URL } from '../../config';
import useSubtitleSettings from './hooks/useSubtitleSettings';
import useNarration from './hooks/useNarration';
import NarrationMenu from './components/NarrationMenu';
import SubtitleSettingsPanel from './components/SubtitleSettingsPanel';

/**
 * SubtitleSettings component
 *
 * @param {Object} props - Component props
 * @param {Object} props.settings - Current subtitle settings
 * @param {Function} props.onSettingsChange - Function to handle settings changes
 * @param {Function} props.onDownloadWithSubtitles - Function to download video with subtitles
 * @param {Function} props.onDownloadWithTranslatedSubtitles - Function to download video with translated subtitles
 * @param {boolean} props.hasTranslation - Whether translation is available
 * @param {Array} props.translatedSubtitles - Translated subtitles
 * @param {string} props.targetLanguage - Target language for translation
 * @param {Object} props.videoRef - Reference to the video element
 * @param {Array} props.originalNarrations - Original narration audio files
 * @param {Array} props.translatedNarrations - Translated narration audio files
 * @param {Function} props.getAudioUrl - Function to get audio URL from filename
 * @returns {JSX.Element} - Rendered component
 */
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

  // Use custom hooks for subtitle settings and narration
  const {
    isOpen,
    setIsOpen,
    subtitleLanguage,
    handleSettingChange,
    handleSubtitleLanguageChange,
    resetToDefaults
  } = useSubtitleSettings(settings, onSettingsChange);

  const {
    showNarrationMenu,
    setShowNarrationMenu,
    narrationSource,
    setNarrationSource,
    narrationVolume,
    setNarrationVolume,
    videoVolume,
    setVideoVolume,
    currentNarration,
    internalOriginalNarrations,
    internalTranslatedNarrations,
    hasOriginalNarrations,
    hasTranslatedNarrations,
    hasAnyNarrations,
    playNarration
  } = useNarration(videoRef, originalNarrations, translatedNarrations, SERVER_URL);

  // Update subtitle language when translation becomes available
  useEffect(() => {
    if (hasTranslation && settings.showTranslatedSubtitles) {
      handleSubtitleLanguageChange({ target: { value: 'translated' } });
    }
  }, [hasTranslation, settings.showTranslatedSubtitles]);

  // Handle video timeupdate to trigger narration playback
  useEffect(() => {
    // Handle seeking events to reset audio state
    const handleSeeking = () => {
      console.log('Video seeking event triggered');

      // Stop any currently playing narration
      if (currentNarration) {
        console.log(`Stopping current narration ${currentNarration.subtitle_id} due to seeking`);
      }
    };

    const handleSeeked = () => {
      console.log('Video seeked event triggered');
      // The timeupdate handler will pick up the new position and play the appropriate narration
    };

    const lastLoggedTime = { current: 0 };

    const handleTimeUpdate = () => {
      if (!hasAnyNarrations || !videoRef?.current || narrationSource === '' || narrationVolume === 0) {
        return;
      }

      const currentTime = videoRef.current.currentTime;

      // Only log every second to reduce console spam
      if (Math.floor(currentTime) !== Math.floor(lastLoggedTime.current)) {
        console.log(`Video time update: ${currentTime.toFixed(2)}`);
        lastLoggedTime.current = currentTime;
      }

      const activeNarrations = narrationSource === 'original' ? internalOriginalNarrations : internalTranslatedNarrations;

      // Log if there are no active narrations
      if (!activeNarrations || activeNarrations.length === 0) {
        return;
      }

      // Array to collect narrations that should be playing at the current time
      const eligibleNarrations = [];

      // Find narrations that should be playing at the current time
      activeNarrations.forEach(narration => {
        if (!narration.success) return;

        // Get the subtitle ID
        const subtitleId = narration.subtitle_id;

        // Try to find the matching subtitle from window.subtitlesData
        let subtitleData;
        if (window.subtitlesData && Array.isArray(window.subtitlesData)) {
          subtitleData = window.subtitlesData.find(sub => sub.id === subtitleId);
        }

        // If not found, try to find it in the original subtitles prop
        if (!subtitleData && window.originalSubtitles && Array.isArray(window.originalSubtitles)) {
          subtitleData = window.originalSubtitles.find(sub => sub.id === subtitleId);
        }

        // If still not found, try to find it in the translated subtitles prop
        if (!subtitleData && window.translatedSubtitles && Array.isArray(window.translatedSubtitles)) {
          subtitleData = window.translatedSubtitles.find(sub => sub.id === subtitleId);
        }

        // If we couldn't find the subtitle data, skip this narration
        if (!subtitleData) {
          return;
        }

        // Get subtitle timing
        const subtitleStart = typeof subtitleData.start === 'number' ?
          subtitleData.start : parseFloat(subtitleData.start);
        const subtitleEnd = typeof subtitleData.end === 'number' ?
          subtitleData.end : parseFloat(subtitleData.end);

        // Simply align the narration start with the subtitle start
        const startPlay = subtitleStart;
        const endPlay = subtitleEnd;

        // Check if current time is within the play window
        if (currentTime >= startPlay && currentTime <= endPlay) {
          // Add this narration to eligible narrations with its start time
          eligibleNarrations.push({
            narration,
            subtitleStart,
            subtitleEnd,
            startPlay,
            endPlay
          });
        }
      });

      // If we have eligible narrations and we're not already playing one of them
      if (eligibleNarrations.length > 0) {
        // Sort eligible narrations by start time (earliest first)
        eligibleNarrations.sort((a, b) => a.subtitleStart - b.subtitleStart);

        // Check if we're already playing one of the eligible narrations
        const alreadyPlayingEligible = currentNarration &&
          eligibleNarrations.some(item => item.narration.subtitle_id === currentNarration.subtitle_id);

        // If we're not already playing an eligible narration, play the earliest one
        if (!alreadyPlayingEligible) {
          const narrationToPlay = eligibleNarrations[0].narration;
          playNarration(narrationToPlay);
        }
      }
    };

    // Add event listeners to video
    if (videoRef && videoRef.current && hasAnyNarrations && narrationSource !== '' && narrationVolume > 0) {
      videoRef.current.addEventListener('timeupdate', handleTimeUpdate);
      videoRef.current.addEventListener('seeking', handleSeeking);
      videoRef.current.addEventListener('seeked', handleSeeked);
    }

    return () => {
      // Clean up event listeners
      if (videoRef && videoRef.current) {
        videoRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        videoRef.current.removeEventListener('seeking', handleSeeking);
        videoRef.current.removeEventListener('seeked', handleSeeked);
      }
    };
  }, [
    hasAnyNarrations,
    narrationSource,
    internalOriginalNarrations,
    internalTranslatedNarrations,
    currentNarration,
    videoRef,
    narrationVolume,
    playNarration
  ]);

  return (
    <div className="subtitle-settings-container">
      <div className="action-buttons">
        {/* Subtitle Settings Toggle Button */}
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

        {/* Narration Menu */}
        <NarrationMenu
          showNarrationMenu={showNarrationMenu}
          setShowNarrationMenu={setShowNarrationMenu}
          narrationSource={narrationSource}
          setNarrationSource={setNarrationSource}
          narrationVolume={narrationVolume}
          setNarrationVolume={setNarrationVolume}
          videoVolume={videoVolume}
          setVideoVolume={setVideoVolume}
          currentNarration={currentNarration}
          hasOriginalNarrations={hasOriginalNarrations}
          hasTranslatedNarrations={hasTranslatedNarrations}
          hasAnyNarrations={hasAnyNarrations}
        />
      </div>

      {/* Subtitle Settings Panel */}
      <SubtitleSettingsPanel
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        settings={settings}
        handleSettingChange={handleSettingChange}
        subtitleLanguage={subtitleLanguage}
        handleSubtitleLanguageChange={handleSubtitleLanguageChange}
        hasTranslation={hasTranslation}
        targetLanguage={targetLanguage}
        resetToDefaults={resetToDefaults}
      />
    </div>
  );
};

export default SubtitleSettings;
