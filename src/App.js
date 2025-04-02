import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import './styles/App.css';
import Header from './components/Header';
import InputMethods from './components/InputMethods';
import OutputContainer from './components/OutputContainer';
import SettingsModal from './components/SettingsModal';
import { startYoutubeVideoDownload, extractYoutubeVideoId } from './utils/videoDownloader';
import { generateFileCacheId } from './utils/cacheUtils';

function App() {
  const { t } = useTranslation();
  const [apiKeysSet, setApiKeysSet] = useState({
    gemini: false,
    youtube: false
  });
  const [showSettings, setShowSettings] = useState(false);
  // Initialize activeTab from localStorage or default to 'youtube-url'
  const [activeTab, setActiveTab] = useState(localStorage.getItem('lastActiveTab') || 'youtube-url');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [subtitlesData, setSubtitlesData] = useState(null);
  const [status, setStatus] = useState({ message: '', type: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  const preloadVideoFrameRef = useRef(null);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

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

  // Check if cached subtitles exist
  const checkCachedSubtitles = async (cacheId) => {
    try {
      const response = await fetch(`http://localhost:3004/api/subtitle-exists/${cacheId}`);
      const data = await response.json();
      return data.exists ? data.subtitles : null;
    } catch (error) {
      console.error('Error checking subtitle cache:', error);
      return null;
    }
  };

  // Save subtitles to cache
  const saveSubtitlesToCache = async (cacheId, subtitles) => {
    try {
      const response = await fetch('http://localhost:3004/api/save-subtitles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cacheId,
          subtitles
        })
      });
      
      const result = await response.json();
      if (!result.success) {
        console.error('Failed to save subtitles to cache:', result.error);
      }
    } catch (error) {
      console.error('Error saving subtitles to cache:', error);
    }
  };

  const validateInput = useCallback(() => {
    if (activeTab === 'youtube-url') {
      return selectedVideo !== null;
    } else if (activeTab === 'youtube-search') {
      return selectedVideo !== null;
    } else if (activeTab === 'file-upload') {
      return uploadedFile !== null;
    }
    return false;
  }, [activeTab, selectedVideo, uploadedFile]);

  const callGeminiApi = useCallback(async (input, inputType) => {
    const geminiApiKey = localStorage.getItem('gemini_api_key');
    const MODEL = "gemini-2.5-pro-exp-03-25";
    
    let requestData = {
      model: MODEL,
      contents: []
    };

    if (inputType === 'youtube') {
      requestData.contents = [
        {
          role: "user",
          parts: [
            { text: "Transcribe this video" },
            { 
              fileData: {
                fileUri: input
              }
            }
          ]
        }
      ];
    } else if (inputType === 'video') {
      const base64Data = await fileToBase64(input);
      requestData.contents = [
        {
          role: "user",
          parts: [
            { text: "Transcribe this video" },
            {
              inlineData: {
                mimeType: input.type,
                data: base64Data
              }
            }
          ]
        }
      ];
    } else if (inputType === 'audio') {
      const base64Data = await fileToBase64(input);
      requestData.contents = [
        {
          role: "user",
          parts: [
            { text: "Transcribe this audio" },
            {
              inlineData: {
                mimeType: input.type,
                data: base64Data
              }
            }
          ]
        }
      ];
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${geminiApiKey}`, 
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
        throw new Error(`API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      
      saveDebugResponse(data);
      
      return parseGeminiResponse(data);
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw new Error('Failed to generate subtitles. Please try again.');
    }
  }, []);

  const generateSubtitles = useCallback(async () => {
    // Validate API keys
    if (!apiKeysSet.gemini) {
      setStatus({ message: t('errors.apiKeyRequired'), type: 'error' });
      setShowSettings(true);
      return;
    }
    
    if (activeTab === 'youtube-search' && !apiKeysSet.youtube) {
      setStatus({ message: t('errors.apiKeyRequired'), type: 'error' });
      setShowSettings(true);
      return;
    }

    // Validate input
    if (!validateInput()) {
      setStatus({ message: t('errors.invalidInput'), type: 'error' });
      return;
    }

    setIsGenerating(true);
    setStatus({ message: t('output.processingVideo'), type: 'loading' });
    setSubtitlesData(null);

    try {
      // Prepare input based on active tab
      let input = null;
      let inputType = '';
      let cacheId = null;

      if (activeTab === 'youtube-url' && selectedVideo) {
        input = selectedVideo.url;
        inputType = 'youtube';
        cacheId = extractYoutubeVideoId(selectedVideo.url);
        
        // Start preloading YouTube video immediately
        preloadYouTubeVideo(selectedVideo.url);
        
      } else if (activeTab === 'youtube-search' && selectedVideo) {
        input = selectedVideo.url;
        inputType = 'youtube';
        cacheId = extractYoutubeVideoId(selectedVideo.url);
        
        // Start preloading YouTube video immediately
        preloadYouTubeVideo(selectedVideo.url);
        
      } else if (activeTab === 'file-upload' && uploadedFile) {
        input = uploadedFile;
        inputType = isVideoFile(uploadedFile.type) ? 'video' : 'audio';
        cacheId = await generateFileCacheId(uploadedFile);
      }

      // Check for cached subtitles
      if (cacheId) {
        const cachedSubtitles = await checkCachedSubtitles(cacheId);
        if (cachedSubtitles) {
          console.log('Loading subtitles from cache for ID:', cacheId);
          setSubtitlesData(cachedSubtitles);
          setStatus({ message: t('output.subtitlesLoadedFromCache'), type: 'success' });
          setIsGenerating(false);
          return;
        }
      }

      // Call the API service to generate subtitles if not cached
      const subtitles = await callGeminiApi(input, inputType);
      setSubtitlesData(subtitles);
      
      // Save to cache for future use
      if (cacheId && subtitles && subtitles.length > 0) {
        await saveSubtitlesToCache(cacheId, subtitles);
      }
      
      setStatus({ message: t('output.generationSuccess'), type: 'success' });
    } catch (error) {
      console.error('Error generating subtitles:', error);
      try {
        // Try to parse the error if it's our special format error
        const errorData = JSON.parse(error.message);
        if (errorData.type === 'unrecognized_format') {
          setStatus({
            message: `${errorData.message}\n\nRaw text from Gemini:\n${errorData.rawText}`,
            type: 'error'
          });
        } else {
          setStatus({ message: `Error: ${error.message}`, type: 'error' });
        }
      } catch {
        // If error message isn't JSON, just show it directly
        setStatus({ message: `Error: ${error.message}`, type: 'error' });
      }
    } finally {
      setIsGenerating(false);
    }
  }, [activeTab, selectedVideo, uploadedFile, apiKeysSet, t, callGeminiApi, validateInput]);

  const retryGeminiRequest = useCallback(async () => {
    // Validate API keys
    if (!apiKeysSet.gemini) {
      setStatus({ message: t('errors.apiKeyRequired'), type: 'error' });
      setShowSettings(true);
      return;
    }
    
    // Validate input
    if (!validateInput()) {
      setStatus({ message: t('errors.invalidInput'), type: 'error' });
      return;
    }

    setIsGenerating(true);
    setStatus({ message: 'Retrying request to Gemini. This may take a few minutes...', type: 'loading' });

    try {
      // Prepare input based on active tab
      let input = null;
      let inputType = '';
      let cacheId = null;

      if (activeTab === 'youtube-url' && selectedVideo) {
        input = selectedVideo.url;
        inputType = 'youtube';
        cacheId = extractYoutubeVideoId(selectedVideo.url);
      } else if (activeTab === 'youtube-search' && selectedVideo) {
        input = selectedVideo.url;
        inputType = 'youtube';
        cacheId = extractYoutubeVideoId(selectedVideo.url);
      } else if (activeTab === 'file-upload' && uploadedFile) {
        input = uploadedFile;
        inputType = isVideoFile(uploadedFile.type) ? 'video' : 'audio';
        cacheId = await generateFileCacheId(uploadedFile);
      }

      // Call the API service to generate subtitles (skip cache check for retry)
      const subtitles = await callGeminiApi(input, inputType);
      setSubtitlesData(subtitles);
      
      // Update cache with new result
      if (cacheId && subtitles && subtitles.length > 0) {
        await saveSubtitlesToCache(cacheId, subtitles);
      }
      
      setStatus({ message: t('output.generationSuccess'), type: 'success' });
    } catch (error) {
      console.error('Error regenerating subtitles:', error);
      setStatus({ message: `Error: ${error.message}`, type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  }, [activeTab, selectedVideo, uploadedFile, apiKeysSet, t, callGeminiApi, validateInput]);

  const isVideoFile = (mimeType) => {
    const SUPPORTED_VIDEO_FORMATS = ["video/mp4", "video/mpeg", "video/mov", "video/avi", "video/x-flv", "video/mpg", "video/webm", "video/wmv", "video/3gpp"];
    return SUPPORTED_VIDEO_FORMATS.includes(mimeType);
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const saveDebugResponse = (response) => {
    // Instead of downloading the file, we'll log it to console and ensure it's saved to cache
    console.log('Gemini API response received:', response);
    
    // The actual response data will be saved through the saveSubtitlesToCache function
    // No need to download files anymore
  };

  const parseGeminiResponse = (response) => {
    if (!response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response format from Gemini API');
    }
    
    const text = response.candidates[0].content.parts[0].text;
    console.log('Raw text from Gemini:', text);
    
    const subtitles = [];
    let hasTimestamps = false;
    let match;

    // Try new format with descriptions and on-screen text: [0:08 - 0:16] (Description) or [0:24 - 0:25] (On-screen text: Text)
    const regexNewFormat = /\[(\d+):(\d+)\s*-\s*(\d+):(\d+)\]\s*(?:\((.*?)\)|(.+?)(?=\[|$))/gs;
    
    while ((match = regexNewFormat.exec(text)) !== null) {
        hasTimestamps = true;
        const startMin = parseInt(match[1]);
        const startSec = parseInt(match[2]);
        const endMin = parseInt(match[3]);
        const endSec = parseInt(match[4]);
        
        // Get either the parenthetical content or the regular text
        let content = match[5] || match[6];
        if (content) {
            content = content.trim();
            
            // Handle on-screen text markers
            if (content.startsWith('On-screen text:')) {
                content = content.substring('On-screen text:'.length).trim();
            }
            
            subtitles.push({
                id: subtitles.length + 1,
                start: startMin * 60 + startSec,
                end: endMin * 60 + endSec,
                text: content
            });
        }
    }
    
    // If no subtitles found with new format, try other formats
    if (subtitles.length === 0) {
        // Original timestamp format: [0m0s - 0m29s]
        const regexOriginal = /\[\s*(\d+)m(\d+)s\s*-\s*(\d+)m(\d+)s\s*\](?:\n|\r\n?)+(.*?)(?=\[\s*\d+m\d+s|\s*$)/gs;
        
        while ((match = regexOriginal.exec(text)) !== null) {
            hasTimestamps = true;
            const startMin = parseInt(match[1]);
            const startSec = parseInt(match[2]);
            const endMin = parseInt(match[3]);
            const endSec = parseInt(match[4]);
            
            let subtitleText = match[5].trim();
            
            subtitles.push({
                id: subtitles.length + 1,
                start: startMin * 60 + startSec,
                end: endMin * 60 + endSec,
                text: subtitleText
            });
        }
    }

    // Try format with milliseconds: [0m0s482ms - 0m1s542ms]
    if (subtitles.length === 0) {
        const regexWithMs = /\[\s*(\d+)m(\d+)s(\d+)ms\s*-\s*(\d+)m(\d+)s(\d+)ms\s*\]\s*(.*?)(?=\[\s*\d+m\d+s|\s*$)/gs;
        while ((match = regexWithMs.exec(text)) !== null) {
            hasTimestamps = true;
            const startMin = parseInt(match[1]);
            const startSec = parseInt(match[2]);
            const startMs = parseInt(match[3]);
            const endMin = parseInt(match[4]);
            const endSec = parseInt(match[5]);
            const endMs = parseInt(match[6]);
            
            const startTime = startMin * 60 + startSec + startMs / 1000;
            const endTime = endMin * 60 + endSec + endMs / 1000;
            
            let subtitleText = match[7].trim();
            
            subtitles.push({
                id: subtitles.length + 1,
                start: startTime,
                end: endTime,
                text: subtitleText
            });
        }
    }
    
    // Try single timestamp format: [0m2s]
    if (subtitles.length === 0) {
        const regexSingleTimestamp = /\[(\d+)m(\d+)s\]\s*([^\[\n]*?)(?=\n*\[|$)/gs;
        const matches = [];
        
        while ((match = regexSingleTimestamp.exec(text)) !== null) {
            const min = parseInt(match[1]);
            const sec = parseInt(match[2]);
            const content = match[3].trim();
            
            if (content && !content.match(/^\d+\.\d+s$/)) {
                hasTimestamps = true;
                matches.push({
                    startTime: min * 60 + sec,
                    text: content
                });
            }
        }
    
        if (matches.length > 0) {
            matches.forEach((curr, index) => {
                const next = matches[index + 1];
                const endTime = next ? next.startTime : curr.startTime + 4;
    
                subtitles.push({
                    id: subtitles.length + 1,
                    start: curr.startTime,
                    end: endTime,
                    text: curr.text
                });
            });
        }
    }

    // If no timestamps were recognized, throw an error with the raw text
    if (!hasTimestamps) {
        throw new Error(JSON.stringify({
            type: 'unrecognized_format',
            message: 'Unrecognized subtitle format. Please add handling for this new format and try again.',
            rawText: text
        }));
    }
    
    // Remove duplicate subtitles and sort by start time
    const uniqueSubtitles = [];
    const seen = new Set();
    
    subtitles.sort((a, b) => a.start - b.start).forEach(sub => {
        const key = `${sub.start}-${sub.end}-${sub.text}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueSubtitles.push(sub);
        }
    });

    console.log('Extracted subtitles:', uniqueSubtitles);
    return uniqueSubtitles;
  };

  // Add function to preload YouTube video
  const preloadYouTubeVideo = (videoUrl) => {
    console.log('Preloading YouTube video:', videoUrl);
    
    // Ensure we're only preloading YouTube videos
    if (!videoUrl || (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be'))) {
      return;
    }
    
    // Store the URL in localStorage for the VideoPreview component to use
    localStorage.setItem('current_video_url', videoUrl);
    
    // Start the background download process for the YouTube video
    try {
      const videoId = startYoutubeVideoDownload(videoUrl);
      console.log('Started background download for YouTube video ID:', videoId);
    } catch (error) {
      console.warn('Failed to start background download:', error);
      // Continue anyway - this is just for optimization
    }
  };
  
  // Cleanup function for the preloaded video
  useEffect(() => {
    const currentFrame = preloadVideoFrameRef.current;
    return () => {
      if (currentFrame) {
        try {
          document.body.removeChild(currentFrame);
        } catch (e) {
          console.error('Error removing preload iframe:', e);
        }
      }
    };
  }, []);

  const handleTabChange = (tab) => {
    // Save the new tab selection to localStorage first
    localStorage.setItem('lastActiveTab', tab);
    
    setActiveTab(tab);
    // Reset states when changing tabs
    setSelectedVideo(null);
    setUploadedFile(null);
    setSubtitlesData(null);
    setStatus({ message: '', type: '' });
    // Clear all video-related localStorage items
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
              onClick={generateSubtitles}
              disabled={isGenerating}
            >
              {isGenerating ? t('output.processingVideo') : t('header.tagline')}
            </button>
            
            {(subtitlesData || status.type === 'error') && !isGenerating && (
              <button 
                className="retry-gemini-btn" 
                onClick={retryGeminiRequest}
                disabled={isGenerating}
                title={t('output.retryGeminiTooltip', 'Request a new transcription from Gemini, ignoring cached results')}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                  <path d="M1 4v6h6"></path>
                  <path d="M23 20v-6h-6"></path>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                </svg>
                {t('output.retryGemini', 'Retry Gemini Request')}
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