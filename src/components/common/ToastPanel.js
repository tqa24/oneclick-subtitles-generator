import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './ToastPanel.css';

const ToastPanel = () => {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  // This effect sets up the global function and event listeners
  useEffect(() => {
    // Global function to add a toast
    window.addToast = (message, type = 'info', duration = 6000, key) => {
      setToasts(prev => {
        const existingIndex = key ? prev.findIndex(t => t.key === key) : -1;

        if (existingIndex >= 0) {
          // Update existing toast and reset its timer
          const updatedToasts = [...prev];
          const existingToast = updatedToasts[existingIndex];
          
          if (existingToast.timerId) {
            clearTimeout(existingToast.timerId);
          }

          updatedToasts[existingIndex] = {
            ...existingToast,
            message,
            type,
            duration,
            timerId: setTimeout(() => removeToast(existingToast.id), duration),
          };
          return updatedToasts;
        } else {
          // Create a new toast
          const id = ++toastIdRef.current;
          const newToast = {
            id,
            message,
            type,
            duration,
            key,
            timerId: setTimeout(() => removeToast(id), duration),
          };
          // Prepend new toast to show it at the bottom with flex-direction: column-reverse
          return [newToast, ...prev];
        }
      });
    };

    const handleAlignedNarrationStatus = (event) => {
      const { status, message } = event.detail;
      if (status === 'error' && message) {
        window.addToast(message, 'error', 8000);
      }
    };

    const handleTranslationWarning = (event) => {
      const { message } = event.detail;
      if (message) {
        window.addToast(message, 'warning', 5000);
      }
    };

    window.addEventListener('aligned-narration-status', handleAlignedNarrationStatus);
    window.addEventListener('translation-warning', handleTranslationWarning);

    // Cleanup function
    return () => {
      // Clear all timers when the component unmounts
      setToasts(prev => {
        prev.forEach(toast => toast.timerId && clearTimeout(toast.timerId));
        return [];
      });
      delete window.addToast;
      window.removeEventListener('aligned-narration-status', handleAlignedNarrationStatus);
      window.removeEventListener('translation-warning', handleTranslationWarning);
    };
  }, []); // Empty dependency array ensures this runs only once

  const removeToast = (id) => {
    setToasts(prev => prev.map(t =>
      t.id === id ? { ...t, dismissing: true } : t
    ));
    
    // Remove from state after the animation completes
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 500); // This duration should match the hide-toast animation
  };

  return (
    <div className="toast-panel">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-item toast-${toast.type} ${toast.dismissing ? 'dismissing' : 'show'}`}
        >
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