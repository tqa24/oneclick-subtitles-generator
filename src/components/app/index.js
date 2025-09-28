import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from './AppLayout';
import { useAppState } from './AppState';
import { useAppHandlers } from './AppHandlers';
import { useModalHandlers } from './ModalHandlers';
import { useAppEffects } from './AppEffects';
import OnboardingBanner from '../OnboardingBanner';
import OnboardingFooterReveal from '../OnboardingFooterReveal';
import AutoDismissErrorToast from '../common/AutoDismissErrorToast';
import PlayPauseMorph from '../common/PlayPauseMorph';
// Import CSS files
import '../../styles/App.css';
import '../../styles/GeminiButtonAnimations.css';
import '../../styles/ProcessingTextAnimation.css';
import '../../styles/SrtUploadButton.css';
import '../../styles/VideoAnalysisModal.css';
import '../../styles/TranscriptionRulesEditor.css';
import '../../styles/OnboardingBanner.css';
import '../../styles/AutoGenerate.css'; // Auto-generate button and flow styles
// Removed spinner-fix.css - now using LoadingIndicator component
import '../../styles/lyrics/save-message.css'; // Audio alignment notification styles
import '../../styles/common/auto-dismiss-error-toast.css'; // Auto-dismiss error toast styles
import '../../styles/common/toast.css'; // Toast notification styles
import '../../styles/OnboardingFooterReveal.css';


/**
 * Main App component
 */
function App() {
  const { t } = useTranslation();

  // Temporary test overlay state for PlayPauseMorph (remove when no longer needed)
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [morphType, setMorphType] = useState(2);

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
    t
  });

  // State change effects removed to reduce console logs

  return (
    <>
      {/* Onboarding banner for first-time visitors - rendered at the top level */}
      <OnboardingBanner />

      {/* Auto-dismiss error toast for global error notifications */}
      <AutoDismissErrorToast />

      {/* This is rendered on top of the app, behind the onboarding overlay */}
      <OnboardingFooterReveal />

      {/* Temporary overlay to test PlayPauseMorph (safe to remove later) */}
      <div
        style={{
          position: 'fixed', top: 12, right: 12, zIndex: 9999,
          background: 'rgba(0,0,0,0.4)', padding: '8px 10px', borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: 10, backdropFilter: 'blur(4px)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
          pointerEvents: 'auto'
        }}
      >
        <button
          onClick={() => setDemoPlaying(p => !p)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.25)',
            color: '#e3e3e3', padding: '6px 8px', borderRadius: 8, cursor: 'pointer'
          }}
          title="Toggle Play/Pause Morph"
        >
          <PlayPauseMorph playing={demoPlaying} color="#e3e3e3" size={28} duration={420} morphType={morphType} />
          <span style={{ fontSize: 12, userSelect: 'none' }}>{demoPlaying ? 'Playing' : 'Paused'}</span>
        </button>
        <select
          value={morphType}
          onChange={(e) => setMorphType(Number(e.target.value))}
          style={{
            background: 'rgba(0,0,0,0.5)',
            color: '#e3e3e3',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 8,
            padding: '4px',
            fontSize: 12,
            cursor: 'pointer'
          }}
        >
          <option value={1}>Type 1</option>
          <option value={2}>Type 2</option>
        </select>
      </div>

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
