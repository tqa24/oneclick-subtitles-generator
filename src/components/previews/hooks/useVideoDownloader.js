import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { extractAndDownloadAudio } from '../../../utils/fileUtils';
import { renderSubtitlesToVideo, downloadVideo } from '../../../utils/videoUtils';
import { convertTimeStringToSeconds } from '../../../utils/vttUtils';

/**
 * Custom hook for managing video downloads, audio extraction, and video rendering
 * @param {string} videoUrl - Current video URL
 * @param {string} videoSource - Original video source
 * @param {array} subtitlesArray - Original subtitles
 * @param {array} translatedSubtitles - Translated subtitles
 * @param {object} subtitleSettings - Subtitle configuration
 * @returns {object} Download state and handlers
 */
export const useVideoDownloader = (videoUrl, videoSource, subtitlesArray, translatedSubtitles, subtitleSettings) => {
  const { t } = useTranslation();
  
  // Download states
  const [isAudioDownloading, setIsAudioDownloading] = useState(false);
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);

  // Handle audio download
  const handleDownloadAudio = useCallback(async () => {
    if (!videoUrl) {
      console.error('No video URL available for audio extraction');
      return;
    }

    setIsAudioDownloading(true);
    
    try {
      await extractAndDownloadAudio(videoUrl);
    } catch (error) {
      console.error('Error downloading audio:', error);
    } finally {
      setIsAudioDownloading(false);
    }
  }, [videoUrl]);

  // Handle downloading video with original subtitles
  const handleDownloadWithSubtitles = useCallback(async () => {
    if (!videoUrl || !subtitlesArray || subtitlesArray.length === 0) {
      console.error('No video URL or subtitles available for rendering');
      return;
    }

    setIsRenderingVideo(true);
    setRenderProgress(0);

    try {
      const renderedVideoUrl = await renderSubtitlesToVideo(
        videoUrl,
        subtitlesArray,
        subtitleSettings,
        (progress) => setRenderProgress(progress)
      );

      // Get video title or use default
      const videoTitle = videoSource?.title || 'video-with-subtitles';
      downloadVideo(renderedVideoUrl, `${videoTitle}.webm`);
    } catch (err) {
      console.error('Error rendering subtitles:', err);
      throw new Error(t('videoPreview.renderError', 'Error rendering subtitles: {{error}}', { error: err.message }));
    } finally {
      setIsRenderingVideo(false);
    }
  }, [videoUrl, subtitlesArray, subtitleSettings, videoSource, t]);

  // Handle downloading video with translated subtitles
  const handleDownloadWithTranslatedSubtitles = useCallback(async () => {
    if (!videoUrl || !translatedSubtitles || translatedSubtitles.length === 0) {
      console.error('No video URL or translated subtitles available');
      return;
    }

    setIsRenderingVideo(true);
    setRenderProgress(0);

    try {
      // Convert translatedSubtitles to the format expected by renderSubtitlesToVideo
      // Use original subtitle timings when available
      const formattedSubtitles = translatedSubtitles.map(sub => {
        // If this subtitle has an originalId, find the corresponding original subtitle
        if (sub.originalId && subtitlesArray) {
          const originalSub = subtitlesArray.find(s => s.id === sub.originalId);
          if (originalSub) {
            // Use the original subtitle's timing
            return {
              id: sub.id,
              start: originalSub.start,
              end: originalSub.end,
              text: sub.text
            };
          }
        }

        // If the subtitle already has start/end properties, use them
        if (sub.start !== undefined && sub.end !== undefined) {
          return sub;
        }

        // Otherwise, convert from startTime/endTime format
        return {
          id: sub.id,
          start: typeof sub.startTime === 'string' ? convertTimeStringToSeconds(sub.startTime) : 0,
          end: typeof sub.endTime === 'string' ? convertTimeStringToSeconds(sub.endTime) : 0,
          text: sub.text
        };
      });

      const renderedVideoUrl = await renderSubtitlesToVideo(
        videoUrl,
        formattedSubtitles,
        subtitleSettings,
        (progress) => setRenderProgress(progress)
      );

      // Get video title or use default
      const videoTitle = videoSource?.title || 'video-with-translated-subtitles';
      downloadVideo(renderedVideoUrl, `${videoTitle}.webm`);
    } catch (err) {
      console.error('Error rendering translated subtitles:', err);
      throw new Error(t('videoPreview.renderError', 'Error rendering subtitles: {{error}}', { error: err.message }));
    } finally {
      setIsRenderingVideo(false);
    }
  }, [videoUrl, translatedSubtitles, subtitlesArray, subtitleSettings, videoSource, t]);

  // Handle narration refresh
  const handleRefreshNarration = useCallback(async (setIsRefreshingNarration) => {
    try {
      // Set refreshing state to show loading overlay
      setIsRefreshingNarration(true);

      // Get narrations from window object
      const isUsingGroupedSubtitles = window.useGroupedSubtitles || false;
      const groupedNarrations = window.groupedNarrations || [];
      const originalNarrations = window.originalNarrations || [];

      // Use grouped narrations if available and enabled, otherwise use original narrations
      const narrations = (isUsingGroupedSubtitles && groupedNarrations.length > 0)
        ? groupedNarrations
        : originalNarrations;

      console.log(`Using ${isUsingGroupedSubtitles ? 'grouped' : 'original'} narrations for alignment. Found ${narrations.length} narrations.`);

      // Check if we have any narration results
      if (!narrations || narrations.length === 0) {
        console.error('No narration results available in window objects');

        // Try to reconstruct narration results from the file system
        const allSubtitles = window.subtitlesData || window.originalSubtitles || [];

        if (allSubtitles.length === 0) {
          console.error('No subtitles available to reconstruct narrations');
          throw new Error('No narration results or subtitles available for alignment');
        }

        // Reconstruct narrations from subtitles
        const reconstructedNarrations = allSubtitles.map(subtitle => ({
          id: subtitle.id,
          text: subtitle.text,
          start: subtitle.start,
          end: subtitle.end,
          success: false, // Mark as not having audio file
          filename: null,
          error: 'Audio file not found - please regenerate narrations'
        }));

        console.log('Reconstructed narrations from subtitles:', reconstructedNarrations.length);
        
        // Store reconstructed narrations
        window.originalNarrations = reconstructedNarrations;
        localStorage.setItem('originalNarrations', JSON.stringify(reconstructedNarrations));
      }

      // Trigger narration alignment process
      if (typeof window.alignNarrationWithVideo === 'function') {
        console.log('Calling window.alignNarrationWithVideo');
        await window.alignNarrationWithVideo();
      } else {
        console.warn('window.alignNarrationWithVideo function not available');
        throw new Error('Narration alignment function not available');
      }

    } catch (error) {
      console.error('Error refreshing narration:', error);
      throw error;
    }
  }, []);

  return {
    // State
    isAudioDownloading,
    isRenderingVideo,
    renderProgress,
    
    // Actions
    handleDownloadAudio,
    handleDownloadWithSubtitles,
    handleDownloadWithTranslatedSubtitles,
    handleRefreshNarration,
    
    // Computed
    canDownloadAudio: !!videoUrl,
    canRenderSubtitles: !!(videoUrl && subtitlesArray && subtitlesArray.length > 0),
    canRenderTranslatedSubtitles: !!(videoUrl && translatedSubtitles && translatedSubtitles.length > 0)
  };
};
