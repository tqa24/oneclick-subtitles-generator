/**
 * Hallucination Recovery Status Component
 * Shows when the system is retrying after detecting hallucination
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const HallucinationRecoveryStatus = () => {
  const { t } = useTranslation();
  const [recoveryInfo, setRecoveryInfo] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleRecovery = (event) => {
      const { originalSegment, retrySegment, attempt, validSubtitlesCount } = event.detail;
      
      setRecoveryInfo({
        originalSegment,
        retrySegment,
        attempt,
        validSubtitlesCount,
        timestamp: Date.now()
      });
      setIsVisible(true);
    };

    const handleStreamingComplete = () => {
      // Hide recovery status after streaming completes
      setTimeout(() => {
        setIsVisible(false);
      }, 3000);
    };

    window.addEventListener('hallucination-recovery', handleRecovery);
    window.addEventListener('streaming-complete', handleStreamingComplete);

    return () => {
      window.removeEventListener('hallucination-recovery', handleRecovery);
      window.removeEventListener('streaming-complete', handleStreamingComplete);
    };
  }, []);

  if (!isVisible || !recoveryInfo) {
    return null;
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="hallucination-recovery-status">
      <div className="recovery-header">
        <div className="recovery-icon">⚠️</div>
        <div className="recovery-title">
          {t('recovery.title', 'Hallucination Recovery')}
        </div>
      </div>
      
      <div className="recovery-details">
        <div className="recovery-info">
          <div className="info-row">
            <span className="info-label">
              {t('recovery.attempt', 'Attempt')}:
            </span>
            <span className="info-value">{recoveryInfo.attempt}/3</span>
          </div>
          
          <div className="info-row">
            <span className="info-label">
              {t('recovery.validSubtitles', 'Valid subtitles saved')}:
            </span>
            <span className="info-value">{recoveryInfo.validSubtitlesCount}</span>
          </div>
          
          <div className="info-row">
            <span className="info-label">
              {t('recovery.retryRange', 'Retrying range')}:
            </span>
            <span className="info-value">
              {formatTime(recoveryInfo.retrySegment.start)} - {formatTime(recoveryInfo.retrySegment.end)}
            </span>
          </div>
        </div>
        
        <div className="recovery-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ 
                width: `${(recoveryInfo.retrySegment.start - recoveryInfo.originalSegment.start) / 
                         (recoveryInfo.originalSegment.end - recoveryInfo.originalSegment.start) * 100}%` 
              }}
            />
            <div 
              className="progress-retry"
              style={{ 
                left: `${(recoveryInfo.retrySegment.start - recoveryInfo.originalSegment.start) / 
                        (recoveryInfo.originalSegment.end - recoveryInfo.originalSegment.start) * 100}%`,
                width: `${(recoveryInfo.retrySegment.end - recoveryInfo.retrySegment.start) / 
                         (recoveryInfo.originalSegment.end - recoveryInfo.originalSegment.start) * 100}%` 
              }}
            />
          </div>
          <div className="progress-labels">
            <span>{formatTime(recoveryInfo.originalSegment.start)}</span>
            <span className="retry-label">
              Retrying: {formatTime(recoveryInfo.retrySegment.start)}
            </span>
            <span>{formatTime(recoveryInfo.originalSegment.end)}</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .hallucination-recovery-status {
          background: #fff3cd;
          border: 1px solid #ffc107;
          border-radius: 8px;
          padding: 12px;
          margin: 12px 0;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .recovery-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .recovery-icon {
          font-size: 20px;
        }

        .recovery-title {
          font-weight: 600;
          color: #856404;
          font-size: 14px;
        }

        .recovery-details {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .recovery-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }

        .info-label {
          color: #666;
        }

        .info-value {
          font-weight: 600;
          color: #856404;
        }

        .recovery-progress {
          margin-top: 8px;
        }

        .progress-bar {
          position: relative;
          height: 24px;
          background: #f0f0f0;
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          background: #28a745;
          transition: width 0.3s ease;
        }

        .progress-retry {
          position: absolute;
          top: 0;
          height: 100%;
          background: repeating-linear-gradient(
            45deg,
            #ffc107,
            #ffc107 10px,
            #ffb800 10px,
            #ffb800 20px
          );
          animation: move 1s linear infinite;
        }

        @keyframes move {
          0% {
            background-position: 0 0;
          }
          100% {
            background-position: 28px 0;
          }
        }

        .progress-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 4px;
          font-size: 11px;
          color: #666;
        }

        .retry-label {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          font-weight: 600;
          color: #856404;
        }

        /* Dark theme support */
        @media (prefers-color-scheme: dark) {
          .hallucination-recovery-status {
            background: rgba(255, 193, 7, 0.1);
            border-color: #ffc107;
          }

          .recovery-title {
            color: #ffc107;
          }

          .info-label {
            color: #adb5bd;
          }

          .info-value {
            color: #ffc107;
          }

          .progress-bar {
            background: #2c2c2c;
          }

          .progress-labels {
            color: #adb5bd;
          }

          .retry-label {
            color: #ffc107;
          }
        }
      `}</style>
    </div>
  );
};

export default HallucinationRecoveryStatus;
