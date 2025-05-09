import React from 'react';

/**
 * Status Message component
 * @param {Object} props - Component props
 * @param {string} props.message - Message to display
 * @param {string} props.type - Message type (info, warning, error, success)
 * @param {React.RefObject} props.statusRef - Reference to status element
 * @param {boolean} props.showProgress - Whether to show a progress indicator
 * @param {boolean} props.isGenerating - Whether generation is in progress
 * @returns {JSX.Element|null} - Rendered component
 */
const StatusMessage = ({
  message,
  type = 'info',
  statusRef = null,
  showProgress = false,
  isGenerating = false
}) => {
  // Only render if there's a message or we're generating (but not for empty error messages)
  if ((!message && !isGenerating) || (type === 'error' && !message)) return null;

  return (
    <div
      className={`status-message ${type} ${showProgress ? 'with-progress' : ''} ${isGenerating ? 'generating' : ''}`}
      ref={statusRef}
    >
      {showProgress && (
        <div className="status-progress-indicator">
          <div className="status-progress-bar"></div>
        </div>
      )}
      <div className="status-message-text">
        {message || ''}
      </div>
    </div>
  );
};

export default StatusMessage;
