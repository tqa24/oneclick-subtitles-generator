import React from 'react';

/**
 * Status Message component
 * @param {Object} props - Component props
 * @param {string} props.message - Message to display
 * @param {string} props.type - Message type (info, warning, error, success)
 * @param {React.RefObject} props.statusRef - Reference to status element
 * @returns {JSX.Element|null} - Rendered component or null if no message
 */
const StatusMessage = ({ message, type = 'info', statusRef = null }) => {
  if (!message) return null;

  return (
    <div className={`status-message ${type}`} ref={statusRef}>
      {message}
    </div>
  );
};

export default StatusMessage;
