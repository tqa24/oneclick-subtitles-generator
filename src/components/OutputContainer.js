import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/OutputContainer.css';
import VideoPreview from './previews/VideoPreview';
import LyricsDisplay from './LyricsDisplay';
import TranslationSection from './translation';
import ParallelProcessingStatus from './ParallelProcessingStatus';
import AddSubtitlesButton from './AddSubtitlesButton';

const OutputContainer = ({
  status,
  subtitlesData,
  setSubtitlesData,
  selectedVideo,
  uploadedFile,
  isGenerating,
  segmentsStatus = [],
  activeTab,
  onRetrySegment,
  onRetryWithModel,
  onGenerateSegment,
  videoSegments = [],
  retryingSegments = [],
  timeFormat = 'seconds',
  showWaveform = true,
  useOptimizedPreview = false,
  isSrtOnlyMode = false,
  onViewRules,
  userProvidedSubtitles = '',
  onUserSubtitlesAdd
}) => {
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
    // Reset the actual video URL when the source changes
    setActualVideoUrl('');

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
    console.log('No video source found, clearing video source');
    setVideoSource('');
  }, [selectedVideo, uploadedFile]);

  // Calculate virtual duration for SRT-only mode
  useEffect(() => {
    if (isSrtOnlyMode && subtitlesData && subtitlesData.length > 0) {
      // Find the last subtitle's end time to use as virtual duration
      const lastSubtitle = [...subtitlesData].sort((a, b) => b.end - a.end)[0];
      if (lastSubtitle && lastSubtitle.end) {
        // Add a small buffer to the end (10 seconds)
        setVideoDuration(lastSubtitle.end + 10);
        console.log('Set virtual duration for SRT-only mode:', lastSubtitle.end + 10);
      }
    }
  }, [isSrtOnlyMode, subtitlesData]);

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
      {/* Add Subtitles Button removed - now only in buttons-container */}

      {/* Show status message or segments status */}
      {status?.message && (
        segmentsStatus.length > 0 && (!activeTab.includes('youtube') || subtitlesData) ? (
          <ParallelProcessingStatus
            segments={segmentsStatus}
            overallStatus={status?.message || t('output.segmentsReady', 'Video segments are ready for processing!')}
            statusType={status?.type || 'success'}
            onRetrySegment={(segmentIndex, segments, options) => {
              console.log('OutputContainer: Retrying segment', segmentIndex, 'with videoSegments:', videoSegments, 'options:', options);
              onRetrySegment && onRetrySegment(segmentIndex, videoSegments, options);
            }}
            userProvidedSubtitles={userProvidedSubtitles}
            onRetryWithModel={(segmentIndex, modelId) => {
              console.log('OutputContainer: Retrying segment', segmentIndex, 'with model', modelId, 'and videoSegments:', videoSegments);
              onRetryWithModel && onRetryWithModel(segmentIndex, modelId, videoSegments);
            }}
            onGenerateSegment={(segmentIndex) => {
              console.log('OutputContainer: Generating segment', segmentIndex, 'with videoSegments:', videoSegments);
              onGenerateSegment && onGenerateSegment(segmentIndex, videoSegments);
            }}
            retryingSegments={retryingSegments}
            onViewRules={onViewRules}
          />
        ) : (
          <div className={`status ${status.type}`}>{status.message}</div>
        )
      )}

      {/* Show segments status when we have segments and subtitles but no status message */}
      {!status?.message && segmentsStatus.length > 0 && subtitlesData && (
        <ParallelProcessingStatus
          segments={segmentsStatus}
          overallStatus={t('output.segmentsReady', 'Video segments are ready for processing!')}
          statusType="success"
          onRetrySegment={(segmentIndex, segments, options) => {
            console.log('OutputContainer: Retrying segment', segmentIndex, 'with videoSegments:', videoSegments, 'options:', options);
            onRetrySegment && onRetrySegment(segmentIndex, videoSegments, options);
          }}
          userProvidedSubtitles={userProvidedSubtitles}
          onRetryWithModel={(segmentIndex, modelId) => {
            console.log('OutputContainer: Retrying segment', segmentIndex, 'with model', modelId, 'and videoSegments:', videoSegments);
            onRetryWithModel && onRetryWithModel(segmentIndex, modelId, videoSegments);
          }}
          onGenerateSegment={(segmentIndex) => {
            console.log('OutputContainer: Generating segment', segmentIndex, 'with videoSegments:', videoSegments);
            onGenerateSegment && onGenerateSegment(segmentIndex, videoSegments);
          }}
          retryingSegments={retryingSegments}
          onViewRules={onViewRules}
        />
      )}

      {subtitlesData && (
        <>
          <div className="preview-section">
            {!isSrtOnlyMode && (
              <VideoPreview
                currentTime={currentTabIndex}
                setCurrentTime={setCurrentTabIndex}
                videoSource={videoSource}
                setDuration={setVideoDuration}
                onSeek={handleVideoSeek}
                translatedSubtitles={translatedSubtitles}
                subtitlesArray={editedLyrics || subtitlesData}
                onVideoUrlReady={setActualVideoUrl}
                useOptimizedPreview={useOptimizedPreview}
              />
            )}

            {isSrtOnlyMode && (
              <div className="srt-only-message">
                <div className="info-icon">
                  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                </div>
                <p>{t('output.srtOnlyModeInfo', 'Working with SRT file only. No video source available.')}</p>
                <p>{t('output.srtOnlyModeHint', 'You can still edit, translate, and download the subtitles.')}</p>
              </div>
            )}
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
              videoSource={isSrtOnlyMode ? null : actualVideoUrl}
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