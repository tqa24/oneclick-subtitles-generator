import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Audio Controls component
 * @param {Object} props - Component props
 * @param {Function} props.handleFileUpload - Function to handle file upload
 * @param {React.RefObject} props.fileInputRef - Reference to file input
 * @param {boolean} props.isRecording - Whether recording is in progress
 * @param {Function} props.startRecording - Function to start recording
 * @param {Function} props.stopRecording - Function to stop recording
 * @param {string} props.segmentStartTime - Segment start time
 * @param {Function} props.setSegmentStartTime - Function to set segment start time
 * @param {string} props.segmentEndTime - Segment end time
 * @param {Function} props.setSegmentEndTime - Function to set segment end time
 * @param {Function} props.extractSegment - Function to extract segment
 * @param {boolean} props.isExtractingSegment - Whether segment extraction is in progress
 * @param {string} props.videoPath - Path to video
 * @param {boolean} props.isAvailable - Whether narration service is available
 * @returns {JSX.Element} - Rendered component
 */
const AudioControls = ({
  handleFileUpload,
  fileInputRef,
  isRecording,
  startRecording,
  stopRecording,
  segmentStartTime,
  setSegmentStartTime,
  segmentEndTime,
  setSegmentEndTime,
  extractSegment,
  isExtractingSegment,
  videoPath,
  isAvailable
}) => {
  const { t } = useTranslation();

  return (
    <div className="narration-row audio-controls-row">
      <div className="row-label">
        <label>{t('narration.audioControls', 'Audio Controls')}:</label>
      </div>
      <div className="row-content">
        <div className="audio-controls">
          {/* Upload Button */}
          <button
            className="pill-button primary"
            onClick={() => fileInputRef.current.click()}
            disabled={isRecording || !isAvailable}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {t('narration.upload', 'Upload')}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="audio/*"
            style={{ display: 'none' }}
          />

          {/* Record Button */}
          {!isRecording ? (
            <button
              className="pill-button primary"
              onClick={startRecording}
              disabled={!isAvailable}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="6" fill="currentColor" />
              </svg>
              {t('narration.record', 'Record')}
            </button>
          ) : (
            <button
              className="pill-button error"
              onClick={stopRecording}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="6" width="12" height="12" fill="currentColor" />
              </svg>
              {t('narration.stopRecording', 'Stop')}
            </button>
          )}

          {/* Extract Segment Controls */}
          <div className="time-inputs">
            <input
              type="text"
              className="time-input"
              value={segmentStartTime}
              onChange={(e) => setSegmentStartTime(e.target.value)}
              placeholder={t('narration.startTime', 'Start')}
              disabled={isExtractingSegment || !isAvailable}
            />
            <span>-</span>
            <input
              type="text"
              className="time-input"
              value={segmentEndTime}
              onChange={(e) => setSegmentEndTime(e.target.value)}
              placeholder={t('narration.endTime', 'End')}
              disabled={isExtractingSegment || !isAvailable}
            />
            <button
              className="pill-button secondary"
              onClick={extractSegment}
              disabled={isExtractingSegment || !videoPath || !isAvailable}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {isExtractingSegment
                ? t('narration.extracting', 'Extracting...')
                : t('narration.extract', 'Extract')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioControls;
