import { useState, useEffect } from 'react';

/**
 * Tracks Full (CUDA) vs Lite vs Vercel startup mode for the video processing modal.
 *
 * Seeds from localStorage, mirrors cross-tab `storage` changes, and (only when the
 * mode was never cached) fetches `/api/startup-mode` once to resolve and persist it.
 *
 * @returns {{ isFullVersion: boolean, isVercelMode: boolean }}
 */
const useStartupMode = () => {
    const [isFullVersion, setIsFullVersion] = useState(() => {
        try {
            const v = localStorage.getItem('is_full_version');
            return v === 'true';
        } catch {
            return false;
        }
    });

    const [isVercelMode, setIsVercelMode] = useState(() => {
        try {
            const v = localStorage.getItem('is_vercel_mode');
            return v === 'true';
        } catch {
            return false;
        }
    });

    // Keep track of startup mode changes (from Header or first-load fallback)
    useEffect(() => {
        let aborted = false;
        const onStorage = (e) => {
            if (e.key === 'is_full_version') {
                setIsFullVersion(e.newValue === 'true');
            } else if (e.key === 'is_vercel_mode') {
                setIsVercelMode(e.newValue === 'true');
            }
        };
        window.addEventListener('storage', onStorage);

        (async () => {
            try {
                const exists = localStorage.getItem('is_full_version');
                if (exists === null) {
                    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3031';
                    const resp = await fetch(`${API_BASE_URL}/api/startup-mode`, {
                        mode: 'cors',
                        credentials: 'include',
                        headers: { 'Accept': 'application/json' }
                    });
                    if (!aborted && resp.ok) {
                        const data = await resp.json();
                        const isFull = !!data.isDevCuda;
                        const isVercel = !!data.isStart && !data.isDevCuda;
                        setIsFullVersion(isFull);
                        setIsVercelMode(isVercel);
                        try {
                            localStorage.setItem('is_full_version', isFull ? 'true' : 'false');
                            localStorage.setItem('is_vercel_mode', isVercel ? 'true' : 'false');
                        } catch { }
                    }
                }
            } catch { }
        })();

        return () => {
            aborted = true;
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    return { isFullVersion, isVercelMode };
};

export default useStartupMode;
