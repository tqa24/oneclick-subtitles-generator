import { useEngineStatus } from './useEngineStatus';

/**
 * Per-engine Nvidia Parakeet ASR availability, sourced from the unified engine status
 * (GET /api/engines/status). Replaces the old `is_full_version` gate: Parakeet is available when its
 * engine is actually running, regardless of how the app was started.
 *
 * @returns {{ available: boolean, checking: boolean, error: string|null, refresh: () => void, installed: boolean }}
 */
export default function useParakeetAvailability() {
  const { engines, loading, refresh, isReady } = useEngineStatus();
  return {
    available: isReady('parakeet'),
    checking: loading,
    error: null,
    refresh,
    installed: !!engines.parakeet?.installed,
  };
}
