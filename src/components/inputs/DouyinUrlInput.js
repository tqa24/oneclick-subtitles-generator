import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiClock, FiX } from 'react-icons/fi';
import { formatTimestamp } from '../../utils/historyUtils';

// Helper functions for Douyin URL history
const getDouyinUrlHistory = () => {
  try {
    const history = JSON.parse(localStorage.getItem('douyin_url_history') || '[]');
    return Array.isArray(history) ? history : [];
  } catch (error) {
    console.error('Error parsing Douyin URL history:', error);
    return [];
  }
};

const addDouyinUrlToHistory = (video) => {
  try {
    if (!video || !video.id || !video.url) return;

    const history = getDouyinUrlHistory();

    // Check if this URL is already in history
    const existingIndex = history.findIndex(item => item.id === video.id);

    // If it exists, remove it (we'll add it to the top)
    if (existingIndex !== -1) {
      history.splice(existingIndex, 1);
    }

    // Add to the beginning of the array
    history.unshift({
      id: video.id,
      url: video.url,
      title: video.title || 'Douyin Video',
      timestamp: Date.now()
    });

    // Keep only the most recent 20 items
    const trimmedHistory = history.slice(0, 20);

    // Save back to localStorage
    localStorage.setItem('douyin_url_history', JSON.stringify(trimmedHistory));
  } catch (error) {
    console.error('Error saving Douyin URL to history:', error);
  }
};

const clearDouyinUrlHistory = () => {
  localStorage.removeItem('douyin_url_history');
};

const DouyinUrlInput = ({ setSelectedVideo, selectedVideo, className }) => {
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
      setVideoTitle(selectedVideo.title || 'Douyin Video');

      // Add to history when a video is selected
      if (selectedVideo.source === 'douyin' && selectedVideo.id) {
        addDouyinUrlToHistory(selectedVideo);
        // Refresh history list
        setHistory(getDouyinUrlHistory());
      }
    }
  }, [selectedVideo]);

  // Load history on component mount
  useEffect(() => {
    setHistory(getDouyinUrlHistory());
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

  const isValidDouyinUrl = (url) => {
    // Douyin URL patterns:
    // - https://www.douyin.com/video/7123456789012345678
    // - https://v.douyin.com/ABC123/
    const douyinRegex = /^(https?:\/\/)?(www\.|v\.)?douyin\.com\/(video\/\d+|[a-zA-Z0-9]+\/?)/;
    return douyinRegex.test(url);
  };

  const extractVideoId = (url) => {
    // Extract ID from full URL format: https://www.douyin.com/video/7123456789012345678
    const fullUrlMatch = url.match(/douyin\.com\/video\/(\d+)/);
    if (fullUrlMatch && fullUrlMatch[1]) {
      return fullUrlMatch[1];
    }

    // Extract ID from short URL format: https://v.douyin.com/ABC123/
    const shortUrlMatch = url.match(/v\.douyin\.com\/([a-zA-Z0-9]+)/);
    if (shortUrlMatch && shortUrlMatch[1]) {
      return shortUrlMatch[1];
    }

    return null;
  };

  const handleUrlChange = (e) => {
    const url = e.target.value.trim();
    setUrl(url);
    setError(''); // Clear any previous errors

    if (url && !isValidDouyinUrl(url)) {
      setError(t('douyinUrlInput.invalidUrl', 'Invalid Douyin URL format. Please check the examples below.'));
      setSelectedVideo(null);
      return;
    }

    if (isValidDouyinUrl(url)) {
      localStorage.removeItem('current_file_url');

      const videoId = extractVideoId(url);
      if (videoId) {
        setSelectedVideo({
          id: videoId,
          url: url,
          source: 'douyin',
          title: 'Douyin Video', // Default title
          thumbnail: '' // No thumbnail available initially
        });
      }
    } else {
      setSelectedVideo(null);
    }
  };

  // Toggle history dropdown
  const toggleHistory = () => {
    setShowHistory(prev => !prev);
  };

  // Handle selecting a URL from history
  const handleSelectFromHistory = (historyItem) => {
    setUrl(historyItem.url);
    setSelectedVideo({
      id: historyItem.id,
      url: historyItem.url,
      source: 'douyin',
      title: historyItem.title || 'Douyin Video',
      thumbnail: '' // No thumbnail available initially
    });
    setShowHistory(false);
  };

  // Clear history
  const handleClearHistory = (e) => {
    e.stopPropagation();
    clearDouyinUrlHistory();
    setHistory([]);
  };

  return (
    <div className={`youtube-url-input ${className || ''}`}>
      <div className="url-input-wrapper">
        <svg className="youtube-icon" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"></path>
          <path d="M12 6v6l4 2"></path>
        </svg>
        <input
          type="text"
          value={url}
          onChange={handleUrlChange}
          placeholder={t('douyinUrlInput.placeholder', 'Enter Douyin URL (e.g., douyin.com/video/...)')}
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

        {/* History dropdown */}
        {showHistory && history.length > 0 && (
          <div className="history-dropdown" ref={historyDropdownRef}>
            <div className="history-header">
              <h4 className="history-title">{t('youtube.recentVideos', 'Recent Videos')}</h4>
              <button
                className="clear-history-btn"
                onClick={handleClearHistory}
              >
                {t('common.clearAll', 'Clear All')}
              </button>
            </div>
            <div className="history-list">
              {history.map((item, index) => (
                <div
                  key={`${item.id}-${index}`}
                  className="history-item"
                  onClick={() => handleSelectFromHistory(item)}
                >
                  <div className="history-item-content">
                    <div className="history-item-info">
                      <div className="history-item-title">{item.title || 'Douyin Video'}</div>
                      <div className="history-item-meta">
                        <span className="history-item-id">{item.id}</span>
                        <span className="history-item-time">{formatTimestamp(item.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {selectedVideo && selectedVideo.id && (
        <>
          <div className="selected-video-preview">
            <div className="video-info">
              <h3 className="video-title">{videoTitle}</h3>
              <p className="video-id">{t('douyinUrlInput.videoId', 'Video ID:')} <span className="video-id-value">{selectedVideo.id}</span></p>
            </div>
          </div>
        </>
      )}



      {/* Examples section */}
      <div className="url-examples">
        <h4>{t('douyinUrlInput.examplesTitle', 'Supported URL formats:')}</h4>
        <ul>
          <li>{t('douyinUrlInput.example1', 'https://www.douyin.com/video/7123456789012345678')}</li>
          <li>{t('douyinUrlInput.example2', 'https://v.douyin.com/ABC123/')}</li>
          <li>{t('douyinUrlInput.example3', 'douyin.com/video/7123456789012345678')}</li>
        </ul>
      </div>
    </div>
  );
};

export default DouyinUrlInput;
