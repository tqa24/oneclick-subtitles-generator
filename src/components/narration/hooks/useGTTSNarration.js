import React, { useCallback, useState } from 'react';
import { SERVER_URL } from '../../../config';

/**
 * Custom hook for gTTS narration generation
 * @param {Object} params - Parameters
 * @param {Function} params.setIsGenerating - Function to set generating state
 * @param {Function} params.setGenerationStatus - Function to set generation status
 * @param {Function} params.setError - Function to set error message
 * @param {Function} params.setGenerationResults - Function to set generation results
 * @param {Array} params.generationResults - Current generation results
 * @param {string} params.subtitleSource - Selected subtitle source
 * @param {Array} params.originalSubtitles - Original subtitles
 * @param {Array} params.translatedSubtitles - Translated subtitles
 * @param {Array} params.subtitles - Fallback subtitles
 * @param {Object} params.originalLanguage - Original language
 * @param {Object} params.translatedLanguage - Translated language
 * @param {string} params.selectedLanguage - Selected gTTS language
 * @param {string} params.tld - Top-level domain for accent
 * @param {boolean} params.slow - Whether to speak slowly
 * @param {Function} params.t - Translation function
 * @param {Function} params.setRetryingSubtitleId - Function to set retrying subtitle ID
 * @returns {Object} - gTTS narration handlers
 */
const useGTTSNarration = ({
  setIsGenerating,
  setGenerationStatus,
  setError,
  setGenerationResults,
  generationResults,
  subtitleSource,
  originalSubtitles,
  translatedSubtitles,
  subtitles,
  originalLanguage,
  translatedLanguage,
  selectedLanguage,
  tld,
  slow,
  t,
  setRetryingSubtitleId
}) => {
  const [abortController, setAbortController] = useState(null);

  /**
   * Get the appropriate subtitles based on source
   */
  const getSubtitlesForGeneration = useCallback(() => {
    if (subtitleSource === 'original' && originalSubtitles?.length > 0) {
      return originalSubtitles;
    } else if (subtitleSource === 'translated' && translatedSubtitles?.length > 0) {
      return translatedSubtitles;
    } else if (subtitles?.length > 0) {
      return subtitles;
    }
    return [];
  }, [subtitleSource, originalSubtitles, translatedSubtitles, subtitles]);

  /**
   * Handle gTTS narration generation
   */
  const handleGTTSNarration = useCallback(async () => {
    const subtitlesToProcess = getSubtitlesForGeneration();
    
    if (!subtitlesToProcess || subtitlesToProcess.length === 0) {
      setError(t('narration.noSubtitlesError', 'No subtitles available for narration generation.'));
      return;
    }

    if (!selectedLanguage) {
      setError(t('narration.noLanguageSelectedError', 'Please select a language for gTTS.'));
      return;
    }

    try {
      setIsGenerating(true);
      setError('');
      setGenerationResults([]);
      
      const controller = new AbortController();
      setAbortController(controller);

      const settings = {
        lang: selectedLanguage,
        tld: tld || 'com',
        slow: slow || false
      };

      const requestBody = {
        subtitles: subtitlesToProcess,
        settings: settings
      };

      setGenerationStatus(t('narration.gttsGeneratingProgress', 'Starting gTTS generation...'));

      const response = await fetch(`${SERVER_URL}/api/narration/gtts/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const results = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.status === 'started') {
                setGenerationStatus(t('narration.gttsGeneratingProgress', 'Generating {{current}} of {{total}} narrations with gTTS...', {
                  current: 1,
                  total: data.total
                }));
              } else if (data.status === 'progress') {
                setGenerationStatus(t('narration.gttsGeneratingProgress', 'Generating {{current}} of {{total}} narrations with gTTS...', {
                  current: data.current,
                  total: data.total
                }));
                
                if (data.result) {
                  results.push(data.result);
                  setGenerationResults([...results]);
                }
              } else if (data.status === 'error') {
                if (data.result) {
                  results.push(data.result);
                  setGenerationResults([...results]);
                }
              } else if (data.status === 'completed') {
                setGenerationResults(data.results || results);
                setGenerationStatus(t('narration.gttsGenerationComplete', 'gTTS narration generation completed successfully!'));
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', parseError);
            }
          }
        }
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        setGenerationStatus(t('narration.gttsGenerationCancelled', 'gTTS generation cancelled'));
      } else {
        console.error('gTTS generation error:', error);
        setError(t('narration.gttsGenerationError', 'Error generating gTTS narration: {{error}}', { error: error.message }));
      }
    } finally {
      setIsGenerating(false);
      setAbortController(null);
    }
  }, [
    getSubtitlesForGeneration,
    selectedLanguage,
    tld,
    slow,
    setIsGenerating,
    setError,
    setGenerationResults,
    setGenerationStatus,
    t
  ]);

  /**
   * Cancel gTTS generation
   */
  const cancelGTTSGeneration = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setIsGenerating(false);
    setGenerationStatus(t('narration.gttsGenerationCancelled', 'gTTS generation cancelled'));
  }, [abortController, setIsGenerating, setGenerationStatus, t]);

  /**
   * Retry gTTS narration for a specific subtitle
   */
  const retryGTTSNarration = useCallback(async (subtitleId) => {
    const subtitlesToProcess = getSubtitlesForGeneration();
    const subtitle = subtitlesToProcess.find(sub => sub.id === subtitleId);
    
    if (!subtitle) {
      setError(t('narration.subtitleNotFoundError', 'Subtitle not found for retry.'));
      return;
    }

    if (!selectedLanguage) {
      setError(t('narration.noLanguageSelectedError', 'Please select a language for gTTS.'));
      return;
    }

    try {
      setRetryingSubtitleId(subtitleId);
      
      const settings = {
        lang: selectedLanguage,
        tld: tld || 'com',
        slow: slow || false
      };

      const requestBody = {
        subtitles: [subtitle],
        settings: settings
      };

      const response = await fetch(`${SERVER_URL}/api/narration/gtts/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.status === 'completed' && data.results?.length > 0) {
                const newResult = data.results[0];
                
                // Update the specific result in the generation results
                setGenerationResults(prev => 
                  prev.map(result => 
                    result.subtitle_id === subtitleId ? newResult : result
                  )
                );
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', parseError);
            }
          }
        }
      }

    } catch (error) {
      console.error('gTTS retry error:', error);
      setError(t('narration.gttsRetryError', 'Error retrying gTTS narration: {{error}}', { error: error.message }));
    } finally {
      setRetryingSubtitleId(null);
    }
  }, [
    getSubtitlesForGeneration,
    selectedLanguage,
    tld,
    slow,
    setError,
    setGenerationResults,
    setRetryingSubtitleId,
    t
  ]);

  /**
   * Retry all failed gTTS narrations
   */
  const retryFailedGTTSNarrations = useCallback(async () => {
    const failedResults = generationResults.filter(result => !result.success);
    
    if (failedResults.length === 0) {
      return;
    }

    const subtitlesToProcess = getSubtitlesForGeneration();
    const failedSubtitles = failedResults.map(result => 
      subtitlesToProcess.find(sub => sub.id === result.subtitle_id)
    ).filter(Boolean);

    if (failedSubtitles.length === 0) {
      setError(t('narration.noFailedSubtitlesError', 'No failed subtitles found for retry.'));
      return;
    }

    try {
      setIsGenerating(true);
      setError('');

      const settings = {
        lang: selectedLanguage,
        tld: tld || 'com',
        slow: slow || false
      };

      const requestBody = {
        subtitles: failedSubtitles,
        settings: settings
      };

      setGenerationStatus(t('narration.gttsRetryingFailed', 'Retrying failed gTTS narrations...'));

      const response = await fetch(`${SERVER_URL}/api/narration/gtts/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.status === 'progress' && data.result) {
                // Update the specific result in the generation results
                setGenerationResults(prev => 
                  prev.map(result => 
                    result.subtitle_id === data.result.subtitle_id ? data.result : result
                  )
                );
              } else if (data.status === 'completed') {
                setGenerationStatus(t('narration.gttsRetryComplete', 'gTTS retry completed!'));
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', parseError);
            }
          }
        }
      }

    } catch (error) {
      console.error('gTTS retry failed error:', error);
      setError(t('narration.gttsRetryFailedError', 'Error retrying failed gTTS narrations: {{error}}', { error: error.message }));
    } finally {
      setIsGenerating(false);
    }
  }, [
    generationResults,
    getSubtitlesForGeneration,
    selectedLanguage,
    tld,
    slow,
    setIsGenerating,
    setError,
    setGenerationResults,
    setGenerationStatus,
    t
  ]);

  return {
    handleGTTSNarration,
    cancelGTTSGeneration,
    retryGTTSNarration,
    retryFailedGTTSNarrations
  };
};

export default useGTTSNarration;
