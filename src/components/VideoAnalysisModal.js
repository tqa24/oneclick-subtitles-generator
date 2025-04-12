import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/VideoAnalysisModal.css';
import { PROMPT_PRESETS } from '../services/geminiService';

const VideoAnalysisModal = ({
  isOpen,
  onClose,
  analysisResult,
  onUsePreset,
  onUseDefaultPreset,
  onEditRules
}) => {
  const { t } = useTranslation();
  const [showRules, setShowRules] = useState(false);

  // Get preset title based on ID
  const getPresetTitle = (presetId) => {
    const preset = PROMPT_PRESETS.find(p => p.id === presetId);
    if (!preset) return presetId;

    switch (preset.id) {
      case 'general':
        return t('settings.presetGeneralPurpose', 'General purpose');
      case 'extract-text':
        return t('settings.presetExtractText', 'Extract text');
      case 'focus-spoken-words':
        return t('settings.presetFocusSpokenWords', 'Focus on Spoken Words');
      case 'focus-lyrics':
        return t('settings.presetFocusLyrics', 'Focus on Lyrics');
      case 'describe-video':
        return t('settings.presetDescribeVideo', 'Describe video');
      case 'translate-vietnamese':
        return t('settings.presetTranslateDirectly', 'Translate directly');
      case 'chaptering':
        return t('settings.presetChaptering', 'Chaptering');
      case 'diarize-speakers':
        return t('settings.presetIdentifySpeakers', 'Identify Speakers');
      default:
        return preset.title || presetId;
    }
  };



  // Handle preview and edit rules
  const handlePreviewRules = () => {
    setShowRules(true);
  };

  // Handle use default preset
  const handleUseDefaultPreset = () => {
    onUseDefaultPreset();
  };

  // Handle edit rules
  const handleEditRules = () => {
    console.log('VideoAnalysisModal: handleEditRules called, passing rules to parent component');
    // Call the parent component's onEditRules function
    onEditRules(analysisResult.transcriptionRules);
    // Reset the local state
    setShowRules(false);
    // The parent component (App.js) will handle closing this modal
    console.log('VideoAnalysisModal: onEditRules called, waiting for parent to close modal');
  };

  // Handle continue with rules
  const handleContinueWithRules = () => {
    setShowRules(false);
    onUsePreset(analysisResult.recommendedPreset.id);
  };

  console.log('VideoAnalysisModal render - isOpen:', isOpen, 'analysisResult:', analysisResult);

  // Always show the modal when it's rendered
  // isOpen is now ignored

  if (!analysisResult) {
    console.log('VideoAnalysisModal - analysisResult is null, trying localStorage');
    // Try to get analysis result from localStorage
    try {
      const storedResult = JSON.parse(localStorage.getItem('video_analysis_result'));
      if (storedResult) {
        console.log('Using analysis result from localStorage');
        analysisResult = storedResult;
      } else {
        console.log('No analysis result in localStorage');
        return null;
      }
    } catch (error) {
      console.error('Error parsing analysis result from localStorage:', error);
      return null;
    }
  }

  return (
    <div className="video-analysis-modal-overlay">
      <div className="video-analysis-modal">
        {!showRules ? (
          <>
            <div className="modal-header">
              <h2>{t('videoAnalysis.title', 'Video Analysis Results')}</h2>
            </div>
            <div className="modal-content">
              <div className="analysis-result">
                <div className="recommended-preset">
                  <h3>{t('videoAnalysis.recommendedPreset', 'Recommended Preset')}</h3>
                  <div className="preset-card">
                    <h4>{getPresetTitle(analysisResult.recommendedPreset.id)}</h4>
                    <p>{analysisResult.recommendedPreset.reason}</p>
                  </div>
                </div>

                <div className="transcription-rules-summary">
                  <h3>{t('videoAnalysis.transcriptionRules', 'Transcription Rules')}</h3>
                  <p>{t('videoAnalysis.rulesDescription', 'A set of rules has been generated to ensure consistent transcription of this video.')}</p>
                  <button
                    className="preview-rules-button"
                    onClick={handlePreviewRules}
                  >
                    {t('videoAnalysis.previewRules', 'Preview & Edit Rules')}
                  </button>
                </div>
              </div>


            </div>
            <div className="modal-footer">
              <button
                className="use-default-button"
                onClick={handleUseDefaultPreset}
              >
                {t('videoAnalysis.useDefaultPreset', 'Use My Default Preset')}
              </button>
              <button
                className="use-recommended-button"
                onClick={() => onUsePreset(analysisResult.recommendedPreset.id)}
              >
                {t('videoAnalysis.useRecommended', 'Use Recommended')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="modal-header">
              <h2>{t('videoAnalysis.transcriptionRules', 'Transcription Rules')}</h2>
            </div>
            <div className="modal-content rules-content">
              {analysisResult.transcriptionRules.atmosphere && (
                <div className="rule-section">
                  <h3>{t('videoAnalysis.atmosphere', 'Atmosphere')}</h3>
                  <p>{analysisResult.transcriptionRules.atmosphere}</p>
                </div>
              )}

              {analysisResult.transcriptionRules.terminology && analysisResult.transcriptionRules.terminology.length > 0 && (
                <div className="rule-section">
                  <h3>{t('videoAnalysis.terminology', 'Terminology & Proper Nouns')}</h3>
                  <ul className="terminology-list">
                    {analysisResult.transcriptionRules.terminology.map((term, index) => (
                      <li key={index}>
                        <strong>{term.term}</strong>: {term.definition}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysisResult.transcriptionRules.speakerIdentification && analysisResult.transcriptionRules.speakerIdentification.length > 0 && (
                <div className="rule-section">
                  <h3>{t('videoAnalysis.speakerIdentification', 'Speaker Identification')}</h3>
                  <ul className="speakers-list">
                    {analysisResult.transcriptionRules.speakerIdentification.map((speaker, index) => (
                      <li key={index}>
                        <strong>{speaker.speakerId}</strong>: {speaker.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysisResult.transcriptionRules.formattingConventions && analysisResult.transcriptionRules.formattingConventions.length > 0 && (
                <div className="rule-section">
                  <h3>{t('videoAnalysis.formattingConventions', 'Formatting & Style Conventions')}</h3>
                  <ul>
                    {analysisResult.transcriptionRules.formattingConventions.map((convention, index) => (
                      <li key={index}>{convention}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysisResult.transcriptionRules.spellingAndGrammar && analysisResult.transcriptionRules.spellingAndGrammar.length > 0 && (
                <div className="rule-section">
                  <h3>{t('videoAnalysis.spellingAndGrammar', 'Spelling, Grammar & Punctuation')}</h3>
                  <ul>
                    {analysisResult.transcriptionRules.spellingAndGrammar.map((rule, index) => (
                      <li key={index}>{rule}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysisResult.transcriptionRules.relationships && analysisResult.transcriptionRules.relationships.length > 0 && (
                <div className="rule-section">
                  <h3>{t('videoAnalysis.relationships', 'Relationships & Social Hierarchy')}</h3>
                  <ul>
                    {analysisResult.transcriptionRules.relationships.map((relationship, index) => (
                      <li key={index}>{relationship}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysisResult.transcriptionRules.additionalNotes && analysisResult.transcriptionRules.additionalNotes.length > 0 && (
                <div className="rule-section">
                  <h3>{t('videoAnalysis.additionalNotes', 'Additional Notes')}</h3>
                  <ul>
                    {analysisResult.transcriptionRules.additionalNotes.map((note, index) => (
                      <li key={index}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="back-button"
                onClick={() => setShowRules(false)}
              >
                {t('videoAnalysis.back', 'Back')}
              </button>
              <button
                className="edit-rules-button"
                onClick={handleEditRules}
              >
                {t('videoAnalysis.editRules', 'Edit Rules')}
              </button>
              <button
                className="continue-button"
                onClick={handleContinueWithRules}
              >
                {t('videoAnalysis.continueWithRules', 'Continue with These Rules')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VideoAnalysisModal;
