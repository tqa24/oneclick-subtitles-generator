import React from 'react';
import { useTranslation } from 'react-i18next';

const AboutTab = ({ useAlternativeBackground }) => {
  const { t } = useTranslation();

  return (
    <div className={`settings-section about-section ${useAlternativeBackground ? 'alternative-bg' : ''}`}>
      <h3>{t('settings.about', 'About')}</h3>
      <div className="about-content">
        <h2 className="about-app-title">One-click Subtitles Generator</h2>
        <p className="version-info">
          <strong>{t('settings.version', 'Version')}:</strong> {new Date().toISOString().slice(0, 10).replace(/-/g, '')}
        </p>
        <div className="creator-info">
          <p><strong>{t('settings.creator', 'Creator')}:</strong> nganlinh4</p>
          <p>
            <strong>GitHub:</strong>
            <a href="https://github.com/nganlinh4" target="_blank" rel="noopener noreferrer">
              https://github.com/nganlinh4
            </a>
          </p>
          <p>
            <strong>YouTube:</strong>
            <a href="https://www.youtube.com/@tteokl" target="_blank" rel="noopener noreferrer">
              https://www.youtube.com/@tteokl
            </a>
          </p>
          <p>
            <strong>Google Scholar:</strong>
            <a href="https://scholar.google.com/citations?user=kWFVuFwAAAAJ&hl=en" target="_blank" rel="noopener noreferrer">
              https://scholar.google.com/citations?user=kWFVuFwAAAAJ&hl=en
            </a>
          </p>
          <p>
            <strong>Email:</strong>
            <a href="mailto:nganlinh4@gmail.com">
              nganlinh4@gmail.com
            </a>
          </p>
        </div>
        <div className="app-description">
          <p>{t('settings.appDescription', 'One-click Subtitles Generator is a tool that helps you generate, edit, and translate subtitles for your videos with just one click.')}</p>
        </div>
      </div>
    </div>
  );
};

export default AboutTab;
