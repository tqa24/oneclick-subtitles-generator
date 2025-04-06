import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const FileUploadInput = ({ uploadedFile, setUploadedFile, onVideoSelect }) => {
  const { t } = useTranslation();
  const [fileInfo, setFileInfo] = useState(null);
  const [error, setError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Maximum file size in MB (2GB = 2048MB)
  const MAX_FILE_SIZE_MB = 2048;

  // Supported file formats - wrapped in useMemo to avoid dependency issues
  const SUPPORTED_VIDEO_FORMATS = useMemo(() => [
    "video/mp4", "video/mpeg", "video/mov", "video/avi", "video/x-flv", "video/mpg", "video/webm", "video/wmv", "video/3gpp"
  ], []);

  const SUPPORTED_AUDIO_FORMATS = useMemo(() => [
    "audio/wav", "audio/mp3", "audio/aiff", "audio/aac", "audio/ogg", "audio/flac", "audio/mpeg"
  ], []);

  // Check if file is a video - wrapped in useCallback to avoid dependency issues
  const isVideoFile = useCallback((mimeType) => {
    return SUPPORTED_VIDEO_FORMATS.includes(mimeType);
  }, [SUPPORTED_VIDEO_FORMATS]);

  // Check if file is an audio - wrapped in useCallback to avoid dependency issues
  const isAudioFile = useCallback((mimeType) => {
    return SUPPORTED_AUDIO_FORMATS.includes(mimeType);
  }, [SUPPORTED_AUDIO_FORMATS]);

  // Display file information - wrapped in useCallback to avoid dependency issues
  const displayFileInfo = useCallback((file) => {
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    const mediaType = isVideoFile(file.type) ? 'Video' : 'Audio';

    setFileInfo({
      name: file.name,
      type: file.type,
      size: `${fileSizeMB} MB`,
      mediaType
    });
  }, [isVideoFile]);

  // Update fileInfo when uploadedFile changes (for auto-downloaded files)
  useEffect(() => {
    if (uploadedFile && !fileInfo) {
      displayFileInfo(uploadedFile);
    }
  }, [uploadedFile, fileInfo, displayFileInfo]);

  // Validate file type and size
  const validateFile = (file) => {
    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      setError(t('fileUpload.sizeError', 'File size exceeds the maximum limit of {{size}} MB.', { size: MAX_FILE_SIZE_MB }));
      return false;
    }

    // Check file type
    if (!isVideoFile(file.type) && !isAudioFile(file.type)) {
      setError(t('fileUpload.formatError', 'Unsupported file format. Please upload a supported video or audio file.'));
      return false;
    }

    setError('');
    return true;
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    processFile(file);
  };

  // Process the file
  const processFile = (file) => {
    if (file) {
      if (validateFile(file)) {
        // Clear ALL video-related storage first
        localStorage.removeItem('current_video_url');
        if (localStorage.getItem('current_file_url')) {
          URL.revokeObjectURL(localStorage.getItem('current_file_url'));
          localStorage.removeItem('current_file_url');
        }

        // Create a new object URL for the file
        const objectUrl = URL.createObjectURL(file);
        localStorage.setItem('current_file_url', objectUrl);

        // Clear any selected YouTube video state via parent callback
        if (onVideoSelect) {
          onVideoSelect(null);
        }

        setUploadedFile(file);
        displayFileInfo(file);
      } else {
        setUploadedFile(null);
        setFileInfo(null);
        if (localStorage.getItem('current_file_url')) {
          URL.revokeObjectURL(localStorage.getItem('current_file_url'));
          localStorage.removeItem('current_file_url');
        }
      }
    }
  };

  // Trigger file input click
  const handleBrowseClick = () => {
    fileInputRef.current.click();
  };

  // Handle drag events
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="file-upload-input">
      <div
        className={`drag-drop-area ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".mp4,.mov,.avi,.mp3,.wav,.aac,.ogg"
          style={{ display: 'none' }}
        />

        {!uploadedFile ? (
          <>
            <div className="upload-icon">
              <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="1" fill="none">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            <div className="upload-text">
              <h3>{t('inputMethods.dragDropText')}</h3>
              <p>{t('inputMethods.orText')}</p>
              <p className="browse-text">{t('inputMethods.browse')}</p>
            </div>
            <div className="upload-instructions">
              <p className="upload-help-text">{t('inputMethods.supportedFormats')}</p>
              <p className="upload-help-text">{t('inputMethods.maxFileSize')}</p>
            </div>
          </>
        ) : (
          <div className="file-info-card">
            <div className="file-preview">
              {fileInfo && isVideoFile(fileInfo.type) ? (
                <svg className="file-type-icon video" viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="1.5" fill="none">
                  <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                  <line x1="7" y1="2" x2="7" y2="22"></line>
                  <line x1="17" y1="2" x2="17" y2="22"></line>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <line x1="2" y1="7" x2="7" y2="7"></line>
                  <line x1="2" y1="17" x2="7" y2="17"></line>
                  <line x1="17" y1="17" x2="22" y2="17"></line>
                  <line x1="17" y1="7" x2="22" y2="7"></line>
                </svg>
              ) : (
                <svg className="file-type-icon audio" viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="1.5" fill="none">
                  <path d="M9 18V5l12-2v13"></path>
                  <circle cx="6" cy="18" r="3"></circle>
                  <circle cx="18" cy="16" r="3"></circle>
                </svg>
              )}
            </div>

            <div className="file-info-content">
              <div className="file-info-header">
                <h4 className="file-name">{fileInfo ? fileInfo.name : 'File'}</h4>
                <span className="file-badge">{fileInfo ? fileInfo.mediaType : 'Video'}</span>
              </div>

              <div className="file-info-details">
                <span className="file-info-size">{fileInfo ? fileInfo.size : ''}</span>
                <button
                  className="remove-file-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFileInfo(null);
                    setUploadedFile(null);
                    if (localStorage.getItem('current_file_url')) {
                      URL.revokeObjectURL(localStorage.getItem('current_file_url'));
                      localStorage.removeItem('current_file_url');
                    }
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                  {t('fileUpload.remove', 'Remove')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default FileUploadInput;