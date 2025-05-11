/**
 * YouTube API service using fetch API directly
 * This avoids the need for the Google API client library which has Node.js dependencies
 */

// Storage keys
const TOKEN_STORAGE_KEY = 'youtube_oauth_token';
const CLIENT_ID_STORAGE_KEY = 'youtube_client_id';
const CLIENT_SECRET_STORAGE_KEY = 'youtube_client_secret';

// Debug flag - set to false to disable verbose logging
const DEBUG_LOGGING = false;

/**
 * Conditionally log messages based on debug flag
 * @param {string} message - Message to log
 * @param {any} data - Optional data to log
 */
const debugLog = (message, data) => {
  if (!DEBUG_LOGGING) return;

  if (data !== undefined) {

  } else {

  }
};

/**
 * Check if OAuth is enabled
 * @returns {boolean} True if OAuth is enabled
 */
export const isOAuthEnabled = () => {
  const useOAuth = localStorage.getItem('use_youtube_oauth') === 'true';
  debugLog('isOAuthEnabled check:', useOAuth);
  return useOAuth;
};

/**
 * Check if tokens are stored and valid
 * @returns {boolean} True if tokens exist and are not expired
 */
export const hasValidTokens = () => {
  const tokens = getStoredTokens();
  debugLog('hasValidTokens check:', tokens ? 'Has tokens' : 'No tokens');

  if (!tokens) {
    return false;
  }

  // Check if tokens are expired
  if (tokens.expires_at) {
    const expiryDate = new Date(tokens.expires_at);
    const now = new Date();
    // Add a 5-minute buffer to be safe
    const isValid = expiryDate > new Date(now.getTime() + 5 * 60 * 1000);
    debugLog('Token expiry check:', { isValid, expiryDate, now });
    return isValid;
  }

  return false;
};

/**
 * Get stored OAuth tokens
 * @returns {Object|null} Stored tokens or null if not found
 */
export const getStoredTokens = () => {
  const tokenString = localStorage.getItem(TOKEN_STORAGE_KEY);
  debugLog('getStoredTokens check:', tokenString ? 'Has token string' : 'No token string');

  if (!tokenString) {
    return null;
  }

  try {
    const tokens = JSON.parse(tokenString);
    debugLog('Parsed tokens:', tokens);
    return tokens;
  } catch (error) {
    console.error('Error parsing stored tokens:', error);
    return null;
  }
};

/**
 * Store OAuth tokens in localStorage
 * @param {Object} tokens - OAuth tokens
 */
export const storeTokens = (tokens) => {
  // Add expiry time
  const expiresIn = tokens.expires_in || 3600;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresIn * 1000);

  const tokensWithExpiry = {
    ...tokens,
    expires_at: expiresAt.toISOString()
  };

  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokensWithExpiry));

  // Trigger a storage event for other tabs/components to detect
  window.dispatchEvent(new Event('storage'));

  // Set success flag for the main application to detect
  localStorage.setItem('oauth_auth_success', 'true');
  localStorage.setItem('oauth_auth_timestamp', Date.now().toString());
};

/**
 * Store OAuth client credentials
 * @param {string} clientId - OAuth client ID
 * @param {string} clientSecret - OAuth client secret
 */
export const storeClientCredentials = (clientId, clientSecret) => {
  localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
  localStorage.setItem(CLIENT_SECRET_STORAGE_KEY, clientSecret);
};

/**
 * Get stored client credentials
 * @returns {Object} Client credentials
 */
export const getClientCredentials = () => {
  return {
    clientId: localStorage.getItem(CLIENT_ID_STORAGE_KEY) || '',
    clientSecret: localStorage.getItem(CLIENT_SECRET_STORAGE_KEY) || ''
  };
};

/**
 * Clear all stored OAuth data
 */
export const clearOAuthData = () => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);

  // Trigger a storage event for other tabs/components to detect
  window.dispatchEvent(new Event('storage'));

  // Remove success flag
  localStorage.removeItem('oauth_auth_success');
  localStorage.removeItem('oauth_auth_timestamp');
};

/**
 * Get authorization URL for OAuth flow
 * @returns {string|null} Authorization URL or null if client not configured
 */
export const getAuthUrl = () => {
  const { clientId } = getClientCredentials();

  if (!clientId) {
    return null;
  }

  const redirectUri = encodeURIComponent(window.location.origin + '/oauth2callback.html');
  const scope = encodeURIComponent('https://www.googleapis.com/auth/youtube.readonly');

  return `https://accounts.google.com/o/oauth2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&access_type=offline&include_granted_scopes=true`;
};

/**
 * Refresh access token
 * @returns {Promise<Object>} New tokens
 */
export const refreshAccessToken = async () => {
  const tokens = getStoredTokens();
  const { clientId, clientSecret } = getClientCredentials();

  if (!tokens || !tokens.refresh_token || !clientId || !clientSecret) {
    throw new Error('Cannot refresh token: missing refresh token or client credentials');
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error_description || 'Failed to refresh token');
    }

    const newTokens = await response.json();

    // Preserve the refresh token as it's not always returned
    const updatedTokens = {
      ...newTokens,
      refresh_token: tokens.refresh_token
    };

    storeTokens(updatedTokens);
    return updatedTokens;
  } catch (error) {
    console.error('Error refreshing token:', error);
    throw error;
  }
};

/**
 * Get access token, refreshing if necessary
 * @returns {Promise<string>} Access token
 */
export const getAccessToken = async () => {
  const tokens = getStoredTokens();

  if (!tokens) {
    throw new Error('No tokens found');
  }

  // Check if token is expired
  if (tokens.expires_at) {
    const expiryDate = new Date(tokens.expires_at);
    const now = new Date();

    if (expiryDate <= now) {
      // Token is expired, refresh it
      const newTokens = await refreshAccessToken();
      return newTokens.access_token;
    }
  }

  return tokens.access_token;
};

/**
 * Search YouTube videos
 * @param {string} query - Search query
 * @param {number} maxResults - Maximum number of results to return
 * @returns {Promise<Array>} Array of video results
 */
export const searchYouTubeVideos = async (query, maxResults = 5) => {
  try {
    let accessToken;
    debugLog('searchYouTubeVideos called with query:', query);

    const useOAuth = isOAuthEnabled();
    debugLog('Using OAuth?', useOAuth);

    if (useOAuth) {
      // Use OAuth
      const hasTokens = hasValidTokens();
      debugLog('Has valid tokens?', hasTokens);

      if (!hasTokens) {
        console.error('Not authenticated with YouTube'); // Keep as console.error for critical errors
        throw new Error('Not authenticated with YouTube');
      }

      accessToken = await getAccessToken();
      debugLog('Got access token:', accessToken ? 'Yes' : 'No');

      debugLog('Making OAuth request to YouTube API');
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=${maxResults}&q=${encodeURIComponent(query)}&type=video`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      debugLog('YouTube API response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('YouTube API error response:', errorText); // Keep as console.error for critical errors

        // Check for quota exceeded error
        if (response.status === 403 && errorText.includes('quotaExceeded')) {
          throw new Error('quota exceeded');
        } else {
          throw new Error('YouTube API request failed');
        }
      }

      const data = await response.json();
      debugLog('YouTube API response data:', data);

      if (data.items && data.items.length > 0) {
        const results = data.items.map(item => ({
          id: item.id.videoId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails.default.url,
          channel: item.snippet.channelTitle,
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`
        }));
        debugLog('Mapped results:', results);
        return results;
      }
    } else {
      // Use API key
      const youtubeApiKey = localStorage.getItem('youtube_api_key');
      debugLog('Using API key:', youtubeApiKey ? 'Yes' : 'No');

      if (!youtubeApiKey) {
        console.error('YouTube API key not found'); // Keep as console.error for critical errors
        throw new Error('YouTube API key not found');
      }

      debugLog('Making API key request to YouTube API');
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=${maxResults}&q=${encodeURIComponent(query)}&type=video&key=${youtubeApiKey}`
      );

      debugLog('YouTube API response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('YouTube API error response:', errorText); // Keep as console.error for critical errors

        // Parse the error response to get more details
        try {
          const errorData = JSON.parse(errorText);

          // Check for specific error types
          if (response.status === 403) {
            if (errorText.includes('quotaExceeded')) {
              throw new Error('quota exceeded');
            } else if (errorData.error && errorData.error.errors && errorData.error.errors.length > 0) {
              const firstError = errorData.error.errors[0];

              // Check for API not enabled error
              if (firstError.reason === 'accessNotConfigured' ||
                  (errorData.error.message && errorData.error.message.includes('API v3 has not been used in project') &&
                   errorData.error.message.includes('or it is disabled'))) {
                throw new Error('api not enabled');
              }
            }
          }

          // If no specific error was identified, throw a generic error with the message
          if (errorData.error && errorData.error.message) {
            throw new Error(`YouTube API error: ${errorData.error.message}`);
          } else {
            throw new Error('YouTube API request failed');
          }
        } catch (parseError) {
          // If we can't parse the error as JSON, just use the original error text
          debugLog('Error parsing YouTube API error response:', parseError);
          throw new Error('YouTube API request failed');
        }
      }

      const data = await response.json();
      debugLog('YouTube API response data:', data);

      if (data.items && data.items.length > 0) {
        const results = data.items.map(item => ({
          id: item.id.videoId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails.default.url,
          channel: item.snippet.channelTitle,
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`
        }));
        debugLog('Mapped results:', results);
        return results;
      }
    }

    return [];
  } catch (error) {
    console.error('Error searching YouTube:', error); // Keep as console.error for critical errors
    throw error;
  }
};

/**
 * Get video details by ID
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Object>} Video details
 */
export const getVideoDetails = async (videoId) => {
  try {
    let accessToken;

    if (isOAuthEnabled()) {
      // Use OAuth
      if (!hasValidTokens()) {
        throw new Error('Not authenticated with YouTube');
      }

      accessToken = await getAccessToken();

      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('YouTube API error response:', errorText); // Keep as console.error for critical errors

        // Parse the error response to get more details
        try {
          const errorData = JSON.parse(errorText);

          // Check for specific error types
          if (response.status === 403) {
            if (errorText.includes('quotaExceeded')) {
              throw new Error('quota exceeded');
            } else if (errorData.error && errorData.error.errors && errorData.error.errors.length > 0) {
              const firstError = errorData.error.errors[0];

              // Check for API not enabled error
              if (firstError.reason === 'accessNotConfigured' ||
                  (errorData.error.message && errorData.error.message.includes('API v3 has not been used in project') &&
                   errorData.error.message.includes('or it is disabled'))) {
                throw new Error('api not enabled');
              }
            }
          }

          // If no specific error was identified, throw a generic error with the message
          if (errorData.error && errorData.error.message) {
            throw new Error(`YouTube API error: ${errorData.error.message}`);
          } else {
            throw new Error('YouTube API request failed');
          }
        } catch (parseError) {
          // If we can't parse the error as JSON, just use the original error text
          debugLog('Error parsing YouTube API error response:', parseError);
          throw new Error('YouTube API request failed');
        }
      }

      const data = await response.json();

      if (data.items && data.items.length > 0) {
        const video = data.items[0];
        return {
          id: video.id,
          title: video.snippet.title,
          description: video.snippet.description,
          thumbnail: video.snippet.thumbnails.high.url,
          channel: video.snippet.channelTitle,
          publishedAt: video.snippet.publishedAt
        };
      }
    } else {
      // Use API key
      const youtubeApiKey = localStorage.getItem('youtube_api_key');

      if (!youtubeApiKey) {
        throw new Error('YouTube API key not found');
      }

      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${youtubeApiKey}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('YouTube API error response:', errorText); // Keep as console.error for critical errors

        // Parse the error response to get more details
        try {
          const errorData = JSON.parse(errorText);

          // Check for specific error types
          if (response.status === 403) {
            if (errorText.includes('quotaExceeded')) {
              throw new Error('quota exceeded');
            } else if (errorData.error && errorData.error.errors && errorData.error.errors.length > 0) {
              const firstError = errorData.error.errors[0];

              // Check for API not enabled error
              if (firstError.reason === 'accessNotConfigured' ||
                  (errorData.error.message && errorData.error.message.includes('API v3 has not been used in project') &&
                   errorData.error.message.includes('or it is disabled'))) {
                throw new Error('api not enabled');
              }
            }
          }

          // If no specific error was identified, throw a generic error with the message
          if (errorData.error && errorData.error.message) {
            throw new Error(`YouTube API error: ${errorData.error.message}`);
          } else {
            throw new Error('YouTube API request failed');
          }
        } catch (parseError) {
          // If we can't parse the error as JSON, just use the original error text
          debugLog('Error parsing YouTube API error response:', parseError);
          throw new Error('YouTube API request failed');
        }
      }

      const data = await response.json();

      if (data.items && data.items.length > 0) {
        const video = data.items[0];
        return {
          id: video.id,
          title: video.snippet.title,
          description: video.snippet.description,
          thumbnail: video.snippet.thumbnails.high.url,
          channel: video.snippet.channelTitle,
          publishedAt: video.snippet.publishedAt
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching video details:', error); // Keep as console.error for critical errors
    throw error;
  }
};
