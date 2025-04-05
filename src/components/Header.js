import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/Header.css';

const Header = ({ onSettingsClick }) => {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system');
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);

  // Function to change the language
  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('preferred_language', lng);
  };

  // Function to toggle between light and dark themes
  const toggleTheme = () => {
    let newTheme;
    // Simple toggle between light and dark
    if (theme === 'light' || theme === 'system') {
      newTheme = 'dark';
    } else {
      newTheme = 'light';
    }

    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);

    // Force re-render by triggering a storage event
    window.dispatchEvent(new Event('storage'));
  };

  // Listen for system theme changes
  useEffect(() => {
    const handleSystemThemeChange = (e) => {
      if (localStorage.getItem('theme') === 'system') {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  // Apply initial theme on component mount
  useEffect(() => {
    // Handle initial theme setup
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  // Handle click outside to close language dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      const container = document.querySelector('.language-selector-container');
      if (container && !container.contains(event.target) && languageDropdownOpen) {
        setLanguageDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [languageDropdownOpen]);

  // Get icon for the current theme
  const getThemeIcon = () => {
    if (theme === 'dark') {
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      );
    } else {
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    }
  };

  // Get aria-label for the theme toggle button
  const getThemeLabel = () => {
    // Return the opposite of current theme to indicate what will happen on click
    return theme === 'dark' ? t('theme.light') : t('theme.dark');
  };

  return (
    <header className="app-header">
      <div className="title-container">
        <h1 className="app-title">
          {t('header.appTitle')}
        </h1>
      </div>

      <div className="header-actions">
        <div className="language-selector-container">
          <div
            className="language-selector-wrapper"
            onClick={() => setLanguageDropdownOpen(!languageDropdownOpen)}
          >
            <div className="language-selector-globe">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
            </div>
            <div className="language-selector-current">
              {t(`language.${i18n.language}`)}
            </div>
            <div className={`language-selector-arrow ${languageDropdownOpen ? 'rotated' : ''}`}>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
          {languageDropdownOpen && (
            <div className="language-selector-options">
              <div
                className={`language-option ${i18n.language === 'en' ? 'active' : ''}`}
                onClick={() => {
                  changeLanguage('en');
                  setLanguageDropdownOpen(false);
                }}
              >
                <span className="language-flag">🇺🇸</span>
                <span className="language-name">{t('language.en')}</span>
              </div>
              <div
                className={`language-option ${i18n.language === 'ko' ? 'active' : ''}`}
                onClick={() => {
                  changeLanguage('ko');
                  setLanguageDropdownOpen(false);
                }}
              >
                <span className="language-flag">🇰🇷</span>
                <span className="language-name">{t('language.ko')}</span>
              </div>
              <div
                className={`language-option ${i18n.language === 'vi' ? 'active' : ''}`}
                onClick={() => {
                  changeLanguage('vi');
                  setLanguageDropdownOpen(false);
                }}
              >
                <span className="language-flag">🇻🇳</span>
                <span className="language-name">{t('language.vi')}</span>
              </div>
            </div>
          )}
        </div>

        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={getThemeLabel()}
          title={getThemeLabel()}
        >
          {getThemeIcon()}
        </button>

        <button
          className="settings-button"
          onClick={onSettingsClick}
          aria-label={t('header.settingsAria')}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>{t('header.settings')}</span>
        </button>
      </div>
    </header>
  );
};

export default Header;