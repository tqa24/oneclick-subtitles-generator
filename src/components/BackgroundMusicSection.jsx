import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../styles/CollapsibleSection.css';
import '../styles/BackgroundMusicSection.css';

import { useTranslation } from 'react-i18next';
import { getCurrentKey } from '../services/gemini/keyManager';
import CustomDropdown from './common/CustomDropdown';
import MaterialSwitch from './common/MaterialSwitch';
import LoadingIndicator from './common/LoadingIndicator';
import { formatTime } from '../utils/timeFormatter';

// Collapsible section embedding the promptdj-midi app with start/stop recording controls
const BackgroundMusicSection = () => {
  const { t, i18n } = useTranslation();
  const iframeRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState('');
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('bg_music_collapsed');
    return saved === 'true';
  });

  // MIDI UI state now lives in the main app header
  const [midiShow, setMidiShow] = useState(false);
  const [midiInputs, setMidiInputs] = useState([]); // [{id, name}]
  const [activeMidiId, setActiveMidiId] = useState('');

  const midiAppUrl = useMemo(() => 'http://127.0.0.1:3037/', []);

  const postApiKeyToIframe = useCallback(() => {
    const apiKey = getCurrentKey?.() || localStorage.getItem('gemini_api_key') || '';
    if (!apiKey) {
      return;
    }
    if (!iframeRef.current?.contentWindow) return;
    const lang = (typeof i18n?.language === 'string' && i18n.language) ? i18n.language : (localStorage.getItem('preferred_language') || 'en');
    iframeRef.current.contentWindow.postMessage({ type: 'pm-dj-set-api-key', apiKey, lang }, '*');
  }, [i18n]);

  const startRecording = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    setIsStartingRecording(true);
    if (recordingUrl) {
      try { URL.revokeObjectURL(recordingUrl); } catch {}
    }
    setRecordingUrl('');
    setRecordingStartTime(Date.now());
    iframeRef.current.contentWindow.postMessage({ type: 'pm-dj-start-recording' }, '*');
  }, [recordingUrl]);

  const stopRecording = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage({ type: 'pm-dj-stop-recording' }, '*');
  }, []);

  const clearReferenceAudio = useCallback(() => {
    if (recordingUrl) {
      try { URL.revokeObjectURL(recordingUrl); } catch {}
    }
    setRecordingUrl('');
  }, [recordingUrl]);

  // Timer like narration
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

	  // Cleanup object URL when it changes or on unmount
	  useEffect(() => {
	    return () => {
	      if (recordingUrl) {
	        try { URL.revokeObjectURL(recordingUrl); } catch {}
	      }
	    };
	  }, [recordingUrl]);


  // Propagate language changes to iframe
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;
    const lang = (typeof i18n?.language === 'string' && i18n.language) ? i18n.language : (localStorage.getItem('preferred_language') || 'en');
    iframeRef.current.contentWindow.postMessage({ type: 'pm-dj-set-lang', lang }, '*');
  }, [i18n?.language]);

  // Receive messages from the iframe
  useEffect(() => {
    function onMessage(event) {
      try {
        const allowedOrigins = ['http://127.0.0.1:3037', 'http://localhost:3037'];
        if (event.origin && !allowedOrigins.includes(event.origin)) return;
      } catch {}

      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'pm-dj-recording-started') {
        setIsStartingRecording(false);
        setIsRecording(true);
        setRecordingStartTime((prev) => prev ?? Date.now());
      }
      if (data.type === 'pm-dj-recording-stopped') {
        setIsStartingRecording(false);
        setIsRecording(false);
        // Create object URL from received blob
        if (data.blob) {
          const url = URL.createObjectURL(data.blob);
          setRecordingUrl(url);
        }
      }
      if (data.type === 'pm-dj-recording-error') {
        setIsStartingRecording(false);
        setIsRecording(false);
      }

      // MIDI bridge: receive device list/state
      if (data.type === 'midi:inputs') {
        const arr = Array.isArray(data.inputs) ? data.inputs : [];
        setMidiInputs(arr);
        if (typeof data.activeId === 'string') setActiveMidiId(data.activeId);
        if (typeof data.show === 'boolean') setMidiShow(data.show);
      }
    }


    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Send API key on iframe load and when storage changes
  const onIframeLoad = useCallback(() => {
    postApiKeyToIframe();
    // Request current MIDI inputs/state
    try { iframeRef.current?.contentWindow?.postMessage({ type: 'midi:getInputs' }, '*'); } catch {}
  }, [postApiKeyToIframe]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e && e.key && !e.key.toLowerCase().includes('gemini')) return;
      postApiKeyToIframe();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [postApiKeyToIframe]);

  return (
    <div
      className={`music-generator-section ${isCollapsed ? 'collapsed' : 'expanded'}`}
    >
      {/* Header */}
      <div className="music-generator-header">
        <div className="header-left" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 48, flexWrap: 'wrap' }}>
          {isCollapsed && (<h2 style={{ margin: 0 }}>{t('backgroundMusic.title', 'Background Music Generator')}</h2>)}

          {/* MIDI controls in header - hidden when collapsed */}
          {!isCollapsed && (
            <div className="midi-controls" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <MaterialSwitch
                  checked={midiShow}
                  onChange={(e) => {
                    const show = !!e?.target?.checked;
                    setMidiShow(show);
                    try { iframeRef.current?.contentWindow?.postMessage({ type: 'midi:setShow', show }, '*'); } catch {}
                    if (show) {
                      try { iframeRef.current?.contentWindow?.postMessage({ type: 'midi:getInputs' }, '*'); } catch {}
                    }
                  }}
                  ariaLabel={t('backgroundMusic.midi', 'MIDI')}
                  icons={true}
                />
                <span style={{ fontWeight: 600 }}>MIDI</span>
              </div>

              <CustomDropdown
                value={activeMidiId || ''}
                onChange={(nextId) => {
                  setActiveMidiId(nextId);
                  try { iframeRef.current?.contentWindow?.postMessage({ type: 'midi:setActiveInput', id: nextId }, '*'); } catch {}
                }}
                options={(midiInputs || []).map(({ id, name }) => ({ value: id, label: name || id }))}
                placeholder={t('backgroundMusic.noDevices', 'Không tìm thấy thiết bị')}
                disabled={!midiShow}
              />
            </div>
          )}

          {/* Record/Stop button with timer and download inline with title; hidden when collapsed */}
          {!isCollapsed && (
            <div className="header-controls" style={{ display: 'flex', alignItems: 'center', gap: 16, minHeight: 40 }}>
              {!isRecording && !isStartingRecording ? (
                <button
                  className="pill-button primary"
                  onClick={startRecording}
                  title={t('narration.record', 'Record')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="6" fill="currentColor" />
                  </svg>
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="6" width="12" height="12" fill="currentColor" />
                  </svg>
                  {t('narration.stopRecording', 'Stop')} {formatTime(elapsed, 'hms_ms')}
                </button>
              )}

              {/* Download button appears when a recording is available */}
              {recordingUrl && (
                <a
                  className="pill-button secondary"
                  href={recordingUrl}
                  download={`background-music-${Date.now()}.webm`}
                  title={t('backgroundMusic.downloadRecording', 'Download recording')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 13 7 8" />
                    <line x1="12" y1="3" x2="12" y2="13" />
                  </svg>
                  {t('narration.download', 'Download')}
                </a>
              )}

              {/* Inline audio preview when available (match narration styles) */}
              {recordingUrl && (
                <div className="audio-preview" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <div className="audio-player-container controls">
                    <audio
                      controls
                      src={recordingUrl}
                      className="audio-player"
                      tabIndex="-1"
                    >
                      {t('narration.audioNotSupported', 'Your browser does not support the audio element.')}
                    </audio>
                  </div>
                  <button
                    className="pill-button error clear-button"
                    onClick={clearReferenceAudio}
                    title={t('narration.clearReference', 'Clear reference audio')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <button
          className="collapse-button"
          onClick={() => {
            const next = !isCollapsed;
            setIsCollapsed(next);
            localStorage.setItem('bg_music_collapsed', next ? 'true' : 'false');
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </div>

      {/* Collapsed content */}
      {isCollapsed ? (
        <div className="music-generator-collapsed-content">
          <p className="helper-message">
            {t('backgroundMusic.helperMessage', 'Configure prompts inside the embedded app to generate live background music.')}
          </p>
        </div>
      ) : (
        <div className="music-generator-content">
          <div style={{ position: 'relative', width: '100%', height: 600, background: '#111', borderRadius: 6, overflow: 'hidden' }}>
            <iframe
              ref={iframeRef}
              title="promptdj-midi"
              src={midiAppUrl}
              onLoad={onIframeLoad}
              allow="midi"
              style={{ border: 'none', width: '100%', height: '100%' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BackgroundMusicSection;
