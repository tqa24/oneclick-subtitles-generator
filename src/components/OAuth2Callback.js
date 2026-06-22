import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exchangeCodeForTokens } from '../services/googleAuthService';
import '../styles/oauth-callback.css';

const OAuth2Callback = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState(t('settings.youtubeOAuth.processing', 'Processing authentication...'));
  const [isFailed, setIsFailed] = useState(false);

  useEffect(() => {
    const processAuthCode = async () => {
      try {
        // Get the authorization code from URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (!code) {
          setStatus(t('settings.youtubeOAuth.noCode', 'Error: No authorization code received'));
          return;
        }

        // Exchange code for tokens
        await exchangeCodeForTokens(code);

        setStatus(t('settings.youtubeOAuth.success', 'Authentication successful! Redirecting...'));

        // Redirect back to the main page
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } catch (error) {
        console.error('OAuth callback error:', error);
        setStatus(t('settings.youtubeOAuth.failed', 'Authentication failed: {{message}}', { message: error.message }));
        setIsFailed(true);
      }
    };

    processAuthCode();
  }, [t]);

  return (
    <div className="oauth-callback-container">
      <div className="oauth-callback-content">
        <h2>{t('settings.youtubeOAuth.authTitle', 'YouTube Authentication')}</h2>
        <p>{status}</p>
        {isFailed && (
          <button
            onClick={() => window.location.href = '/'}
            className="primary-button"
          >
            {t('settings.youtubeOAuth.returnToApp', 'Return to Application')}
          </button>
        )}
      </div>
    </div>
  );
};

export default OAuth2Callback;
