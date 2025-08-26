import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/Header.css';
import GeminiHeaderAnimation from './GeminiHeaderAnimation';
import specialStarIcon from '../assets/specialStar.svg';

const Header = ({ onSettingsClick }) => {
  const { t } = useTranslation();
  const [showFloatingActions, setShowFloatingActions] = useState(true); // Start as visible
  const hideTimeoutRef = useRef(null);
  const initialShowTimeoutRef = useRef(null);
  const [isInitialShow, setIsInitialShow] = useState(true); // Track if we're in initial show period
  const [hasOpenedSettings, setHasOpenedSettings] = useState(false); // Track if user has ever opened settings
  const [isFullVersion, setIsFullVersion] = useState(false); // Track if running in full mode

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
    // Check if user has ever opened settings
    const hasEverOpenedSettings = localStorage.getItem('has_opened_settings') === 'true';
    setHasOpenedSettings(hasEverOpenedSettings);

    // If user has never opened settings, keep button always visible
    if (!hasEverOpenedSettings) {
      setShowFloatingActions(true);
      setIsInitialShow(false); // Skip initial show period, just stay visible
      updateFloatingActionsPosition();
      return;
    }

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

      // If user has never opened settings, keep button always visible
      if (!hasOpenedSettings) return;

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

      // If user has never opened settings, keep button always visible
      if (!hasOpenedSettings) return;

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
  }, [showFloatingActions, isInitialShow, hasOpenedSettings]);

  // Detect startup mode (lite vs full version)
  useEffect(() => {
    const detectStartupMode = async () => {
      try {
        const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3031';
        const response = await fetch(`${API_BASE_URL}/api/startup-mode`, {
          mode: 'cors',
          credentials: 'include',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const startupData = await response.json();
          setIsFullVersion(startupData.isDevCuda);
        }
      } catch (error) {
        // If we can't detect, assume lite version
        setIsFullVersion(false);
      }
    };

    detectStartupMode();
  }, []);

  // Handle settings click - mark as opened and call original handler
  const handleSettingsClick = () => {
    // Mark that user has opened settings
    if (!hasOpenedSettings) {
      localStorage.setItem('has_opened_settings', 'true');
      setHasOpenedSettings(true);
    }

    // Call the original settings click handler
    onSettingsClick();
  };

  return (
    <header className="app-header">
      {/* Gemini constellation animation */}
      {localStorage.getItem('enable_gemini_effects') !== 'false' && (
        <GeminiHeaderAnimation />
      )}

      <div className="header-title-container">
        <h1 className="header-title">
          <span className="osg-main">OSG</span>
          <span className="osg-version">
            {isFullVersion ? ` (${t('header.versionFull')})` : ` (${t('header.versionLite')})`}
          </span>
        </h1>
      </div>

      <button
        className={`settings-button floating-settings ${showFloatingActions ? 'floating-visible' : 'floating-hidden'}`}
        onClick={handleSettingsClick}
        aria-label={t('header.settingsAria')}
      >
        <img
          src={specialStarIcon}
          alt="Settings"
          width="24"
          height="24"
          style={{ marginRight: '10px' }}
        />
        <span>{t('header.settings')}</span>
      </button>
    </header>
  );
};

export default Header;