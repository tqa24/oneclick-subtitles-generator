import { useTranslation } from 'react-i18next';
import DownloadOptionsModal from './DownloadOptionsModal';

// Download button + consolidation status + download options modal. Pure UI; props only.
const LyricsDownloadAndOutput = ({
  lyrics,
  translatedSubtitles,
  consolidationStatus,
  isModalOpen,
  onOpenModal,
  onCloseModal,
  onDownload,
  onProcess,
  namingInfo
}) => {
  const { t } = useTranslation();
  const { sourceSubtitleName = '', videoName = '', targetLanguages = [] } = namingInfo || {};

  return (
    <div className="download-buttons">
      <button
        className="btn-base btn-primary btn-large download-btn-primary"
        onClick={onOpenModal}
        disabled={!lyrics.length}
      >
        <span className="material-symbols-rounded" style={{ fontSize: '20px' }}>download</span>
        <span>{t('download.downloadCenter', 'Download Center')}</span>
      </button>

      {/* Show consolidation status if available */}
      {consolidationStatus && (
        <div className="consolidation-status">
          <div className="status-spinner"></div>
          <span>{consolidationStatus}</span>
        </div>
      )}

      {/* Download Options Modal */}
      <DownloadOptionsModal
        isOpen={isModalOpen}
        onClose={onCloseModal}
        onDownload={onDownload}
        onProcess={onProcess}
        hasTranslation={translatedSubtitles && translatedSubtitles.length > 0}
        hasOriginal={lyrics && lyrics.length > 0}
        sourceSubtitleName={sourceSubtitleName}
        videoName={videoName}
        targetLanguages={targetLanguages}
      />
    </div>
  );
};

export default LyricsDownloadAndOutput;
