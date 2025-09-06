/**
 * Utility functions for showing temporary toast notifications
 */

/**
 * Shows a temporary toast notification that auto-dismisses
 * @param {string} message - The message to display
 * @param {string} type - The type of toast ('info', 'error', 'success', 'warning')
 * @param {number} duration - Duration in milliseconds before auto-dismiss (default: 3000)
 * @param {string} className - Additional CSS class names
 */
export const showToast = (message, type = 'info', duration = 3000, className = '') => {
  console.log(`[Toast] Creating ${type} toast:`, message);
  
  // Create the toast element
  const toast = document.createElement('div');
  toast.className = `custom-toast ${type} ${className}`;
  
  // Add icon based on type
  const iconHTML = type === 'error' ? 
    '<svg class="toast-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>' :
    type === 'success' ?
    '<svg class="toast-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>' :
    type === 'warning' ?
    '<svg class="toast-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>' :
    '<svg class="toast-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  
  toast.innerHTML = `
    ${iconHTML}
    <span class="toast-message">${message}</span>
  `;
  
  // Add to body
  document.body.appendChild(toast);
  
  // Trigger reflow to enable CSS transition
  // eslint-disable-next-line no-unused-expressions
  toast.offsetHeight;
  
  // Add visible class for fade-in animation with slight delay
  setTimeout(() => {
    toast.classList.add('visible');
  }, 10);
  
  // Auto-dismiss after duration
  setTimeout(() => {
    toast.classList.remove('visible');
    // Remove from DOM after fade-out animation
    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
  
  return toast;
};

/**
 * Shows an info toast
 */
export const showInfoToast = (message, duration = 3000) => {
  return showToast(message, 'info', duration);
};

/**
 * Shows an error toast
 */
export const showErrorToast = (message, duration = 4000) => {
  return showToast(message, 'error', duration);
};

/**
 * Shows a success toast
 */
export const showSuccessToast = (message, duration = 3000) => {
  return showToast(message, 'success', duration);
};

/**
 * Shows a warning toast
 */
export const showWarningToast = (message, duration = 3500) => {
  return showToast(message, 'warning', duration);
};
