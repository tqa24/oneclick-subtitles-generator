import React, { useEffect } from 'react';
import Header from '../Header';
import InputMethods from '../InputMethods';
import OutputContainer from '../OutputContainer';
import ButtonsContainer from './ButtonsContainer';
import SettingsModal from '../settings/SettingsModal';
import TranslationWarningToast from '../TranslationWarningToast';
import VideoAnalysisModal from '../VideoAnalysisModal';
import TranscriptionRulesEditor from '../TranscriptionRulesEditor';
import ServerConnectionOverlay from '../ServerConnectionOverlay';

/**
 * Main application layout component
 */
const AppLayout = ({
  appState,
  appHandlers,
  modalHandlers,
  t
}) => {
  const {
    showSettings, setShowSettings,
    activeTab,
    selectedVideo, setSelectedVideo,
    uploadedFile, setUploadedFile,
    apiKeysSet, setApiKeysSet,
    isAppReady,
    isGenerating,
    isDownloading,
    downloadProgress,
    currentDownloadId,
    isRetrying,
    isSrtOnlyMode, setIsSrtOnlyMode,
    showVideoAnalysis, setShowVideoAnalysis,
    videoAnalysisResult, setVideoAnalysisResult,
    segmentsStatus,
    videoSegments,
    showRulesEditor, setShowRulesEditor,
    userProvidedSubtitles,
    useUserProvidedSubtitles,
    transcriptionRules, setTranscriptionRulesState,
    subtitlesData, setSubtitlesData,
    status,
    timeFormat,
    showWaveform,
    useOptimizedPreview,
    optimizeVideos,
    optimizedResolution,
    retryingSegments,
    retrySegment
  } = appState;

  const {
    validateInput,
    handleSrtUpload,
    handleGenerateSubtitles,
    handleRetryGeneration,
    handleCancelDownload,
    handleTabChange,
    saveApiKeys
  } = appHandlers;

  const {
    handleUseRecommendedPreset,
    handleUseDefaultPreset,
    handleEditRules,
    handleSaveRules,
    handleViewRules,
    handleUserSubtitlesAdd,
    handleAbortVideoAnalysis
  } = modalHandlers;

  // Handler for generating a specific segment (for strong model)
  const handleGenerateSegment = async (segmentIndex, segments) => {
    if (!segments || !segments[segmentIndex]) {
      console.error('No segment found at index', segmentIndex);
      return;
    }

    // Prepare options for segment generation
    const segmentOptions = {};

    // Add user-provided subtitles if available and enabled
    if (useUserProvidedSubtitles && userProvidedSubtitles) {
      segmentOptions.userProvidedSubtitles = userProvidedSubtitles;
    }

    // Use the retrySegment function which will properly combine this segment's results
    // with any previously processed segments
    await retrySegment(segmentIndex, segments, segmentOptions);
  };

  // Handler for retrying a segment with a specific model
  const handleRetryWithModel = async (segmentIndex, modelId, segments) => {
    if (!segments || !segments[segmentIndex]) {
      console.error('No segment found at index', segmentIndex);
      return;
    }

    // Save the current model
    const currentModel = localStorage.getItem('gemini_model');

    // Temporarily set the selected model
    localStorage.setItem('gemini_model', modelId);

    // Prepare options for segment retry
    const segmentOptions = {};

    // Add user-provided subtitles if available and enabled
    if (useUserProvidedSubtitles && userProvidedSubtitles) {
      segmentOptions.userProvidedSubtitles = userProvidedSubtitles;
    }

    try {
      // Use the retrySegment function with the temporarily set model
      await retrySegment(segmentIndex, segments, segmentOptions);
    } finally {
      // Restore the original model
      if (currentModel) {
        localStorage.setItem('gemini_model', currentModel);
      } else {
        localStorage.removeItem('gemini_model');
      }
    }
  };

  // Handle when video source is removed or added
  useEffect(() => {
    // If we have subtitles data but no video source, switch to SRT-only mode
    if (!selectedVideo && !uploadedFile && subtitlesData) {
      setIsSrtOnlyMode(true);
    }
    // If we have a video source, switch to normal mode
    else if ((selectedVideo || uploadedFile) && subtitlesData && isSrtOnlyMode) {
      setIsSrtOnlyMode(false);
    }
  }, [selectedVideo, uploadedFile, subtitlesData, isSrtOnlyMode, setIsSrtOnlyMode]);

  return (
    <>
      <Header
        onSettingsClick={() => setShowSettings(true)}
      />

      {isAppReady && (
        <main className="app-main">
          <InputMethods
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            selectedVideo={selectedVideo}
            setSelectedVideo={setSelectedVideo}
            uploadedFile={uploadedFile}
            setUploadedFile={setUploadedFile}
            apiKeysSet={apiKeysSet}
            isSrtOnlyMode={isSrtOnlyMode}
            setIsSrtOnlyMode={setIsSrtOnlyMode}
          />

          {/* Consistent layout container for buttons and output */}
          <div className="content-layout-container">
            <ButtonsContainer
              handleSrtUpload={handleSrtUpload}
              handleGenerateSubtitles={handleGenerateSubtitles}
              handleRetryGeneration={handleRetryGeneration}
              handleCancelDownload={handleCancelDownload}
              handleUserSubtitlesAdd={handleUserSubtitlesAdd}
              handleAbortVideoAnalysis={handleAbortVideoAnalysis}
              validateInput={validateInput}
              isGenerating={isGenerating}
              isDownloading={isDownloading}
              downloadProgress={downloadProgress}
              currentDownloadId={currentDownloadId}
              isRetrying={isRetrying}
              setIsRetrying={appState.setIsRetrying}
              retryingSegments={retryingSegments}
              segmentsStatus={segmentsStatus}
              subtitlesData={subtitlesData}
              status={status}
              userProvidedSubtitles={userProvidedSubtitles}
              selectedVideo={selectedVideo}
              uploadedFile={uploadedFile}
              isSrtOnlyMode={isSrtOnlyMode}
              t={t}
            />

            <OutputContainer
              status={status}
              subtitlesData={subtitlesData}
              setSubtitlesData={setSubtitlesData}
              selectedVideo={selectedVideo}
              uploadedFile={uploadedFile}
              isGenerating={isGenerating}
              segmentsStatus={segmentsStatus}
              activeTab={activeTab}
              onRetrySegment={retrySegment}
              onRetryWithModel={handleRetryWithModel}
              onGenerateSegment={handleGenerateSegment}
              videoSegments={videoSegments}
              retryingSegments={retryingSegments}
              timeFormat={timeFormat}
              showWaveform={showWaveform}
              useOptimizedPreview={useOptimizedPreview}
              isSrtOnlyMode={isSrtOnlyMode}
              onViewRules={handleViewRules}
              userProvidedSubtitles={userProvidedSubtitles}
              onUserSubtitlesAdd={handleUserSubtitlesAdd}
            />
          </div>
        </main>
      )}

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onSave={saveApiKeys}
          apiKeysSet={apiKeysSet}
          setApiKeysSet={setApiKeysSet}
          optimizeVideos={optimizeVideos}
          optimizedResolution={optimizedResolution}
          useOptimizedPreview={useOptimizedPreview}
        />
      )}

      {/* Video Analysis Modal */}
      {/* Check if we should show the modal */}
      {((showVideoAnalysis || localStorage.getItem('show_video_analysis') === 'true') &&
        (videoAnalysisResult || localStorage.getItem('video_analysis_result'))) && (
        <VideoAnalysisModal
          isOpen={true}
          onClose={() => {
            // Clear localStorage flags
            localStorage.removeItem('show_video_analysis');
            localStorage.removeItem('video_analysis_timestamp');
            localStorage.removeItem('video_analysis_result');
            setShowVideoAnalysis(false);
            setVideoAnalysisResult(null);
            // Use default preset if user closes the modal
            handleUseDefaultPreset();
          }}
          analysisResult={videoAnalysisResult}
          onUsePreset={handleUseRecommendedPreset}
          onUseDefaultPreset={handleUseDefaultPreset}
          onEditRules={handleEditRules}
        />
      )}

      {/* Transcription Rules Editor */}
      {showRulesEditor && transcriptionRules && (
        <TranscriptionRulesEditor
          isOpen={showRulesEditor}
          onClose={(action) => {
            setShowRulesEditor(false);
            // Reopen the video analysis modal only if it was previously open
            if ((action === 'cancel' || action === 'save') && videoAnalysisResult) {
              setShowVideoAnalysis(true);
              // Set localStorage flag to ensure modal stays open
              localStorage.setItem('show_video_analysis', 'true');
              // If we have a video analysis result, make sure it's available
              localStorage.setItem('video_analysis_result', JSON.stringify(videoAnalysisResult));
              localStorage.setItem('video_analysis_timestamp', Date.now().toString());
            }
          }}
          initialRules={transcriptionRules}
          onSave={handleSaveRules}
        />
      )}

      {/* Toast for translation warnings */}
      <TranslationWarningToast />

      {/* Server connection overlay - make sure the URL matches your server */}
      <ServerConnectionOverlay serverUrl="http://localhost:3004" />
    </>
  );
};

export default AppLayout;
