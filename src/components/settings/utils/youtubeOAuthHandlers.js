import { getAuthUrl, hasValidTokens, clearOAuthData } from '../../../services/youtubeApiService';

// Store client credentials (mirrors youtubeApiService storage)
export const storeClientCredentials = (clientId, clientSecret) => {
  localStorage.setItem('youtube_client_id', clientId);
  localStorage.setItem('youtube_client_secret', clientSecret);
};

// Handle YouTube OAuth authentication
export const handleOAuthAuthentication = (youtubeClientId, youtubeClientSecret, setIsAuthenticated) => {
  if (youtubeClientId && youtubeClientSecret) {
    // Store client credentials
    storeClientCredentials(youtubeClientId, youtubeClientSecret);

    // Get authorization URL
    const authUrl = getAuthUrl();
    if (authUrl) {
      // Set up message listener for OAuth success
      const messageListener = (event) => {
        if (event.origin === window.location.origin &&
            event.data && event.data.type === 'OAUTH_SUCCESS') {
          // Update authentication status
          setIsAuthenticated(hasValidTokens());
          // Remove the listener
          window.removeEventListener('message', messageListener);
        }
      };

      // Add the listener
      window.addEventListener('message', messageListener);

      // Open the authorization URL in a new window
      const authWindow = window.open(authUrl, 'youtube-oauth', 'width=800,height=600');

      // Check if popup was blocked
      if (!authWindow || authWindow.closed || typeof authWindow.closed === 'undefined') {
        alert('Popup blocked! Please allow popups for this site and try again.');
        window.removeEventListener('message', messageListener);
      }
    } else {
      alert('Failed to generate authorization URL. Please check your client credentials.');
    }
  } else {
    alert('Please enter both Client ID and Client Secret.');
  }
};

// Handle clearing OAuth data
export const handleClearOAuth = (setIsAuthenticated) => {
  if (window.confirm('Are you sure you want to clear your YouTube OAuth credentials? You will need to authenticate again to use YouTube search.')) {
    clearOAuthData();
    setIsAuthenticated(false);
  }
};
