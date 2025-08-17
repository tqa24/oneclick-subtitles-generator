import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import '../styles/VideoProcessingOptionsModal.css';
import { getNextAvailableKey } from '../services/gemini/keyManager';

/**
 * Modal for selecting video processing options after timeline segment selection
 */
const VideoProcessingOptionsModal = ({
  isOpen,
  onClose,
  onProcess,
  selectedSegment, // { start: number, end: number } in seconds
  isUploading = false,
  videoFile = null // Optional video file for real token counting
}) => {
  const { t } = useTranslation();
  const modalRef = useRef(null);
  
  // Processing options state
  const [fps, setFps] = useState(1); // Default 1 FPS
  const [mediaResolution, setMediaResolution] = useState('medium'); // low, medium, high (default to medium)
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash'); // Default model
  const [customGeminiModels, setCustomGeminiModels] = useState([]);
  const [isCountingTokens, setIsCountingTokens] = useState(false);
  const [realTokenCount, setRealTokenCount] = useState(null);
  
  // Available options
  const fpsOptions = [
    { value: 0.25, label: '0.25 FPS (4s intervals)' },
    { value: 0.5, label: '0.5 FPS (2s intervals)' },
    { value: 1, label: '1 FPS (1s intervals)' },
    { value: 2, label: '2 FPS (0.5s intervals)' },
    { value: 5, label: '5 FPS (0.2s intervals)' }
  ];

  const resolutionOptions = [
    { value: 'low', label: t('processing.lowRes', 'Low (64 tokens/frame)'), tokens: 64 },
    { value: 'medium', label: t('processing.mediumRes', 'Medium (256 tokens/frame)'), tokens: 256 },
    { value: 'high', label: t('processing.highRes', 'High (256 tokens/frame)'), tokens: 256 }
  ];

  // Helper function to get all available models (built-in + custom)
  const getAllAvailableModels = () => {
    const builtInModels = [
      { value: 'gemini-2.5-pro', label: t('settings.modelBestAccuracy', 'Gemini 2.5 Pro - Nghe lời nhất, dễ ra sub ngắn, dễ bị quá tải'), maxTokens: 2000000 },
      { value: 'gemini-2.5-flash', label: t('settings.modelSmartFast', 'Gemini 2.5 Flash (Độ chính xác thứ hai)'), maxTokens: 1048575 },
      { value: 'gemini-2.5-flash-lite', label: t('settings.modelFlash25Lite', 'Gemini 2.5 Flash Lite (Mô hình 2.5 nhanh nhất, độ chính xác tốt)'), maxTokens: 1048575 },
      { value: 'gemini-2.0-flash', label: t('settings.modelThirdBest', 'Gemini 2.0 Flash (Độ chính xác thứ ba, dễ bị sub dài)'), maxTokens: 1048575 },
      { value: 'gemini-2.0-flash-lite', label: t('settings.modelFastest', 'Gemini 2.0 Flash Lite (Độ chính xác kém nhất, nhanh nhất, dễ bị sub dài)'), maxTokens: 1048575 }
    ];

    const customModels = customGeminiModels.map(model => ({
      value: model.id,
      label: `${model.name} (Custom)`,
      maxTokens: 1048575, // Default token limit for custom models
      isCustom: true
    }));

    return [...builtInModels, ...customModels];
  };

  const modelOptions = getAllAvailableModels();

  // Load custom models on component mount
  useEffect(() => {
    const loadCustomModels = () => {
      try {
        const savedCustomModels = localStorage.getItem('custom_gemini_models');
        if (savedCustomModels) {
          setCustomGeminiModels(JSON.parse(savedCustomModels));
        }
      } catch (error) {
        console.error('Error loading custom models:', error);
      }
    };

    loadCustomModels();
  }, []);

  // Real token counting using Gemini API with Files API
  const countTokensWithGeminiAPI = async (videoFile) => {
    if (!videoFile || !selectedSegment) return null;

    const geminiApiKey = getNextAvailableKey();
    if (!geminiApiKey) {
      console.warn('No Gemini API key available for token counting');
      return null;
    }

    try {
      setIsCountingTokens(true);

      // Check if we already have an uploaded file URI for this file (same logic as in core.js)
      const fileKey = `gemini_file_${videoFile.name}_${videoFile.size}_${videoFile.lastModified}`;
      let uploadedFile = JSON.parse(localStorage.getItem(fileKey) || 'null');

      // If no cached file or file doesn't exist, upload it first
      if (!uploadedFile || !uploadedFile.uri) {
        console.log('[TokenCounting] No cached file found, uploading for token counting...');

        // Import and use the same upload function as the main processing
        const { uploadFileToGemini } = await import('../services/gemini');
        uploadedFile = await uploadFileToGemini(videoFile, `${videoFile.name}_${Date.now()}`);

        // Cache the uploaded file info for reuse
        localStorage.setItem(fileKey, JSON.stringify(uploadedFile));
        console.log('[TokenCounting] File uploaded successfully:', uploadedFile.uri);
      } else {
        console.log('[TokenCounting] Using cached uploaded file:', uploadedFile.uri);
      }

      // Create the request data using the uploaded file URI (matching countTokens API format)
      // Note: countTokens API doesn't support media resolution, so we only count basic video metadata
      const filePart = {
        file_data: {
          file_uri: uploadedFile.uri,
          mime_type: uploadedFile.mimeType || videoFile.type || "video/mp4"
        }
      };

      // Add video metadata to the file_data part if this is a video
      if (!videoFile.type.startsWith('audio/')) {
        filePart.video_metadata = {
          start_offset: `${Math.floor(selectedSegment.start)}s`,
          end_offset: `${Math.floor(selectedSegment.end)}s`,
          fps: fps
        };
      }

      const requestData = {
        contents: [{
          role: "user",
          parts: [
            { text: "Transcribe this video segment." },
            filePart
          ]
        }]
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:countTokens?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Token counting API error:', errorData);
        return null;
      }

      const data = await response.json();
      console.log('[TokenCounting] Real token count (without media resolution):', data.totalTokens);

      // Note: The countTokens API doesn't support media resolution, so this count
      // is for the default resolution. We'll adjust it based on the selected resolution.
      const baseTokens = data.totalTokens;

      // Adjust for media resolution based on official token counts
      let adjustmentFactor = 1;
      if (mediaResolution === 'low') {
        adjustmentFactor = 64 / 256; // low vs medium ratio
      } else if (mediaResolution === 'high') {
        adjustmentFactor = 256 / 256; // high vs medium ratio (same)
      }

      const adjustedTokens = Math.round(baseTokens * adjustmentFactor);
      console.log('[TokenCounting] Adjusted token count for', mediaResolution, 'resolution:', adjustedTokens);

      return adjustedTokens;
    } catch (error) {
      console.error('Error counting tokens with Gemini API:', error);
      return null;
    } finally {
      setIsCountingTokens(false);
    }
  };

  // Calculate estimated token usage based on official Gemini API documentation
  const calculateEstimatedTokens = () => {
    if (!selectedSegment) return 0;

    const segmentDuration = selectedSegment.end - selectedSegment.start;
    const resolution = resolutionOptions.find(r => r.value === mediaResolution);
    const frameTokens = resolution ? resolution.tokens : 256; // Default to medium resolution
    const audioTokens = 32; // tokens per second for audio (official documentation)

    return Math.round(segmentDuration * (fps * frameTokens + audioTokens));
  };
  
  const estimatedTokens = calculateEstimatedTokens();
  const selectedModelData = modelOptions.find(m => m.value === selectedModel);
  const displayTokens = realTokenCount !== null ? realTokenCount : estimatedTokens;
  const isWithinLimit = displayTokens <= (selectedModelData?.maxTokens || 1048575);
  
  // Format time for display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Handle real token counting
  const handleCountTokens = async () => {
    if (!videoFile) {
      console.warn('No video file available for token counting');
      return;
    }
    const realCount = await countTokensWithGeminiAPI(videoFile);
    if (realCount !== null) {
      setRealTokenCount(realCount);
    }
  };

  // Handle form submission
  const handleProcess = () => {
    if (!selectedSegment || isUploading) return;

    const options = {
      fps,
      mediaResolution,
      model: selectedModel,
      segment: selectedSegment,
      estimatedTokens: displayTokens,
      realTokenCount
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
            <div className="token-header">
              <h4>
                {realTokenCount !== null
                  ? t('processing.actualTokens', 'Actual Token Usage')
                  : t('processing.estimatedTokens', 'Estimated Token Usage')
                }
                {isCountingTokens && (
                  <span className="counting-indicator"> (Counting...)</span>
                )}
              </h4>
              {videoFile && realTokenCount === null && !isCountingTokens && (
                <button
                  className="count-tokens-btn"
                  onClick={handleCountTokens}
                  disabled={isCountingTokens}
                >
                  {t('processing.getActualCount', 'Get Actual Count')}
                </button>
              )}
            </div>
            <div className={`token-count ${isWithinLimit ? 'within-limit' : 'exceeds-limit'}`}>
              {displayTokens.toLocaleString()} / {selectedModelData?.maxTokens.toLocaleString()} tokens
            </div>
            <p className="estimation-note">
              {realTokenCount !== null
                ? t('processing.adjustedNote', 'Real count from Gemini API, adjusted for selected media resolution. More accurate than estimation.')
                : t('processing.estimationNote', 'Estimation based on official Gemini API documentation. Actual usage may vary.')
              }
            </p>
            {!isWithinLimit && (
              <p className="warning">
                {t('processing.exceedsLimit', 'Warning: Token count exceeds model limit. Consider reducing FPS or using a higher-capacity model.')}
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
