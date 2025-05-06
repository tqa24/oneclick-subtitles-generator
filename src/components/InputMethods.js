import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import YoutubeUrlInput from './inputs/YoutubeUrlInput';
import YoutubeSearchInput from './inputs/YoutubeSearchInput';
import FileUploadInput from './inputs/FileUploadInput';
import DouyinUrlInput from './inputs/DouyinUrlInput';
import AllSitesUrlInput from './inputs/AllSitesUrlInput';
import UnifiedUrlInput from './inputs/UnifiedUrlInput';
import { initTabPillAnimation } from '../utils/tabPillAnimation';
import '../styles/InputMethods.css';
import '../styles/components/tab-content-animations.css';

const InputMethods = ({ onVideoSelect, apiKeysSet, selectedVideo, setSelectedVideo, uploadedFile, setUploadedFile, activeTab, setActiveTab, isSrtOnlyMode, setIsSrtOnlyMode }) => {
  const { t } = useTranslation();
  const tabsRef = useRef(null);
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const [previousTab, setPreviousTab] = useState(null);
  const [animationDirection, setAnimationDirection] = useState('center');

  // Initialize pill position and container height on component mount
  useEffect(() => {
    if (tabsRef.current) {
      // Small delay to ensure the DOM is fully rendered
      setTimeout(() => {
        initTabPillAnimation('.input-tabs');

        // Set initial height with extra 100px to ensure enough space
        if (containerRef.current && contentRef.current) {
          const contentHeight = contentRef.current.offsetHeight;
          containerRef.current.style.height = `${contentHeight + 100}px`;
        }
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

      // Determine animation direction based on tab order
      if (previousTab) {
        const tabOrder = ['unified-url', 'youtube-search', 'file-upload'];
        const prevIndex = tabOrder.indexOf(previousTab);
        const currentIndex = tabOrder.indexOf(activeTab);

        if (prevIndex !== -1 && currentIndex !== -1) {
          if (prevIndex < currentIndex) {
            setAnimationDirection('left');
          } else if (prevIndex > currentIndex) {
            setAnimationDirection('right');
          } else {
            setAnimationDirection('center');
          }
        } else {
          setAnimationDirection('center');
        }
      }

      // Update previous tab for next change
      setPreviousTab(activeTab);

      // Small delay to ensure the active class is applied
      setTimeout(() => {
        initTabPillAnimation('.input-tabs');
      }, 10);
    }
  }, [activeTab, previousTab]);

  // Handle height animation when content changes
  useEffect(() => {
    // Use a small delay to ensure the new content is rendered
    const animationTimeout = setTimeout(() => {
      if (containerRef.current && contentRef.current) {
        // Get the height of the content and add 100px for extra space
        const contentHeight = contentRef.current.offsetHeight;

        // Set the container height to match the content height plus extra space
        containerRef.current.style.height = `${contentHeight + 100}px`;
      }
    }, 50); // Small delay to ensure content is rendered

    return () => clearTimeout(animationTimeout);
  }, [activeTab]);

  const renderInputMethod = () => {
    // Determine the animation class based on direction
    const animationClass = `tab-content-slide-${animationDirection}`;

    switch (activeTab) {
      case 'unified-url':
        return (
          <div key={`tab-${activeTab}`} className={`tab-content ${animationClass}`}>
            <UnifiedUrlInput
              selectedVideo={selectedVideo}
              setSelectedVideo={setSelectedVideo}
            />
          </div>
        );
      case 'youtube-search':
        return (
          <div key={`tab-${activeTab}`} className={`tab-content ${animationClass}`}>
            <YoutubeSearchInput
              apiKeysSet={apiKeysSet}
              selectedVideo={selectedVideo}
              setSelectedVideo={setSelectedVideo}
            />
          </div>
        );
      case 'file-upload':
        return (
          <div key={`tab-${activeTab}`} className={`tab-content ${animationClass}`}>
            <FileUploadInput
              onVideoSelect={onVideoSelect}
              uploadedFile={uploadedFile}
              setUploadedFile={setUploadedFile}
              isSrtOnlyMode={isSrtOnlyMode}
              setIsSrtOnlyMode={setIsSrtOnlyMode}
            />
          </div>
        );
      // Keep the old tabs for backward compatibility, but they won't be shown in the UI
      case 'all-sites-url':
        return (
          <div key={`tab-${activeTab}`} className={`tab-content ${animationClass}`}>
            <AllSitesUrlInput
              selectedVideo={selectedVideo}
              setSelectedVideo={setSelectedVideo}
            />
          </div>
        );
      case 'youtube-url':
        return (
          <div key={`tab-${activeTab}`} className={`tab-content ${animationClass}`}>
            <YoutubeUrlInput
              onVideoSelect={onVideoSelect}
              selectedVideo={selectedVideo}
              setSelectedVideo={setSelectedVideo}
            />
          </div>
        );
      case 'douyin-url':
        return (
          <div key={`tab-${activeTab}`} className={`tab-content ${animationClass}`}>
            <DouyinUrlInput
              selectedVideo={selectedVideo}
              setSelectedVideo={setSelectedVideo}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="input-methods-container" ref={containerRef}>
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

      <div className="tab-content-wrapper" ref={contentRef}>
        {renderInputMethod()}
      </div>
    </div>
  );
};

export default InputMethods;