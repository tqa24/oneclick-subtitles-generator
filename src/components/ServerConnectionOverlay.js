import React, { useState, useEffect, useRef } from 'react';
import '../styles/ServerConnectionOverlay.css';
import { useTranslation } from 'react-i18next';

const ServerConnectionOverlay = ({ serverUrl = 'http://localhost:3004' }) => {
  const { t } = useTranslation();
  const [isServerConnected, setIsServerConnected] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const checkIntervalRef = useRef(null);
  const initialCheckDoneRef = useRef(false);
  const [hasCompletedInitialCheck, setHasCompletedInitialCheck] = useState(false);

  // Set up continuous checking
  useEffect(() => {
    // Initialize server connection checking
    let isMounted = true; // Flag to prevent state updates after unmount

    // Function to check server connection
    const checkServerConnection = async () => {
      if (!isMounted || isChecking) return; // Prevent checks if unmounted or already checking

      try {
        setIsChecking(true);
        // Try to connect to the server's health endpoint
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 3000);

        // Add timestamp to URL to prevent caching
        const timestamp = new Date().getTime();
        const url = `${serverUrl}/api/health?_=${timestamp}`;

        const response = await fetch(url, {
          method: 'GET',
          // Simplified headers to avoid CORS issues
          headers: {
            'Content-Type': 'application/json'
          },
          signal: controller.signal,
          mode: 'cors'
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            setIsServerConnected(true);
            setRetryCount(0);
          }
        } else {
          if (isMounted) {
            setIsServerConnected(false);
          }
        }
      } catch (error) {
        if (isMounted) {
          setIsServerConnected(false);
        }
      } finally {
        if (isMounted) {
          setIsChecking(false);
          initialCheckDoneRef.current = true;
          setHasCompletedInitialCheck(true);
        }
      }
    };

    // Initial check
    checkServerConnection();

    // Set up periodic checking regardless of connection status
    // This ensures we detect both disconnections and reconnections
    checkIntervalRef.current = setInterval(checkServerConnection, 3000); // Check every 3 seconds

    // Cleanup function
    return () => {
      isMounted = false;
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, []); // Empty dependency array to run only once on mount

  // Expose the check function for the retry button
  const handleRetryClick = async () => {
    if (isChecking) return; // Prevent multiple simultaneous checks

    setIsChecking(true);
    setRetryCount(prev => prev + 1);
    try {
      // Force a new connection check by simulating a fetch
      const timestamp = new Date().getTime();
      const url = `${serverUrl}/api/health?_=${timestamp}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 3000);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        mode: 'cors',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setIsServerConnected(true);
        setRetryCount(0);
      } else {
        setIsServerConnected(false);
      }
    } catch (error) {
      setIsServerConnected(false);
    } finally {
      setIsChecking(false);
      initialCheckDoneRef.current = true;
      setHasCompletedInitialCheck(true);
    }
  };

  // Don't show overlay if server is connected or if initial check hasn't completed
  if (isServerConnected || !hasCompletedInitialCheck) {
    return null;
  }

  return (
    <div className="server-connection-overlay">

      <div className="server-connection-modal">
        <div className="server-connection-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <h2>{t('serverConnection.title', 'Server Connection Error')}</h2>
        <p>{t('serverConnection.message', 'Cannot connect to the server. Please check if the server is running properly.')}</p>
        <div className="server-connection-help">
          <h3>{t('serverConnection.howToFix', 'How to fix this:')}</h3>
          <ol>
            <li>{t('serverConnection.step1', 'Make sure the server application is running')}</li>
            <li>
              {t('serverConnection.step2', 'Check if the server is running at')}:
              <code>{serverUrl}</code>
            </li>
            <li>{t('serverConnection.step3', 'Restart the server application if needed')}</li>
          </ol>
        </div>
        <div className="server-connection-actions">
          <button
            className="retry-button"
            onClick={handleRetryClick}
            disabled={isChecking}
          >
            {isChecking ? (
              <>
                <span className="loading-spinner"></span>
                {t('serverConnection.checking', 'Checking...')}
              </>
            ) : (
              t('serverConnection.retry', 'Retry Connection')
            )}
          </button>
          <div className="retry-count">
            {retryCount > 0 && t('serverConnection.retryCount', 'Retry attempts: {{count}}', { count: retryCount })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerConnectionOverlay;
