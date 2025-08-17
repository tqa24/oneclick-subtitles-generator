import { useState, useCallback, useEffect } from 'react';
import { callGeminiApi, setProcessingForceStopped } from '../services/geminiService';
import { preloadYouTubeVideo } from '../utils/videoPreloader';
import { generateFileCacheId } from '../utils/cacheUtils';
import { extractYoutubeVideoId } from '../utils/videoDownloader';
import { getVideoDuration, processMediaFile } from '../utils/videoProcessor';
import { processSegmentWithFilesApi } from '../utils/videoProcessing/processingUtils';
import { setCurrentCacheId as setRulesCacheId } from '../utils/transcriptionRulesStore';
import { setCurrentCacheId as setSubtitlesCacheId } from '../utils/userSubtitlesStore';

/**
 * Generate a consistent cache ID from any video URL
 * @param {string} url - Video URL
 * @returns {string|null} - Consistent cache ID
 */
const generateUrlBasedCacheId = async (url) => {
    if (!url) return null;

    try {
        // YouTube URLs
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            return extractYoutubeVideoId(url);
        }

        // Douyin URLs
        if (url.includes('douyin.com')) {
            const { extractDouyinVideoId } = await import('../utils/douyinDownloader');
            return extractDouyinVideoId(url);
        }

        // All other sites - generate consistent ID from URL structure
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace('www.', '');
        const path = urlObj.pathname.replace(/\//g, '_');
        const query = urlObj.search.replace(/[^a-zA-Z0-9]/g, '_');
        const baseId = `${domain}${path}${query}`.replace(/[^a-zA-Z0-9]/g, '_');
        const cleanId = baseId.replace(/_+/g, '_').replace(/^_|_$/g, '');
        return `site_${cleanId}`;

    } catch (error) {
        console.error('Error generating URL-based cache ID:', error);
        return null;
    }
};

export const useSubtitles = (t) => {
    const [subtitlesData, setSubtitlesData] = useState(null);
    const [status, setStatus] = useState({ message: '', type: '' });
    const [isGenerating, setIsGenerating] = useState(false);
    const [retryingSegments, setRetryingSegments] = useState([]);

    // Listen for abort events
    useEffect(() => {
        const handleAbort = () => {
            // Reset generating state
            setIsGenerating(false);
            // Reset retrying segments
            setRetryingSegments([]);
            // Update status
            setStatus({ message: t('output.requestsAborted', 'All Gemini requests have been aborted'), type: 'info' });
        };

        // Add event listener
        window.addEventListener('gemini-requests-aborted', handleAbort);

        // Clean up
        return () => {
            window.removeEventListener('gemini-requests-aborted', handleAbort);
        };
    }, [t]);

    // Function to update segment status and dispatch event
    const updateSegmentsStatus = useCallback((segments) => {
        // Dispatch custom event with segment status
        const event = new CustomEvent('segmentStatusUpdate', { detail: segments });
        window.dispatchEvent(event);
    }, []);

    const checkCachedSubtitles = async (cacheId, currentVideoUrl = null) => {
        try {
            const response = await fetch(`http://localhost:3031/api/subtitle-exists/${cacheId}`);
            const data = await response.json();

            if (!data.exists) {
                return null;
            }

            // If we have a current video URL, validate that the cache belongs to this URL
            // Skip this validation for file uploads since they don't have consistent URLs
            const currentFileCacheId = localStorage.getItem('current_file_cache_id');
            const isFileUpload = currentFileCacheId === cacheId;

            if (!isFileUpload && currentVideoUrl && data.metadata && data.metadata.sourceUrl) {
                if (data.metadata.sourceUrl !== currentVideoUrl) {
                    console.log(`[Cache] Cache ID collision detected. Cache for ${data.metadata.sourceUrl}, current: ${currentVideoUrl}`);
                    return null; // Cache belongs to different video
                }
            }

            console.log(`[Cache] Cache validation passed for ${isFileUpload ? 'file upload' : 'video URL'}`);

            return data.subtitles;
        } catch (error) {
            console.error('Error checking subtitle cache:', error);
            return null;
        }
    };

    const saveSubtitlesToCache = async (cacheId, subtitles) => {
        try {
            // Include source URL metadata for validation
            const currentVideoUrl = localStorage.getItem('current_video_url');
            const metadata = currentVideoUrl ? { sourceUrl: currentVideoUrl } : {};

            const response = await fetch('http://localhost:3031/api/save-subtitles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    cacheId,
                    subtitles,
                    metadata
                })
            });

            const result = await response.json();
            if (!result.success) {
                console.error('Failed to save subtitles to cache:', result.error);
            }
        } catch (error) {
            console.error('Error saving subtitles to cache:', error);
        }
    };

    const generateSubtitles = useCallback(async (input, inputType, apiKeysSet, options = {}) => {
        // Extract options
        const { userProvidedSubtitles, segment, fps, mediaResolution, model } = options;
        if (!apiKeysSet.gemini) {
            setStatus({ message: t('errors.apiKeyRequired'), type: 'error' });
            return false;
        }

        // Reset the force stop flag when starting a new generation
        setProcessingForceStopped(false);

        setIsGenerating(true);
        setStatus({ message: t('output.processingVideo'), type: 'loading' });

        try {
            let cacheId = null;

            // Check if this is a URL-based input (either direct URL or downloaded video)
            const currentVideoUrl = localStorage.getItem('current_video_url');
            const currentFileCacheId = localStorage.getItem('current_file_cache_id');

            console.log('[Subtitle Generation] Cache ID generation debug:', {
                inputType,
                currentVideoUrl,
                currentFileCacheId,
                inputIsFile: input instanceof File,
                inputName: input instanceof File ? input.name : 'not a file'
            });

            if (inputType === 'youtube' || currentVideoUrl) {
                // Use unified URL-based caching for all video URLs
                const urlToUse = inputType === 'youtube' ? input : currentVideoUrl;
                cacheId = await generateUrlBasedCacheId(urlToUse);

                // Preload YouTube videos
                if (urlToUse && (urlToUse.includes('youtube.com') || urlToUse.includes('youtu.be'))) {
                    preloadYouTubeVideo(urlToUse);
                }

                // Set cache ID for both stores
                setRulesCacheId(cacheId);
                setSubtitlesCacheId(cacheId);

            } else if (inputType === 'file-upload') {
                // For actual file uploads (not downloaded videos), use file-based cache ID
                cacheId = await generateFileCacheId(input);

                // Store the cache ID in localStorage for later use (e.g., saving edited subtitles)
                localStorage.setItem('current_file_cache_id', cacheId);

                // Set cache ID for both stores
                setRulesCacheId(cacheId);
                setSubtitlesCacheId(cacheId);


                // Check if this is a video file and get its duration
                if (input.type.startsWith('video/')) {
                    try {
                        const duration = await getVideoDuration(input);
                        // eslint-disable-next-line no-unused-vars
                        const durationMinutes = Math.floor(duration / 60);

                        // If video is longer than 30 minutes, show warning and use special processing
                        if (durationMinutes > 30) {
                            setStatus({
                                message: t('output.longVideoWarning', 'You uploaded a {{duration}} minute video. Processing can be longer than usual due to multiple Gemini calls.', { duration: durationMinutes }),
                                type: 'loading'
                            });
                        }
                    } catch (error) {
                        console.warn('Error getting video duration:', error);
                    }
                }
            }

            // IMPORTANT: Check cache FIRST and load cached subtitles immediately
            // This ensures the timeline shows cached subtitles right when output container appears
            console.log('[Subtitle Generation] Cache check debug:', {
                cacheId,
                segment: !!segment,
                willCheckCache: !!(cacheId && !segment)
            });

            if (cacheId && !segment) {
                console.log('[Subtitle Generation] Checking for cached subtitles with cache ID:', cacheId);
                const cachedSubtitles = await checkCachedSubtitles(cacheId, currentVideoUrl);
                console.log('[Subtitle Generation] Cache check result:', {
                    found: !!cachedSubtitles,
                    count: cachedSubtitles ? cachedSubtitles.length : 0
                });

                if (cachedSubtitles) {
                    console.log('[Subtitle Generation] Loading cached subtitles immediately for timeline display');
                    setSubtitlesData(cachedSubtitles);
                    setStatus({
                        message: t('output.subtitlesLoadedFromCache', 'Subtitles loaded from cache!'),
                        type: 'success',
                        translationKey: 'output.subtitlesLoadedFromCache'
                    });
                    setIsGenerating(false);
                    return true;
                }
                // If no cached subtitles found, clear the timeline for fresh generation
                console.log('[Subtitle Generation] No cached subtitles found, clearing timeline for fresh generation');
                setSubtitlesData(null);
            } else if (segment) {
                console.log('[Subtitle Generation] Skipping cache check for segment processing - generating fresh subtitles');
                // For segment processing, keep existing subtitles (don't clear)
            } else {
                // No cache ID available, clear timeline for fresh generation
                console.log('[Subtitle Generation] No cache ID available, clearing timeline for fresh generation');
                setSubtitlesData(null);
            }

            // Generate new subtitles
            let subtitles;

            // Check if this is segment processing
            if (segment) {
                console.log('[Subtitle Generation] Processing specific segment with streaming:', segment);

                // CRITICAL: Ensure cache ID is properly set BEFORE triggering save
                if (inputType === 'file-upload') {
                    // Check if this is a downloaded video (has current_video_url) or a true file upload
                    const currentVideoUrl = localStorage.getItem('current_video_url');

                    if (currentVideoUrl) {
                        // This is a downloaded video - use URL-based cache ID for subtitle caching
                        console.log('[Subtitle Generation] Downloaded video detected, using URL-based cache ID for subtitles');
                        // The URL-based cache ID is already set in the main cache ID generation above
                    } else {
                        // This is a true file upload - use file-based cache ID
                        let cacheId = localStorage.getItem('current_file_cache_id');
                        if (!cacheId) {
                            // Generate and store cache ID if not already set
                            cacheId = await generateFileCacheId(input);
                            localStorage.setItem('current_file_cache_id', cacheId);
                            console.log('[Subtitle Generation] Generated file cache ID for uploaded file:', cacheId);
                        } else {
                            console.log('[Subtitle Generation] Using existing file cache ID for uploaded file:', cacheId);
                        }
                    }
                }

                // FIRST: Trigger save to preserve any manual edits before processing starts
                // Use a Promise to wait for the save to actually complete
                await new Promise((resolve) => {
                    const handleSaveComplete = (event) => {
                        if (event.detail?.source === 'segment-processing-start') {
                            window.removeEventListener('save-complete', handleSaveComplete);
                            resolve();
                        }
                    };

                    window.addEventListener('save-complete', handleSaveComplete);

                    // Trigger the save
                    window.dispatchEvent(new CustomEvent('save-before-update', {
                        detail: {
                            source: 'segment-processing-start',
                            segment: segment
                        }
                    }));

                    // Fallback timeout in case save doesn't complete
                    setTimeout(() => {
                        window.removeEventListener('save-complete', handleSaveComplete);
                        resolve();
                    }, 2000);
                });

                // Import the streaming segment processing function and subtitle merger
                const { processSegmentWithStreaming } = await import('../utils/videoProcessing/processingUtils');
                const { mergeSegmentSubtitles, mergeStreamingSubtitlesProgressively } = await import('../utils/subtitle/subtitleMerger');

                // IMPORTANT: Load the saved state from cache AFTER save completes
                // This ensures we merge with the saved state (including manual edits), not the old React state
                let currentSubtitles = [];
                try {
                    // Determine which cache ID to use based on whether this is a downloaded video or uploaded file
                    const currentVideoUrl = localStorage.getItem('current_video_url');
                    let cacheIdToUse = null;

                    if (currentVideoUrl) {
                        // Downloaded video - use URL-based cache ID
                        cacheIdToUse = await generateUrlBasedCacheId(currentVideoUrl);
                        console.log('[Subtitle Generation] Using URL-based cache ID for downloaded video:', cacheIdToUse);
                    } else {
                        // Uploaded file - use file-based cache ID
                        cacheIdToUse = localStorage.getItem('current_file_cache_id');
                        console.log('[Subtitle Generation] Using file-based cache ID for uploaded file:', cacheIdToUse);
                    }

                    if (cacheIdToUse) {
                        const response = await fetch(`http://localhost:3031/api/subtitle-exists/${cacheIdToUse}`);
                        const result = await response.json();
                        if (result.exists && result.subtitles) {
                            currentSubtitles = result.subtitles;
                            console.log('[Subtitle Generation] Loaded saved state from cache for merging:', currentSubtitles.length, 'subtitles');
                        } else {
                            console.warn('[Subtitle Generation] Could not load saved state, falling back to React state');
                            setSubtitlesData(current => {
                                currentSubtitles = current || [];
                                return current;
                            });
                        }
                    } else {
                        console.warn('[Subtitle Generation] No cache ID found, using React state');
                        setSubtitlesData(current => {
                            currentSubtitles = current || [];
                            return current;
                        });
                    }
                } catch (error) {
                    console.error('[Subtitle Generation] Error loading saved state:', error);
                    setSubtitlesData(current => {
                        currentSubtitles = current || [];
                        return current;
                    });
                }

                console.log('[Subtitle Generation] Before streaming (using saved state):', {
                    existingCount: currentSubtitles.length,
                    segmentRange: `${segment.start}s - ${segment.end}s`,
                    existingSubtitles: currentSubtitles.map(s => `${s.start}-${s.end}: ${s.text.substring(0, 20)}...`)
                });

                // Process the specific segment with streaming
                const segmentSubtitles = await processSegmentWithStreaming(
                    input,
                    segment,
                    {
                        fps,
                        mediaResolution,
                        model,
                        userProvidedSubtitles
                    },
                    setStatus,
                    (streamingSubtitles, isStreaming) => {
                        // Real-time subtitle updates during streaming
                        if (streamingSubtitles && streamingSubtitles.length > 0) {
                            console.log(`[Subtitle Generation] Streaming update: ${streamingSubtitles.length} subtitles`);

                            // Capture state before progressive merging for undo/redo
                            window.dispatchEvent(new CustomEvent('capture-before-merge', {
                                detail: {
                                    type: 'progressive-merge',
                                    source: 'streaming-update',
                                    segment: segment
                                }
                            }));

                            // Use progressive merging for streaming updates (clears left to right)
                            const mergedStreamingSubtitles = mergeStreamingSubtitlesProgressively(currentSubtitles, streamingSubtitles, segment);

                            // Update the UI with streaming results
                            setSubtitlesData(mergedStreamingSubtitles);

                            // Update status to show streaming progress
                            if (isStreaming) {
                                setStatus({
                                    message: `Streaming... ${streamingSubtitles.length} subtitles generated for segment`,
                                    type: 'loading'
                                });
                            }
                        }
                    },
                    t
                );

                console.log('[Subtitle Generation] Streaming complete:', {
                    newSegmentCount: segmentSubtitles.length,
                    segmentRange: `${segment.start}s - ${segment.end}s`
                });

                // Capture state before final merging for undo/redo
                window.dispatchEvent(new CustomEvent('capture-before-merge', {
                    detail: {
                        type: 'final-merge',
                        source: 'streaming-complete',
                        segment: segment
                    }
                }));

                // Final merge with existing subtitles
                subtitles = mergeSegmentSubtitles(currentSubtitles, segmentSubtitles, segment);

                console.log('[Subtitle Generation] Final merge:', {
                    totalCount: subtitles.length,
                    mergedSubtitles: subtitles.map(s => `${s.start}-${s.end}: ${s.text.substring(0, 20)}...`)
                });
            }
            // Check if this is a long media file (video or audio) that needs special processing
            else if (input.type && (input.type.startsWith('video/') || input.type.startsWith('audio/'))) {
                try {
                    const duration = await getVideoDuration(input);
                    // eslint-disable-next-line no-unused-vars
                    const durationMinutes = Math.floor(duration / 60);

                    // Determine if this is a video or audio file
                    const isAudio = input.type.startsWith('audio/');
                    // eslint-disable-next-line no-unused-vars
                    const mediaType = isAudio ? 'audio' : 'video';

                    // Debug log to see the media duration


                    // Check if we have segment-based processing options
                    if (segment && fps && mediaResolution && model) {
                        // Use new segment-based processing with Files API
                        subtitles = await processSegmentWithFilesApi(input, segment, {
                            fps,
                            mediaResolution,
                            model,
                            userProvidedSubtitles
                        }, setStatus, t);
                    } else {
                        // Use the existing smart processing function
                        subtitles = await processMediaFile(input, setStatus, t, { userProvidedSubtitles });
                    }
                } catch (error) {
                    console.error('Error checking media duration:', error);
                    // Fallback to normal processing
                    subtitles = await callGeminiApi(input, inputType, { userProvidedSubtitles });
                }
            } else {
                // Normal processing for YouTube
                subtitles = await callGeminiApi(input, inputType, { userProvidedSubtitles });
            }

            // For segment processing, the final result is already set during streaming
            // For non-segment processing, trigger save before updating with new results
            if (segment) {
                // For segment processing, just update the final result
                // (the save was already triggered before streaming started)
                setSubtitlesData(subtitles);

                // Auto-save after streaming completion to preserve the new results
                if (subtitles && subtitles.length > 0) {
                    setTimeout(() => {
                        console.log('[Subtitle Generation] Triggering auto-save after streaming completion');
                        window.dispatchEvent(new CustomEvent('save-after-streaming', {
                            detail: {
                                source: 'streaming-complete',
                                subtitles: subtitles,
                                segment: segment
                            }
                        }));
                    }, 500); // Wait a bit for UI to update with final results
                }
            } else {
                // For non-segment processing, trigger save before updating with new results
                if (subtitles && subtitles.length > 0) {
                    // First, trigger save of current state to preserve any manual edits
                    window.dispatchEvent(new CustomEvent('save-before-update', {
                        detail: {
                            source: 'video-processing-complete',
                            newSubtitles: subtitles
                        }
                    }));

                    // Wait a moment for the save to complete, then update with new results
                    setTimeout(() => {
                        setSubtitlesData(subtitles);
                    }, 300);
                } else {
                    // If no subtitles, just update normally
                    setSubtitlesData(subtitles);
                }
            }

            // Cache the results - but don't cache segment results with the full file cache ID
            if (cacheId && subtitles && subtitles.length > 0 && !segment) {
                await saveSubtitlesToCache(cacheId, subtitles);
            } else if (segment) {
                console.log('[Subtitle Generation] Skipping cache save for segment processing - not overwriting full file cache');
            }

            // Check if using a strong model (Gemini 2.5 Pro or Gemini 2.0 Flash Thinking)
            const currentModel = localStorage.getItem('gemini_model') || 'gemini-2.0-flash';
            const strongModels = ['gemini-2.5-pro', 'gemini-2.0-flash-thinking-exp-01-21'];
            const isUsingStrongModel = strongModels.includes(currentModel);

            // Show different success message based on model
            if (isUsingStrongModel && (!subtitles || subtitles.length === 0)) {
                setStatus({ message: t('output.strongModelSuccess'), type: 'warning' });
            } else {
                setStatus({ message: t('output.generationSuccess'), type: 'success' });
            }
            return true;
        } catch (error) {
            console.error('Error generating subtitles:', error);
            try {
                // Check for specific Gemini API errors
                if (error.message && (
                    (error.message.includes('503') && error.message.includes('Service Unavailable')) ||
                    error.message.includes('The model is overloaded')
                )) {
                    // Use specific 503 error message if it's a 503 error
                    const is503Error = error.message.includes('503');
                    const errorMessage = is503Error
                        ? t('errors.geminiServiceUnavailable', 'Gemini is currently overloaded, please wait and try again later (error code 503)')
                        : t('errors.geminiOverloaded', 'Strong model tends to get overloaded, please consider using other model and try again, or try lower the segment duration. Or create a new Google Cloud Project and get an API Key.');
                    setStatus({ message: errorMessage, type: 'error' });
                } else if (error.message && error.message.includes('token') && error.message.includes('exceeds the maximum')) {
                    setStatus({ message: t('errors.tokenLimitExceeded'), type: 'error' });
                } else if (error.message && error.message.includes('File size') && error.message.includes('exceeds the recommended maximum')) {
                    // Extract file size and max size from error message
                    const sizeMatch = error.message.match(/(\d+)MB\) exceeds the recommended maximum of (\d+)MB/);
                    if (sizeMatch && sizeMatch.length >= 3) {
                        const size = sizeMatch[1];
                        const maxSize = sizeMatch[2];
                        setStatus({
                            message: t('errors.fileSizeTooLarge', 'File size ({{size}}MB) exceeds the recommended maximum of {{maxSize}}MB. Please use a smaller file or lower quality video.', { size, maxSize }),
                            type: 'error'
                        });
                    } else {
                        setStatus({ message: error.message, type: 'error' });
                    }
                } else {
                    const errorData = JSON.parse(error.message);
                    if (errorData.type === 'unrecognized_format') {
                        setStatus({
                            message: `${errorData.message}\n\nRaw text from Gemini:\n${errorData.rawText}`,
                            type: 'error'
                        });
                    } else {
                        setStatus({ message: `Error: ${error.message}`, type: 'error' });
                    }
                }
            } catch {
                // Check for specific Gemini API errors in the catch block too
                if (error.message && (
                    (error.message.includes('503') && error.message.includes('Service Unavailable')) ||
                    error.message.includes('The model is overloaded')
                )) {
                    // Use specific 503 error message if it's a 503 error
                    const is503Error = error.message.includes('503');
                    const errorMessage = is503Error
                        ? t('errors.geminiServiceUnavailable', 'Gemini is currently overloaded, please wait and try again later (error code 503)')
                        : t('errors.geminiOverloaded', 'Strong model tends to get overloaded, please consider using other model and try again, or try lower the segment duration. Or create a new Google Cloud Project and get an API Key.');
                    setStatus({ message: errorMessage, type: 'error' });
                } else if (error.message && error.message.includes('token') && error.message.includes('exceeds the maximum')) {
                    setStatus({ message: t('errors.tokenLimitExceeded'), type: 'error' });
                } else if (error.message && error.message.includes('File size') && error.message.includes('exceeds the recommended maximum')) {
                    // Extract file size and max size from error message
                    const sizeMatch = error.message.match(/(\d+)MB\) exceeds the recommended maximum of (\d+)MB/);
                    if (sizeMatch && sizeMatch.length >= 3) {
                        const size = sizeMatch[1];
                        const maxSize = sizeMatch[2];
                        setStatus({
                            message: t('errors.fileSizeTooLarge', 'File size ({{size}}MB) exceeds the recommended maximum of {{maxSize}}MB. Please use a smaller file or lower quality video.', { size, maxSize }),
                            type: 'error'
                        });
                    } else {
                        setStatus({ message: error.message, type: 'error' });
                    }
                } else {
                    setStatus({ message: `Error: ${error.message}`, type: 'error' });
                }
            }
            return false;
        } finally {
            setIsGenerating(false);
        }
    }, [t]);

    const retryGeneration = useCallback(async (input, inputType, apiKeysSet, options = {}) => {
        // Extract options
        const { userProvidedSubtitles } = options;
        if (!apiKeysSet.gemini) {
            setStatus({ message: t('errors.apiKeyRequired'), type: 'error' });
            return false;
        }

        // Reset the force stop flag when retrying generation
        setProcessingForceStopped(false);

        setIsGenerating(true);
        setStatus({ message: 'Retrying request to Gemini. This may take a few minutes...', type: 'loading' });

        try {
            let subtitles;

            // Check if this is a long media file (video or audio) that needs special processing
            if (input.type && (input.type.startsWith('video/') || input.type.startsWith('audio/'))) {
                try {
                    const duration = await getVideoDuration(input);
                    // eslint-disable-next-line no-unused-vars
                    const durationMinutes = Math.floor(duration / 60);

                    // Determine if this is a video or audio file
                    const isAudio = input.type.startsWith('audio/');
                    // eslint-disable-next-line no-unused-vars
                    const mediaType = isAudio ? 'audio' : 'video';

                    // Debug log to see the media duration


                    // Use the new smart processing function that chooses between simplified and legacy
                    subtitles = await processMediaFile(input, setStatus, t, { userProvidedSubtitles });
                } catch (error) {
                    console.error('Error checking media duration:', error);
                    // Fallback to normal processing
                    subtitles = await callGeminiApi(input, inputType, { userProvidedSubtitles });
                }
            } else {
                // Normal processing for YouTube
                subtitles = await callGeminiApi(input, inputType, { userProvidedSubtitles });
            }

            setSubtitlesData(subtitles);

            // Cache the new results using unified approach
            const currentVideoUrl = localStorage.getItem('current_video_url');
            let cacheId = null;

            if (inputType === 'youtube' || currentVideoUrl) {
                // Use unified URL-based caching
                const urlToUse = inputType === 'youtube' ? input : currentVideoUrl;
                cacheId = await generateUrlBasedCacheId(urlToUse);

                if (cacheId && subtitles && subtitles.length > 0) {
                    await saveSubtitlesToCache(cacheId, subtitles);
                }

                // Set cache ID for both stores
                setRulesCacheId(cacheId);
                setSubtitlesCacheId(cacheId);

            } else if (inputType === 'file-upload') {
                // For actual file uploads, use file-based cache ID
                cacheId = await generateFileCacheId(input);
                localStorage.setItem('current_file_cache_id', cacheId);

                if (cacheId && subtitles && subtitles.length > 0) {
                    await saveSubtitlesToCache(cacheId, subtitles);
                }

                // Set cache ID for both stores
                setRulesCacheId(cacheId);
                setSubtitlesCacheId(cacheId);

            }

            // Check if using a strong model (Gemini 2.5 Pro or Gemini 2.0 Flash Thinking)
            const currentModel = localStorage.getItem('gemini_model') || 'gemini-2.0-flash';
            const strongModels = ['gemini-2.5-pro', 'gemini-2.0-flash-thinking-exp-01-21'];
            const isUsingStrongModel = strongModels.includes(currentModel);

            // Show different success message based on model
            if (isUsingStrongModel && (!subtitles || subtitles.length === 0)) {
                setStatus({ message: t('output.strongModelSuccess'), type: 'warning' });
            } else {
                setStatus({ message: t('output.generationSuccess'), type: 'success' });
            }
            return true;
        } catch (error) {
            console.error('Error regenerating subtitles:', error);

            // Check for specific Gemini API errors
            if (error.message && (
                (error.message.includes('503') && error.message.includes('Service Unavailable')) ||
                error.message.includes('The model is overloaded')
            )) {
                // Use specific 503 error message if it's a 503 error
                const is503Error = error.message.includes('503');
                const errorMessage = is503Error
                    ? t('errors.geminiServiceUnavailable', 'Gemini is currently overloaded, please wait and try again later (error code 503)')
                    : t('errors.geminiOverloaded', 'Strong model tends to get overloaded, please consider using other model and try again, or try lower the segment duration. Or create a new Google Cloud Project and get an API Key.');
                setStatus({ message: errorMessage, type: 'error' });
            } else if (error.message && error.message.includes('token') && error.message.includes('exceeds the maximum')) {
                setStatus({ message: t('errors.tokenLimitExceeded'), type: 'error' });
            } else if (error.message && error.message.includes('File size') && error.message.includes('exceeds the recommended maximum')) {
                // Extract file size and max size from error message
                const sizeMatch = error.message.match(/(\d+)MB\) exceeds the recommended maximum of (\d+)MB/);
                if (sizeMatch && sizeMatch.length >= 3) {
                    const size = sizeMatch[1];
                    const maxSize = sizeMatch[2];
                    setStatus({
                        message: t('errors.fileSizeTooLarge', 'File size ({{size}}MB) exceeds the recommended maximum of {{maxSize}}MB. Please use a smaller file or lower quality video.', { size, maxSize }),
                        type: 'error'
                    });
                } else {
                    setStatus({ message: error.message, type: 'error' });
                }
            } else {
                setStatus({ message: `Error: ${error.message}`, type: 'error' });
            }
            return false;
        } finally {
            setIsGenerating(false);
        }
    }, [t]);

    // State to track which segments are currently being retried is defined at the top of the hook

    // Function to retry a specific segment
    const retrySegment = useCallback(async (segmentIndex, segments, options = {}) => {
        // Extract options
        const { modelId } = options;

        if (modelId) {
            console.log(`[RetrySegment] Using custom model for segment ${segmentIndex + 1}: ${modelId}`);
        } else {
            console.log(`[RetrySegment] Using default model for segment ${segmentIndex + 1}`);
        }

        // Mark this segment as retrying temporarily
        setRetryingSegments(prev => [...prev, segmentIndex]);

        try {
            // Segment retry is deprecated - show error message instead
            setStatus({
                message: t('errors.segmentRetryDeprecated', 'Segment retry is deprecated. Please use the new workflow: upload your video and select segments on the timeline for processing.'),
                type: 'error'
            });

            // Remove this segment from the retrying list since we're not actually retrying
            setRetryingSegments(prev => prev.filter(idx => idx !== segmentIndex));

            return false;
        } catch (error) {
            console.error('Error retrying segment:', error);

            // Update the segment status to show the error
            const errorStatus = {
                index: segmentIndex,
                status: 'error',
                message: error.message || t('output.processingFailed', 'Processing failed'),
                shortMessage: t('output.failed', 'Failed')
            };
            const errorEvent = new CustomEvent('segmentStatusUpdate', { detail: [errorStatus] });
            window.dispatchEvent(errorEvent);

            // Show error message
            setStatus({
                message: `${t('errors.segmentRetryFailed', 'Failed to retry segment {{segmentNumber}}', { segmentNumber: segmentIndex + 1 })}: ${error.message}`,
                type: 'error'
            });
            return false;
        } finally {
            // Remove this segment from the retrying list
            setRetryingSegments(prev => prev.filter(idx => idx !== segmentIndex));
        }
    }, [subtitlesData, t]);



    return {
        subtitlesData,
        setSubtitlesData,
        status,
        setStatus,
        isGenerating,
        generateSubtitles,
        retryGeneration,
        updateSegmentsStatus,
        retrySegment,
        retryingSegments
    };
};

export default useSubtitles;
export { generateUrlBasedCacheId };