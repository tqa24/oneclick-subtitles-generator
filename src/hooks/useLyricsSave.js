import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { EVENTS, publish, subscribe } from '../events/bus';
import { generateUrlBasedCacheId } from '../services/subtitleCache';

/**
 * Encapsulates saving lyrics to cache plus the save-before-update and
 * save-after-streaming event listeners (with cleanup). Closes over the
 * parent's lyrics state and update/save callbacks via params.
 */
export const useLyricsSave = ({ lyrics, updateSavedLyrics, onSaveSubtitles }) => {
  const { t } = useTranslation();

  // Function to save current subtitles to cache
  const handleSave = async () => {
    try {
      // Get the current video source
      const currentVideoUrl = localStorage.getItem('current_video_url');
      const currentFileUrl = localStorage.getItem('current_file_url');
      let cacheId = null;

      if (currentVideoUrl) {
        // For any video URL, use unified URL-based caching
        cacheId = await generateUrlBasedCacheId(currentVideoUrl);
      } else if (currentFileUrl) {
        // For uploaded files, the cacheId is already stored
        cacheId = localStorage.getItem('current_file_cache_id');
      }

      if (!cacheId) {
        console.error('No cache ID found for current media');
        return;
      }

      // Check if we have latest segment subtitles in localStorage
      let subtitlesToSave = lyrics;
      try {
        const latestSubtitles = localStorage.getItem('latest_segment_subtitles');
        if (latestSubtitles) {
          const parsedSubtitles = JSON.parse(latestSubtitles);
          if (Array.isArray(parsedSubtitles) && parsedSubtitles.length > 0) {
            subtitlesToSave = parsedSubtitles;
            // Clear the localStorage entry to avoid using it again
            localStorage.removeItem('latest_segment_subtitles');
          }
        }
      } catch (e) {
        console.error('Error parsing latest subtitles from localStorage:', e);
      }

      // Save to cache (server when available; local-only in FE-only)
      const { probeServerAvailability } = await import('../utils/serverEnv');
      let hasServer = false;
      try { hasServer = await probeServerAvailability(); } catch {}

      if (hasServer) {
        const response = await fetch('http://localhost:3031/api/save-subtitles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cacheId,
            subtitles: subtitlesToSave
          })
        });

        const result = await response.json();
        if (result.success) {
          // Show success toast using centralized system
          window.addToast(t('output.subtitlesSaved', 'Progress saved successfully'), 'success', 3000);

          // Update the saved lyrics state in the editor
          updateSavedLyrics();

          // Call the callback if provided to update parent component state
          if (onSaveSubtitles) {
            onSaveSubtitles(subtitlesToSave);
          }

          // Notify listeners
          window.dispatchEvent(new CustomEvent('subtitles-saved', { detail: { success: true } }));
          window.dispatchEvent(new CustomEvent('subtitle-timing-changed', {
            detail: { action: 'save', timestamp: Date.now(), subtitles: subtitlesToSave }
          }));
        } else {
          console.error('Failed to save subtitles:', result.error);
        }
      } else {
        // Frontend-only: simulate success (local state + events only)
        // Show success toast using centralized system
        window.addToast(t('output.subtitlesSaved', 'Progress saved successfully'), 'success', 3000);

        updateSavedLyrics();
        if (onSaveSubtitles) {
          onSaveSubtitles(subtitlesToSave);
        }
        window.dispatchEvent(new CustomEvent('subtitles-saved', { detail: { success: true } }));
        window.dispatchEvent(new CustomEvent('subtitle-timing-changed', {
          detail: { action: 'save', timestamp: Date.now(), subtitles: subtitlesToSave }
        }));
      }
    } catch (error) {
      console.error('Error saving subtitles:', error);
    }
  };

  // Listen for save-before-update events triggered before new video processing results
  useEffect(() => {
    const handleSaveBeforeUpdate = (event) => {


      // Handle both segment processing start and video processing complete
      const isSegmentStart = event.detail?.source === 'segment-processing-start';
      const isProcessingComplete = event.detail?.source === 'video-processing-complete';

      if (isSegmentStart || isProcessingComplete) {
        const action = isSegmentStart ? 'segment processing' : 'video processing completion';


        // Trigger the save function to checkpoint current edits
        handleSave().then(() => {

          // Update the saved state to gray out the save button
          updateSavedLyrics();

          // Dispatch save-complete event to notify that save is done
          publish(EVENTS.SAVE_COMPLETE, {
            source: event.detail?.source,
            success: true
          });
        }).catch((error) => {
          console.error(`[LyricsDisplay] Error during checkpoint save for ${action}:`, error);

          // Dispatch save-complete event even on error to prevent hanging
          publish(EVENTS.SAVE_COMPLETE, {
            source: event.detail?.source,
            success: false,
            error: error.message
          });
        });
      }
    };

  const unsubscribe = subscribe(EVENTS.SAVE_BEFORE_UPDATE, handleSaveBeforeUpdate);

    return () => {
  unsubscribe();
    };
  }, [lyrics]); // Only include lyrics in dependency array since handleSave is stable

  // Listen for save-after-streaming events triggered after streaming completion
  useEffect(() => {
    const handleSaveAfterStreaming = (event) => {


      // Only trigger save if the event is from streaming completion and we have lyrics
      if (event.detail?.source === 'streaming-complete' && lyrics && lyrics.length > 0) {


        // Trigger the save function to preserve the new streaming results
        handleSave().then(() => {

          // Update the saved state to gray out the save button
          updateSavedLyrics();
        }).catch((error) => {
          console.error('[LyricsDisplay] Error during auto-save after streaming:', error);
        });
      }
    };

  const unsubscribe2 = subscribe(EVENTS.SAVE_AFTER_STREAMING, handleSaveAfterStreaming);

    return () => {
  unsubscribe2();
    };
  }, [lyrics]); // Only include lyrics in dependency array since handleSave is stable

  return { handleSave };
};

export default useLyricsSave;
