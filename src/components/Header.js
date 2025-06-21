import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/Header.css';
import GeminiHeaderAnimation from './GeminiHeaderAnimation';

const Header = ({ onSettingsClick }) => {
  const { t } = useTranslation();
  const [showFloatingActions, setShowFloatingActions] = useState(true); // Start as visible
  const hideTimeoutRef = useRef(null);
  const initialShowTimeoutRef = useRef(null);
  const [isInitialShow, setIsInitialShow] = useState(true); // Track if we're in initial show period

  // Define the position update function outside useEffect so it can be reused
  const updateFloatingActionsPosition = () => {
    const floatingSettings = document.querySelector('.floating-settings');
    const appHeader = document.querySelector('.app-header');

    if (floatingSettings && appHeader) {
      const scrollY = window.scrollY;

      // Position the floating settings button to move with the page scroll
      // Use the header's height and padding for alignment, but position relative to scroll
      const headerHeight = 60; // min-height from CSS
      const buttonHeight = 48; // Height of the larger settings button
      const verticalOffset = (headerHeight - buttonHeight) / 2; // Center within header height

      floatingSettings.style.top = `${scrollY + verticalOffset}px`;

      // Align horizontally with the header's right padding
      const headerStyles = window.getComputedStyle(appHeader);
      const headerPadding = headerStyles.paddingRight;
      floatingSettings.style.right = headerPadding;
    }
  };

  useEffect(() => {
    // Check if user has visited before (onboarding banner logic)
    const hasVisitedBefore = localStorage.getItem('has_visited_site') === 'true';

    if (hasVisitedBefore) {
      // User has visited before, start the 5-second auto-show immediately
      updateFloatingActionsPosition();

      initialShowTimeoutRef.current = setTimeout(() => {
        setIsInitialShow(false);
        setShowFloatingActions(false);
      }, 5000);
    } else {
      // First-time user, wait for onboarding banner to be dismissed
      // Hide the floating settings initially
      setShowFloatingActions(false);

      // Poll localStorage to detect when onboarding is dismissed
      const checkOnboardingDismissed = setInterval(() => {
        const hasVisitedNow = localStorage.getItem('has_visited_site') === 'true';
        if (hasVisitedNow) {
          clearInterval(checkOnboardingDismissed);

          // Onboarding dismissed, now show floating settings for 5 seconds
          setShowFloatingActions(true);
          updateFloatingActionsPosition();

          initialShowTimeoutRef.current = setTimeout(() => {
            setIsInitialShow(false);
            setShowFloatingActions(false);
          }, 5000);
        }
      }, 100); // Check every 100ms

      // Cleanup interval on unmount
      return () => {
        clearInterval(checkOnboardingDismissed);
      };
    }

    // Cleanup initial timeout on unmount
    return () => {
      if (initialShowTimeoutRef.current) {
        clearTimeout(initialShowTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {

    const handleMouseMove = (e) => {
      // Don't handle mouse events during initial show period
      if (isInitialShow) return;

      // Show floating actions when cursor is near the top-right area of the current viewport
      const viewportWidth = window.innerWidth;
      const isMobile = viewportWidth <= 768;

      // Define detection zone in the top-right area of the viewport
      const topZone = isMobile ? 100 : 120;
      const rightZone = isMobile ? 100 : 150;

      const isInTopRightZone =
        e.clientY <= topZone &&
        e.clientX >= (viewportWidth - rightZone);

      if (isInTopRightZone) {
        // Clear any pending hide timeout
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
          hideTimeoutRef.current = null;
        }
        setShowFloatingActions(true);
        // Update position when showing
        updateFloatingActionsPosition();
      } else {
        // Add a small delay before hiding to prevent flickering
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
        }
        hideTimeoutRef.current = setTimeout(() => {
          setShowFloatingActions(false);
        }, 300);
      }
    };

    const handleMouseLeave = () => {
      // Don't handle mouse leave during initial show period
      if (isInitialShow) return;

      // Hide when mouse leaves the window with a slight delay
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      hideTimeoutRef.current = setTimeout(() => {
        setShowFloatingActions(false);
      }, 500);
    };

    const handleScroll = () => {
      // Update position on scroll if floating actions are visible
      if (showFloatingActions) {
        updateFloatingActionsPosition();
      }
    };

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('scroll', handleScroll);

    // Cleanup
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('scroll', handleScroll);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [showFloatingActions, isInitialShow]);

  return (
    <header className="app-header">
      {/* Gemini constellation animation */}
      <GeminiHeaderAnimation />

      <h1 className="header-title">
        {t('header.appTitle')}
      </h1>

      <button
        className={`settings-button floating-settings ${showFloatingActions ? 'floating-visible' : 'floating-hidden'}`}
        onClick={onSettingsClick}
        aria-label={t('header.settingsAria')}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        <span>{t('header.settings')}</span>
      </button>
    </header>
  );
};

export default Header;