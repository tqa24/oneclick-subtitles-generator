import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../LanguageSelector';
import { toggleTheme as toggleThemeUtil, getThemeIcon, getThemeLabel, initializeTheme, setupSystemThemeListener } from './utils/themeUtils';

/**
 * Reusable settings footer controls: Theme toggle + Language selector
 * - Keeps real-time updates (theme + i18n) like in SettingsModal
 * - size: 'normal' | 'large' (for onboarding reveal)
 * - layout: 'group' | 'split' (split places theme left, language right)
 */
const SettingsFooterControls = ({ isDropup = false, size = 'normal', layout = 'group', className = '' }) => {
  const { t } = useTranslation();

  const [theme, setTheme] = useState(() => initializeTheme());

  useEffect(() => {
    const cleanup = setupSystemThemeListener(setTheme);
    return () => cleanup && cleanup();
  }, []);

  const handleToggleTheme = () => {
    const newTheme = toggleThemeUtil(theme, setTheme);
    setTheme(newTheme);
  };

  if (layout === 'split') {
    return (
      <div className={`settings-footer-controls ${size === 'large' ? 'controls-large' : ''} split-layout ${className}`.trim()}>
        <div className="controls-left">
          <button
            className="theme-toggle"
            onClick={handleToggleTheme}
            aria-label={getThemeLabel(theme, t)}
            title={getThemeLabel(theme, t)}
          >
            {getThemeIcon(theme)}
          </button>
        </div>
        <div className="controls-right">
          <LanguageSelector isDropup={isDropup} />
        </div>
      </div>
    );
  }

  return (
    <div className={`settings-footer-controls ${size === 'large' ? 'controls-large' : ''} ${className}`.trim()}>
      <button
        className="theme-toggle"
        onClick={handleToggleTheme}
        aria-label={getThemeLabel(theme, t)}
        title={getThemeLabel(theme, t)}
      >
        {getThemeIcon(theme)}
      </button>
      <LanguageSelector isDropup={isDropup} />
    </div>
  );
};

export default SettingsFooterControls;

