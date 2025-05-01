import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import YoutubeUrlInput from './inputs/YoutubeUrlInput';
import YoutubeSearchInput from './inputs/YoutubeSearchInput';
import FileUploadInput from './inputs/FileUploadInput';
import DouyinUrlInput from './inputs/DouyinUrlInput';
import AllSitesUrlInput from './inputs/AllSitesUrlInput';
import UnifiedUrlInput from './inputs/UnifiedUrlInput';
import { initTabPillAnimation } from '../utils/tabPillAnimation';
import '../styles/InputMethods.css';

const InputMethods = ({ onVideoSelect, apiKeysSet, selectedVideo, setSelectedVideo, uploadedFile, setUploadedFile, activeTab, setActiveTab, isSrtOnlyMode, setIsSrtOnlyMode }) => {
  const { t } = useTranslation();
  const tabsRef = useRef(null);

  // Initialize pill position on component mount
  useEffect(() => {
    if (tabsRef.current) {
      // Small delay to ensure the DOM is fully rendered
      setTimeout(() => {
        initTabPillAnimation('.input-tabs');
      }, 50);
    }
  }, []);

  // Update pill position when active tab changes
  useEffect(() => {
    if (tabsRef.current) {
      // Reset wasActive and lastActive attributes on all tabs when active tab changes programmatically
      const tabButtons = tabsRef.current.querySelectorAll('.tab-btn');
      tabButtons.forEach(tab => {
        tab.dataset.wasActive = 'false';
        tab.dataset.lastActive = 'false';
      });

      // Small delay to ensure the active class is applied
      setTimeout(() => {
        initTabPillAnimation('.input-tabs');
      }, 10);
    }
  }, [activeTab]);

  const renderInputMethod = () => {
    switch (activeTab) {
      case 'unified-url':
        return <UnifiedUrlInput
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
      // Keep the old tabs for backward compatibility, but they won't be shown in the UI
      case 'all-sites-url':
        return <AllSitesUrlInput
          selectedVideo={selectedVideo}
          setSelectedVideo={setSelectedVideo}
        />;
      case 'youtube-url':
        return <YoutubeUrlInput
          onVideoSelect={onVideoSelect}
          selectedVideo={selectedVideo}
          setSelectedVideo={setSelectedVideo}
        />;
      case 'douyin-url':
        return <DouyinUrlInput
          selectedVideo={selectedVideo}
          setSelectedVideo={setSelectedVideo}
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

        <div className="input-tabs" ref={tabsRef}>
          <button
            className={`tab-btn ${activeTab === 'unified-url' ? 'active' : ''}`}
            onClick={() => setActiveTab('unified-url')}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            {t('inputMethods.unifiedUrl', 'Video URL')}
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