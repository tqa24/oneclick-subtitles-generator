import { useState, useCallback } from 'react';
import { callGeminiApi } from '../services/geminiService';
import { preloadYouTubeVideo } from '../utils/videoPreloader';
import { generateFileCacheId } from '../utils/cacheUtils';
import { extractYoutubeVideoId } from '../utils/videoDownloader';

export const useSubtitles = (t) => {
    const [subtitlesData, setSubtitlesData] = useState(null);
    const [status, setStatus] = useState({ message: '', type: '' });
    const [isGenerating, setIsGenerating] = useState(false);

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
            const subtitles = await callGeminiApi(input, inputType);
            setSubtitlesData(subtitles);
            
            // Cache the results
            if (cacheId && subtitles && subtitles.length > 0) {
                await saveSubtitlesToCache(cacheId, subtitles);
            }
            
            setStatus({ message: t('output.generationSuccess'), type: 'success' });
            return true;
        } catch (error) {
            console.error('Error generating subtitles:', error);
            try {
                const errorData = JSON.parse(error.message);
                if (errorData.type === 'unrecognized_format') {
                    setStatus({
                        message: `${errorData.message}\n\nRaw text from Gemini:\n${errorData.rawText}`,
                        type: 'error'
                    });
                } else {
                    setStatus({ message: `Error: ${error.message}`, type: 'error' });
                }
            } catch {
                setStatus({ message: `Error: ${error.message}`, type: 'error' });
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
            const subtitles = await callGeminiApi(input, inputType);
            setSubtitlesData(subtitles);
            
            // Cache the new results
            if (inputType === 'youtube') {
                const cacheId = extractYoutubeVideoId(input);
                if (cacheId && subtitles && subtitles.length > 0) {
                    await saveSubtitlesToCache(cacheId, subtitles);
                }
            }
            
            setStatus({ message: t('output.generationSuccess'), type: 'success' });
            return true;
        } catch (error) {
            console.error('Error regenerating subtitles:', error);
            setStatus({ message: `Error: ${error.message}`, type: 'error' });
            return false;
        } finally {
            setIsGenerating(false);
        }
    }, [t]);

    return {
        subtitlesData,
        setSubtitlesData,
        status,
        setStatus,
        isGenerating,
        generateSubtitles,
        retryGeneration
    };
};