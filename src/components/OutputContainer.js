import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/OutputContainer.css';
import VideoPreview from './previews/VideoPreview';
import LyricsDisplay from './LyricsDisplay';

const OutputContainer = ({ status, subtitlesData, selectedVideo, uploadedFile, isGenerating }) => {
  const { t } = useTranslation();
  const [currentTabIndex, setCurrentTabIndex] = useState(0);

  const handleLyricClick = (time) => {
    setCurrentTabIndex(time);
  };

  const handleUpdateLyrics = (updatedLyrics) => {
    // Handle lyrics update logic if needed
  };

  const formatSubtitlesForLyricsDisplay = (subtitles) => {
    return subtitles.map(sub => ({
      ...sub,
      startTime: sub.start,
      endTime: sub.end
    }));
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
  
  // Display formatted subtitles or edited subtitles
  const displaySubtitles = subtitlesData;
  
  return (
    <div className="output-container">
      <div className={`status ${status.type}`}>{status.message}</div>
      
      {displaySubtitles && (
        <>
          {/* Video Preview with Subtitles - Always shown */}
          <div className="preview-section">
            <h3>{t('output.videoPreview', 'Video Preview with Subtitles')}</h3>
            
            <VideoPreview 
              currentTime={currentTabIndex}
              setCurrentTime={setCurrentTabIndex}
              subtitle={displaySubtitles.find(s => currentTabIndex >= s.start && currentTabIndex <= s.end)?.text || ''}
              videoSource={videoSource}
            />
            
            <LyricsDisplay 
              matchedLyrics={formatSubtitlesForLyricsDisplay(displaySubtitles)}
              currentTime={currentTabIndex}
              onLyricClick={handleLyricClick}
              onUpdateLyrics={handleUpdateLyrics}
              allowEditing={true}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default OutputContainer;