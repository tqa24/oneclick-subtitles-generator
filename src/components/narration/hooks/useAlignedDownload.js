import { createSimpleLoadingOverlay } from '../utils/loadingOverlayFactory';
import { hydrateNarrationResultsForAlignment } from '../../../utils/narrationAlignmentUtils';
import { checkAudioAlignmentFromResponse } from '../../../utils/audioAlignmentNotification';
import {
  translateAlignedDownloadMessage,
  getAlignedDownloadSegmentDetail,
} from './alignedDownloadMessages';

/**
 * Aligned-narration download flow.
 *
 * Renders the aligned audio file on the server and triggers a native browser download of it.
 * The progress message/segment-detail translators live in ./alignedDownloadMessages.
 *
 * @param {Object} params - State/setters threaded from the generation hook.
 * @returns {{ downloadAlignedAudio: Function }}
 */
const useAlignedDownload = ({
  generationResults,
  getSelectedSubtitles,
  t,
}) => {
  // Download aligned narration audio (one file)
  const downloadAlignedAudio = async () => {
    // Check if we have any generation results
    if (!generationResults || generationResults.length === 0) {
      alert(t('narration.noResults', 'No narration results to download'));
      return;
    }

    // Create a React-based loading overlay
    const loadingOverlay = createSimpleLoadingOverlay(
      t(
        'narration.alignedDownloadPreparing',
        'Preparing aligned narration download...',
      ),
    );
    const alignedJobId = `aligned_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    let progressPollInterval = null;
    let requestTimeoutId = null;

    try {
      // Get the server URL from the narration service
      const { SERVER_URL } = require('../../../config');

      // Get all subtitles from the video for timing information
      // Check if we're using grouped subtitles (same logic as VideoRenderingSection.js)
      const isUsingGroupedSubtitles = window.useGroupedSubtitles || false;
      const allSubtitles = isUsingGroupedSubtitles && window.groupedSubtitles ?
        window.groupedSubtitles :
        (window.subtitlesData || window.originalSubtitles || window.subtitles || []);

      // First try to get subtitles from the getSelectedSubtitles function if no grouped subtitles
      if (allSubtitles.length === 0) {
        const selectedSubtitles = getSelectedSubtitles();
        if (selectedSubtitles && Array.isArray(selectedSubtitles) && selectedSubtitles.length > 0) {
          allSubtitles.push(...selectedSubtitles);
        }
      }

      // Also try translated subtitles if no other subtitles found
      if (allSubtitles.length === 0 && window.translatedSubtitles && Array.isArray(window.translatedSubtitles)) {
        allSubtitles.push(...window.translatedSubtitles);
      }

      console.log(`Download aligned: Using ${isUsingGroupedSubtitles ? 'grouped' : 'individual'} subtitles. Found ${allSubtitles.length} subtitles.`);

      // Create a map for faster lookup
      const subtitleMap = {};
      allSubtitles.forEach(sub => {
        if (sub.id !== undefined) {
          subtitleMap[sub.id] = sub;
        }
      });



      // Prepare the data for the aligned narration with correct timing
      const narrationData = hydrateNarrationResultsForAlignment(generationResults)
        .filter(result => result.success && result.filename)
        .map(result => {
          // Get the correct subtitle ID from the result
          const subtitleId = result.subtitle_id;
          const isGrouped = result.original_ids && result.original_ids.length > 1;

          // Find the corresponding subtitle for timing information
          let subtitle = subtitleMap[subtitleId];

          // If this is a grouped subtitle and we couldn't find it directly in the map,
          // we might need to calculate its timing from the original subtitles
          if (!subtitle && isGrouped && result.original_ids) {
            console.log(`Download aligned: Handling grouped subtitle ${subtitleId} with ${result.original_ids.length} original IDs`);

            // Get all the original subtitles that are part of this group
            const originalSubtitles = result.original_ids
              .map(id => subtitleMap[id])
              .filter(Boolean);

            if (originalSubtitles.length > 0) {
              // Calculate start and end times from the original subtitles
              const start = Math.min(...originalSubtitles.map(sub => sub.start));
              const end = Math.max(...originalSubtitles.map(sub => sub.end));

              // Create a synthetic subtitle with the calculated timing
              subtitle = {
                id: subtitleId,
                start,
                end,
                text: result.text
              };

              console.log(`Download aligned: Created synthetic timing for grouped subtitle ${subtitleId}: start=${start}, end=${end}`);
            }
          }

          // If we found a matching subtitle or created synthetic timing, use it.
          // NOTE: use Number.isFinite, not typeof === 'number' — typeof NaN is 'number', and a NaN
          // start/end here propagates into the server timeline math, producing an invalid ffmpeg
          // filter that hangs the aligned render (the download appears frozen at 0%).
          if (subtitle && Number.isFinite(subtitle.start) && Number.isFinite(subtitle.end) && subtitle.end > subtitle.start) {
            return {
              filename: result.filename,
              subtitle_id: result.subtitle_id,
              start: subtitle.start,
              end: subtitle.end,
              text: subtitle.text || result.text || '',
              // Preserve original_ids if they exist
              original_ids: result.original_ids || [subtitleId]
            };
          }

          // Otherwise, use existing timing or defaults
          return {
            filename: result.filename,
            subtitle_id: result.subtitle_id,
            start: result.start || 0,
            end: result.end || (result.start ? result.start + 5 : 5),
            text: result.text || '',
            // Preserve original_ids if they exist
            original_ids: result.original_ids || [subtitleId]
          };
        });

      // Sort by start time to ensure correct order
      narrationData.sort((a, b) => a.start - b.start);

      if (narrationData.length === 0) {
        alert(t('narration.noResults', 'No narration results to download'));
        return;
      }


      // Render the aligned file on the server, then trigger a NATIVE browser download of it.
      // We deliberately do NOT pull the audio bytes into JS via response.blob(): buffering a
      // multi-MB body through fetch is slow/unstable in some environments (a network-capturing
      // browser extension can pin the main thread on it) and is pointless — the browser can fetch
      // the file directly. So we POST to /generate-aligned (which returns a small JSON with the
      // file URL) and then let the browser download that URL natively. The ?download flag makes the
      // server serve it as an attachment.
      const generateUrl = `${SERVER_URL}/api/narration/generate-aligned`;
      const progressUrl = `${SERVER_URL}/api/narration/aligned-progress/${encodeURIComponent(alignedJobId)}`;

      const pollAlignedProgress = async () => {
        try {
          const progressResponse = await fetch(progressUrl, { method: 'GET', mode: 'cors', credentials: 'include' });
          if (!progressResponse.ok) return;
          const progressData = await progressResponse.json();
          loadingOverlay.updateProgress({
            message: translateAlignedDownloadMessage(progressData, t),
            detail: getAlignedDownloadSegmentDetail(progressData, t),
          });
        } catch (progressError) {
          console.warn('Aligned download progress polling error:', progressError);
        }
      };

      progressPollInterval = window.setInterval(pollAlignedProgress, 800);

      const abortController = new AbortController();
      // Aligned audio is a fast audio-only concat render (seconds even for long timelines), so a
      // multi-minute wait means something is wrong. Abort after 5 min so the user gets a retryable
      // error instead of an indefinitely stuck overlay.
      requestTimeoutId = window.setTimeout(() => {
        abortController.abort();
      }, 5 * 60 * 1000);

      const response = await fetch(generateUrl, {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        signal: abortController.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          narrations: narrationData,
          format: 'wav',
          jobId: alignedJobId,
        }),
      });

      if (progressPollInterval) {
        window.clearInterval(progressPollInterval);
        progressPollInterval = null;
      }

      if (!response.ok) {
        let message = `Failed to create aligned audio: ${response.statusText}`;
        try {
          const errorData = await response.json();
          message = errorData.error || message;
        } catch (jsonError) { /* keep statusText */ }
        throw new Error(message);
      }

      // Small JSON response: { url, filename, durationDifference, ... } — no large body to buffer.
      const result = await response.json();
      if (!result || !result.url) {
        throw new Error('Aligned audio generation did not return a file URL');
      }

      loadingOverlay.destroy();

      // Trigger a native browser download of the generated file. The ?download flag makes the
      // server send Content-Disposition: attachment (the anchor's download attribute is ignored
      // cross-origin, so we rely on that header). The browser downloads the file directly to disk
      // without it ever passing through page JavaScript.
      const sep = result.url.includes('?') ? '&' : '?';
      const fileUrl = `${SERVER_URL}${result.url}${sep}download=${encodeURIComponent('aligned_narration.wav')}`;
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = 'aligned_narration.wav';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) document.body.removeChild(a);
      }, 1000);

      // Non-critical: warn (via toast) if the aligned audio ended up notably longer than expected.
      // The X-* duration headers are present on the generate-aligned response too.
      checkAudioAlignmentFromResponse(response);
    } catch (error) {
      console.error('Error downloading aligned audio:', error);
      if (error?.name === 'AbortError') {
        alert(
          t(
            'narration.alignedDownloadTimedOut',
            'Aligned audio download timed out. Please try again.',
          ),
        );
      } else {
        alert(
          t(
            'narration.alignedDownloadFailed',
            'Error downloading aligned audio: {{error}}',
            {
              error: error.message,
            },
          ),
        );
      }
    } finally {
      if (progressPollInterval) {
        window.clearInterval(progressPollInterval);
      }
      if (requestTimeoutId) {
        window.clearTimeout(requestTimeoutId);
      }
      // Remove loading overlay
      loadingOverlay.destroy();
    }
  };

  return { downloadAlignedAudio };
};

export default useAlignedDownload;
