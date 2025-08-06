import { useState, useEffect, useCallback } from 'react';
import { defaultSettings } from '../constants';

/**
 * Custom hook for managing subtitle settings
 * 
 * @param {Object} initialSettings - Initial settings
 * @param {Function} onSettingsChange - Callback when settings change
 * @returns {Object} - Settings state and handlers
 */
const useSubtitleSettings = (initialSettings, onSettingsChange) => {
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

  const handleSettingChange = useCallback((setting, value) => {
    const updatedSettings = {
      ...initialSettings,
      [setting]: value
    };

    // Save to localStorage
    localStorage.setItem('subtitle_settings', JSON.stringify(updatedSettings));

    // Update state via parent component
    onSettingsChange(updatedSettings);
  }, [initialSettings, onSettingsChange]);

  const handleSubtitleLanguageChange = useCallback((e) => {
    const value = e.target.value;
    setSubtitleLanguage(value);

    // Update the showTranslatedSubtitles setting
    const showTranslated = value === 'translated';
    handleSettingChange('showTranslatedSubtitles', showTranslated);

    // Save the selected language to localStorage
    localStorage.setItem('subtitle_language', value);

    // Log the change for debugging

  }, [handleSettingChange]);

  const resetToDefaults = () => {
    // Save default settings to localStorage
    localStorage.setItem('subtitle_settings', JSON.stringify(defaultSettings));

    // Update state via parent component
    onSettingsChange(defaultSettings);
  };

  return {
    isOpen,
    setIsOpen,
    subtitleLanguage,
    setSubtitleLanguage,
    handleSettingChange,
    handleSubtitleLanguageChange,
    resetToDefaults
  };
};

export default useSubtitleSettings;
