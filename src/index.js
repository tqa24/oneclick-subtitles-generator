import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './App';
import './i18n/i18n';

// Theme initialization
const initializeTheme = () => {
  const storedTheme = localStorage.getItem('theme');

  if (storedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (storedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else if (storedTheme === 'system' || !storedTheme) {
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');

    // If no theme is set, default to dark
    if (!storedTheme) {
      localStorage.setItem('theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    // Add listener for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (localStorage.getItem('theme') === 'system') {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    });
  }
};

// Initialize theme
initializeTheme();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);