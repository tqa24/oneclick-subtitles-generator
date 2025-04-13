import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FiClock, FiX } from 'react-icons/fi';
import { addYoutubeUrlToHistory, getYoutubeUrlHistory, clearYoutubeUrlHistory, formatTimestamp } from '../../utils/historyUtils';
import { getVideoDetails } from '../../services/youtubeApiService';
import QualitySelector from './QualitySelector';

const YoutubeUrlInput = ({ setSelectedVideo, selectedVideo, className }) => {
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
      setVideoTitle(selectedVideo.title || 'YouTube Video');

      // Add to history when a video is selected
      if (selectedVideo.source === 'youtube' && selectedVideo.id) {
        addYoutubeUrlToHistory(selectedVideo);
        // Refresh history list
        setHistory(getYoutubeUrlHistory());
      }
    }
  }, [selectedVideo]);

  // Load history on component mount
  useEffect(() => {
    setHistory(getYoutubeUrlHistory());
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

  const isValidYoutubeUrl = (url) => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(\S*)?$/;
    return youtubeRegex.test(url);
  };

  const extractVideoId = (url) => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  };

  const fetchVideoTitle = async (videoId) => {
    try {
      // Use the YouTube API service to get video details
      const videoDetails = await getVideoDetails(videoId);
      return videoDetails ? videoDetails.title : null;
    } catch (error) {
      console.error('Error fetching video title:', error);

      // Check for quota exceeded error
      if (error.message.includes('quota exceeded')) {
        setError(error.message);
      }

      return null;
    }
  };

  const handleUrlChange = async (e) => {
    const url = e.target.value.trim();
    setUrl(url);

    if (isValidYoutubeUrl(url)) {
      localStorage.removeItem('current_file_url');

      const videoId = extractVideoId(url);
      if (videoId) {
        const title = await fetchVideoTitle(videoId) || 'YouTube Video';
        setSelectedVideo({
          id: videoId,
          url: url,
          source: 'youtube',
          title: title,
          thumbnail: `https://img.youtube.com/vi/${videoId}/0.jpg`
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

  // Handle selecting a video from history
  const handleSelectFromHistory = (historyItem) => {
    setUrl(historyItem.url);
    setSelectedVideo({
      id: historyItem.id,
      url: historyItem.url,
      source: 'youtube',
      title: historyItem.title,
      thumbnail: historyItem.thumbnail
    });
    setShowHistory(false);
  };

  // Clear history
  const handleClearHistory = (e) => {
    e.stopPropagation();
    clearYoutubeUrlHistory();
    setHistory([]);
  };

  return (
    <div className={`youtube-url-input ${className || ''}`}>
      <div className="url-input-wrapper">
        <svg className="youtube-icon" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none">
          <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
          <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
        </svg>
        <input
          type="text"
          value={url}
          onChange={handleUrlChange}
          placeholder={t('youtubeUrlInput.placeholder', 'Enter YouTube URL (e.g., youtube.com/watch?v=...)')}
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
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="history-thumbnail"
                      onError={(e) => {
                        e.target.src = `https://img.youtube.com/vi/${item.id}/0.jpg`;
                      }}
                    />
                    <div className="history-item-info">
                      <div className="history-item-title">{item.title}</div>
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

      {!selectedVideo && (
        <div className="youtube-instructions-container">
          <div className="youtube-instructions-row">
            <div className="youtube-instructions-col">
              <h4>{t('youtubeUrlInput.instructionsTitle', 'How to use')}</h4>
              <ol>
                <li>{t('youtubeUrlInput.instructionsStep1', 'Find a YouTube video you want to generate subtitles for')}</li>
                <li>{t('youtubeUrlInput.instructionsStep2', 'Copy the URL from your browser address bar')}</li>
                <li>{t('youtubeUrlInput.instructionsStep3', 'Paste the URL above')}</li>
              </ol>
            </div>

            <div className="youtube-instructions-col">
              <h4>{t('youtubeUrlInput.examplesTitle', 'Supported URL formats:')}</h4>
              <ul>
                <li>{t('youtubeUrlInput.example1', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')}</li>
                <li>{t('youtubeUrlInput.example2', 'https://youtu.be/dQw4w9WgXcQ')}</li>
                <li>{t('youtubeUrlInput.example3', 'youtube.com/watch?v=dQw4w9WgXcQ')}</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {selectedVideo && selectedVideo.id && (
        <>
          <div className="selected-video-preview">
            <img
              src={`https://img.youtube.com/vi/${selectedVideo.id}/0.jpg`}
              alt={videoTitle}
              className="thumbnail"
            />
            <div className="video-info">
              <h3 className="video-title">{videoTitle}</h3>
              <p className="video-id">{t('youtubeUrlInput.videoId', 'Video ID:')} <span className="video-id-value">{selectedVideo.id}</span></p>
            </div>
          </div>

          {/* Quality selector */}
          <QualitySelector
            onChange={(quality) => {
              // Update the selected video with the quality
              setSelectedVideo(prev => ({
                ...prev,
                quality
              }));
            }}
          />
        </>
      )}
    </div>
  );
};

export default YoutubeUrlInput;