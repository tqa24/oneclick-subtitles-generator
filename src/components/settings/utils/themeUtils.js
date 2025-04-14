import React from 'react';
import { SunIcon, MoonIcon } from '../icons/TabIcons';

// Function to toggle between light and dark themes
export const toggleTheme = (theme, setTheme) => {
  let newTheme;
  // Simple toggle between light and dark
  if (theme === 'light' || theme === 'system') {
    newTheme = 'dark';
  } else {
    newTheme = 'light';
  }

  setTheme(newTheme);
  localStorage.setItem('theme', newTheme);
  document.documentElement.setAttribute('data-theme', newTheme);

  // Force re-render by triggering a storage event
  window.dispatchEvent(new Event('storage'));
  
  return newTheme;
};

// Get icon for the current theme
export const getThemeIcon = (theme) => {
  return theme === 'dark' ? <SunIcon /> : <MoonIcon />;
};

// Get aria-label for the theme toggle button
export const getThemeLabel = (theme, t) => {
  // Return the opposite of current theme to indicate what will happen on click
  return theme === 'dark' ? t('theme.light') : t('theme.dark');
};

// Initialize theme from localStorage or default to dark
export const initializeTheme = () => {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  return savedTheme;
};

// Set up system theme change listener
export const setupSystemThemeListener = (setTheme) => {
  const handleSystemThemeChange = (e) => {
    if (localStorage.getItem('theme') === 'system') {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
  };

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', handleSystemThemeChange);

  return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
};
