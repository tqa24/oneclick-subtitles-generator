import { useCallback, useEffect, useRef } from 'react';

/**
 * Quota-countdown updater extracted from useSubtitles.
 *
 * Drives the "wait about {{seconds}}s" status message for Gemini quota-exceeded
 * errors, ticking once per second until it reaches zero. The countdown is cleared
 * whenever a new generation starts (isGenerating) and on unmount.
 *
 * Behavior is byte-for-byte identical to the original inline implementation.
 *
 * @returns {(initialSeconds:number, isFreeTier:boolean) => void} startQuotaCountdown
 */
export const useQuotaCountdown = ({ t, setStatus, isGenerating }) => {
    const quotaCountdownRef = useRef(null);

    const clearQuotaCountdown = useCallback(() => {
        if (quotaCountdownRef.current) {
            clearInterval(quotaCountdownRef.current);
            quotaCountdownRef.current = null;
        }
    }, []);

    const startQuotaCountdown = useCallback((initialSeconds, isFreeTier) => {
        clearQuotaCountdown();
        let remaining = Math.max(0, Number(initialSeconds) || 0);

        const tick = () => {
            const msg = isFreeTier
                ? t('errors.geminiQuotaExceededWithRetry', 'Gemini free-tier quota exceeded. Please wait about {{seconds}}s and try again, or use a different API key/add billing.', { seconds: remaining })
                : t('errors.geminiQuotaExceededWithRetry', 'Gemini quota exceeded. Please wait about {{seconds}}s and try again, or use a different API key/add billing.', { seconds: remaining });
            setStatus({ message: msg, type: 'error' });

            if (remaining <= 0) {
                clearQuotaCountdown();
                return;
            }
            remaining -= 1;
        };

        // Immediate render, then interval updates
        tick();
        quotaCountdownRef.current = setInterval(tick, 1000);
    }, [clearQuotaCountdown, t, setStatus]);

    // Clear countdown when we start generating again or on unmount
    useEffect(() => {
        if (isGenerating) {
            clearQuotaCountdown();
        }
        return () => clearQuotaCountdown();
    }, [isGenerating, clearQuotaCountdown]);

    return startQuotaCountdown;
};
