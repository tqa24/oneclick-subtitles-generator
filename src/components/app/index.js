import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from './AppLayout';
import { useAppState } from './AppState';
import { useAppHandlers } from './AppHandlers';
import { useModalHandlers } from './ModalHandlers';
import { useAppEffects } from './AppEffects';
import OnboardingBanner from '../OnboardingBanner';
import { initializeAudioAlignmentNotifications } from '../../utils/audioAlignmentNotification';

// Import CSS files
import '../../styles/App.css';
import '../../styles/GeminiButtonAnimations.css';
import '../../styles/ProcessingTextAnimation.css';
import '../../styles/SrtUploadButton.css';
import '../../styles/VideoAnalysisModal.css';
import '../../styles/TranscriptionRulesEditor.css';
import '../../styles/OnboardingBanner.css';
// Removed spinner-fix.css - now using LoadingIndicator component
import '../../styles/lyrics/save-message.css'; // Audio alignment notification styles

/**
 * Main App component
 */
function App() {
  const { t } = useTranslation();

  // Initialize app state
  const appState = { ...useAppState(), t };

  // Initialize app handlers
  const appHandlers = useAppHandlers(appState);

  // Initialize modal handlers
  const modalHandlers = useModalHandlers(appState);

  // Set up app effects
  useAppEffects({
    ...appState,
    handleDownloadAndPrepareYouTubeVideo: appHandlers.handleDownloadAndPrepareYouTubeVideo,
    prepareVideoForSegments: appHandlers.prepareVideoForSegments,
    t
  });

  // Initialize audio alignment notification system
  useEffect(() => {
    initializeAudioAlignmentNotifications();
  }, []);

  // State change effects removed to reduce console logs

  return (
    <>
      {/* Onboarding banner for first-time visitors - rendered at the top level */}
      <OnboardingBanner />

      <AppLayout
        appState={appState}
        appHandlers={appHandlers}
        modalHandlers={modalHandlers}
        t={t}
      />
    </>
  );
}

export default App;
