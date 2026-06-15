import { renderSubtitlesToVideo, downloadVideo } from '../../utils/videoUtils';
import { convertTimeStringToSeconds } from '../../utils/vttUtils';

/**
 * Factory helpers for the "download video with burned-in subtitles" actions.
 * Each returns an async handler closing over the parent's state setters/props.
 * Behaviour is moved verbatim from VideoPreview.
 */

/**
 * Build the handler that renders + downloads the video with the original
 * (source-language) subtitles.
 */
export const createDownloadWithSubtitlesHandler = ({
  videoUrl,
  subtitlesArray,
  subtitleSettings,
  videoSource,
  t,
  setError,
  setIsRenderingVideo,
  setRenderProgress,
}) => async () => {
  if (!videoUrl || !subtitlesArray || subtitlesArray.length === 0) {
    setError(t('videoPreview.noSubtitlesToRender', 'No subtitles to render'));
    return;
  }

  setIsRenderingVideo(true);
  setRenderProgress(0);
  setError('');

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
    setError(t('videoPreview.renderError', 'Error rendering subtitles: {{error}}', { error: err.message }));
  } finally {
    setIsRenderingVideo(false);
  }
};

/**
 * Build the handler that renders + downloads the video with the translated
 * subtitles, reusing original subtitle timings where available.
 */
export const createDownloadWithTranslatedSubtitlesHandler = ({
  videoUrl,
  subtitlesArray,
  translatedSubtitles,
  subtitleSettings,
  videoSource,
  t,
  setError,
  setIsRenderingVideo,
  setRenderProgress,
}) => async () => {
  if (!videoUrl || !translatedSubtitles || translatedSubtitles.length === 0) {
    setError(t('videoPreview.noTranslatedSubtitles', 'No translated subtitles available'));
    return;
  }

  setIsRenderingVideo(true);
  setRenderProgress(0);
  setError('');

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
    setError(t('videoPreview.renderError', 'Error rendering subtitles: {{error}}', { error: err.message }));
  } finally {
    setIsRenderingVideo(false);
  }
};
