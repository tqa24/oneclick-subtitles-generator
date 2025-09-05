import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiEdit, FiX } from 'react-icons/fi';
import LoadingIndicator from './common/LoadingIndicator';
import TranscriptionRulesEditor from './TranscriptionRulesEditor';
import { analyzeVideoAndWaitForUserChoice } from '../utils/videoProcessing/analysisUtils';
import { getTranscriptionRulesSync, setTranscriptionRules, clearTranscriptionRules, getCurrentCacheId } from '../utils/transcriptionRulesStore';
import '../styles/VideoAnalysisButton.css';


// Custom analyze icon: panel with Gemini star inside
const AnalyzeIcon = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {/* Outer panel */}
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    {/* Side ticks (longer) */}
    <line x1="2.5" y1="8" x2="6.5" y2="8" />
    <line x1="2.5" y1="16" x2="6.5" y2="16" />
    <line x1="17.5" y1="8" x2="21.5" y2="8" />
    <line x1="17.5" y1="16" x2="21.5" y2="16" />
    {/* Gemini star inside (even bigger) */}
    <path d="M12 6 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2 2 -4 z" fill="currentColor" stroke="none" />
  </svg>
);

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
  const [lastVideoIdentifier, setLastVideoIdentifier] = useState(null);

  // Check for existing transcription rules on mount
  useEffect(() => {
    const checkExistingRules = () => {
      const rules = getTranscriptionRulesSync();
      setHasAnalysis(!!rules);
      setTranscriptionRulesState(rules);
    };

    checkExistingRules();

    // Listen for openRulesEditor event to skip countdown modal
    const handleOpenRulesEditor = (event) => {
      const { transcriptionRules, recommendedPresetId } = event.detail;
      if (transcriptionRules) {
        setTranscriptionRulesState(transcriptionRules);
        setHasAnalysis(true);

        // Ensure the recommended preset is set in session storage
        if (recommendedPresetId) {
          sessionStorage.setItem('current_session_preset_id', recommendedPresetId);
        }

        setShowRulesEditor(true);
      }
    };

    window.addEventListener('openRulesEditor', handleOpenRulesEditor);

    return () => {
      window.removeEventListener('openRulesEditor', handleOpenRulesEditor);
    };
  }, []);

  // React to video file changes
  useEffect(() => {
    // Get a unique identifier for the current video
    // Include file size and last modified date for better uniqueness
    const getVideoFingerprint = (file) => {
      if (!file) return null;
      return `${file.name}_${file.size}_${file.lastModified || ''}`;
    };
    
    const currentFingerprint = getVideoFingerprint(uploadedFileData || uploadedFile);
    
    // Check if video has actually changed
    if (currentFingerprint !== lastVideoIdentifier) {
      console.log('[VideoAnalysisButton] Video changed from:', lastVideoIdentifier, 'to:', currentFingerprint);
      
      // Clear everything when video changes or is removed
      setHasAnalysis(false);
      setTranscriptionRulesState(null);
      setShowRulesEditor(false);
      setIsAnalyzing(false);
      
      // Update the last video identifier
      setLastVideoIdentifier(currentFingerprint);
      
      // Clear the transcription rules from storage when switching videos or clearing video
      if (lastVideoIdentifier !== null) {
        // Clear rules when:
        // 1. Switching from one video to another
        // 2. Clearing the video (currentFingerprint is null)
        clearTranscriptionRules().catch(err => {
          console.error('[VideoAnalysisButton] Error clearing rules on video change:', err);
        });
      } else if (currentFingerprint) {
        // First video loaded - check if we have rules for it
        const rules = getTranscriptionRulesSync();
        if (rules) {
          console.log('[VideoAnalysisButton] Found existing rules on initial load');
          setHasAnalysis(true);
          setTranscriptionRulesState(rules);
        }
      }
    }
  }, [uploadedFile, uploadedFileData, lastVideoIdentifier]);

  // Listen for transcription rules updates
  useEffect(() => {
    const handleRulesUpdated = (event) => {
      const { rules } = event.detail;
      // Only update if the rules are different from what we have
      if (JSON.stringify(rules) !== JSON.stringify(transcriptionRules)) {
        setHasAnalysis(!!rules);
        setTranscriptionRulesState(rules);
      }
    };

    window.addEventListener('transcriptionRulesUpdated', handleRulesUpdated);

    return () => {
      window.removeEventListener('transcriptionRulesUpdated', handleRulesUpdated);
    };
  }, [transcriptionRules]);

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

    // Video analysis is always enabled

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
                <LoadingIndicator
                  theme="light"
                  showContainer={false}
                  size={16}
                  className="analysis-processing-loading"
                  color="#FFFFFF"
                />
                <span className="processing-text">
                  {t('videoAnalysis.analyzing', 'Analyzing...')}
                </span>
              </span>
            ) : hasAnalysis ? (
              <>
                <FiEdit className="icon" />
                <span>{t('videoAnalysis.editRules', 'Edit rules')}</span>
              </>
            ) : (
              <>
                <AnalyzeIcon size={16} />
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
