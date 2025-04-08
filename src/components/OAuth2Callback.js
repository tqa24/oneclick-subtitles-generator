import React, { useEffect, useState } from 'react';
import { exchangeCodeForTokens } from '../services/googleAuthService';
import '../styles/oauth-callback.css';

const OAuth2Callback = () => {
  const [status, setStatus] = useState('Processing authentication...');

  useEffect(() => {
    const processAuthCode = async () => {
      try {
        // Get the authorization code from URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (!code) {
          setStatus('Error: No authorization code received');
          return;
        }

        // Exchange code for tokens
        await exchangeCodeForTokens(code);

        setStatus('Authentication successful! Redirecting...');

        // Redirect back to the main page
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } catch (error) {
        console.error('OAuth callback error:', error);
        setStatus(`Authentication failed: ${error.message}`);
      }
    };

    processAuthCode();
  }, []);

  return (
    <div className="oauth-callback-container">
      <div className="oauth-callback-content">
        <h2>YouTube Authentication</h2>
        <p>{status}</p>
        {status.includes('failed') && (
          <button
            onClick={() => window.location.href = '/'}
            className="primary-button"
          >
            Return to Application
          </button>
        )}
      </div>
    </div>
  );
};

export default OAuth2Callback;
