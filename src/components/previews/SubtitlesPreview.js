import React from 'react';
import { useTranslation } from 'react-i18next';

const SubtitlesPreview = ({ subtitles }) => {
  const { t } = useTranslation();

  if (!subtitles || subtitles.length === 0) {
    return <p>{t('preview.noSubtitles', 'No subtitles to display.')}</p>;
  }

  // Format time for display (seconds to MM:SS.mmm)
  const formatTimeForDisplay = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const milliseconds = Math.floor((timeInSeconds % 1) * 1000);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  return (
    <div className="subtitles-preview">
      {subtitles.map((subtitle) => (
        <div key={subtitle.id} className="subtitle-item">
          <div className="subtitle-timing">
            {formatTimeForDisplay(subtitle.start)} → {formatTimeForDisplay(subtitle.end)}
          </div>
          <div className="subtitle-text">{subtitle.text}</div>
        </div>
      ))}
    </div>
  );
};

export default SubtitlesPreview;