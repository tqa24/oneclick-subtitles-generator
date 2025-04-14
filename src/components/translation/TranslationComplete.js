import React from 'react';
import { useTranslation } from 'react-i18next';
import DownloadOptionsModal from '../DownloadOptionsModal';

/**
 * Translation complete component
 * @param {Object} props - Component props
 * @param {Function} props.onReset - Function to handle reset
 * @param {boolean} props.isModalOpen - Whether the download options modal is open
 * @param {Function} props.setIsModalOpen - Function to set modal open state
 * @param {Function} props.onDownload - Function to handle download
 * @param {Function} props.onProcess - Function to handle processing
 * @param {boolean} props.hasTranslation - Whether translation is available
 * @param {boolean} props.hasOriginal - Whether original subtitles are available
 * @returns {JSX.Element} - Rendered component
 */
const TranslationComplete = ({
  onReset,
  isModalOpen,
  setIsModalOpen,
  onDownload,
  onProcess,
  hasTranslation = false,
  hasOriginal = true
}) => {
  const { t } = useTranslation();

  return (
    <div className="translation-row action-row">
      <div className="row-content action-content">
        {/* New Translation button */}
        <button
          className="reset-translation-button"
          onClick={onReset}
        >
          {t('translation.newTranslation', 'New Translation')}
        </button>

        <DownloadOptionsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onDownload={onDownload}
          onProcess={onProcess}
          hasTranslation={hasTranslation}
          hasOriginal={hasOriginal}
        />
      </div>
    </div>
  );
};

export default TranslationComplete;
