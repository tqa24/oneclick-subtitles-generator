import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Header component for the translation section
 * @returns {JSX.Element} - Rendered component
 */
const TranslationHeader = () => {
  const { t } = useTranslation();

  return (
    <div className="translation-header">
      <h3>{t('translation.title', 'Translate Subtitles')}</h3>
      <p className="translation-description">
        {t('translation.description', 'Translate your edited subtitles to another language while preserving timing information.')}
      </p>
    </div>
  );
};

export default TranslationHeader;
