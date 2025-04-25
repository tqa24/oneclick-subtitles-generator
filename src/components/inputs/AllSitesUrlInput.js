import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FiClock, FiX } from 'react-icons/fi';
import { addAllSitesUrlToHistory, getAllSitesUrlHistory, clearAllSitesUrlHistory, formatTimestamp } from '../../utils/historyUtils';

const AllSitesUrlInput = ({ setSelectedVideo, selectedVideo, className }) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const historyDropdownRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (selectedVideo) {
      setVideoTitle(selectedVideo.title || 'Video');

      // Add to history when a video is selected
      if (selectedVideo.source === 'all-sites' && selectedVideo.id) {
        addAllSitesUrlToHistory(selectedVideo);
        // Refresh history list
        setHistory(getAllSitesUrlHistory());
      }
    }
  }, [selectedVideo]);

  // Load history on component mount
  useEffect(() => {
    setHistory(getAllSitesUrlHistory());
  }, []);

  // Handle clicks outside the dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        historyDropdownRef.current &&
        !historyDropdownRef.current.contains(event.target) &&
        !event.target.closest('.history-button')
      ) {
        setShowHistory(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const isValidUrl = (url) => {
    if (!url) return false;

    // First, check if it's a valid URL format
    try {
      new URL(url);
    } catch (e) {
      return false;
    }

    // Then check if it has a domain name
    const domainRegex = /^https?:\/\/([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]*[a-z0-9])?/i;
    return domainRegex.test(url);
  };

  const generateVideoId = (url) => {
    // Generate a unique ID based on the URL
    try {
      // First, try to create a more reliable ID
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      const path = urlObj.pathname.replace(/\//g, '_');

      // Create a base ID from domain and path
      const baseId = `${domain}${path}`.replace(/[^a-zA-Z0-9]/g, '_');

      // Add a timestamp to ensure uniqueness
      const timestamp = Date.now();

      // Combine everything into a valid ID
      return `site_${baseId}_${timestamp}`;
    } catch (error) {
      console.error('Error generating video ID:', error);
      // Fallback to a simpler ID generation
      const timestamp = Date.now();
      return `site_${timestamp}`;
    }
  };

  const handleUrlChange = (e) => {
    const url = e.target.value.trim();
    setUrl(url);
    setError(''); // Clear any previous errors

    // Only validate if there's actually a URL entered
    if (url) {
      if (!isValidUrl(url)) {
        setError(t('allSitesUrlInput.invalidUrl', 'Invalid URL format. Please enter a valid URL.'));
        setSelectedVideo(null);
        return;
      }

      // Valid URL, set up the selected video
      localStorage.removeItem('current_file_url');

      try {
        const videoId = generateVideoId(url);
        const hostname = new URL(url).hostname;
        const siteName = hostname.replace(/^www\./, '');

        setSelectedVideo({
          id: videoId,
          url: url,
          source: 'all-sites',
          title: `Video from ${siteName}`,
          thumbnail: '', // No thumbnail available initially
          type: 'video/mp4' // Explicitly set the type
        });

        // Set video title for display
        setVideoTitle(`Video from ${siteName}`);
      } catch (error) {
        console.error('Error setting up video:', error);
        setError(t('allSitesUrlInput.invalidUrl', 'Invalid URL format. Please enter a valid URL.'));
        setSelectedVideo(null);
      }
    } else {
      // Empty URL, clear selected video
      setSelectedVideo(null);
    }
  };

  // Toggle history dropdown
  const toggleHistory = () => {
    setShowHistory(prev => !prev);
  };

  // Clear all history
  const handleClearHistory = () => {
    clearAllSitesUrlHistory();
    setHistory([]);
    setShowHistory(false);
  };

  // Select a video from history
  const selectFromHistory = (historyItem) => {
    setUrl(historyItem.url);
    setSelectedVideo({
      id: historyItem.id,
      url: historyItem.url,
      source: 'all-sites',
      title: historyItem.title,
      thumbnail: historyItem.thumbnail || ''
    });
    setShowHistory(false);
  };

  return (
    <div className={`youtube-url-input ${className || ''}`}>
      <div className="url-input-wrapper">
        <svg className="youtube-icon" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
          <path d="M21 2H3a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"></path>
          <path d="M7 10.5v3"></path>
          <path d="M12 10.5v3"></path>
          <path d="M17 10.5v3"></path>
          <path d="M5 14h14"></path>
        </svg>
        <input
          type="text"
          value={url}
          onChange={handleUrlChange}
          placeholder={t('allSitesUrlInput.placeholder', 'Enter any video URL (e.g., tiktok.com, dailymotion.com, etc.)')}
          className={`youtube-url-field ${error ? 'error-input' : ''}`}
          ref={inputRef}
        />

        {/* History button */}
        {history.length > 0 && (
          <button
            type="button"
            className="history-button"
            onClick={toggleHistory}
            aria-label={t('common.history', 'History')}
            title={t('common.history', 'History')}
          >
            <FiClock size={18} />
          </button>
        )}

        {url && (
          <button
            type="button"
            className="clear-url-btn"
            onClick={() => {
              setUrl('');
              setSelectedVideo(null);
              setError('');
            }}
            aria-label="Clear input"
          >
            <FiX size={18} />
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* History dropdown */}
      {showHistory && (
        <div className="history-dropdown" ref={historyDropdownRef}>
          <div className="history-header">
            <h4>{t('common.recentVideos', 'Recent Videos')}</h4>
            <button
              type="button"
              className="clear-history-btn"
              onClick={handleClearHistory}
            >
              {t('common.clearHistory', 'Clear History')}
            </button>
          </div>
          <ul className="history-list">
            {history.map((item, index) => (
              <li key={index} className="history-item" onClick={() => selectFromHistory(item)}>
                <div className="history-item-content">
                  <div className="history-item-title">{item.title || 'Video'}</div>
                  <div className="history-item-url">{item.url}</div>
                  <div className="history-item-time">{formatTimestamp(item.timestamp)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedVideo && selectedVideo.id && (
        <>
          <div className="selected-video-preview">
            <div className="video-info">
              <h3 className="video-title">{videoTitle}</h3>
              <p className="video-url">{t('allSitesUrlInput.url', 'URL:')} <span className="video-url-value">{url}</span></p>
            </div>
          </div>
        </>
      )}

      {/* Examples section */}
      <div className="url-examples">
        <h4>{t('allSitesUrlInput.examplesTitle', 'Supported sites include:')}</h4>
        <ul>
          <li>{t('allSitesUrlInput.example1', 'tiktok.com')}</li>
          <li>{t('allSitesUrlInput.example2', 'vimeo.com')}</li>
          <li>{t('allSitesUrlInput.example3', 'dailymotion.com')}</li>
          <li>{t('allSitesUrlInput.example4', 'facebook.com')}</li>
          <li>{t('allSitesUrlInput.example5', 'twitter.com')}</li>
          <li>{t('allSitesUrlInput.example7', '...and many more!')}</li>
        </ul>
        <p className="yt-dlp-note">{t('allSitesUrlInput.ytDlpNote', 'Powered by yt-dlp which supports 1000+ sites')}</p>
      </div>
    </div>
  );
};

export default AllSitesUrlInput;
