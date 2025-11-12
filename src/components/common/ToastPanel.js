import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './ToastPanel.css'; // We'll create this

const ToastPanel = () => {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const recentMessagesRef = useRef(new Map()); // Track recent messages to prevent duplicates

  useEffect(() => {
    // Global function to add toast
    window.addToast = (message, type = 'info', duration = 6000, key) => {
      setToasts(prev => {
        const existingIndex = key ? prev.findIndex(t => t.key === key) : -1;

        if (existingIndex >= 0) {
          // Update existing toast
          const updatedToasts = [...prev];
          updatedToasts[existingIndex] = {
            ...updatedToasts[existingIndex],
            message,
            type,
            duration
          };
          // Reset auto dismiss timer
          if (updatedToasts[existingIndex].timerId) {
            clearTimeout(updatedToasts[existingIndex].timerId);
          }
          updatedToasts[existingIndex].timerId = setTimeout(() => {
            removeToast(updatedToasts[existingIndex].id);
          }, duration);
          return updatedToasts;
        } else {
          // Create new toast
          const id = ++toastIdRef.current;
          const toast = { id, message, type, duration, key };
          toast.timerId = setTimeout(() => {
            removeToast(id);
          }, duration);
          return [...prev, toast];
        }
      });
    };

    // Listen for aligned-narration-status events
    const handleAlignedNarrationStatus = (event) => {
      const { status, message } = event.detail;
      if (status === 'error' && message) {
        window.addToast(message, 'error', 8000);
      }
    };

    // Listen for translation-warning events
    const handleTranslationWarning = (event) => {
      const { message } = event.detail;
      if (message) {
        window.addToast(message, 'warning', 5000);
      }
    };

    window.addEventListener('aligned-narration-status', handleAlignedNarrationStatus);
    window.addEventListener('translation-warning', handleTranslationWarning);

    return () => {
      delete window.addToast;
      window.removeEventListener('aligned-narration-status', handleAlignedNarrationStatus);
      window.removeEventListener('translation-warning', handleTranslationWarning);
    };
  }, []);

  const removeToast = (id) => {
    // Add dismiss class for animation
    setToasts(prev => prev.map(t =>
      t.id === id ? { ...t, dismissing: true } : t
    ));
    // Remove after animation completes (matches CSS transition duration)
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 500);
  };


  return (
    <div className="toast-panel">
      {toasts.map((toast, index) => (
        <div key={toast.id} className={`toast-item toast-${toast.type} show ${toast.dismissing ? 'dismissing' : ''}`} style={{ '--y-offset': `-${(toasts.length - 1 - index) * 90}px` }}>
          <div className={`toast toast-${toast.type}`}>
            <span className="material-symbols-rounded close-icon" onClick={() => removeToast(toast.id)}>close</span>
            <h3>{t(`common.toast.${toast.type}`)}</h3>
            <p>{toast.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ToastPanel;