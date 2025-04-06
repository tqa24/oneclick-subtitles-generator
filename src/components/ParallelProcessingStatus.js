import React from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/ParallelProcessingStatus.css';
import { FiRefreshCw } from 'react-icons/fi';

/**
 * Component to display the status of parallel segment processing
 * @param {Object} props - Component props
 * @param {Array} props.segments - Array of segment status objects
 * @param {string} props.overallStatus - Overall processing status message
 * @param {string} props.statusType - Status type (loading, success, error, warning)
 * @param {Function} props.onRetrySegment - Function to retry processing a specific segment
 * @param {Function} props.onGenerateSegment - Function to generate a specific segment (for strong model)
 * @param {Array} props.retryingSegments - Array of segment indices that are currently being retried
 * @returns {JSX.Element} - Rendered component
 */
const ParallelProcessingStatus = ({ segments, overallStatus, statusType, onRetrySegment, onGenerateSegment, retryingSegments = [] }) => {
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
              {/* Show generate button for pending segments */}
              {segment.status === 'pending' && !retryingSegments.includes(index) && onGenerateSegment && (
                <button
                  className="segment-generate-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('Generate button clicked for segment', index);
                    onGenerateSegment(index);
                  }}
                  title={t('output.generateSegmentTooltip', 'Process this segment')}
                >
                  {t('output.generateSegment', 'Generate')}
                </button>
              )}

              {/* Show refresh button for completed segments that aren't currently being retried */}
              {segment.status === 'success' && !retryingSegments.includes(index) && (
                /* Debug info to help troubleshoot */
                console.log('Segment', index, 'status:', segment.status, 'shortMessage:', segment.shortMessage, 'retrying:', retryingSegments.includes(index)) ||
                <button
                  className="segment-retry-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('Retry button clicked for segment', index);
                    onRetrySegment && onRetrySegment(index);
                  }}
                  title={t('output.retrySegment', 'Retry this segment')}
                >
                  <FiRefreshCw size={14} />
                </button>
              )}

              {/* Show retry button for error segments */}
              {segment.status === 'error' && !retryingSegments.includes(index) && onRetrySegment && (
                <button
                  className="segment-retry-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('Retry button clicked for segment', index);
                    onRetrySegment(index);
                  }}
                  title={t('output.retrySegment', 'Retry this segment')}
                >
                  <FiRefreshCw size={14} />
                </button>
              )}

              {/* Show spinning refresh icon for segments that are currently being retried */}
              {(segment.status === 'retrying' || retryingSegments.includes(index)) && (
                <span className="segment-retrying-indicator" title={t('output.retryingSegment', 'Retrying this segment...')}>
                  <FiRefreshCw size={14} className="spinning" />
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ParallelProcessingStatus;
