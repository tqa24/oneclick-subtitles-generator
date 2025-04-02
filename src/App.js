import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './styles/App.css';
import Header from './components/Header';
import InputMethods from './components/InputMethods';
import OutputContainer from './components/OutputContainer';
import SettingsModal from './components/SettingsModal';
import { startYoutubeVideoDownload, extractYoutubeVideoId } from './utils/videoDownloader';
import { generateFileCacheId } from './utils/cacheUtils';

function App() {
  // We'll use t in error messages, so we need to keep it
  const { t } = useTranslation();
  const [apiKeysSet, setApiKeysSet] = useState({
    gemini: false,
    youtube: false
  });
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('youtube-url');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [subtitlesData, setSubtitlesData] = useState(null);
  const [status, setStatus] = useState({ message: '', type: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreloadingVideo, setIsPreloadingVideo] = useState(false);
  const preloadVideoFrameRef = useRef(null);

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

  // New function to check if cached subtitles exist
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

  // New function to save subtitles to cache
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

  // Generate a cache ID based on the input
  const generateCacheId = (input, inputType) => {
    if (inputType === 'youtube') {
      // For YouTube videos, use the video ID as the cache ID
      return extractYoutubeVideoId(input);
    } else if (inputType === 'file') {
      // For files, generate a hash of the file content
      return generateFileCacheId(input);
    }
    return null;
  };

  const generateSubtitles = async () => {
    // Validate API keys
    if (!apiKeysSet.gemini) {
      setStatus({ message: 'Please set your Gemini API key in the settings first.', type: 'error' });
      setShowSettings(true);
      return;
    }
    
    if (activeTab === 'youtube-search' && !apiKeysSet.youtube) {
      setStatus({ message: 'Please set your YouTube API key in the settings first.', type: 'error' });
      setShowSettings(true);
      return;
    }

    // Validate input
    if (!validateInput()) {
      setStatus({ message: 'Please provide a valid input (YouTube URL, search result, or file upload).', type: 'error' });
      return;
    }

    setIsGenerating(true);
    setStatus({ message: 'Processing. This may take a few minutes...', type: 'loading' });
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
          setStatus({ message: 'Subtitles loaded from cache!', type: 'success' });
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
      
      setStatus({ message: 'Subtitles generated successfully!', type: 'success' });
    } catch (error) {
      console.error('Error generating subtitles:', error);
      setStatus({ message: `Error: ${error.message}`, type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  // Function to retry Gemini request (ignores cache)
  const retryGeminiRequest = async () => {
    // Validate API keys
    if (!apiKeysSet.gemini) {
      setStatus({ message: 'Please set your Gemini API key in the settings first.', type: 'error' });
      setShowSettings(true);
      return;
    }
    
    // Validate input
    if (!validateInput()) {
      setStatus({ message: 'Please provide a valid input (YouTube URL, search result, or file upload).', type: 'error' });
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
      
      setStatus({ message: 'Subtitles regenerated successfully!', type: 'success' });
    } catch (error) {
      console.error('Error regenerating subtitles:', error);
      setStatus({ message: `Error: ${error.message}`, type: 'error' });
    } finally {
      setIsGenerating(false);
    }
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

  const isVideoFile = (mimeType) => {
    const SUPPORTED_VIDEO_FORMATS = ["video/mp4", "video/mpeg", "video/mov", "video/avi", "video/x-flv", "video/mpg", "video/webm", "video/wmv", "video/3gpp"];
    return SUPPORTED_VIDEO_FORMATS.includes(mimeType);
  };

  const callGeminiApi = async (input, inputType) => {
    const geminiApiKey = localStorage.getItem('gemini_api_key');
    const MODEL = "gemini-2.5-pro-exp-03-25";
    
    let requestData = {
      model: MODEL,
      contents: []
    };

    if (inputType === 'youtube') {
      // YouTube URL case
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
      // Uploaded video file case
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
      // Uploaded audio file case
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
      // Call the Gemini API
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
      
      // Save debug response
      saveDebugResponse(data);
      
      // Parse the response to extract subtitles
      return parseGeminiResponse(data);
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw new Error('Failed to generate subtitles. Please try again.');
    }
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
    // Extract text from the response
    let text = '';
    
    if (response && 
        response.candidates && 
        response.candidates[0] && 
        response.candidates[0].content && 
        response.candidates[0].content.parts && 
        response.candidates[0].content.parts[0] && 
        response.candidates[0].content.parts[0].text) {
        text = response.candidates[0].content.parts[0].text;
    } else {
        console.error('Unexpected response format:', response);
        throw new Error('Invalid response format from Gemini API');
    }
    
    console.log('Raw text from Gemini:', text);
    
    // Parse the response text to extract subtitles
    const subtitles = [];
    
    // Format with milliseconds: [0m0s482ms - 0m1s542ms ]
    const regexWithMs = /\[\s*(\d+)m(\d+)s(\d+)ms\s*-\s*(\d+)m(\d+)s(\d+)ms\s*\]\s*(.*?)(?=\[\s*\d+m\d+s|\s*$)/gs;
    
    let match;
    let hasTimestamps = false;
    
    while ((match = regexWithMs.exec(text)) !== null) {
        hasTimestamps = true;
        // Extract time components with milliseconds
        const startMin = parseInt(match[1]);
        const startSec = parseInt(match[2]);
        const startMs = parseInt(match[3]);
        const endMin = parseInt(match[4]);
        const endSec = parseInt(match[5]);
        const endMs = parseInt(match[6]);
        
        // Format times as MM:SS.mmm for internal storage (will be converted to proper SRT format later)
        const startTime = startMin * 60 + startSec + startMs / 1000;
        const endTime = endMin * 60 + endSec + endMs / 1000;
        
        // Extract and clean the subtitle text
        let subtitleText = match[7].trim();
        
        subtitles.push({
            id: subtitles.length + 1,
            start: startTime,
            end: endTime,
            text: subtitleText
        });
    }
    
    // If no subtitles were found with the milliseconds pattern, try the original format
    if (subtitles.length === 0) {
        // Original format: [ 0m0s - 0m29s ]
        const regexOriginal = /\[\s*(\d+)m(\d+)s\s*-\s*(\d+)m(\d+)s\s*\](?:\n|\r\n?)+(.*?)(?=\[\s*\d+m\d+s|\s*$)/gs;
        
        while ((match = regexOriginal.exec(text)) !== null) {
            hasTimestamps = true;
            // Extract time components
            const startMin = parseInt(match[1]);
            const startSec = parseInt(match[2]);
            const endMin = parseInt(match[3]);
            const endSec = parseInt(match[4]);
            
            // Convert to seconds for internal representation
            const startTime = startMin * 60 + startSec;
            const endTime = endMin * 60 + endSec;
            
            // Extract and clean the subtitle text
            let subtitleText = match[5].trim();
            
            subtitles.push({
                id: subtitles.length + 1,
                start: startTime,
                end: endTime,
                text: subtitleText
            });
        }
    }
    
    // If no explicit timestamps found, create approximate timestamps based on line breaks
    if (!hasTimestamps) {
        console.warn('No timestamps found in response, generating approximate timestamps');
        
        // Split the text by line breaks
        const lines = text.split(/\n+/).filter(line => line.trim() !== '');
        
        // Calculate average line duration based on typical song length (estimated 3 minutes for songs)
        // This will give each line roughly equal time distribution
        const totalLines = lines.length;
        const estimatedDurationSec = 180; // 3 minutes in seconds
        const avgLineDurationSec = estimatedDurationSec / totalLines;
        
        lines.forEach((line, index) => {
            const startTime = index * avgLineDurationSec;
            const endTime = (index + 1) * avgLineDurationSec;
            
            subtitles.push({
                id: index + 1,
                start: startTime,
                end: endTime,
                text: line.trim()
            });
        });
    }
    
    console.log('Extracted subtitles:', subtitles);
    return subtitles;
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
    
    // We no longer need to create a hidden iframe with YouTube API
    // This was causing the googleads.g.doubleclick.net errors
  };
  
  // Cleanup function for the preloaded video
  useEffect(() => {
    return () => {
      // Clean up the preloading iframe when component unmounts
      if (preloadVideoFrameRef.current) {
        try {
          document.body.removeChild(preloadVideoFrameRef.current);
        } catch (e) {
          console.error('Error removing preload iframe:', e);
        }
      }
    };
  }, []);

  const handleTabChange = (tab) => {
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
    <div className="app-container">
      <Header 
        onSettingsClick={() => setShowSettings(true)} 
      />
      
      <InputMethods 
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        selectedVideo={selectedVideo}
        setSelectedVideo={setSelectedVideo}
        uploadedFile={uploadedFile}
        setUploadedFile={setUploadedFile}
        apiKeysSet={apiKeysSet}
      />
      
      <button 
        className="generate-btn" 
        onClick={generateSubtitles}
        disabled={isGenerating || !validateInput()}
      >
        {isGenerating ? 'Generating...' : 'Generate timed subtitles'}
      </button>
      
      <OutputContainer 
        status={status}
        subtitlesData={subtitlesData}
        selectedVideo={selectedVideo}
        uploadedFile={uploadedFile}
        onRetryGemini={retryGeminiRequest}
        isGenerating={isGenerating}
      />
      
      {showSettings && (
        <SettingsModal 
          onClose={() => setShowSettings(false)}
          onSave={saveApiKeys}
          apiKeysSet={apiKeysSet}
        />
      )}
    </div>
  );
}

export default App;