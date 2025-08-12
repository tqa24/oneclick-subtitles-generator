import React, { useState, useRef, useEffect, useCallback } from 'react';
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

  // Debug flag - can be enabled for troubleshooting
  const DEBUG_POSITIONING = false;

  // Track if we've successfully calculated position at least once
  const [hasValidPosition, setHasValidPosition] = useState(false);

  // Language options with their details
  const languages = [
    { code: 'en', name: t('language.en'), flag: '🇺🇸', label: 'English' },
    { code: 'ko', name: t('language.ko'), flag: '🇰🇷', label: 'Korean' },
    { code: 'vi', name: t('language.vi'), flag: '🇻🇳', label: 'Vietnamese' }
  ];

  // Find the currently selected language
  const currentLanguage = languages.find(lang => lang.code === selectedLanguage) || languages[0];

  // Globe icon variants for different languages
  const getGlobeIcon = (languageCode) => {
    if (languageCode === 'en') {
      // English globe icon
      return (
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
          <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm-40-82v-78q-33 0-56.5-23.5T360-320v-40L168-552q-3 18-5.5 36t-2.5 36q0 121 79.5 212T440-162Zm276-102q41-45 62.5-100.5T800-480q0-98-54.5-179T600-776v16q0 33-23.5 56.5T520-680h-80v80q0 17-11.5 28.5T400-560h-80v80h240q17 0 28.5 11.5T600-440v120h40q26 0 47 15.5t29 40.5Z"/>
        </svg>
      );
    } else {
      // Vietnamese and Korean globe icon (default)
      return (
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
          <path d="M472-159q-33 0-56.5-24T392-240q0-33 23.5-56.5T472-320l24-23q8-8 18.5-12.5T536-360q23 0 39.5 17t16.5 40v17q0 20 13 33t33 13q15 0 27-9t17-23l12-33q9-24 29-39.5t46-15.5q11-28 17.5-58t6.5-62q0-89-44.5-162.5T632-758v38q0 33-23.5 56.5T552-640h-40v80q0 17-11.5 28.5T472-520h-40v68q0 22-15 37t-37 15q-14 0-25.5-6T336-423l-64-97h-40v40q0 31-21 53t-50 26q26 104 112.5 173T472-159Zm80-241q-17 0-28.5-11.5T512-440q0-17 11.5-28.5T552-480h40q17 0 28.5 11.5T632-440q0 17-11.5 28.5T592-400h-40Zm93-120q-20 0-31.5-15.5T608-570l15-44q4-12 14-19t22-7q20 0 31.5 15.5T696-590l-15 44q-4 12-14 19t-22 7ZM472-80q-83 0-156-31.5T189-197q-54-54-85.5-127T72-480q0-83 31.5-156T189-763q54-54 127-85.5T472-880q83 0 156 31.5T755-763q54 54 85.5 127T872-480q0 83-31.5 156T755-197q-54 54-127 85.5T472-80Z"/>
        </svg>
      );
    }
  };

  // Function to change the language
  const changeLanguage = (code) => {
    i18n.changeLanguage(code);
    setSelectedLanguage(code);
    localStorage.setItem('preferred_language', code);
    setIsOpen(false);
  };

  // Calculate menu position when button is clicked
  const calculateMenuPosition = useCallback(() => {
    if (buttonRef.current) {
      try {
        const buttonRect = buttonRef.current.getBoundingClientRect();

        if (DEBUG_POSITIONING) {
          console.log('Calculating position:', {
            isDropup,
            buttonRect,
            windowHeight: window.innerHeight
          });
        }

        // Ensure we have valid dimensions
        if (buttonRect.width === 0 || buttonRect.height === 0) {
          console.warn('Button has no dimensions, retrying position calculation...');
          // Retry after a short delay
          setTimeout(() => calculateMenuPosition(), 50);
          return;
        }

        // Check if the button is inside a floating modal
        const isInFloatingModal = buttonRef.current?.closest('.floating-settings');

        let newPosition;
        if (isDropup) {
          if (isInFloatingModal) {
            // For dropup inside floating modal, position relative to the modal container
            const modalContainer = buttonRef.current.closest('.settings-modal');
            const modalRect = modalContainer ? modalContainer.getBoundingClientRect() : null;

            if (modalRect) {
              // Position relative to the modal container using absolute positioning
              const relativeBottom = modalRect.height - (buttonRect.top - modalRect.top);
              const relativeLeft = buttonRect.left - modalRect.left;
              newPosition = {
                bottom: Math.max(10, relativeBottom),
                left: Math.max(10, Math.min(relativeLeft, modalRect.width - 200)),
                top: 'auto'
              };
            } else {
              // Fallback to viewport positioning
              const bottomPosition = window.innerHeight - buttonRect.top;
              newPosition = {
                bottom: Math.max(10, bottomPosition),
                left: Math.max(10, Math.min(buttonRect.left, window.innerWidth - 200)),
                top: 'auto'
              };
            }
          } else {
            // For dropup in normal (non-floating) context
            const bottomPosition = window.innerHeight - buttonRect.top;
            newPosition = {
              bottom: Math.max(10, bottomPosition),
              left: Math.max(10, Math.min(buttonRect.left, window.innerWidth - 200)),
              top: 'auto'
            };
          }
        } else {
          // For dropdown, position the menu below the button
          newPosition = {
            top: Math.max(10, buttonRect.bottom),
            left: Math.max(10, Math.min(buttonRect.left, window.innerWidth - 200)),
            bottom: 'auto'
          };
        }

        if (DEBUG_POSITIONING) {
          console.log('Setting menu position:', newPosition);
        }

        setMenuPosition(newPosition);
        setHasValidPosition(true);
      } catch (error) {
        console.error('Error calculating menu position:', error);
        // Fallback to default positioning
        setMenuPosition({ top: 0, left: 0 });
      }
    } else if (DEBUG_POSITIONING) {
      console.warn('buttonRef.current is null, cannot calculate position');
    }
  }, [isDropup, DEBUG_POSITIONING]);

  // Toggle menu open/closed
  const toggleMenu = () => {
    if (!isOpen) {
      // Use requestAnimationFrame to ensure DOM is updated before calculating position
      requestAnimationFrame(() => {
        calculateMenuPosition();
      });
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

  // Update menu position when window is resized, scrolled, or mouse moves (for floating buttons)
  useEffect(() => {
    const handleResize = () => {
      if (isOpen) {
        calculateMenuPosition();
      }
    };

    const handleScroll = () => {
      if (isOpen) {
        calculateMenuPosition();
      }
    };

    const handleMouseMove = () => {
      if (isOpen && buttonRef.current?.closest('.floating-settings')) {
        // For floating buttons, recalculate position on mouse movement
        // since the floating button may reposition itself
        calculateMenuPosition();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isOpen, calculateMenuPosition]);

  // Recalculate position when menu opens and continuously track floating button movement
  useEffect(() => {
    if (isOpen) {
      // Multiple attempts to ensure proper positioning
      const timeouts = [
        setTimeout(() => calculateMenuPosition(), 10),
        setTimeout(() => calculateMenuPosition(), 50),
        setTimeout(() => calculateMenuPosition(), 100),
        // Fallback: make menu visible even if position calculation fails
        setTimeout(() => {
          if (!hasValidPosition) {
            console.warn('Position calculation failed, showing menu with fallback position');
            setHasValidPosition(true);
          }
        }, 200)
      ];

      // For floating buttons, continuously track position changes using requestAnimationFrame
      let animationFrameId = null;
      let lastPosition = null;
      const isFloatingButton = buttonRef.current?.closest('.floating-settings');

      if (isFloatingButton) {
        const trackPosition = () => {
          if (buttonRef.current && isOpen) {
            const buttonRect = buttonRef.current.getBoundingClientRect();
            const currentPosition = `${buttonRect.left},${buttonRect.top}`;

            // Only recalculate if position actually changed
            if (currentPosition !== lastPosition) {
              lastPosition = currentPosition;

              // Immediately update position for smooth tracking
              let newPosition;
              if (isDropup) {
                const bottomPosition = window.innerHeight - buttonRect.top;
                newPosition = {
                  bottom: Math.max(10, bottomPosition),
                  left: Math.max(10, Math.min(buttonRect.left, window.innerWidth - 200)),
                  top: 'auto'
                };
              } else {
                newPosition = {
                  top: Math.max(10, buttonRect.bottom),
                  left: Math.max(10, Math.min(buttonRect.left, window.innerWidth - 200)),
                  bottom: 'auto'
                };
              }

              setMenuPosition(newPosition);

              if (DEBUG_POSITIONING) {
                console.log('Position updated during floating tracking:', newPosition);
              }
            }

            // Continue tracking
            animationFrameId = requestAnimationFrame(trackPosition);
          }
        };

        // Start tracking
        animationFrameId = requestAnimationFrame(trackPosition);
      }

      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
      };
    } else {
      // Reset position state when menu closes
      setHasValidPosition(false);
    }
  }, [isOpen, calculateMenuPosition, hasValidPosition, DEBUG_POSITIONING, isDropup]);

  // Watch for button visibility and position changes (especially for floating buttons)
  useEffect(() => {
    if (buttonRef.current && isOpen) {
      // Use Intersection Observer to detect when button is visible
      const intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio > 0) {
            calculateMenuPosition();
          }
        });
      }, { threshold: 0.1 });

      // Use Mutation Observer to detect style/class changes (important for floating buttons)
      const mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          if (mutation.type === 'attributes' &&
              (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
            // Recalculate position when button style changes (floating button repositioning)
            calculateMenuPosition();
          }
        });
      });

      // Monitor the floating settings button specifically if this is inside one
      const floatingButton = buttonRef.current.closest('.floating-settings');
      if (floatingButton) {
        mutationObserver.observe(floatingButton, {
          attributes: true,
          attributeFilter: ['style', 'class']
        });
      }

      intersectionObserver.observe(buttonRef.current);
      mutationObserver.observe(buttonRef.current, {
        attributes: true,
        attributeFilter: ['style', 'class']
      });

      return () => {
        intersectionObserver.disconnect();
        mutationObserver.disconnect();
      };
    }
  }, [isOpen, calculateMenuPosition]);

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
          <span className="language-globe-icon">
            {getGlobeIcon(currentLanguage.code)}
          </span>
          <span className="language-current-flag">{currentLanguage.flag}</span>
        </div>
        <span className="language-current-name">{currentLanguage.name}</span>
        <span className={`language-arrow ${isOpen ? 'open' : ''}`}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </span>
      </button>

      {isOpen && (() => {
        // Check if we're inside a floating modal
        const isInFloatingModal = buttonRef.current?.closest('.floating-settings');
        const modalContainer = isInFloatingModal ? buttonRef.current?.closest('.settings-modal') : null;

        // Choose the portal target: modal container if floating, otherwise document.body
        const portalTarget = modalContainer || document.body;

        return createPortal(
          <div
            ref={menuRef}
            className={`language-menu ${isDropup ? 'dropup' : ''}`}
            role="menu"
            style={{
              position: isInFloatingModal && modalContainer ? 'absolute' : 'fixed',
              zIndex: 1000001, // Match the CSS z-index to ensure it's above onboarding overlay
              visibility: hasValidPosition ? 'visible' : 'hidden',
              ...(isDropup
                ? {
                    bottom: `${menuPosition.bottom || (hasValidPosition ? 0 : 50)}px`,
                    left: `${menuPosition.left || 20}px`,
                    top: 'auto'
                  }
                : {
                    top: `${menuPosition.top || (hasValidPosition ? 0 : 50)}px`,
                    left: `${menuPosition.left || 20}px`,
                    bottom: 'auto'
                  }
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
        portalTarget
      );
    })()}
    </div>
  );
};

export default LanguageSelector;
