import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const YoutubeUrlInput = ({ onVideoSelect }) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const isValidYoutubeUrl = (url) => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(\S*)?$/;
    return youtubeRegex.test(url);
  };

  const extractVideoId = (url) => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!url.trim()) {
      setError(t('youtubeUrlInput.emptyUrl', 'Please enter a YouTube URL'));
      return;
    }

    if (!isValidYoutubeUrl(url)) {
      setError(t('youtubeUrlInput.invalidUrl', 'Please enter a valid YouTube URL'));
      return;
    }

    setIsLoading(true);
    
    try {
      const videoId = extractVideoId(url);
      
      // Call API to fetch video details
      // This would typically be an API call to get video metadata
      // For now, we'll mock it with a simple object
      
      const videoData = {
        id: videoId,
        title: 'YouTube Video',
        url: url,
        source: 'youtube',
        thumbnail: `https://img.youtube.com/vi/${videoId}/0.jpg`
      };
      
      onVideoSelect(videoData);
    } catch (error) {
      console.error('Error fetching video:', error);
      setError(t('youtubeUrlInput.fetchError', 'Failed to fetch video information'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="youtube-url-input">
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t('youtubeUrlInput.placeholder', 'Enter YouTube URL (e.g., https://www.youtube.com/watch?v=...)')}
            className={error ? 'error-input' : ''}
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading} className="primary-button">
            {isLoading ? (
              <span className="loading-spinner"></span>
            ) : (
              t('youtubeUrlInput.submitButton', 'Generate Subtitles')
            )}
          </button>
        </div>
        {error && <p className="error-message">{error}</p>}
      </form>
      
      <div className="youtube-instructions">
        <h3>{t('youtubeUrlInput.instructionsTitle', 'How to use')}</h3>
        <ol>
          <li>{t('youtubeUrlInput.instructionsStep1', 'Find a YouTube video you want to generate subtitles for')}</li>
          <li>{t('youtubeUrlInput.instructionsStep2', 'Copy the URL from your browser address bar')}</li>
          <li>{t('youtubeUrlInput.instructionsStep3', 'Paste the URL above and click "Generate Subtitles"')}</li>
        </ol>
      </div>
    </div>
  );
};

export default YoutubeUrlInput;