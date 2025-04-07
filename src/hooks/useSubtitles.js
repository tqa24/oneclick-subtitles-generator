import { useState, useCallback } from 'react';
import { callGeminiApi } from '../services/geminiService';
import { preloadYouTubeVideo } from '../utils/videoPreloader';
import { generateFileCacheId } from '../utils/cacheUtils';
import { extractYoutubeVideoId } from '../utils/videoDownloader';
import { getVideoDuration, processLongVideo, retrySegmentProcessing } from '../utils/videoProcessor';

export const useSubtitles = (t) => {
    const [subtitlesData, setSubtitlesData] = useState(null);
    const [status, setStatus] = useState({ message: '', type: '' });
    const [isGenerating, setIsGenerating] = useState(false);

    // Function to update segment status and dispatch event
    const updateSegmentsStatus = useCallback((segments) => {
        // Dispatch custom event with segment status
        const event = new CustomEvent('segmentStatusUpdate', { detail: segments });
        window.dispatchEvent(event);
    }, []);

    const checkCachedSubtitles = async (cacheId) => {
        try {
            const response = await fetch(`http://localhost:3004/api/subtitle-exists/${cacheId}`);
            const data = await response.json();
            return data.exists ? data.subtitles : null;
        } catch (error) {
            console.error('Error checking subtitle cache:', error);
            return null;
        }
    };

    const saveSubtitlesToCache = async (cacheId, subtitles) => {
        try {
            const response = await fetch('http://localhost:3004/api/save-subtitles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    cacheId,
                    subtitles
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

    const generateSubtitles = useCallback(async (input, inputType, apiKeysSet) => {
        if (!apiKeysSet.gemini) {
            setStatus({ message: t('errors.apiKeyRequired'), type: 'error' });
            return false;
        }

        setIsGenerating(true);
        setStatus({ message: t('output.processingVideo'), type: 'loading' });
        setSubtitlesData(null);

        try {
            let cacheId = null;

            if (inputType === 'youtube') {
                cacheId = extractYoutubeVideoId(input);
                preloadYouTubeVideo(input);
            } else if (inputType === 'file-upload') {
                cacheId = await generateFileCacheId(input);

                // Check if this is a video file and get its duration
                if (input.type.startsWith('video/')) {
                    try {
                        const duration = await getVideoDuration(input);
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

            // Check cache
            if (cacheId) {
                const cachedSubtitles = await checkCachedSubtitles(cacheId);
                if (cachedSubtitles) {
                    setSubtitlesData(cachedSubtitles);
                    setStatus({ message: t('output.subtitlesLoadedFromCache'), type: 'success' });
                    setIsGenerating(false);
                    return true;
                }
            }

            // Generate new subtitles
            let subtitles;

            // Check if this is a long video that needs special processing
            if (input.type && input.type.startsWith('video/')) {
                try {
                    const duration = await getVideoDuration(input);
                    const durationMinutes = Math.floor(duration / 60);

                    // Debug log to see the video duration
                    console.log(`Video duration: ${duration} seconds, ${durationMinutes} minutes`);

                    // For testing purposes, always use segmentation
                    if (true) {
                        // Process long video by splitting it into segments
                        subtitles = await processLongVideo(input, setStatus, t);
                    } else {
                        // Process normally for shorter videos
                        subtitles = await callGeminiApi(input, inputType);
                    }
                } catch (error) {
                    console.error('Error checking video duration:', error);
                    // Fallback to normal processing
                    subtitles = await callGeminiApi(input, inputType);
                }
            } else {
                // Normal processing for non-video files or YouTube
                subtitles = await callGeminiApi(input, inputType);
            }

            setSubtitlesData(subtitles);

            // Cache the results
            if (cacheId && subtitles && subtitles.length > 0) {
                await saveSubtitlesToCache(cacheId, subtitles);
            }

            // Check if using a strong model (Gemini 2.5 Pro or Gemini 2.0 Flash Thinking)
            const currentModel = localStorage.getItem('gemini_model') || 'gemini-2.0-flash';
            const strongModels = ['gemini-2.5-pro-exp-03-25', 'gemini-2.0-flash-thinking-exp-01-21'];
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
                    setStatus({ message: t('errors.geminiOverloaded'), type: 'error' });
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
                    setStatus({ message: t('errors.geminiOverloaded'), type: 'error' });
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

    const retryGeneration = useCallback(async (input, inputType, apiKeysSet) => {
        if (!apiKeysSet.gemini) {
            setStatus({ message: t('errors.apiKeyRequired'), type: 'error' });
            return false;
        }

        setIsGenerating(true);
        setStatus({ message: 'Retrying request to Gemini. This may take a few minutes...', type: 'loading' });

        try {
            let subtitles;

            // Check if this is a long video that needs special processing
            if (input.type && input.type.startsWith('video/')) {
                try {
                    const duration = await getVideoDuration(input);
                    const durationMinutes = Math.floor(duration / 60);

                    if (durationMinutes > 30) {
                        // Process long video by splitting it into segments
                        subtitles = await processLongVideo(input, setStatus, t);
                    } else {
                        // Process normally for shorter videos
                        subtitles = await callGeminiApi(input, inputType);
                    }
                } catch (error) {
                    console.error('Error checking video duration:', error);
                    // Fallback to normal processing
                    subtitles = await callGeminiApi(input, inputType);
                }
            } else {
                // Normal processing for non-video files or YouTube
                subtitles = await callGeminiApi(input, inputType);
            }

            setSubtitlesData(subtitles);

            // Cache the new results
            if (inputType === 'youtube') {
                const cacheId = extractYoutubeVideoId(input);
                if (cacheId && subtitles && subtitles.length > 0) {
                    await saveSubtitlesToCache(cacheId, subtitles);
                }
            }

            // Check if using a strong model (Gemini 2.5 Pro or Gemini 2.0 Flash Thinking)
            const currentModel = localStorage.getItem('gemini_model') || 'gemini-2.0-flash';
            const strongModels = ['gemini-2.5-pro-exp-03-25', 'gemini-2.0-flash-thinking-exp-01-21'];
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
                setStatus({ message: t('errors.geminiOverloaded'), type: 'error' });
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

    // State to track which segments are currently being retried
    const [retryingSegments, setRetryingSegments] = useState([]);

    // Function to retry a specific segment
    const retrySegment = useCallback(async (segmentIndex, segments) => {
        // Initialize subtitlesData to empty array if it's null
        // This happens when using the strong model where we process segments one by one
        const currentSubtitles = subtitlesData || [];

        // Mark this segment as retrying
        setRetryingSegments(prev => [...prev, segmentIndex]);

        // Update the segment status to show it's retrying
        const retryingStatus = {
            index: segmentIndex,
            status: 'retrying',
            message: t('output.retryingSegment', 'Retrying segment...'),
            shortMessage: t('output.retrying', 'Retrying...')
        };
        const event = new CustomEvent('segmentStatusUpdate', { detail: [retryingStatus] });
        window.dispatchEvent(event);

        try {
            // Retry processing the specific segment
            const updatedSubtitles = await retrySegmentProcessing(
                segmentIndex,
                segments,
                currentSubtitles,
                (status) => {
                    // Only update the overall status if it's a success message
                    if (status.type === 'success') {
                        setStatus(status);
                    }
                },
                t
            );

            // Update the subtitles data with the new results
            setSubtitlesData(updatedSubtitles);

            // Show a brief success message
            // Check if we're generating a new segment or retrying an existing one
            const isGenerating = !subtitlesData || subtitlesData.length === 0;
            setStatus({
                message: isGenerating
                    ? t('output.segmentGenerateSuccess', 'Segment {{segmentNumber}} processed successfully and combined with existing subtitles', { segmentNumber: segmentIndex + 1 })
                    : t('output.segmentRetrySuccess', 'Segment {{segmentNumber}} reprocessed successfully', { segmentNumber: segmentIndex + 1 }),
                type: 'success'
            });
            return true;
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