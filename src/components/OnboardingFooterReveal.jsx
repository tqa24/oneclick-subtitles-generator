import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SettingsFooterControls from './settings/SettingsFooterControls';
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
    // Do not reload the page; just hide and remember
    localStorage.setItem('onboarding_controls_dismissed', 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="onboarding-reveal-overlay" aria-hidden={false}>
      <div className="onboarding-reveal-card">
        <div className="onboarding-reveal-header">{/* empty header keeps layout clean */}</div>
        <div className="onboarding-reveal-body">
          <div className="onboarding-controls-row">
            <SettingsFooterControls size="large" layout="group" isDropup={true} />
            <button className="lets-go-btn" onClick={handleLetsGo}>
              <div className="gemini-icon-container"></div>
              {t('onboarding.letsGo')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingFooterReveal;

