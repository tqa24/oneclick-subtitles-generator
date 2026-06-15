import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Owns Parakeet-specific options for the video processing modal.
 *
 * Holds the segment-strategy / max-chars / max-words / preserve-sentences /
 * max-duration state (seeded from and persisted to localStorage) and the
 * drag-to-scroll behaviour for the supported-languages badge strip. The drag
 * listeners are only active while the Parakeet method is selected.
 *
 * @param {string} method Current processing method (drives the drag listeners)
 * @returns parakeet state, setters, and the languages-strip ref
 */
const useParakeetOptions = (method) => {
    // Mouse drag scrolling for languages badges - simplified and robust
    const languagesRef = useRef(null);
    const isDraggingRef = useRef(false);
    const startXRef = useRef(0);
    const startScrollLeftRef = useRef(0);

    const handleMouseDown = useCallback((e) => {
        if (!languagesRef.current || e.button !== 0) return;
        isDraggingRef.current = true;
        languagesRef.current.classList.add('dragging');
        startXRef.current = e.pageX;
        startScrollLeftRef.current = languagesRef.current.scrollLeft;
        e.preventDefault();
    }, []);

    const handleMouseMove = useCallback((e) => {
        if (!isDraggingRef.current || !languagesRef.current) return;
        e.preventDefault();
        const deltaX = e.pageX - startXRef.current;
        languagesRef.current.scrollLeft = startScrollLeftRef.current - deltaX;
    }, []);

    const handleMouseUp = useCallback(() => {
        isDraggingRef.current = false;
        if (languagesRef.current) {
            languagesRef.current.classList.remove('dragging');
        }
    }, []);

    // Set up drag event listeners - only when Parakeet is selected
    useEffect(() => {
        if (method !== 'nvidia-parakeet' || !languagesRef.current) return;

        const container = languagesRef.current;
        container.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            container.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [method, handleMouseDown, handleMouseMove, handleMouseUp]);

    // Parakeet-specific options
    const [parakeetStrategy, setParakeetStrategy] = useState(() => localStorage.getItem('parakeet_segment_strategy') || 'sentence');
    const [parakeetMaxChars, setParakeetMaxChars] = useState(() => {
        const saved = parseInt(localStorage.getItem('parakeet_max_chars') || '60', 10);
        return Math.min(100, Math.max(5, isNaN(saved) ? 60 : saved));
    });
    const [parakeetMaxWords, setParakeetMaxWords] = useState(() => {
        const saved = parseInt(localStorage.getItem('parakeet_max_words') || '7', 10);
        return Math.min(50, Math.max(1, isNaN(saved) ? 7 : saved));
    });
    const [parakeetPreserveSentences, setParakeetPreserveSentences] = useState(() => {
        return localStorage.getItem('parakeet_preserve_sentences') === 'true';
    });

    // Separate max duration for Parakeet (in minutes)
    const [parakeetMaxDurationPerRequest, setParakeetMaxDurationPerRequest] = useState(() => {
        const saved = localStorage.getItem('parakeet_max_duration_per_request');
        return saved ? parseInt(saved, 10) : 3; // Default to 3 minutes for Parakeet
    });

    // Persist Parakeet max duration per request
    useEffect(() => {
        localStorage.setItem('parakeet_max_duration_per_request', parakeetMaxDurationPerRequest.toString());
    }, [parakeetMaxDurationPerRequest]);

    // Persist Parakeet options
    useEffect(() => {
        localStorage.setItem('parakeet_segment_strategy', parakeetStrategy);
    }, [parakeetStrategy]);
    useEffect(() => {
        localStorage.setItem('parakeet_max_chars', String(parakeetMaxChars));
    }, [parakeetMaxChars]);
    useEffect(() => {
        localStorage.setItem('parakeet_max_words', String(parakeetMaxWords));
    }, [parakeetMaxWords]);
    useEffect(() => {
        localStorage.setItem('parakeet_preserve_sentences', parakeetPreserveSentences ? 'true' : 'false');
    }, [parakeetPreserveSentences]);

    return {
        languagesRef,
        parakeetStrategy,
        setParakeetStrategy,
        parakeetMaxChars,
        setParakeetMaxChars,
        parakeetMaxWords,
        setParakeetMaxWords,
        parakeetPreserveSentences,
        setParakeetPreserveSentences,
        parakeetMaxDurationPerRequest,
        setParakeetMaxDurationPerRequest,
    };
};

export default useParakeetOptions;
