import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/OutputContainer.css';
import VideoPreview from './previews/VideoPreview';
import LyricsDisplay from './LyricsDisplay';
import TranslationSection from './TranslationSection';
import ParallelProcessingStatus from './ParallelProcessingStatus';

const OutputContainer = ({ status, subtitlesData, setSubtitlesData, selectedVideo, uploadedFile, isGenerating, segmentsStatus = [], activeTab, onRetrySegment, onRetryWithModel, onGenerateSegment, videoSegments = [], retryingSegments = [], timeFormat = 'seconds', showWaveform = true }) => {
  const { t } = useTranslation();
  const [currentTabIndex, setCurrentTabIndex] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [editedLyrics, setEditedLyrics] = useState(null);
  const [translatedSubtitles, setTranslatedSubtitles] = useState(null);
  const [seekTime, setSeekTime] = useState(null); // Track when seeking happens

  const handleLyricClick = (time) => {
    setCurrentTabIndex(time);
  };

  const handleVideoSeek = (time) => {
    // Set the seek time to trigger timeline centering
    setSeekTime(time);

    // Reset the seek time in the next frame to allow future seeks
    requestAnimationFrame(() => {
      setSeekTime(null);
    });
  };

  const handleUpdateLyrics = (updatedLyrics) => {
    setEditedLyrics(updatedLyrics);
  };

  // Handle saving subtitles
  const handleSaveSubtitles = (savedLyrics) => {
    // Update the edited lyrics state with the saved lyrics
    setEditedLyrics(savedLyrics);
    // Also update the subtitlesData in the parent component
    // This ensures that if the page is reloaded, the saved subtitles will be used
    if (setSubtitlesData) {
      setSubtitlesData(savedLyrics);
    }
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

  // When subtitles are loaded from cache, they should be considered as the source of truth
  // This ensures that saved edits are properly loaded when the page is reloaded

  // Download functionality moved to LyricsDisplay component

  // Set video source when a video is selected or file is uploaded
  const [videoSource, setVideoSource] = useState('');
  const [actualVideoUrl, setActualVideoUrl] = useState('');
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
        // Show segments status only for file-upload tab and when segments exist
        segmentsStatus.length > 0 && !activeTab.includes('youtube') ? (
          <ParallelProcessingStatus
            segments={segmentsStatus}
            overallStatus={status.message}
            statusType={status.type}
            onRetrySegment={(segmentIndex) => {
              console.log('OutputContainer: Retrying segment', segmentIndex, 'with videoSegments:', videoSegments);
              onRetrySegment && onRetrySegment(segmentIndex, videoSegments);
            }}
            onRetryWithModel={(segmentIndex, modelId) => {
              console.log('OutputContainer: Retrying segment', segmentIndex, 'with model', modelId, 'and videoSegments:', videoSegments);
              onRetryWithModel && onRetryWithModel(segmentIndex, modelId, videoSegments);
            }}
            onGenerateSegment={(segmentIndex) => {
              console.log('OutputContainer: Generating segment', segmentIndex, 'with videoSegments:', videoSegments);
              onGenerateSegment && onGenerateSegment(segmentIndex, videoSegments);
            }}
            retryingSegments={retryingSegments}
          />
        ) : (
          <div className={`status ${status.type}`}>{status.message}</div>
        )
      )}

      {subtitlesData && (
        <>
          <div className="preview-section">
            <VideoPreview
              currentTime={currentTabIndex}
              setCurrentTime={setCurrentTabIndex}
              subtitle={editedLyrics?.find(s => currentTabIndex >= s.start && currentTabIndex <= s.end)?.text ||
                       subtitlesData.find(s => currentTabIndex >= s.start && currentTabIndex <= s.end)?.text || ''}
              videoSource={videoSource}
              setDuration={setVideoDuration}
              onSeek={handleVideoSeek}
              translatedSubtitles={translatedSubtitles}
              subtitlesArray={editedLyrics || subtitlesData}
              onVideoUrlReady={setActualVideoUrl}
            />

            <LyricsDisplay
              matchedLyrics={formatSubtitlesForLyricsDisplay(subtitlesData)}
              currentTime={currentTabIndex}
              onLyricClick={handleLyricClick}
              onUpdateLyrics={handleUpdateLyrics}
              onSaveSubtitles={handleSaveSubtitles}
              allowEditing={true}
              duration={videoDuration}
              seekTime={seekTime}
              timeFormat={timeFormat}
              videoSource={actualVideoUrl}
              showWaveform={showWaveform}
              translatedSubtitles={translatedSubtitles}
              videoTitle={selectedVideo?.title || uploadedFile?.name?.replace(/\.[^/.]+$/, '') || 'subtitles'}
            />

            {/* Download buttons moved to LyricsDisplay component */}
          </div>

          {/* Translation Section */}
          <TranslationSection
            subtitles={editedLyrics || subtitlesData}
            videoTitle={selectedVideo?.title || uploadedFile?.name?.replace(/\.[^/.]+$/, '') || 'subtitles'}
            onTranslationComplete={setTranslatedSubtitles}
          />
        </>
      )}
    </div>
  );
};

export default OutputContainer;