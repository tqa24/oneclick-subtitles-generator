import React from 'react';
import { useTranslation } from 'react-i18next';
import YoutubeUrlInput from './inputs/YoutubeUrlInput';
import YoutubeSearchInput from './inputs/YoutubeSearchInput';
import FileUploadInput from './inputs/FileUploadInput';
import '../styles/InputMethods.css';

const InputMethods = ({ onVideoSelect, apiKeysSet, selectedVideo, setSelectedVideo, uploadedFile, setUploadedFile, activeTab, setActiveTab, isSrtOnlyMode, setIsSrtOnlyMode }) => {
  const { t } = useTranslation();

  const renderInputMethod = () => {
    switch (activeTab) {
      case 'youtube-url':
        return <YoutubeUrlInput
          onVideoSelect={onVideoSelect}
          selectedVideo={selectedVideo}
          setSelectedVideo={setSelectedVideo}
        />;
      case 'youtube-search':
        return <YoutubeSearchInput
          apiKeysSet={apiKeysSet}
          selectedVideo={selectedVideo}
          setSelectedVideo={setSelectedVideo}
        />;
      case 'file-upload':
        return <FileUploadInput
          onVideoSelect={onVideoSelect}
          uploadedFile={uploadedFile}
          setUploadedFile={setUploadedFile}
          className="tab-content"
          isSrtOnlyMode={isSrtOnlyMode}
          setIsSrtOnlyMode={setIsSrtOnlyMode}
        />;
      default:
        return null;
    }
  };

  return (
    <div className="input-methods-container">
      <div className="input-header">
        <h2 className="input-title">
          {t('inputMethods.title', 'Select Video Source')}
        </h2>

        <div className="input-tabs">
          <button
            className={`tab-btn ${activeTab === 'youtube-url' ? 'active' : ''}`}
            onClick={() => setActiveTab('youtube-url')}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
              <path d="M12 19c-2.3 0-6.4-.2-8.1-.6-.7-.2-1.2-.7-1.4-1.4-.3-1.1-.5-3.4-.5-5s.2-3.9.5-5c.2-.7.7-1.2 1.4-1.4C5.6 5.2 9.7 5 12 5s6.4.2 8.1.6c.7.2 1.2.7 1.4 1.4.3 1.1.5 3.4.5 5s-.2 3.9-.5 5c-.2.7-.7 1.2-1.4 1.4-1.7.4-5.8.6-8.1.6z" />
              <polygon points="10 15 15 12 10 9 10 15" />
            </svg>
            {t('inputMethods.youtubeUrl', 'YouTube URL')}
          </button>

          <button
            className={`tab-btn ${activeTab === 'youtube-search' ? 'active' : ''}`}
            onClick={() => setActiveTab('youtube-search')}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {t('inputMethods.youtubeSearch', 'Search YouTube')}
          </button>

          <button
            className={`tab-btn ${activeTab === 'file-upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('file-upload')}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {t('inputMethods.fileUpload', 'Upload File')}
          </button>
        </div>
      </div>

      {renderInputMethod()}
    </div>
  );
};

export default InputMethods;