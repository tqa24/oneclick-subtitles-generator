import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/OutputContainer.css';
import SubtitlesPreview from './previews/SubtitlesPreview';
import VideoPreview from './previews/VideoPreview';
import LyricsDisplay from './LyricsDisplay';

const OutputContainer = ({ status, subtitlesData, selectedVideo }) => {
  const { t } = useTranslation();
  const [currentTime, setCurrentTime] = useState(0);
  const [showTimingEditor, setShowTimingEditor] = useState(false);
  const [editedSubtitles, setEditedSubtitles] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoSource, setVideoSource] = useState('');
  const [isDownloadingVideo, setIsDownloadingVideo] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  
  // Set video source when a video is selected
  useEffect(() => {
    if (selectedVideo?.url) {
      setVideoSource(selectedVideo.url);
      // Save to localStorage for persistence
      localStorage.setItem('current_video_url', selectedVideo.url);
    } else {
      // Try to load from localStorage if no video is selected
      const savedUrl = localStorage.getItem('current_video_url');
      if (savedUrl) {
        setVideoSource(savedUrl);
      }
    }
  }, [selectedVideo]);
  
  // Convert subtitles data format for LyricsDisplay
  const formatSubtitlesForLyricsDisplay = (subtitles) => {
    if (!subtitles) return [];
    
    return subtitles.map(subtitle => ({
      id: subtitle.id,
      start: subtitle.start,
      end: subtitle.end,
      text: subtitle.text
    }));
  };
  
  // Handle lyric click (for seeking in video)
  const handleLyricClick = (time) => {
    setCurrentTime(time);
  };
  
  // Update subtitles when edited
  const handleUpdateLyrics = (updatedLyrics) => {
    setEditedSubtitles(updatedLyrics);
  };
  
  // Convert subtitles to SRT format
  const convertToSRT = (subtitles) => {
    return subtitles.map((subtitle, index) => {
      const id = index + 1;
      
      // Convert seconds to HH:MM:SS,mmm format
      const formatTime = seconds => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
      };
      
      const startTime = formatTime(subtitle.start);
      const endTime = formatTime(subtitle.end);
      
      return `${id}\n${startTime} --> ${endTime}\n${subtitle.text}\n`;
    }).join('\n');
  };
  
  // Download subtitles as SRT file
  const downloadSRT = () => {
    const subtitlesToUse = editedSubtitles || subtitlesData;
    if (!subtitlesToUse) return;
    
    const srtContent = convertToSRT(subtitlesToUse);
    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subtitles.srt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Download subtitles as JSON file
  const downloadJSON = () => {
    const subtitlesToUse = editedSubtitles || subtitlesData;
    if (!subtitlesToUse) return;
    
    const jsonContent = JSON.stringify(subtitlesToUse, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subtitles.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Toggle timing editor
  const toggleTimingEditor = () => {
    setShowTimingEditor(!showTimingEditor);
  };

  // Display formatted subtitles or edited subtitles
  const displaySubtitles = editedSubtitles || subtitlesData;
  
  return (
    <div className="output-container">
      <div className={`status ${status.type}`}>{status.message}</div>
      
      {displaySubtitles && (
        <>
          {/* Video Preview with Subtitles (Shown when editing timings) */}
          {showTimingEditor && (
            <div className="preview-section">
              <h3>{t('output.videoPreview', 'Video Preview with Subtitles')}</h3>
              
              <VideoPreview 
                currentTime={currentTime}
                setCurrentTime={setCurrentTime}
                subtitle={displaySubtitles.find(s => currentTime >= s.start && currentTime <= s.end)?.text || ''}
                setDuration={setVideoDuration}
                videoSource={videoSource}
              />
              
              <LyricsDisplay 
                matchedLyrics={formatSubtitlesForLyricsDisplay(displaySubtitles)}
                currentTime={currentTime}
                onLyricClick={handleLyricClick}
                duration={videoDuration}
                onUpdateLyrics={handleUpdateLyrics}
                allowEditing={true}
              />
            </div>
          )}
          
          {/* Subtitles Preview */}
          <div className="preview-container">
            <h3>{t('output.subtitlesPreview', 'Subtitle Preview')}</h3>
            <SubtitlesPreview subtitles={displaySubtitles} />
          </div>
          
          {/* Download options */}
          <div className="download-options">
            <button 
              className="download-btn" 
              onClick={downloadSRT} 
              disabled={!displaySubtitles}
            >
              {t('output.downloadSrt', 'Download SRT')}
            </button>
            
            <button 
              className="download-btn" 
              onClick={downloadJSON} 
              disabled={!displaySubtitles}
            >
              {t('output.downloadJson', 'Download JSON')}
            </button>
            
            <button 
              className={`edit-btn ${showTimingEditor ? 'active' : ''}`} 
              onClick={toggleTimingEditor} 
              disabled={!displaySubtitles}
            >
              {showTimingEditor 
                ? t('output.hideEditor', 'Hide Timing Editor') 
                : t('output.editTimings', 'Edit Timings')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default OutputContainer;