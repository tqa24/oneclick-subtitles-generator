import { useState, useEffect } from 'react';

/**
 * Tracks whether saved transcription/analysis rules exist and are non-empty.
 *
 * Re-checks on mount, on the `transcriptionRulesUpdated` event, and on cross-tab
 * `storage` changes to the `transcription_rules` key. When no usable rules exist
 * it also flips the caller's "use rules" toggle off.
 *
 * @param {boolean} useTranscriptionRules current toggle value
 * @param {Function} setUseTranscriptionRules toggle setter (disabled when no rules)
 * @returns {boolean} whether usable rules are available
 */
const useTranscriptionRulesAvailability = (useTranscriptionRules, setUseTranscriptionRules) => {
    const [transcriptionRulesAvailable, setTranscriptionRulesAvailable] = useState(false);

    useEffect(() => {
        const checkRulesAvailability = () => {
            const transcriptionRulesStr = localStorage.getItem('transcription_rules');
            let hasRules = false;

            if (transcriptionRulesStr && transcriptionRulesStr.trim() !== '' && transcriptionRulesStr !== 'null') {
                try {
                    const rules = JSON.parse(transcriptionRulesStr);
                    // Check if rules object has any meaningful content
                    hasRules = rules && typeof rules === 'object' &&
                        (Object.keys(rules).length > 0) &&
                        // Make sure it's not just an empty object or only has empty arrays/strings
                        Object.values(rules).some(value => {
                            if (Array.isArray(value)) return value.length > 0;
                            if (typeof value === 'string') return value.trim() !== '';
                            if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0;
                            return value !== null && value !== undefined;
                        });
                } catch (e) {
                    // If it's not valid JSON, treat as no rules
                    hasRules = false;
                }
            }

            setTranscriptionRulesAvailable(hasRules);

            // If rules are not available, disable the switch
            if (!hasRules && useTranscriptionRules) {
                setUseTranscriptionRules(false);
            }

            console.log('[VideoProcessingModal] Transcription rules availability:', hasRules ? 'Available' : 'Not available');
        };

        // Initial check
        checkRulesAvailability();

        // Listen for transcription rules changes
        const handleRulesUpdate = () => {
            console.log('[VideoProcessingModal] Transcription rules updated, re-checking availability');
            checkRulesAvailability();
        };

        // Listen for storage changes (when rules are cleared from other components)
        const handleStorageChange = (event) => {
            if (event.key === 'transcription_rules') {
                console.log('[VideoProcessingModal] Transcription rules changed in localStorage');
                checkRulesAvailability();
            }
        };

        // Add event listeners
        window.addEventListener('transcriptionRulesUpdated', handleRulesUpdate);
        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('transcriptionRulesUpdated', handleRulesUpdate);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [useTranscriptionRules]); // eslint-disable-line react-hooks/exhaustive-deps

    return transcriptionRulesAvailable;
};

export default useTranscriptionRulesAvailability;
