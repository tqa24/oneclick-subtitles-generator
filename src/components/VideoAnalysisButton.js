import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiPlay, FiEdit, FiX } from 'react-icons/fi';
import TranscriptionRulesEditor from './TranscriptionRulesEditor';
import { analyzeVideoAndWaitForUserChoice } from '../utils/videoProcessing/analysisUtils';
import { getTranscriptionRulesSync, setTranscriptionRules, clearTranscriptionRules } from '../utils/transcriptionRulesStore';
import '../styles/VideoAnalysisButton.css';

/**
 * Button component for video analysis functionality
 * @param {Object} props - Component props
 * @param {boolean} props.disabled - Whether the button is disabled
 * @param {File} props.uploadedFile - The uploaded file (original)
 * @param {File} props.uploadedFileData - The processed file data (ready for processing)
 * @returns {JSX.Element} - Rendered component
 */
const VideoAnalysisButton = ({ disabled = false, uploadedFile = null, uploadedFileData = null }) => {
  const { t } = useTranslation();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const [showRulesEditor, setShowRulesEditor] = useState(false);
  const [transcriptionRules, setTranscriptionRulesState] = useState(null);

  // Check for existing transcription rules on mount
  useEffect(() => {
    const checkExistingRules = () => {
      const rules = getTranscriptionRulesSync();
      setHasAnalysis(!!rules);
      setTranscriptionRulesState(rules);
    };

    checkExistingRules();
  }, []);

  // Get current video file for analysis (same logic as VideoProcessingOptionsModal)
  const getCurrentVideoFile = () => {
    // Use the same priority as VideoProcessingOptionsModal: uploadedFileData || uploadedFile
    const videoFile = uploadedFileData || uploadedFile;

    if (videoFile) {
      console.log('[VideoAnalysisButton] Found video file:', videoFile.name || 'unnamed file');
      return videoFile;
    }

    // Fallback: Try to get from window globals (legacy support)
    const windowUploadedFile = window.uploadedVideoFile;
    if (windowUploadedFile) {
      console.log('[VideoAnalysisButton] Found video file from window.uploadedVideoFile:', windowUploadedFile.name);
      return windowUploadedFile;
    }

    const windowDownloadedFile = window.downloadedVideoFile;
    if (windowDownloadedFile) {
      console.log('[VideoAnalysisButton] Found video file from window.downloadedVideoFile:', windowDownloadedFile.name);
      return windowDownloadedFile;
    }

    console.log('[VideoAnalysisButton] No video file found');
    return null;
  };

  const handleAnalyzeVideo = async () => {
    const videoFile = getCurrentVideoFile();
    if (!videoFile) {
      alert(t('videoAnalysis.noVideoFile', 'No video file available for analysis. Please upload or download a video first.'));
      return;
    }

    // Check if video analysis is enabled
    const useVideoAnalysis = localStorage.getItem('use_video_analysis') !== 'false';
    if (!useVideoAnalysis) {
      alert(t('videoAnalysis.disabled', 'Video analysis is disabled in settings. Please enable it in the Video Processing tab.'));
      return;
    }

    setIsAnalyzing(true);

    try {
      // Create a status update callback
      const onStatusUpdate = (status) => {
        console.log('Video analysis status:', status.message);
      };

      // Perform video analysis
      const result = await analyzeVideoAndWaitForUserChoice(videoFile, onStatusUpdate, t);
      
      if (result && result.analysisResult && result.analysisResult.transcriptionRules) {
        setHasAnalysis(true);
        setTranscriptionRulesState(result.analysisResult.transcriptionRules);
      }
    } catch (error) {
      console.error('Error during video analysis:', error);
      alert(t('videoAnalysis.error', 'Video analysis failed: {{message}}', { message: error.message }));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleEditRules = () => {
    setShowRulesEditor(true);
  };

  const handleSaveRules = async (editedRules) => {
    setTranscriptionRulesState(editedRules);
    await setTranscriptionRules(editedRules);
    setHasAnalysis(!!editedRules);
    setShowRulesEditor(false);
  };

  const handleClearAnalysis = async () => {
    await clearTranscriptionRules();
    setHasAnalysis(false);
    setTranscriptionRulesState(null);
  };

  const handleCloseRulesEditor = () => {
    setShowRulesEditor(false);
  };

  const handleChangePrompt = (preset) => {
    // Handle prompt changes if needed
    console.log('Prompt changed to:', preset);
  };

  return (
    <>
      <div className="video-analysis-buttons-group">
        <div className="video-analysis-button-container">
          <button
            className={`video-analysis-button ${hasAnalysis ? 'has-analysis' : ''} ${isAnalyzing ? 'processing' : ''}`}
            onClick={hasAnalysis ? handleEditRules : handleAnalyzeVideo}
            disabled={disabled || isAnalyzing}
            title={hasAnalysis
              ? t('videoAnalysis.editTooltip', 'Edit transcription rules')
              : t('videoAnalysis.analyzeTooltip', 'Analyze video to generate transcription rules')}
          >
            {/* Dynamic Gemini effects container - populated by particle system */}
            <div className="gemini-icon-container"></div>

            {isAnalyzing ? (
              <span className="processing-text-container">
                <span className="processing-gemini-icon">
                  <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </span>
                <span className="processing-text">
                  {t('videoAnalysis.analyzing', 'Analyzing...')}
                </span>
                <span className="processing-dots"></span>
              </span>
            ) : hasAnalysis ? (
              <>
                <FiEdit className="icon" />
                <span>{t('videoAnalysis.editRules', 'Edit rules')}</span>
              </>
            ) : (
              <>
                <FiPlay size={16} />
                <span>{t('videoAnalysis.addAnalysis', 'Add analysis')}</span>
              </>
            )}
          </button>
        </div>

        {/* Separate clear button */}
        {hasAnalysis && !isAnalyzing && (
          <button
            className="clear-analysis-button"
            onClick={handleClearAnalysis}
            title={t('videoAnalysis.clearAnalysis', 'Clear video analysis')}
            data-tooltip={t('videoAnalysis.clearAnalysis', 'Clear video analysis')}
            aria-label={t('videoAnalysis.clearAnalysis', 'Clear video analysis')}
            disabled={disabled}
          >
            <FiX size={18} />
          </button>
        )}
      </div>

      {/* Transcription Rules Editor Modal */}
      {showRulesEditor && (
        <TranscriptionRulesEditor
          isOpen={showRulesEditor}
          onClose={handleCloseRulesEditor}
          initialRules={transcriptionRules}
          onSave={handleSaveRules}
          onCancel={handleCloseRulesEditor}
          onChangePrompt={handleChangePrompt}
        />
      )}
    </>
  );
};

export default VideoAnalysisButton;
