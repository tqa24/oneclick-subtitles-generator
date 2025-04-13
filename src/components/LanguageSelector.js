import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/LanguageSelector.css';
import { createPortal } from 'react-dom';

const LanguageSelector = ({ isDropup = false }) => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // Language options with their details
  const languages = [
    { code: 'en', name: t('language.en'), flag: '🇺🇸', label: 'English' },
    { code: 'ko', name: t('language.ko'), flag: '🇰🇷', label: 'Korean' },
    { code: 'vi', name: t('language.vi'), flag: '🇻🇳', label: 'Vietnamese' }
  ];

  // Find the currently selected language
  const currentLanguage = languages.find(lang => lang.code === selectedLanguage) || languages[0];

  // Function to change the language
  const changeLanguage = (code) => {
    i18n.changeLanguage(code);
    setSelectedLanguage(code);
    localStorage.setItem('preferred_language', code);
    setIsOpen(false);
  };

  // Calculate menu position when button is clicked
  const calculateMenuPosition = () => {
    if (buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

      if (isDropup) {
        // Position the menu above the button
        setMenuPosition({
          bottom: window.innerHeight - buttonRect.top + scrollTop,
          left: buttonRect.left + scrollLeft,
        });
      } else {
        // Position the menu below the button
        setMenuPosition({
          top: buttonRect.bottom + scrollTop,
          left: buttonRect.left + scrollLeft,
        });
      }
    }
  };

  // Toggle menu open/closed
  const toggleMenu = () => {
    if (!isOpen) {
      calculateMenuPosition();
    }
    setIsOpen(!isOpen);
  };

  // Close the menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Update menu position when window is resized
  useEffect(() => {
    const handleResize = () => {
      if (isOpen) {
        calculateMenuPosition();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e, code) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      changeLanguage(code);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();

      const currentIndex = languages.findIndex(lang => lang.code === selectedLanguage);
      let newIndex;

      if (e.key === 'ArrowDown') {
        newIndex = (currentIndex + 1) % languages.length;
      } else {
        newIndex = (currentIndex - 1 + languages.length) % languages.length;
      }

      const focusableElements = menuRef.current.querySelectorAll('.language-option');
      if (focusableElements[newIndex]) {
        focusableElements[newIndex].focus();
      }
    }
  };

  return (
    <div className="language-selector-container">
      <button
        ref={buttonRef}
        className={`language-selector-button ${isDropup ? 'dropup' : ''}`}
        onClick={toggleMenu}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={t('language.languageSelector')}
      >
        <div className="language-globe">
          <span className="language-globe-icon">🌐</span>
          <span className="language-current-flag">{currentLanguage.flag}</span>
        </div>
        <span className="language-current-name">{currentLanguage.name}</span>
        <span className={`language-arrow ${isOpen ? 'open' : ''}`}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          className={`language-menu ${isDropup ? 'dropup' : ''}`}
          role="menu"
          style={{
            ...(isDropup
              ? { bottom: `${menuPosition.bottom}px`, left: `${menuPosition.left}px` }
              : { top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }
            )
          }}
        >
          <div className="language-menu-header">
            <span className="language-menu-title">{t('language.languageSelector')}</span>
          </div>
          <div className="language-options">
            {languages.map((language, index) => (
              <button
                key={language.code}
                className={`language-option ${language.code === selectedLanguage ? 'selected' : ''}`}
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => changeLanguage(language.code)}
                onKeyDown={(e) => handleKeyDown(e, language.code)}
                role="menuitem"
                tabIndex={0}
                aria-current={language.code === selectedLanguage}
              >
                <span className="language-flag">{language.flag}</span>
                <div className="language-info">
                  <span className="language-name">{language.name}</span>
                  {language.code !== selectedLanguage && (
                    <span className="language-native">{language.label}</span>
                  )}
                </div>
                {language.code === selectedLanguage && (
                  <span className="language-selected-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default LanguageSelector;
