import React from 'react';
import { useTranslation } from 'react-i18next';
import { getAuthUrl, hasValidTokens, clearOAuthData } from '../../../services/youtubeApiService';

const ApiKeysTab = ({
  geminiApiKey,
  setGeminiApiKey,
  youtubeApiKey,
  setYoutubeApiKey,
  showGeminiKey,
  setShowGeminiKey,
  showYoutubeKey,
  setShowYoutubeKey,
  useOAuth,
  setUseOAuth,
  youtubeClientId,
  setYoutubeClientId,
  youtubeClientSecret,
  setYoutubeClientSecret,
  showClientId,
  setShowClientId,
  showClientSecret,
  setShowClientSecret,
  isAuthenticated,
  setIsAuthenticated,
  apiKeysSet,
  setApiKeysSet
}) => {
  const { t } = useTranslation();

  // Handle YouTube OAuth authentication
  const handleOAuthAuthentication = () => {
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
  const handleClearOAuth = () => {
    if (window.confirm('Are you sure you want to clear your YouTube OAuth credentials? You will need to authenticate again to use YouTube search.')) {
      clearOAuthData();
      setIsAuthenticated(false);
    }
  };

  // Function to store client credentials (imported from youtubeApiService)
  const storeClientCredentials = (clientId, clientSecret) => {
    localStorage.setItem('youtube_client_id', clientId);
    localStorage.setItem('youtube_client_secret', clientSecret);
  };

  return (
    <div className="settings-section api-key-section">
      <h3>{t('settings.apiKeys', 'API Keys')}</h3>

      <div className="api-key-input">
        <label htmlFor="gemini-api-key">
          {t('settings.geminiApiKey', 'Gemini API Key')}
          <span className={`api-key-status ${apiKeysSet.gemini ? 'set' : 'not-set'}`}>
            {apiKeysSet.gemini
              ? t('settings.keySet', 'Set')
              : t('settings.keyNotSet', 'Not Set')}
          </span>
        </label>

        <div className="input-with-toggle">
          <input
            type={showGeminiKey ? "text" : "password"}
            id="gemini-api-key"
            value={geminiApiKey}
            onChange={(e) => setGeminiApiKey(e.target.value)}
            placeholder={t('settings.geminiApiKeyPlaceholder', 'Enter your Gemini API key')}
          />
          <button
            type="button"
            className="toggle-visibility"
            onClick={() => setShowGeminiKey(!showGeminiKey)}
            aria-label={showGeminiKey ? t('settings.hide') : t('settings.show')}
          >
            {showGeminiKey ? t('settings.hide') : t('settings.show')}
          </button>
        </div>

        <p className="api-key-help">
          {t('settings.geminiApiKeyHelp', 'Required for all functions. Get one at')}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google AI Studio
          </a>
        </p>
        <div className="api-key-instructions">
          <h4>{t('settings.getApiKey', 'Get Gemini API Key')}</h4>
          <ol>
            <li>{t('settings.geminiStep1', 'Login to Google AI Studio')}</li>
            <li>{t('settings.geminiStep2', 'Click \'Get API Key\'')}</li>
            <li>{t('settings.geminiStep3', 'Create a new key or select existing')}</li>
            <li>{t('settings.geminiStep4', 'Copy your API key')}</li>
            <li>{t('settings.geminiStep5', 'Paste it into the field above')}</li>
          </ol>
        </div>
      </div>

      <div className="api-key-input">
        <div className="auth-method-toggle">
          <label className="auth-method-label">{t('settings.youtubeAuthMethod', 'YouTube Authentication Method')}</label>
          <div className="auth-toggle-buttons">
            <button
              className={`auth-toggle-btn ${!useOAuth ? 'active' : ''}`}
              onClick={() => {
                setUseOAuth(false);
                localStorage.setItem('use_youtube_oauth', 'false');
                console.log('Set OAuth to false');
                // Update apiKeysSet to reflect the API key method
                setApiKeysSet(prevState => ({
                  ...prevState,
                  youtube: !!youtubeApiKey
                }));
              }}
            >
              {t('settings.apiKeyMethod', 'API Key')}
            </button>
            <button
              className={`auth-toggle-btn ${useOAuth ? 'active' : ''}`}
              onClick={() => {
                setUseOAuth(true);
                localStorage.setItem('use_youtube_oauth', 'true');
                console.log('Set OAuth to true');
                // Update apiKeysSet to reflect the OAuth method
                setApiKeysSet(prevState => ({
                  ...prevState,
                  youtube: isAuthenticated
                }));
              }}
            >
              {t('settings.oauthMethod', 'OAuth 2.0')}
            </button>
          </div>
        </div>

        {!useOAuth ? (
          <>
            <label htmlFor="youtube-api-key">
              {t('settings.youtubeApiKey', 'YouTube API Key')}
              <span className={`api-key-status ${apiKeysSet.youtube ? 'set' : 'not-set'}`}>
                {apiKeysSet.youtube
                  ? t('settings.keySet', 'Set')
                  : t('settings.keyNotSet', 'Not Set')}
              </span>
            </label>
            <div className="input-with-toggle">
              <input
                type={showYoutubeKey ? "text" : "password"}
                id="youtube-api-key"
                value={youtubeApiKey}
                onChange={(e) => setYoutubeApiKey(e.target.value)}
                placeholder={t('settings.youtubeApiKeyPlaceholder', 'Enter your YouTube API key')}
              />
              <button
                type="button"
                className="toggle-visibility"
                onClick={() => setShowYoutubeKey(!showYoutubeKey)}
                aria-label={showYoutubeKey ? t('settings.hide') : t('settings.show')}
              >
                {showYoutubeKey ? t('settings.hide') : t('settings.show')}
              </button>
            </div>
            <p className="api-key-help">
              {t('settings.youtubeApiKeyHelp', 'Required for YouTube search. Get one at')}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Cloud Console
              </a>
            </p>
            <div className="api-key-instructions">
              <h4>{t('settings.getYoutubeApiKey', 'Get YouTube API Key')}</h4>
              <ol>
                <li>{t('settings.youtubeStep1', 'Go to Google Cloud Console')}</li>
                <li>{t('settings.youtubeStep2', 'Create or select a project')}</li>
                <li className="important-step">{t('settings.youtubeStep3', 'Enable \'YouTube Data API v3\'')}
                  <a
                    href="https://console.developers.google.com/apis/api/youtube.googleapis.com/overview"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="enable-api-link"
                  >
                    {t('settings.enableApiDirectly', 'Enable API directly')}
                  </a>
                </li>
                <li>{t('settings.youtubeStep4', 'Go to credentials')}</li>
                <li>{t('settings.youtubeStep5', 'Generate API key')}</li>
              </ol>
              <div className="api-warning">
                <strong>{t('settings.important', 'Important:')}</strong> {t('settings.apiEnableWarning', 'You must enable the YouTube Data API v3 in your Google Cloud project before using your API key. If you get an error about "API not enabled", click the link above to enable it.')}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="oauth-status-container">
              <label>{t('settings.youtubeOAuth', 'YouTube OAuth 2.0')}</label>
              <span className={`api-key-status ${isAuthenticated ? 'set' : 'not-set'}`}>
                {isAuthenticated
                  ? t('settings.authenticated', 'Authenticated')
                  : t('settings.notAuthenticated', 'Not Authenticated')}
              </span>
            </div>

            <div className="oauth-client-inputs">
              <div className="oauth-input-group">
                <label htmlFor="youtube-client-id">{t('settings.clientId', 'Client ID')}</label>
                <div className="input-with-toggle">
                  <input
                    type={showClientId ? "text" : "password"}
                    id="youtube-client-id"
                    value={youtubeClientId}
                    onChange={(e) => setYoutubeClientId(e.target.value)}
                    placeholder={t('settings.clientIdPlaceholder', 'Enter your OAuth Client ID')}
                  />
                  <button
                    type="button"
                    className="toggle-visibility"
                    onClick={() => setShowClientId(!showClientId)}
                    aria-label={showClientId ? t('settings.hide') : t('settings.show')}
                  >
                    {showClientId ? t('settings.hide') : t('settings.show')}
                  </button>
                </div>
              </div>

              <div className="oauth-input-group">
                <label htmlFor="youtube-client-secret">{t('settings.clientSecret', 'Client Secret')}</label>
                <div className="input-with-toggle">
                  <input
                    type={showClientSecret ? "text" : "password"}
                    id="youtube-client-secret"
                    value={youtubeClientSecret}
                    onChange={(e) => setYoutubeClientSecret(e.target.value)}
                    placeholder={t('settings.clientSecretPlaceholder', 'Enter your OAuth Client Secret')}
                  />
                  <button
                    type="button"
                    className="toggle-visibility"
                    onClick={() => setShowClientSecret(!showClientSecret)}
                    aria-label={showClientSecret ? t('settings.hide') : t('settings.show')}
                  >
                    {showClientSecret ? t('settings.hide') : t('settings.show')}
                  </button>
                </div>
              </div>
            </div>

            <div className="oauth-actions">
              <button
                className="oauth-authenticate-btn"
                onClick={handleOAuthAuthentication}
                disabled={!youtubeClientId || !youtubeClientSecret}
              >
                {t('settings.authenticateWithYouTube', 'Authenticate with YouTube')}
              </button>
              {isAuthenticated && (
                <button
                  className="oauth-clear-btn"
                  onClick={handleClearOAuth}
                >
                  {t('settings.clearAuth', 'Clear Authentication')}
                </button>
              )}
            </div>

            <p className="api-key-help">
              {t('settings.oauthDescription', 'OAuth 2.0 provides more reliable access to YouTube API. Get credentials at')}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Cloud Console
              </a>
            </p>
            <div className="api-key-instructions">
              <h4>{t('settings.getOAuthCredentials', 'Get OAuth Credentials')}</h4>
              <ol>
                <li>{t('settings.createProject', 'Create a project in Google Cloud Console')}</li>
                <li>{t('settings.enableYouTubeAPI', 'Enable the YouTube Data API v3')}</li>
                <li>{t('settings.createOAuthClientId', 'Create OAuth 2.0 Client ID (Web application)')}</li>
                <li>{t('settings.addAuthorizedOrigins', 'Add Authorized JavaScript origins:')}<br/>
                  <code>{window.location.origin}</code>
                </li>
                <li>{t('settings.addAuthorizedRedirect', 'Add Authorized redirect URI:')}<br/>
                  <code>{window.location.origin + '/oauth2callback.html'}</code>
                </li>
                <li>{t('settings.copyClientCredentials', 'Copy your Client ID and Client Secret')}</li>
                <li>{t('settings.pasteAndAuthenticate', 'Paste them into the fields above and click Authenticate')}</li>
              </ol>

              <h4>{t('settings.troubleshootingOAuth', 'Troubleshooting OAuth Issues')}</h4>

              <h5>{t('settings.errorRedirectMismatch', 'Error: redirect_uri_mismatch')}</h5>
              <p>{t('settings.redirectMismatchDescription', 'This error occurs when the redirect URI in your application doesn\'t match what\'s registered in Google Cloud Console:')}</p>
              <ol>
                <li>{t('settings.goToCredentials', 'Go to Google Cloud Console > APIs & Services > Credentials')}</li>
                <li>{t('settings.findOAuthClient', 'Find your OAuth 2.0 Client ID and click to edit')}</li>
                <li>{t('settings.inAuthorizedOrigins', 'In "Authorized JavaScript origins", add exactly:')}<br/>
                  <code>{window.location.origin}</code>
                </li>
                <li>{t('settings.inAuthorizedRedirect', 'In "Authorized redirect URIs", add exactly:')}<br/>
                  <code>{window.location.origin + '/oauth2callback.html'}</code>
                </li>
                <li>{t('settings.clickSave', 'Click Save')}</li>
              </ol>

              <h5>{t('settings.errorAccessDenied', 'Error: access_denied')}</h5>
              <p>{t('settings.accessDeniedDescription', 'This error can occur for several reasons:')}</p>
              <ul>
                <li>{t('settings.deniedPermission', 'You denied permission during the OAuth flow')}</li>
                <li>{t('settings.apiNotEnabled', 'The YouTube Data API is not enabled for your project')}</li>
                <li>{t('settings.apiRestrictions', 'There are API restrictions on your OAuth client')}</li>
              </ul>
              <p>{t('settings.toFix', 'To fix:')}</p>
              <ol>
                <li>{t('settings.goToLibrary', 'Go to Google Cloud Console > APIs & Services > Library')}</li>
                <li>{t('settings.searchYouTubeAPI', 'Search for "YouTube Data API v3" and make sure it\'s enabled')}</li>
                <li>{t('settings.checkRestrictions', 'Check your OAuth client for any API restrictions')}</li>
              </ol>

              <h5>{t('settings.errorAppNotVerified', 'Error: App not verified')}</h5>
              <p>{t('settings.appNotVerifiedDescription', 'New OAuth applications start in "Testing" mode and can only be used by test users:')}</p>
              <ol>
                <li>{t('settings.goToConsentScreen', 'Go to Google Cloud Console > APIs & Services > OAuth consent screen')}</li>
                <li>{t('settings.scrollToTestUsers', 'Scroll down to "Test users" section')}</li>
                <li>{t('settings.clickAddUsers', 'Click "Add users"')}</li>
                <li>{t('settings.addYourEmail', 'Add your Google email address as a test user')}</li>
                <li>{t('settings.saveChanges', 'Save changes and try again')}</li>
              </ol>
              <p className="note">{t('settings.verificationNote', 'Note: You don\'t need to wait for verification if you add yourself as a test user. Verification is only required if you want to make your app available to all users.')}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ApiKeysTab;
