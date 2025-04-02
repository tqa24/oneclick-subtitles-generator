import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/OutputContainer.css';
import VideoPreview from './previews/VideoPreview';
import LyricsDisplay from './LyricsDisplay';

const OutputContainer = ({ status, subtitlesData, selectedVideo, uploadedFile, isGenerating }) => {
  const { t } = useTranslation();
  const [currentTime, setCurrentTime] = useState(0);
  const [editedSubtitles, setEditedSubtitles] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoSource, setVideoSource] = useState('');
  const [isDownloadingVideo, setIsDownloadingVideo] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  
  // Set video source when a video is selected or file is uploaded
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
  
  // Display formatted subtitles or edited subtitles
  const displaySubtitles = editedSubtitles || subtitlesData;
  
  return (
    <div className="output-container">
      <div className={`status ${status.type}`}>{status.message}</div>
      
      {displaySubtitles && (
        <>
          {/* Video Preview with Subtitles - Always shown */}
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
          </div>
        </>
      )}
    </div>
  );
};

export default OutputContainer;