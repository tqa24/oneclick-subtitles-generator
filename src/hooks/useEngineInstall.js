import { useState, useCallback, useRef, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import i18n from '../i18n/i18n';

/**
 * Drives on-demand install + start/stop of a single heavy engine.
 *
 * The install runs ENTIRELY on the server (engineManager) — the frontend's only job is to REPORT
 * progress. So on mount this hook reconnects to whatever install is already running server-side and
 * resumes polling: install progress survives page reloads and navigating away/back. Closing the tab
 * does NOT stop the install; reopening it picks the progress back up.
 *
 * Endpoints (server/routes/engineRoutes.js):
 *   POST /api/engines/:id/install            -> kick off the per-engine venv install (background)
 *   GET  /api/engines/:id/install-progress   -> { running, percent, log[], done, error }
 *   POST /api/engines/:id/install/cancel     -> abort an in-flight / queued install
 *   POST /api/engines/:id/start | /stop      -> spawn / kill the engine's Python service
 */
export const useEngineInstall = (id) => {
  const [installing, setInstalling] = useState(false);
  const [percent, setPercent] = useState(0);
  const [log, setLog] = useState([]);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);
  const mountedRef = useRef(true);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // Read the server's current progress for this engine. Returns whether an install is running.
  const readProgress = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/engines/${id}/install-progress`);
      if (!r.ok) return false;
      const p = await r.json();
      if (mountedRef.current) {
        setPercent(typeof p.percent === 'number' ? p.percent : 0);
        if (Array.isArray(p.log)) setLog(p.log);
        setError(p.error || null);
        setInstalling(!!p.running);
      }
      return !!p.running;
    } catch (e) {
      return false; // transient — caller decides whether to keep polling
    }
  }, [id]);

  const ensurePolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const running = await readProgress();
      if (!running) stopPolling();
    }, 1500);
  }, [readProgress, stopPolling]);

  // On mount, reconnect to any in-flight server-side install (survives reload / navigation).
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      if (await readProgress()) ensurePolling();
    })();
    return () => { mountedRef.current = false; stopPolling(); };
  }, [readProgress, ensurePolling, stopPolling]);

  const install = useCallback(async () => {
    setError(null); setInstalling(true); setPercent(0); setLog([]);
    try {
      const r = await fetch(`${API_BASE_URL}/engines/${id}/install`, { method: 'POST' });
      if (!r.ok && r.status !== 202) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || i18n.t('engines.error.installFailed', 'Install failed to start'));
      }
      ensurePolling();
    } catch (e) {
      setError(e.message || i18n.t('engines.error.installFailed', 'Install failed to start'));
      setInstalling(false);
    }
  }, [id, ensurePolling]);

  // Cancel an in-flight (or queued) install. The server aborts it; polling reflects the result.
  const cancel = useCallback(() => fetch(`${API_BASE_URL}/engines/${id}/install/cancel`, { method: 'POST' }).catch(() => {}), [id]);

  const requestAction = useCallback(async (action, fallbackKey, fallbackText) => {
    setError(null);
    const r = await fetch(`${API_BASE_URL}/engines/${id}/${action}`, { method: 'POST' });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.error || i18n.t(fallbackKey, fallbackText));
    }
    return r.json().catch(() => ({}));
  }, [id]);

  const start = useCallback(async () => {
    try {
      return await requestAction('start', 'engines.error.startFailed', 'Engine failed to start');
    } catch (e) {
      setError(e.message || i18n.t('engines.error.startFailed', 'Engine failed to start'));
      throw e;
    }
  }, [requestAction]);

  const stop = useCallback(async () => {
    try {
      return await requestAction('stop', 'engines.error.stopFailed', 'Engine failed to stop');
    } catch (e) {
      setError(e.message || i18n.t('engines.error.stopFailed', 'Engine failed to stop'));
      throw e;
    }
  }, [requestAction]);

  const uninstall = useCallback(async () => {
    try {
      return await requestAction('uninstall', 'engines.error.uninstallFailed', 'Uninstall failed');
    } catch (e) {
      setError(e.message || i18n.t('engines.error.uninstallFailed', 'Uninstall failed'));
      throw e;
    }
  }, [requestAction]);

  return { install, cancel, start, stop, uninstall, installing, percent, log, error };
};

export default useEngineInstall;
