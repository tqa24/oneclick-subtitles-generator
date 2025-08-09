import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import './styles/audio-player-dark-theme.css';
import './styles/video-player-dark-theme.css';
import App from './App';
import './i18n/i18n';
import './utils/sliderDragHandler';
import { getThemeWithFallback, setupSystemThemeListener } from './utils/systemDetection';

// Theme initialization
const initializeTheme = () => {
  const theme = getThemeWithFallback();
  document.documentElement.setAttribute('data-theme', theme);

  // Save to localStorage if not already saved
  if (!localStorage.getItem('theme')) {
    localStorage.setItem('theme', theme);
  }

  // Set up system theme change listener
  setupSystemThemeListener((newTheme) => {
    const currentStoredTheme = localStorage.getItem('theme');
    // Only update if user hasn't manually set a preference
    if (!currentStoredTheme || currentStoredTheme === 'system') {
      document.documentElement.setAttribute('data-theme', newTheme);
      if (!currentStoredTheme) {
        localStorage.setItem('theme', newTheme);
      }
    }
  });
};

// Initialize theme
initializeTheme();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);