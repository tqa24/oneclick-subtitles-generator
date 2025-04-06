import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const YoutubeSearchInput = ({ apiKeysSet = { youtube: false }, selectedVideo, setSelectedVideo }) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  // Debounce function for search
  const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);

      return () => {
        clearTimeout(handler);
      };
    }, [value, delay]);

    return debouncedValue;
  };

  // Search YouTube API - using useCallback to allow it in the dependency array
  const searchYouTube = useCallback(async (query) => {
    setIsSearching(true);
    setError('');

    try {
      const youtubeApiKey = localStorage.getItem('youtube_api_key');
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${encodeURIComponent(query)}&type=video&key=${youtubeApiKey}`
      );

      if (!response.ok) {
        throw new Error('YouTube API request failed');
      }

      const data = await response.json();

      if (data.items && data.items.length > 0) {
        const formattedResults = data.items.map(item => ({
          id: item.id.videoId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails.default.url,
          channel: item.snippet.channelTitle,
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`
        }));

        setSearchResults(formattedResults);
      } else {
        setSearchResults([]);
        setError(t('youtube.noResults', 'No results found.'));
      }
    } catch (error) {
      console.error('Error searching YouTube:', error);
      setError(t('youtube.searchError', 'Error searching YouTube. Please try again or enter a URL directly.'));
    } finally {
      setIsSearching(false);
    }
  }, [t]);

  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Search YouTube when query changes
  useEffect(() => {
    if (debouncedSearchQuery.length < 3) {
      setSearchResults([]);
      return;
    }

    if (!apiKeysSet.youtube) {
      setError(t('youtube.noApiKey', 'Please set your YouTube API key in the settings first.'));
      return;
    }

    searchYouTube(debouncedSearchQuery);
  }, [debouncedSearchQuery, apiKeysSet.youtube, t, searchYouTube]);

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Handle search result selection
  const handleVideoSelect = (video) => {
    // Clear any existing file URLs when selecting a YouTube video
    localStorage.removeItem('current_file_url');
    setSelectedVideo(video);
  };

  return (
    <div className="youtube-search-input">
      <div className="search-field-container">
        <label htmlFor="youtube-search-input" className="search-label">
          {t('youtube.searchLabel', 'Search YouTube Video:')}
        </label>
        <div className="search-input-wrapper">
          <svg className="search-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            id="youtube-search-input"
            className="youtube-search-field"
            placeholder={t('youtube.searchPlaceholder', 'Enter video title...')}
            value={searchQuery}
            onChange={handleSearchChange}
          />
          {searchQuery && (
            <button
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="search-results">
        {error && <p className="error">{error}</p>}

        {isSearching && (
          <div className="searching-indicator">
            <div className="search-spinner"></div>
            <p>{t('youtube.searching', 'Searching...')}</p>
          </div>
        )}

        {!isSearching && searchResults.length > 0 && (
          searchResults.map(video => (
            <div
              key={video.id}
              className={`search-result-item ${selectedVideo?.id === video.id ? 'selected' : ''}`}
            >
              <div
                className="search-result-content"
                onClick={() => handleVideoSelect(video)}
              >
                <div className="search-thumbnail-container">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="search-result-thumbnail"
                  />
                </div>
                <div className="search-result-info">
                  <div className="search-result-title">{video.title}</div>
                  <div className="search-result-channel">{video.channel}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default YoutubeSearchInput;