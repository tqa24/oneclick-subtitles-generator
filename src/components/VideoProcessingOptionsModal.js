import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import '../styles/VideoProcessingOptionsModal.css';

/**
 * Modal for selecting video processing options after timeline segment selection
 */
const VideoProcessingOptionsModal = ({
  isOpen,
  onClose,
  onProcess,
  selectedSegment, // { start: number, end: number } in seconds
  videoDuration,
  isUploading = false
}) => {
  const { t } = useTranslation();
  const modalRef = useRef(null);
  
  // Processing options state
  const [fps, setFps] = useState(1); // Default 1 FPS
  const [mediaResolution, setMediaResolution] = useState('medium'); // low, medium, high
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash'); // Default model
  
  // Available options
  const fpsOptions = [
    { value: 0.25, label: '0.25 FPS (4s intervals)' },
    { value: 0.5, label: '0.5 FPS (2s intervals)' },
    { value: 1, label: '1 FPS (1s intervals)' },
    { value: 2, label: '2 FPS (0.5s intervals)' },
    { value: 5, label: '5 FPS (0.2s intervals)' }
  ];
  
  const resolutionOptions = [
    { value: 'low', label: t('processing.lowRes', 'Low (~66 tokens/frame)'), tokens: 66 },
    { value: 'medium', label: t('processing.mediumRes', 'Medium (~150 tokens/frame)'), tokens: 150 },
    { value: 'high', label: t('processing.highRes', 'High (~258 tokens/frame)'), tokens: 258 }
  ];
  
  const modelOptions = [
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (1M tokens)', maxTokens: 1048575 },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (1M tokens)', maxTokens: 1048575 },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (2M tokens)', maxTokens: 2000000 }
  ];
  
  // Calculate estimated token usage
  const calculateTokens = () => {
    if (!selectedSegment) return 0;
    
    const segmentDuration = selectedSegment.end - selectedSegment.start;
    const resolution = resolutionOptions.find(r => r.value === mediaResolution);
    const frameTokens = resolution ? resolution.tokens : 150;
    const audioTokens = 32; // tokens per second for audio
    
    return Math.round(segmentDuration * (fps * frameTokens + audioTokens));
  };
  
  const estimatedTokens = calculateTokens();
  const selectedModelData = modelOptions.find(m => m.value === selectedModel);
  const isWithinLimit = estimatedTokens <= (selectedModelData?.maxTokens || 1048575);
  
  // Format time for display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Handle form submission
  const handleProcess = () => {
    if (!selectedSegment || isUploading) return;
    
    const options = {
      fps,
      mediaResolution,
      model: selectedModel,
      segment: selectedSegment,
      estimatedTokens
    };
    
    onProcess(options);
  };
  
  // Handle escape key and outside clicks
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);
  
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };
  
  if (!isOpen) return null;
  
  return ReactDOM.createPortal(
    <div className="video-processing-modal-overlay" onClick={handleOverlayClick}>
      <div
        className="video-processing-modal"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{t('processing.configureOptions', 'Configure Processing Options')}</h3>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        
        <div className="modal-content">
          {/* Segment Info */}
          <div className="segment-info">
            <h4>{t('processing.selectedSegment', 'Selected Segment')}</h4>
            <p>
              {formatTime(selectedSegment?.start || 0)} - {formatTime(selectedSegment?.end || 0)}
              {' '}({Math.round((selectedSegment?.end || 0) - (selectedSegment?.start || 0))}s)
            </p>
          </div>
          
          {/* FPS Selection */}
          <div className="option-group">
            <label>{t('processing.frameRate', 'Frame Rate')}</label>
            <select value={fps} onChange={(e) => setFps(parseFloat(e.target.value))}>
              {fpsOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Media Resolution */}
          <div className="option-group">
            <label>{t('processing.mediaResolution', 'Media Resolution')}</label>
            <select value={mediaResolution} onChange={(e) => setMediaResolution(e.target.value)}>
              {resolutionOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Model Selection */}
          <div className="option-group">
            <label>{t('processing.model', 'Model')}</label>
            <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
              {modelOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Token Estimation */}
          <div className="token-estimation">
            <h4>{t('processing.estimatedTokens', 'Estimated Token Usage')}</h4>
            <div className={`token-count ${isWithinLimit ? 'within-limit' : 'exceeds-limit'}`}>
              {estimatedTokens.toLocaleString()} / {selectedModelData?.maxTokens.toLocaleString()} tokens
            </div>
            {!isWithinLimit && (
              <p className="warning">
                {t('processing.exceedsLimit', 'Warning: Estimated tokens exceed model limit. Consider reducing FPS or using a higher-capacity model.')}
              </p>
            )}
          </div>
          
          {/* Upload Status */}
          {isUploading && (
            <div className="upload-status">
              <div className="loading-spinner"></div>
              <span>{t('processing.uploading', 'Uploading video...')}</span>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </button>
          <button 
            className="process-btn" 
            onClick={handleProcess}
            disabled={isUploading || !isWithinLimit}
          >
            {isUploading 
              ? t('processing.waitingForUpload', 'Waiting for upload...') 
              : t('processing.startProcessing', 'Start Processing')
            }
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default VideoProcessingOptionsModal;
