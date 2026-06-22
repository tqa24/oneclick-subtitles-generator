import { useState, useEffect } from 'react';

/**
 * Tracks whether the app runs in Vercel/hosted "npm start" mode (no local backend features) vs a
 * normal local run. Heavy-engine availability is no longer a global flag — it's per-engine via
 * useEngineStatus. Seeds from localStorage, mirrors cross-tab `storage` changes, and (only when the
 * mode was never cached) fetches `/api/startup-mode` once to resolve and persist it.
 *
 * @returns {{ isVercelMode: boolean }}
 */
const useStartupMode = () => {
    const [isVercelMode, setIsVercelMode] = useState(() => {
        try {
            return localStorage.getItem('is_vercel_mode') === 'true';
        } catch {
            return false;
        }
    });

    useEffect(() => {
        let aborted = false;
        const onStorage = (e) => {
            if (e.key === 'is_vercel_mode') {
                setIsVercelMode(e.newValue === 'true');
            }
        };
        window.addEventListener('storage', onStorage);

        (async () => {
            try {
                const exists = localStorage.getItem('is_vercel_mode');
                if (exists === null) {
                    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3031';
                    const resp = await fetch(`${API_BASE_URL}/api/startup-mode`, {
                        mode: 'cors',
                        credentials: 'include',
                        headers: { 'Accept': 'application/json' }
                    });
                    if (!aborted && resp.ok) {
                        const data = await resp.json();
                        const isVercel = !!data.isStart || !!data.isVercel;
                        setIsVercelMode(isVercel);
                        try {
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

    return { isVercelMode };
};

export default useStartupMode;
