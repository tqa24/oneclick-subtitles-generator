import React, { useState, useEffect } from 'react';
import '../styles/TranslationWarningToast.css';

const TranslationWarningToast = () => {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleWarning = (event) => {
      setMessage(event.detail.message);
      setVisible(true);

      // Hide the toast after 5 seconds
      setTimeout(() => {
        setVisible(false);
      }, 5000);
    };

    window.addEventListener('translation-warning', handleWarning);

    return () => {
      window.removeEventListener('translation-warning', handleWarning);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="translation-warning-toast">
      <div className="toast-icon">⚠️</div>
      <div className="toast-message">{message}</div>
      <button className="toast-close" onClick={() => setVisible(false)}>
        <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="currentColor">
          <path d="M480-392 300-212q-18 18-44 18t-44-18q-18-18-18-44t18-44l180-180-180-180q-18-18-18-44t18-44q18-18 44-18t44 18l180 180 180-180q18-18 44-18t44 18q18 18 18 44t-18 44L568-480l180 180q18 18 18 44t-18 44q-18 18-44 18t-44-18L480-392Z"/>
        </svg>
      </button>
    </div>
  );
};

export default TranslationWarningToast;
