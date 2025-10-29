import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SERVER_URL } from '../../../config';
import ExampleAudioDropdown from './ExampleAudioDropdown';
import HelpIcon from '../../common/HelpIcon';
import LoadingIndicator from '../../common/LoadingIndicator';
import PlayPauseMorphType4 from '../../common/PlayPauseMorphType4';
import WavyProgressIndicator from '../../common/WavyProgressIndicator';
import { formatTime } from '../../../utils/timeFormatter';

/**
 * Audio Controls component
 * @param {Object} props - Component props
 * @param {Function} props.handleFileUpload - Function to handle file upload
 * @param {React.RefObject} props.fileInputRef - Reference to file input
 * @param {boolean} props.isRecording - Whether recording is in progress
 * @param {boolean} props.isStartingRecording - Whether recording is initializing
 * @param {number|null} props.recordingStartTime - Timestamp when recording started (ms since epoch)
 * @param {Function} props.startRecording - Function to start recording
 * @param {Function} props.stopRecording - Function to stop recording
 * @param {boolean} props.isAvailable - Whether narration service is available
 * @param {Object} props.referenceAudio - Reference audio object
 * @param {Function} props.clearReferenceAudio - Function to clear reference audio
 * @param {Function} props.onExampleSelect - Function to handle example audio selection
 * @param {string} props.narrationMethod - Current narration method (f5tts, chatterbox, etc.)
 * @param {string} [props.color="var(--md-primary)"] - Color for the progress indicator
 * @param {number} [props.height=24] - Height for the progress indicator
 * @returns {JSX.Element} - Rendered component
 */

const AudioControls = ({
  handleFileUpload,
  fileInputRef,
  isRecording,
  isStartingRecording,
  recordingStartTime,
  startRecording,
  stopRecording,
  isAvailable,
  referenceAudio,
  clearReferenceAudio,
  onExampleSelect,
  narrationMethod,
  color = "var(--md-primary)",
  height = 18
}) => {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const audioRef = useRef(null);
  const wavyProgressRef = useRef(null);
  const thumbRef = useRef(null);

  // Resolve CSS variables to actual colors for canvas
  const [resolvedColor, setResolvedColor] = useState(color);
  const [resolvedTrackColor, setResolvedTrackColor] = useState("var(--md-outline-variant)");

  useEffect(() => {
    const resolveColor = (cssValue) => {
      if (typeof window === 'undefined') return cssValue;
      try {
        const dummy = document.createElement('div');
        dummy.style.color = cssValue;
        dummy.style.position = 'absolute';
        dummy.style.visibility = 'hidden';
        document.body.appendChild(dummy);
        const computed = getComputedStyle(dummy).color;
        document.body.removeChild(dummy);
        return computed;
      } catch {
        return cssValue;
      }
    };
    setResolvedColor(resolveColor(color));
    setResolvedTrackColor(resolveColor("color-mix(in srgb, var(--md-outline-variant), white 50%)"));
  }, [color]);

  // Clamp waveform height to a smaller range for a less tall wave
  const waveformHeight = Math.max(8, Math.min(height, 18));

  // Update elapsed time while recording
  useEffect(() => {
    if (isRecording && recordingStartTime) {
      setElapsed((Date.now() - recordingStartTime) / 1000);
      const id = setInterval(() => {
        setElapsed((Date.now() - recordingStartTime) / 1000);
      }, 100);
      return () => clearInterval(id);
    } else {
      setElapsed(0);
    }
  }, [isRecording, recordingStartTime]);

  // Reset audio state when reference audio changes
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [referenceAudio]);

  // Continuous update of thumb position for smooth animation
  useEffect(() => {
    if (!playing && !isDragging) {
      if (thumbRef.current) {
        thumbRef.current.style.left = duration > 0 ? `${(currentTime / duration) * 100}%` : '0%';
      }
      if (wavyProgressRef.current) {
        wavyProgressRef.current.setProgress(duration > 0 ? currentTime / duration : 0, false);
      }
      return;
    }

    let rafId;
    const update = () => {
      const time = isDragging ? dragTime : (audioRef.current ? audioRef.current.currentTime : 0);
      if (thumbRef.current) {
        thumbRef.current.style.left = duration > 0 ? `${(time / duration) * 100}%` : '0%';
      }
      if (wavyProgressRef.current) {
        wavyProgressRef.current.setProgress(duration > 0 ? time / duration : 0, false);
      }
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [playing, isDragging, duration, currentTime, dragTime]);

  const togglePlayPause = () => {
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleTimelineMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;
    setDragTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }

    const handleMouseMove = (e) => {
      const clickX = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      const newTime = percentage * duration;
      setDragTime(newTime);
      if (audioRef.current) {
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTimelineTouchStart = (e) => {
    e.preventDefault();
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    const clickX = touch.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;
    setDragTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }

    const handleTouchMove = (e) => {
      const touch = e.touches[0];
      const clickX = touch.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      const newTime = percentage * duration;
      setDragTime(newTime);
      if (audioRef.current) {
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };

  const audioSrc = referenceAudio ? (referenceAudio.url || `${SERVER_URL}/api/narration/audio/${referenceAudio.filename}`) : null;

  return (
    <div className="narration-row audio-controls-row">
      <div className="row-label">
        <label>
          {narrationMethod === 'f5tts' && (
            <HelpIcon
              title={t('narration.audioControlsHelp', 'Use reference audio <12s and leave proper silence space (e.g. 1s) at the end. Otherwise there is a risk of truncating in the middle of word')}
              size={16}
              style={{ display: 'inline-flex', marginRight: '8px', verticalAlign: 'middle' }}
            />
          )}
          {t('narration.audioControls', 'Âm thanh tham chiếu')}:
        </label>
      </div>
      <div className="row-content">
        <div className="audio-controls-container">
          <div className="audio-controls">
            {/* Upload Button */}
            <button
              className="pill-button primary"
              onClick={() => fileInputRef.current.click()}
              disabled={isRecording || isStartingRecording || !isAvailable}
            >
              <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>upload</span>
              {t('narration.upload', 'Upload')}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="audio/*"
              style={{ display: 'none' }}
            />

            {/* Record / Starting / Stop Button */}
            {!isRecording && !isStartingRecording ? (
              <button
                className="pill-button primary"
                onClick={startRecording}
                disabled={!isAvailable}
                title={t('narration.record', 'Record')}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>radio_button_checked</span>
                {t('narration.record', 'Record')}
              </button>
            ) : !isRecording && isStartingRecording ? (
              <button
                className="pill-button primary"
                disabled
                title={t('narration.startingRecording', 'Starting microphone...')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <LoadingIndicator theme="light" showContainer={false} size={18} />
              </button>
            ) : (
              <button
                className="pill-button error"
                onClick={stopRecording}
                title={t('narration.stopRecording', 'Stop')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '16px' }}>stop</span>
                {t('narration.stopRecording', 'Stop')} {formatTime(elapsed, 'hms_ms')}
              </button>
            )}

            {/* Use Example Button */}
            <ExampleAudioDropdown
              onExampleSelect={onExampleSelect}
              disabled={isRecording || !isAvailable}
            />
          </div>

          {/* Audio Preview */}
          {referenceAudio && (
            <div className="audio-preview" style={{ height: `32px`, marginTop: '6px' }}>
              <div className="audio-player-container primary-audio-player">
                {audioSrc ? (
                  <div className="custom-audio-player" style={{ WebkitFlex: 1, height: `${height}px` }}>
                    <PlayPauseMorphType4 playing={playing} onToggle={togglePlayPause} size={20} color="var(--md-primary)" config={{ rotateDegrees: 0 }} />
                    <div className="audio-progress-container" style={{ flex: 1, WebkitFlex: 1, position: 'relative', height: `${height}px` }}>
                      <div style={{ position: 'relative', zIndex: 0, width: '100%' }}>
                        <WavyProgressIndicator
                          ref={wavyProgressRef}
                          progress={duration > 0 ? currentTime / duration : 0}
                          animate={false}
                          forceFlat={!playing}
                          height={waveformHeight}
                          color={resolvedColor}
                          trackColor={resolvedTrackColor}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          cursor: 'pointer',
                          background: 'transparent'
                        }}
                        onMouseDown={handleTimelineMouseDown}
                        onTouchStart={handleTimelineTouchStart}
                      />
                      <div
                        ref={thumbRef}
                        style={{
                          display: 'none',
                          position: 'absolute',
                          left: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: isDragging ? '16px' : '12px',
                          height: isDragging ? '16px' : '12px',
                          background: 'var(--md-primary)',
                          borderRadius: '50%',
                          boxShadow: isDragging ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 2px 6px rgba(0, 0, 0, 0.3)',
                          cursor: 'pointer',
                          zIndex: 1,
                          border: '1px solid color-mix(in srgb, var(--md-primary), transparent 0.2)',
                          pointerEvents: 'none',
                          transition: isDragging ? 'none' : 'left 0.1s ease, width 0.2s ease, height 0.2s ease'
                        }}
                      />
                    </div>
                    <span className="time-display">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>
                ) : (
                  <div className="audio-status-container">
                    <div className="status-message success">
                      <span className="status-icon">✓</span>
                      {t('narration.referenceAudioReady', 'Reference audio is ready')}
                    </div>
                  </div>
                )}
              </div>
              <button
                className="pill-button error clear-button"
                onClick={clearReferenceAudio}
                title={t('narration.clearReference', 'Clear reference audio')}
              >
                <span className="material-symbols-rounded" style={{ fontSize: '14px' }}>close</span>
              </button>
              <audio
                ref={audioRef}
                src={audioSrc}
                onLoadedMetadata={() => setDuration(audioRef.current.duration)}
                onTimeUpdate={() => setCurrentTime(audioRef.current.currentTime)}
                onEnded={() => setPlaying(false)}
                style={{ display: 'none' }}
              >
                {t('narration.audioNotSupported', 'Your browser does not support the audio element.')}
              </audio>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioControls;
