import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SettingsFooterControls from './settings/SettingsFooterControls';
import OnboardingStarryBackground from './OnboardingStarryBackground';
import initGeminiButtonEffects from '../utils/geminiEffects';
import '../styles/OnboardingFooterReveal.css';

/**
 * OnboardingFooterReveal
 * Renders the settings footer controls in a large, glassy card above the app.
 * It is mounted at all times (beneath the onboarding overlay), so when the
 * SVG dismissal animation plays, this card is revealed.
 */
const OnboardingFooterReveal = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    // Show only if user hasn't dismissed this helper yet
    const dismissed = localStorage.getItem('onboarding_controls_dismissed') === 'true';
    if (!dismissed) {
      setVisible(true);
    }
  }, []);

  // Initialize Gemini effects when component becomes visible
  useEffect(() => {
    if (visible) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        initGeminiButtonEffects();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleLetsGo = () => {
    // Start dismissal animation
    setDismissing(true);

    // After animation completes, hide and remember
    setTimeout(() => {
      localStorage.setItem('onboarding_controls_dismissed', 'true');
      setVisible(false);
      setDismissing(false);
    }, 500); // Match animation duration
  };

  if (!visible) return null;

  return (
    <div className={`onboarding-reveal-overlay ${dismissing ? 'dismissing' : ''}`} aria-hidden={false}>
      <OnboardingStarryBackground />
      <div className={`onboarding-reveal-card ${dismissing ? 'dismissing' : ''}`}>
        <div className="onboarding-reveal-header">{/* empty header keeps layout clean */}</div>
        <div className="onboarding-reveal-body">
          <div className="onboarding-controls-row">
            <SettingsFooterControls size="large" layout="group" isDropup={true} />
            <button className="lets-go-btn" onClick={handleLetsGo}>
              <div className="gemini-icon-container"></div>
              <span className="lets-go-text">{t('onboarding.letsGo')}</span>
              <svg className="lets-go-arrow" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
                <path d="M646-440H200q-17 0-28.5-11.5T160-480q0-17 11.5-28.5T200-520h446L532-634q-12-12-11.5-28t11.5-28q12-12 28.5-12.5T589-691l183 183q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L589-269q-12 12-28.5 11.5T532-270q-11-12-11.5-28t11.5-28l114-114Z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingFooterReveal;

