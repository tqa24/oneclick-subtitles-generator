import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentKey } from '../services/gemini/keyManager';

// Collapsible section embedding the promptdj-midi app with start/stop recording controls
const BackgroundMusicSection = () => {
  const { t, i18n } = useTranslation();
  const iframeRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState('');
  const [status, setStatus] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('bg_music_collapsed');
    return saved === 'true';
  });

  const midiAppUrl = useMemo(() => 'http://127.0.0.1:3037/', []);

  const postApiKeyToIframe = useCallback(() => {
    const apiKey = getCurrentKey?.() || localStorage.getItem('gemini_api_key') || '';
    if (!apiKey) {
      setStatus(t('backgroundMusic.statusNoApiKey', 'Gemini API key not set. Please set it in Settings > API Keys.'));
      return;
    }
    if (!iframeRef.current?.contentWindow) return;
    const lang = (typeof i18n?.language === 'string' && i18n.language) ? i18n.language : (localStorage.getItem('preferred_language') || 'en');
    iframeRef.current.contentWindow.postMessage({ type: 'pm-dj-set-api-key', apiKey, lang }, '*');
  }, [t, i18n]);

  const startRecording = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    setStatus(t('backgroundMusic.statusStarting', 'Starting recording...'));
    setRecordingUrl('');
    iframeRef.current.contentWindow.postMessage({ type: 'pm-dj-start-recording' }, '*');
  }, [t]);

  const stopRecording = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    setStatus(t('backgroundMusic.statusStopping', 'Stopping recording...'));
    iframeRef.current.contentWindow.postMessage({ type: 'pm-dj-stop-recording' }, '*');
  }, [t]);
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
        setIsRecording(true);
        setStatus(t('backgroundMusic.statusRecording', 'Recording...'));
      }
      if (data.type === 'pm-dj-recording-stopped') {
        setIsRecording(false);
        setStatus(t('backgroundMusic.statusRecordingStopped', 'Recording stopped.'));
        // Create object URL from received blob
        if (data.blob) {
          const url = URL.createObjectURL(data.blob);
          setRecordingUrl(url);
        }
      }
      if (data.type === 'pm-dj-recording-error') {
        setIsRecording(false);
        setStatus(t('backgroundMusic.statusRecordingError', 'Recording error: {{error}}', { error: data.error || 'Unknown error' }));
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Send API key on iframe load and when storage changes
  const onIframeLoad = useCallback(() => {
    postApiKeyToIframe();
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
      className={`video-rendering-section ${isCollapsed ? 'collapsed' : 'expanded'}`}
    >
      {/* Header - reuse existing styles */}
      <div className="video-rendering-header">
        <div className="header-left">
          <h2>{t('backgroundMusic.title', 'Background Music Generator')}</h2>

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
        <div className="video-rendering-collapsed-content">
          <p className="helper-message">
            {t('backgroundMusic.helperMessage', 'Configure prompts inside the embedded app to generate live background music.')}
          </p>
        </div>
      ) : (
        <div className="video-rendering-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <button onClick={startRecording} disabled={isRecording} style={{ padding: '6px 10px' }}>{t('backgroundMusic.startRecording', 'Start Recording')}</button>
            <button onClick={stopRecording} disabled={!isRecording} style={{ padding: '6px 10px' }}>{t('backgroundMusic.stopRecording', 'Stop Recording')}</button>
            <span style={{ marginLeft: 8, opacity: 0.9 }}>{status}</span>
          </div>

          {recordingUrl && (
            <div style={{ marginBottom: 10 }}>
              <audio src={recordingUrl} controls style={{ width: '100%' }} />
              <div style={{ marginTop: 6 }}>
                <a href={recordingUrl} download={`background-music-${Date.now()}.webm`}>
                  Download Recording
                </a>
              </div>
            </div>
          )}

          <div style={{ position: 'relative', width: '100%', height: 480, background: '#111', borderRadius: 6, overflow: 'hidden' }}>
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

