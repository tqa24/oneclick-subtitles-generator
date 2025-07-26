import { useState, useEffect, useCallback } from 'react';
import { convertTimeStringToSeconds } from '../../../utils/vttUtils';

/**
 * Custom hook for managing subtitle display and synchronization
 * @param {number} currentTime - Current video playback time
 * @param {array} subtitlesArray - Original subtitles array
 * @param {array} translatedSubtitles - Translated subtitles array
 * @param {boolean} isFullscreen - Whether video is in fullscreen mode
 * @returns {object} Subtitle state and handlers
 */
export const useSubtitleDisplay = (currentTime, subtitlesArray, translatedSubtitles, isFullscreen) => {
  // Subtitle state
  const [currentSubtitleText, setCurrentSubtitleText] = useState('');
  const [subtitleSettings, setSubtitleSettings] = useState(() => {
    // Try to load settings from localStorage
    const savedSettings = localStorage.getItem('subtitle_settings');
    if (savedSettings) {
      try {
        return JSON.parse(savedSettings);
      } catch (e) {
        console.error('Error parsing saved subtitle settings:', e);
      }
    }

    // Default settings if nothing is saved
    return {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24',
      fontWeight: '400',
      position: '90', // Percentage value from 0 (top) to 100 (bottom)
      boxWidth: '80',
      backgroundColor: '#000000',
      opacity: '0.7',
      textColor: '#ffffff',
      showTranslatedSubtitles: false
    };
  });

  // Save subtitle settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem('subtitle_settings', JSON.stringify(subtitleSettings));
  }, [subtitleSettings]);

  // Function to find current subtitle based on time
  const findCurrentSubtitle = useCallback((time, subtitles) => {
    if (!subtitles || subtitles.length === 0) return null;

    return subtitles.find(sub => {
      // Handle both numeric and string time formats
      const startTime = typeof sub.start === 'number' ? sub.start :
                       (typeof sub.startTime === 'string' ? convertTimeStringToSeconds(sub.startTime) :
                       convertTimeStringToSeconds(sub.start));
      const endTime = typeof sub.end === 'number' ? sub.end :
                     (typeof sub.endTime === 'string' ? convertTimeStringToSeconds(sub.endTime) :
                     convertTimeStringToSeconds(sub.end));
      return time >= startTime && time <= endTime;
    });
  }, []);

  // Function to update fullscreen subtitle
  const updateFullscreenSubtitle = useCallback((subtitleText) => {
    if (!isFullscreen) return;

    const container = document.getElementById('fullscreen-subtitle-overlay');
    console.log('🎬 SUBTITLE - Updating subtitle text:', {
      text: subtitleText,
      containerExists: !!container,
      isFullscreen
    });

    if (container) {
      // Clear existing content
      container.innerHTML = '';

      if (subtitleText) {
        // Create subtitle element
        const subtitle = document.createElement('div');
        subtitle.id = 'fullscreen-subtitle';
        console.log('🎬 SUBTITLE - Created subtitle element');

        // Handle newlines by splitting the text and adding <br> tags
        const lines = subtitleText.split('\n');
        lines.forEach((line, index) => {
          if (index > 0) {
            subtitle.appendChild(document.createElement('br'));
          }
          subtitle.appendChild(document.createTextNode(line));
        });

        // Apply styles
        subtitle.style.display = 'inline-block';
        subtitle.style.backgroundColor = `rgba(${parseInt(subtitleSettings.backgroundColor.slice(1, 3), 16)},
                                       ${parseInt(subtitleSettings.backgroundColor.slice(3, 5), 16)},
                                       ${parseInt(subtitleSettings.backgroundColor.slice(5, 7), 16)},
                                       ${subtitleSettings.opacity || '0.7'})`;
        subtitle.style.color = subtitleSettings.textColor || '#ffffff';
        subtitle.style.padding = `${subtitleSettings.backgroundPadding || '10'}px`;
        subtitle.style.borderRadius = `${subtitleSettings.backgroundRadius || '4'}px`;
        subtitle.style.fontFamily = subtitleSettings.fontFamily || 'Arial, sans-serif';
        subtitle.style.fontSize = `${subtitleSettings.fontSize || '24'}px`;
        subtitle.style.fontWeight = subtitleSettings.fontWeight || '400';
        subtitle.style.lineHeight = subtitleSettings.lineSpacing || '1.4';
        subtitle.style.letterSpacing = `${subtitleSettings.letterSpacing || '0'}px`;
        subtitle.style.textTransform = subtitleSettings.textTransform || 'none';
        subtitle.style.textShadow = subtitleSettings.textShadow === true || subtitleSettings.textShadow === 'true' ?
                                  '1px 1px 2px rgba(0, 0, 0, 0.8)' : 'none';
        subtitle.style.maxWidth = '100%';
        subtitle.style.overflowWrap = 'break-word';

        // Add to container
        container.appendChild(subtitle);
        console.log('🎬 SUBTITLE - Subtitle added to container');
      }
    }
  }, [isFullscreen, subtitleSettings]);

  // Update current subtitle based on time
  useEffect(() => {
    // Determine which subtitle array to use based on settings
    const useTranslated = subtitleSettings.showTranslatedSubtitles && translatedSubtitles && translatedSubtitles.length > 0;
    const subtitlesToUse = useTranslated ? translatedSubtitles : subtitlesArray;

    // Find the current subtitle based on the video's current time
    const currentSub = findCurrentSubtitle(currentTime, subtitlesToUse);

    if (currentSub) {
      setCurrentSubtitleText(currentSub.text);
      
      // Log subtitle changes in development mode (throttled)
      if (process.env.NODE_ENV === 'development') {
        if (!window._lastLoggedSubtitle || window._lastLoggedSubtitle !== currentSub.text) {
          console.log('🎬 SUBTITLE - Current subtitle:', currentSub.text);
          window._lastLoggedSubtitle = currentSub.text;
        }
      }

      // Update fullscreen subtitle if in fullscreen mode
      updateFullscreenSubtitle(currentSub.text);
    } else {
      setCurrentSubtitleText('');
      // Clear fullscreen subtitle if in fullscreen mode
      updateFullscreenSubtitle('');
    }
  }, [currentTime, subtitlesArray, translatedSubtitles, subtitleSettings.showTranslatedSubtitles, findCurrentSubtitle, updateFullscreenSubtitle]);

  // Generate CSS variables for subtitle styling
  const getSubtitleCSSVariables = useCallback(() => {
    return {
      '--subtitle-position': `${subtitleSettings.position || '90'}%`,
      '--subtitle-box-width': `${subtitleSettings.boxWidth || '80'}%`,
      '--subtitle-background-radius': `${subtitleSettings.backgroundRadius || '4'}px`,
      '--subtitle-background-padding': `${subtitleSettings.backgroundPadding || '10'}px`,
      '--subtitle-text-transform': subtitleSettings.textTransform || 'none',
      '--subtitle-letter-spacing': `${subtitleSettings.letterSpacing || '0'}px`
    };
  }, [subtitleSettings]);

  // Generate subtitle styles for custom subtitle display
  const getSubtitleStyles = useCallback(() => {
    return {
      backgroundColor: `rgba(${parseInt(subtitleSettings.backgroundColor.slice(1, 3), 16)}, ${parseInt(subtitleSettings.backgroundColor.slice(3, 5), 16)}, ${parseInt(subtitleSettings.backgroundColor.slice(5, 7), 16)}, ${subtitleSettings.opacity})`,
      color: subtitleSettings.textColor,
      fontFamily: subtitleSettings.fontFamily,
      fontSize: `${subtitleSettings.fontSize}px`,
      fontWeight: subtitleSettings.fontWeight,
      lineHeight: subtitleSettings.lineSpacing || '1.4',
      textAlign: subtitleSettings.textAlign || 'center',
      textTransform: subtitleSettings.textTransform || 'none',
      letterSpacing: `${subtitleSettings.letterSpacing || '0'}px`,
      padding: `${subtitleSettings.backgroundPadding || '10'}px`,
      borderRadius: `${subtitleSettings.backgroundRadius || '4'}px`,
      textShadow: subtitleSettings.textShadow === true || subtitleSettings.textShadow === 'true' ? '1px 1px 2px rgba(0, 0, 0, 0.8)' : 'none'
    };
  }, [subtitleSettings]);

  // Function to toggle between original and translated subtitles
  const toggleSubtitleLanguage = useCallback(() => {
    setSubtitleSettings(prev => ({
      ...prev,
      showTranslatedSubtitles: !prev.showTranslatedSubtitles
    }));
  }, []);

  // Function to update subtitle settings
  const updateSubtitleSettings = useCallback((newSettings) => {
    setSubtitleSettings(prev => ({
      ...prev,
      ...newSettings
    }));
  }, []);

  return {
    // State
    currentSubtitleText,
    subtitleSettings,
    
    // Actions
    setSubtitleSettings,
    updateSubtitleSettings,
    toggleSubtitleLanguage,
    
    // Computed values
    getSubtitleCSSVariables,
    getSubtitleStyles,
    
    // Utilities
    findCurrentSubtitle,
    updateFullscreenSubtitle,
    
    // Derived state
    isShowingTranslated: subtitleSettings.showTranslatedSubtitles && translatedSubtitles && translatedSubtitles.length > 0,
    hasTranslatedSubtitles: translatedSubtitles && translatedSubtitles.length > 0
  };
};
