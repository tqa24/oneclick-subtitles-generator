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
  const handleResultClick = (video) => {
    setSelectedVideo(video);
  };
  
  return (
    <div className="youtube-search-input">
      <label htmlFor="youtube-search-input">{t('youtube.searchLabel', 'Search YouTube Video:')}</label>
      <input 
        type="text" 
        id="youtube-search-input" 
        placeholder={t('youtube.searchPlaceholder', 'Enter video title...')}
        value={searchQuery}
        onChange={handleSearchChange}
      />
      
      <div className="search-results">
        {error && <p className="error">{error}</p>}
        
        {isSearching && <p>{t('youtube.searching', 'Searching...')}</p>}
        
        {!isSearching && searchResults.length > 0 && (
          searchResults.map(video => (
            <div 
              key={video.id} 
              className={`search-result-item ${selectedVideo?.id === video.id ? 'selected' : ''}`}
              onClick={() => handleResultClick(video)}
            >
              <img 
                src={video.thumbnail} 
                alt={video.title} 
                className="search-result-thumbnail"
              />
              <div className="search-result-info">
                <div className="search-result-title">{video.title}</div>
                <div className="search-result-channel">{video.channel}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default YoutubeSearchInput;