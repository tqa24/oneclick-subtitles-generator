import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const FileUploadInput = ({ uploadedFile, setUploadedFile, onVideoSelect }) => {
  const { t } = useTranslation();
  const [fileInfo, setFileInfo] = useState(null);
  const [error, setError] = useState('');
  
  // Maximum file size in MB
  const MAX_FILE_SIZE_MB = 200;
  
  // Supported file formats
  const SUPPORTED_VIDEO_FORMATS = ["video/mp4", "video/mpeg", "video/mov", "video/avi", "video/x-flv", "video/mpg", "video/webm", "video/wmv", "video/3gpp"];
  const SUPPORTED_AUDIO_FORMATS = ["audio/wav", "audio/mp3", "audio/aiff", "audio/aac", "audio/ogg", "audio/flac", "audio/mpeg"];
  
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
  
  // Check if file is a video
  const isVideoFile = (mimeType) => {
    return SUPPORTED_VIDEO_FORMATS.includes(mimeType);
  };
  
  // Check if file is an audio
  const isAudioFile = (mimeType) => {
    return SUPPORTED_AUDIO_FORMATS.includes(mimeType);
  };
  
  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    
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
  
  // Display file information
  const displayFileInfo = (file) => {
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    const mediaType = isVideoFile(file.type) ? 'Video' : 'Audio';
    
    setFileInfo({
      name: file.name,
      type: file.type,
      size: `${fileSizeMB} MB`,
      mediaType
    });
  };
  
  return (
    <div className="file-upload-input">
      <label htmlFor="file-upload-input">
        {t('fileUpload.label', 'Upload Video or Audio File:')}
      </label>
      
      <input 
        type="file" 
        id="file-upload-input" 
        accept="video/*,audio/*" 
        onChange={handleFileChange}
      />
      
      {error && <p className="error">{error}</p>}
      
      {fileInfo && (
        <div className="file-info">
          <p><strong>{t('fileUpload.fileName', 'File:')} </strong>{fileInfo.name}</p>
          <p><strong>{t('fileUpload.fileType', 'Type:')} </strong>{fileInfo.type} ({fileInfo.mediaType})</p>
          <p><strong>{t('fileUpload.fileSize', 'Size:')} </strong>{fileInfo.size}</p>
        </div>
      )}
    </div>
  );
};

export default FileUploadInput;