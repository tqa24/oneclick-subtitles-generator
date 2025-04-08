import { google } from 'googleapis';

// OAuth 2.0 configuration
const SCOPES = ['https://www.googleapis.com/auth/youtube.readonly'];
const TOKEN_STORAGE_KEY = 'youtube_oauth_token';
const CLIENT_ID_STORAGE_KEY = 'youtube_client_id';
const CLIENT_SECRET_STORAGE_KEY = 'youtube_client_secret';

/**
 * Create OAuth2 client from stored credentials
 * @returns {OAuth2Client|null} OAuth2 client or null if credentials not set
 */
export const createOAuth2Client = () => {
  const clientId = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  const clientSecret = localStorage.getItem(CLIENT_SECRET_STORAGE_KEY);

  if (!clientId || !clientSecret) {
    return null;
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    window.location.origin + '/oauth2callback.html'
  );
};

/**
 * Get authorization URL for OAuth flow
 * @returns {string|null} Authorization URL or null if client not configured
 */
export const getAuthUrl = () => {
  const oauth2Client = createOAuth2Client();

  if (!oauth2Client) {
    return null;
  }

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    include_granted_scopes: true
  });
};

/**
 * Exchange authorization code for tokens
 * @param {string} code - Authorization code from OAuth redirect
 * @returns {Promise<Object>} Token response
 */
export const exchangeCodeForTokens = async (code) => {
  const oauth2Client = createOAuth2Client();

  if (!oauth2Client) {
    throw new Error('OAuth client not configured');
  }

  const { tokens } = await oauth2Client.getToken(code);
  storeTokens(tokens);
  return tokens;
};

/**
 * Store OAuth tokens in localStorage
 * @param {Object} tokens - OAuth tokens
 */
export const storeTokens = (tokens) => {
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
};

/**
 * Get stored OAuth tokens
 * @returns {Object|null} Stored tokens or null if not found
 */
export const getStoredTokens = () => {
  const tokenString = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!tokenString) {
    return null;
  }

  try {
    return JSON.parse(tokenString);
  } catch (error) {
    console.error('Error parsing stored tokens:', error);
    return null;
  }
};

/**
 * Check if tokens are stored and valid
 * @returns {boolean} True if tokens exist and are not expired
 */
export const hasValidTokens = () => {
  const tokens = getStoredTokens();
  if (!tokens) {
    return false;
  }

  // Check if tokens are expired
  if (tokens.expiry_date) {
    const expiryDate = new Date(tokens.expiry_date);
    const now = new Date();
    // Add a 5-minute buffer to be safe
    return expiryDate > new Date(now.getTime() + 5 * 60 * 1000);
  }

  return false;
};

/**
 * Get authorized OAuth2 client with valid tokens
 * @returns {Promise<OAuth2Client|null>} Authorized OAuth2 client or null
 */
export const getAuthorizedClient = async () => {
  const oauth2Client = createOAuth2Client();

  if (!oauth2Client) {
    return null;
  }

  const tokens = getStoredTokens();
  if (!tokens) {
    return null;
  }

  oauth2Client.setCredentials(tokens);

  // Refresh token if needed
  if (tokens.expiry_date && new Date(tokens.expiry_date) <= new Date()) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      storeTokens(credentials);
    } catch (error) {
      console.error('Error refreshing access token:', error);
      return null;
    }
  }

  return oauth2Client;
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
};
