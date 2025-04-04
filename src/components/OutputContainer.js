import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/OutputContainer.css';
import VideoPreview from './previews/VideoPreview';
import LyricsDisplay from './LyricsDisplay';
import ParallelProcessingStatus from './ParallelProcessingStatus';

const OutputContainer = ({ status, subtitlesData, selectedVideo, uploadedFile, isGenerating, segmentsStatus = [], activeTab }) => {
  const { t } = useTranslation();
  const [currentTabIndex, setCurrentTabIndex] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [editedLyrics, setEditedLyrics] = useState(null);

  const handleLyricClick = (time) => {
    setCurrentTabIndex(time);
  };

  const handleUpdateLyrics = (updatedLyrics) => {
    setEditedLyrics(updatedLyrics);
  };

  const formatSubtitlesForLyricsDisplay = (subtitles) => {
    // If we have edited lyrics, use those instead of the original subtitles
    const sourceData = editedLyrics || subtitles;
    return sourceData?.map(sub => ({
      ...sub,
      startTime: sub.start,
      endTime: sub.end
    })) || [];
  };

  const convertToSRT = (subtitles) => {
    return subtitles.map((subtitle, index) => {
      const id = index + 1;
      const timeFormat = time => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        const milliseconds = Math.floor((time % 1) * 1000);
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
      };
      const startTime = timeFormat(subtitle.start);
      const endTime = timeFormat(subtitle.end);

      return `${id}\n${startTime} --> ${endTime}\n${subtitle.text}\n`;
    }).join('\n');
  };

  const downloadFile = (content, filename, contentType) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSRTDownload = () => {
    if (subtitlesData) {
      downloadFile(convertToSRT(subtitlesData), 'subtitles.srt', 'text/plain');
    }
  };

  const handleJSONDownload = () => {
    if (subtitlesData) {
      downloadFile(JSON.stringify(subtitlesData, null, 2), 'subtitles.json', 'application/json');
    }
  };

  // Set video source when a video is selected or file is uploaded
  const [videoSource, setVideoSource] = useState('');
  useEffect(() => {
    // First check for uploaded file
    const uploadedFileUrl = localStorage.getItem('current_file_url');
    if (uploadedFileUrl) {
      console.log('Setting video source to uploaded file:', uploadedFileUrl);
      setVideoSource(uploadedFileUrl);
      return;
    }

    // Then check for YouTube video
    if (selectedVideo?.url) {
      console.log('Setting video source to YouTube URL:', selectedVideo.url);
      setVideoSource(selectedVideo.url);
      return;
    }

    // Clear video source if nothing is selected
    setVideoSource('');
  }, [selectedVideo, uploadedFile]);

  // Reset edited lyrics when subtitlesData changes (new video/generation)
  useEffect(() => {
    setEditedLyrics(null);
  }, [subtitlesData]);

  // Don't render anything if there's no content to show
  if (!status?.message && !subtitlesData) {
    return null;
  }

  return (
    <div className="output-container">
      {status?.message && (
        // Only show segments status for file upload method and when segments exist
        activeTab === 'file-upload' && segmentsStatus.length > 0 ? (
          <ParallelProcessingStatus
            segments={segmentsStatus}
            overallStatus={status.message}
            statusType={status.type}
          />
        ) : (
          <div className={`status ${status.type}`}>{status.message}</div>
        )
      )}

      {subtitlesData && (
        <>
          <div className="preview-section">
            <h3>{t('output.videoPreview', 'Video Preview with Subtitles')}</h3>

            <VideoPreview
              currentTime={currentTabIndex}
              setCurrentTime={setCurrentTabIndex}
              subtitle={editedLyrics?.find(s => currentTabIndex >= s.start && currentTabIndex <= s.end)?.text ||
                       subtitlesData.find(s => currentTabIndex >= s.start && currentTabIndex <= s.end)?.text || ''}
              videoSource={videoSource}
              setDuration={setVideoDuration}
            />

            <LyricsDisplay
              matchedLyrics={formatSubtitlesForLyricsDisplay(subtitlesData)}
              currentTime={currentTabIndex}
              onLyricClick={handleLyricClick}
              onUpdateLyrics={handleUpdateLyrics}
              allowEditing={true}
              duration={videoDuration}
            />

            <div className="download-options">
              <button
                className="download-btn"
                onClick={handleSRTDownload}
                disabled={!subtitlesData || isGenerating}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                {t('output.downloadSrt', 'Download SRT')}
              </button>
              <button
                className="download-btn"
                onClick={handleJSONDownload}
                disabled={!subtitlesData || isGenerating}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                {t('output.downloadJson', 'Download JSON')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OutputContainer;