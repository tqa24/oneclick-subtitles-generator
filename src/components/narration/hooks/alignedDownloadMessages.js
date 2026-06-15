/**
 * Pure translators for aligned-narration download progress messages.
 *
 * Extracted from the generation hook so the streaming/download logic stays focused. Each function
 * takes the server progress payload plus the i18n `t` function and returns a display string.
 */

/**
 * Translate an aligned-download progress payload into a localized status message.
 * @param {Object} progressData - Server progress payload.
 * @param {Function} t - i18n translate function.
 * @returns {string}
 */
export const translateAlignedDownloadMessage = (progressData = {}, t) => {
  const fallbackMessages = {
    pending: 'Preparing aligned narration download...',
    queued: 'Queued aligned audio download...',
    starting: 'Preparing aligned narration download...',
    resolving: 'Resolving audio segments...',
    'loading-durations': 'Loading audio durations...',
    'analyzing-overlaps': 'Analyzing overlaps...',
    rendering: 'Rendering aligned audio timeline...',
    finalizing: 'Finalizing aligned audio file...',
    measuring: 'Measuring final audio duration...',
    completed: 'Aligned audio ready. Starting download...',
  };

  if (progressData.messageKey) {
    const translationKey = progressData.messageKey.includes('.')
      ? progressData.messageKey
      : `narration.${progressData.messageKey}`;
    const defaultMessage =
      progressData.message ||
      fallbackMessages[progressData.status] ||
      'Downloading audio...';

    return t(
      translationKey,
      defaultMessage,
      progressData.messageParams || {},
    );
  }

  switch (progressData.status) {
    case 'queued':
      return t(
        'narration.alignedDownloadQueued',
        fallbackMessages.queued,
      );
    case 'starting':
    case 'pending':
      return t(
        'narration.alignedDownloadPreparing',
        fallbackMessages.starting,
      );
    case 'resolving':
      return t(
        'narration.alignedDownloadResolving',
        fallbackMessages.resolving,
      );
    case 'loading-durations':
      return t(
        'narration.alignedDownloadLoadingDurations',
        fallbackMessages['loading-durations'],
      );
    case 'analyzing-overlaps':
      return t(
        'narration.alignedDownloadAnalyzingOverlaps',
        fallbackMessages['analyzing-overlaps'],
      );
    case 'rendering':
      return t(
        'narration.alignedDownloadRendering',
        fallbackMessages.rendering,
      );
    case 'finalizing':
      return t(
        'narration.alignedDownloadFinalizing',
        fallbackMessages.finalizing,
      );
    case 'measuring':
      return t(
        'narration.alignedDownloadMeasuring',
        fallbackMessages.measuring,
      );
    case 'completed':
      return t(
        'narration.alignedDownloadReady',
        fallbackMessages.completed,
      );
    case 'error':
      if (progressData.error) {
        return t(
          'narration.alignedDownloadFailed',
          'Error downloading aligned audio: {{error}}',
          { error: progressData.error },
        );
      }
      break;
    default:
      break;
  }

  return progressData.message || t(
    'narration.downloading',
    'Downloading audio...',
  );
};

/**
 * Build the "{{current}}/{{total}} segments" detail line, or '' when no segment totals are known.
 * @param {Object} progressData - Server progress payload.
 * @param {Function} t - i18n translate function.
 * @returns {string}
 */
export const getAlignedDownloadSegmentDetail = (progressData = {}, t) => {
  const totalSegments = Number(progressData.totalSegments);
  if (!Number.isFinite(totalSegments) || totalSegments <= 0) {
    return '';
  }

  const processedSegments = Number(progressData.processedSegments);
  const current = Number.isFinite(processedSegments)
    ? Math.max(0, Math.min(totalSegments, processedSegments))
    : 0;

  return t(
    'narration.alignedDownloadSegmentProgress',
    '{{current}}/{{total}} segments',
    {
      current,
      total: totalSegments,
    },
  );
};
