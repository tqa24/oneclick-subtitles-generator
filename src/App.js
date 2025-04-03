import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './styles/App.css';
import Header from './components/Header';
import InputMethods from './components/InputMethods';
import OutputContainer from './components/OutputContainer';
import SettingsModal from './components/SettingsModal';
import { useSubtitles } from './hooks/useSubtitles';

function App() {
  const { t } = useTranslation();
  const [apiKeysSet, setApiKeysSet] = useState({
    gemini: false,
    youtube: false
  });
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState(localStorage.getItem('lastActiveTab') || 'youtube-url');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  const {
    subtitlesData,
    setSubtitlesData,
    status,
    setStatus,
    isGenerating,
    generateSubtitles,
    retryGeneration
  } = useSubtitles(t);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Listen for theme changes from other components
  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key === 'theme' || !event.key) {
        const newTheme = localStorage.getItem('theme') || 'light';
        setTheme(newTheme);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Initialize API keys from localStorage
  useEffect(() => {
    const geminiApiKey = localStorage.getItem('gemini_api_key');
    const youtubeApiKey = localStorage.getItem('youtube_api_key');
    
    setApiKeysSet({
      gemini: !!geminiApiKey,
      youtube: !!youtubeApiKey
    });

    // Check API keys status and show message if needed
    if (!geminiApiKey || !youtubeApiKey) {
      let message = 'Please set your ';
      if (!geminiApiKey && !youtubeApiKey) {
        message += 'Gemini and YouTube API keys';
      } else if (!geminiApiKey) {
        message += 'Gemini API key';
      } else {
        message += 'YouTube API key';
      }
      message += ' in the settings to use this application.';
      
      setStatus({ message, type: 'info' });
    }
  }, []);

  const saveApiKeys = (geminiKey, youtubeKey) => {
    // Save to localStorage
    if (geminiKey) {
      localStorage.setItem('gemini_api_key', geminiKey);
    } else {
      localStorage.removeItem('gemini_api_key');
    }
    
    if (youtubeKey) {
      localStorage.setItem('youtube_api_key', youtubeKey);
    } else {
      localStorage.removeItem('youtube_api_key');
    }
    
    // Update state
    setApiKeysSet({
      gemini: !!geminiKey,
      youtube: !!youtubeKey
    });

    // Show success notification
    setStatus({ message: 'Settings saved successfully!', type: 'success' });
  };

  const validateInput = () => {
    if (activeTab === 'youtube-url') {
      return selectedVideo !== null;
    } else if (activeTab === 'youtube-search') {
      return selectedVideo !== null;
    } else if (activeTab === 'file-upload') {
      return uploadedFile !== null;
    }
    return false;
  };

  const handleGenerateSubtitles = async () => {
    if (!validateInput()) {
      setStatus({ message: t('errors.invalidInput'), type: 'error' });
      return;
    }

    let input, inputType;
    if (activeTab.includes('youtube') && selectedVideo) {
      input = selectedVideo.url;
      inputType = 'youtube';
    } else if (activeTab === 'file-upload' && uploadedFile) {
      input = uploadedFile;
      inputType = 'file-upload';
    }

    await generateSubtitles(input, inputType, apiKeysSet);
  };

  const handleRetryGeneration = async () => {
    if (!validateInput()) {
      setStatus({ message: t('errors.invalidInput'), type: 'error' });
      return;
    }

    let input, inputType;
    if (activeTab.includes('youtube') && selectedVideo) {
      input = selectedVideo.url;
      inputType = 'youtube';
    } else if (activeTab === 'file-upload' && uploadedFile) {
      input = uploadedFile;
      inputType = 'file-upload';
    }

    await retryGeneration(input, inputType, apiKeysSet);
  };

  const handleTabChange = (tab) => {
    localStorage.setItem('lastActiveTab', tab);
    setActiveTab(tab);
    setSelectedVideo(null);
    setUploadedFile(null);
    setStatus({}); // Reset status
    setSubtitlesData(null); // Reset subtitles data
    localStorage.removeItem('current_video_url');
    localStorage.removeItem('current_file_url');
  };

  return (
    <>
      <Header 
        onSettingsClick={() => setShowSettings(true)} 
      />
      
      <main className="app-main">
        <InputMethods 
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          selectedVideo={selectedVideo}
          setSelectedVideo={setSelectedVideo}
          uploadedFile={uploadedFile}
          setUploadedFile={setUploadedFile}
          apiKeysSet={apiKeysSet}
        />
        
        {validateInput() && (
          <div className="buttons-container">
            <button 
              className="generate-btn"
              onClick={handleGenerateSubtitles}
              disabled={isGenerating}
            >
              {isGenerating ? t('output.processingVideo') : t('header.tagline')}
            </button>
            
            {(subtitlesData || status.type === 'error') && !isGenerating && (
              <button 
                className="retry-gemini-btn" 
                onClick={handleRetryGeneration}
                disabled={isGenerating}
                title={t('output.retryGeminiTooltip')}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                  <path d="M1 4v6h6"></path>
                  <path d="M23 20v-6h-6"></path>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                </svg>
                {t('output.retryGemini')}
              </button>
            )}
          </div>
        )}
        
        <OutputContainer 
          status={status}
          subtitlesData={subtitlesData}
          selectedVideo={selectedVideo}
          uploadedFile={uploadedFile}
          isGenerating={isGenerating}
        />
      </main>
      
      {showSettings && (
        <SettingsModal 
          onClose={() => setShowSettings(false)}
          onSave={saveApiKeys}
          apiKeysSet={apiKeysSet}
        />
      )}
    </>
  );
}

export default App;