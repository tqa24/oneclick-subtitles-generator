import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const YoutubeUrlInput = ({ setSelectedVideo, selectedVideo }) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [videoTitle, setVideoTitle] = useState('');

  useEffect(() => {
    if (selectedVideo) {
      setVideoTitle(selectedVideo.title || 'YouTube Video');
    }
  }, [selectedVideo]);

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
      const youtubeApiKey = localStorage.getItem('youtube_api_key');
      if (!youtubeApiKey) {
        console.warn('YouTube API key not found');
        return null;
      }

      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${youtubeApiKey}`
      );

      if (!response.ok) {
        throw new Error('YouTube API request failed');
      }

      const data = await response.json();
      if (data.items && data.items.length > 0) {
        return data.items[0].snippet.title;
      }
      return null;
    } catch (error) {
      console.error('Error fetching video title:', error);
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

  return (
    <div className="youtube-url-input">
      <div className="full-width-url-input">
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
          />
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
              ✕
            </button>
          )}
        </div>
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
        <div className="youtube-instructions">
          <h3>{t('youtubeUrlInput.instructionsTitle', 'How to use')}</h3>
          <ol>
            <li>{t('youtubeUrlInput.instructionsStep1', 'Find a YouTube video you want to generate subtitles for')}</li>
            <li>{t('youtubeUrlInput.instructionsStep2', 'Copy the URL from your browser address bar')}</li>
            <li>{t('youtubeUrlInput.instructionsStep3', 'Paste the URL above')}</li>
          </ol>

          <div className="url-examples">
            <h4>{t('youtubeUrlInput.examplesTitle', 'Supported URL formats:')}</h4>
            <ul>
              <li>{t('youtubeUrlInput.example1', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')}</li>
              <li>{t('youtubeUrlInput.example2', 'https://youtu.be/dQw4w9WgXcQ')}</li>
              <li>{t('youtubeUrlInput.example3', 'youtube.com/watch?v=dQw4w9WgXcQ')}</li>
            </ul>
          </div>
        </div>
      )}

      {selectedVideo && selectedVideo.id && (
        <div className="selected-video-preview">
          <div className="thumbnail-container">
            <img
              src={`https://img.youtube.com/vi/${selectedVideo.id}/0.jpg`}
              alt={videoTitle}
              className="thumbnail"
            />
          </div>
          <div className="video-info">
            <h3 className="video-title">{videoTitle}</h3>
            <p className="video-id">{t('youtubeUrlInput.videoId', 'Video ID:')} <span className="video-id-value">{selectedVideo.id}</span></p>
          </div>
        </div>
      )}
    </div>
  );
};

export default YoutubeUrlInput;