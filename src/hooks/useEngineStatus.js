import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../config';

const POLL_MS = 5000;

/**
 * Unified per-engine availability, polled from GET /api/engines/status. This is the additive
 * replacement for the old global install flag + the separate narration/Parakeet availability hooks:
 * availability is per-engine at runtime, not one global mode.
 *
 * Returns { engines, loading, refresh, isReady(id), isInstalled(id) } where each engine is
 * { id, label, port, installed, running, state: 'not-installed'|'installed-stopped'|'ready' }.
 */
export const useEngineStatus = ({ poll = true } = {}) => {
  const [engines, setEngines] = useState({});
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/engines/status`);
      if (resp.ok) {
        const data = await resp.json();
        if (mountedRef.current) setEngines(data.engines || {});
      }
    } catch (error) {
      // Leave the last known status on a transient failure.
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    if (!poll) return () => { mountedRef.current = false; };
    const id = setInterval(refresh, POLL_MS);
    return () => { mountedRef.current = false; clearInterval(id); };
  }, [refresh, poll]);

  const isReady = useCallback((id) => engines[id]?.state === 'ready', [engines]);
  const isInstalled = useCallback((id) => !!engines[id]?.installed, [engines]);

  return { engines, loading, refresh, isReady, isInstalled };
};

export default useEngineStatus;
