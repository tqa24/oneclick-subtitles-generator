import React from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/ParallelProcessingStatus.css';

/**
 * Component to display the status of parallel segment processing
 * @param {Object} props - Component props
 * @param {Array} props.segments - Array of segment status objects
 * @param {string} props.overallStatus - Overall processing status message
 * @param {string} props.statusType - Status type (loading, success, error, warning)
 * @returns {JSX.Element} - Rendered component
 */
const ParallelProcessingStatus = ({ segments, overallStatus, statusType }) => {
  const { t } = useTranslation();
  
  if (!segments || segments.length === 0) {
    return (
      <div className={`status ${statusType}`}>
        {overallStatus}
      </div>
    );
  }
  
  return (
    <div className="parallel-processing-container">
      <div className={`status ${statusType}`}>
        {overallStatus}
      </div>
      
      <div className="segments-status">
        <h4>{t('output.segmentsStatus', 'Segments Status')}</h4>
        <div className="segments-grid">
          {segments.map((segment, index) => (
            <div 
              key={index} 
              className={`segment-status ${segment.status}`}
              title={segment.message}
            >
              <span className="segment-number">{index + 1}</span>
              <span className="segment-indicator"></span>
              <span className="segment-message">{segment.shortMessage || segment.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ParallelProcessingStatus;
